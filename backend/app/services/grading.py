"""Main grading service orchestrating the evaluation process."""

import asyncio
import uuid
import math
from typing import Dict, List, Union, AsyncGenerator
from collections import Counter

from app.core.config import settings
from app.models import (
    RubricItem, RubricType, GradingDecision, PartialResult,
    CheckboxVerdict, RadioVerdict, RubricDecision, Evidence
)
from app.services.llm.service import LLMService
from app.services.preprocessing import PreprocessingService
from app.services.rubric_loader import RubricLoaderService
from app.services.caveat_service import CaveatService


class GradingService:
    """Service for orchestrating the grading process."""
    
    def __init__(self):
        self.llm_service = LLMService()
        self.preprocessing_service = PreprocessingService()
        self.rubric_loader = RubricLoaderService()
        self.caveat_service = CaveatService()
    
    def _estimate_batch_load(self, batch_size: int) -> Dict[str, int]:
        """Estimate the API load for a batch."""
        total_requests = batch_size * settings.parallel_llm_calls
        estimated_tokens = total_requests * 2000  # ~2000 tokens per request
        
        return {
            "requests": total_requests,
            "tokens": estimated_tokens,
            "batch_size": batch_size
        }
    
    def _optimize_batch_size(self, total_items: int) -> int:
        """Optimize batch size based on total items and API limits."""
        # Calculate maximum possible batch size based on API limits
        max_requests_per_batch = settings.max_requests_per_minute // 6  # Conservative: 6 batches per minute max
        max_tokens_per_batch = settings.max_tokens_per_minute // 6  # Conservative: 6 batches per minute max
        
        # Calculate limits based on our parallel calls
        max_batch_by_requests = max_requests_per_batch // settings.parallel_llm_calls
        max_batch_by_tokens = max_tokens_per_batch // (settings.parallel_llm_calls * 2000)
        
        # Take the minimum of all constraints
        api_limited_batch_size = min(max_batch_by_requests, max_batch_by_tokens)
        
        # Use the smaller of configured batch_size, API limits, or total items
        optimal_batch_size = min(settings.batch_size, api_limited_batch_size, total_items)
        
        # If we have very few items, just use total_items
        if total_items <= settings.batch_size:
            optimal_batch_size = total_items
            
        print(f"📊 Batch Size Optimization:")
        print(f"   • Configured batch size: {settings.batch_size}")
        print(f"   • Total rubric items: {total_items}")
        print(f"   • API-limited batch size: {api_limited_batch_size}")
        print(f"   • Optimal batch size: {optimal_batch_size}")
        
        return optimal_batch_size
    
    async def grade_submission(
        self,
        course_id: str,
        assignment_id: str,
        submission_id: str,
        source_files: Dict[str, str],
        rubric_items: List[RubricItem]
    ) -> AsyncGenerator[PartialResult, None]:
        """
        Grade a submission by evaluating rubric items in parallel batches.
        
        Yields PartialResult objects as batches are processed.
        """
        # Preprocess the submission
        processed_files = await self.preprocessing_service.preprocess_submission(
            course_id, assignment_id, submission_id, source_files
        )
        
        # Load full rubric sections for context
        full_rubric_sections = self.rubric_loader.load_full_rubric_sections(assignment_id)
        
        total_items = len(rubric_items)
        completed_items = 0
        
        # Optimize batch size based on total items and API limits
        optimal_batch_size = self._optimize_batch_size(total_items)
        total_batches = math.ceil(total_items / optimal_batch_size)
        
        # Log concise batch processing plan
        print(f"🚀 Processing {total_items} rubric items in {total_batches} batches (size: {optimal_batch_size})")
        
        batch_start_time = asyncio.get_event_loop().time()
        
        # Process rubric items in batches using optimal batch size
        for batch_num, batch_start in enumerate(range(0, total_items, optimal_batch_size), 1):
            batch_end = min(batch_start + optimal_batch_size, total_items)
            batch = rubric_items[batch_start:batch_end]
            actual_batch_size = len(batch)
            
            print(f"📦 Batch {batch_num}/{total_batches}: processing {actual_batch_size} items...")
            
            # Process entire batch in parallel
            batch_task_start = asyncio.get_event_loop().time()
            
            batch_tasks = []
            for rubric_item in batch:
                task = self._evaluate_rubric_item(rubric_item, processed_files, full_rubric_sections)
                batch_tasks.append((rubric_item, task))
            
            # Execute all tasks in the batch simultaneously
            batch_results = await asyncio.gather(
                *[task for _, task in batch_tasks], 
                return_exceptions=True
            )
            
            batch_task_end = asyncio.get_event_loop().time()
            batch_duration = batch_task_end - batch_task_start
            
            # Process results and yield partial results
            for i, ((rubric_item, _), result) in enumerate(zip(batch_tasks, batch_results)):
                completed_items += 1
                progress = completed_items / total_items
                
                if isinstance(result, Exception):
                    print(f"❌ Batch processing failed for rubric item {rubric_item.id}: {result}")
                    decision = self._create_fallback_decision(rubric_item)
                else:
                    decision = result
                
                yield PartialResult(
                    type="partial_result",
                    rubric_item_id=rubric_item.id,
                    decision=decision,
                    progress=progress
                )
            
            print(f"✅ Batch {batch_num}/{total_batches} completed in {batch_duration:.2f}s ({actual_batch_size} items)")
            
            # Add small delay between batches if configured and more batches remain
            if batch_num < total_batches and settings.batch_processing_delay > 0:
                await asyncio.sleep(settings.batch_processing_delay)
        
        total_duration = asyncio.get_event_loop().time() - batch_start_time
        print(f"🎉 All batches completed in {total_duration:.2f}s (avg: {total_duration/total_batches:.2f}s per batch)")
        
        # Send completion event
        yield PartialResult(
            type="job_complete",
            message=f"Grading completed - {total_items} items in {total_batches} batches ({total_duration:.1f}s)",
            progress=1.0
        )
    
    async def _evaluate_rubric_item(
        self,
        rubric_item: RubricItem,
        processed_files: Dict[str, str],
        full_rubric_sections: Dict[str, List[RubricItem]]
    ) -> GradingDecision:
        """Evaluate a single rubric item with multiple LLM calls and voting."""
        
        # Determine which section this rubric item belongs to
        section_name = self.rubric_loader.get_section_for_rubric_item(rubric_item, full_rubric_sections)
        section_items = full_rubric_sections.get(section_name, [])
        
        # Format the section context
        section_context = self.rubric_loader.format_section_context(section_items) if section_items else None
        
        # Search for relevant caveats
        relevant_caveats = await self.caveat_service.search_caveats(
            rubric_question=rubric_item.description,
            top_k=3,
            similarity_threshold=0.7
        )
        
        # Launch parallel LLM evaluations
        tasks = []
        for _ in range(settings.parallel_llm_calls):
            task = self.llm_service.evaluate_rubric_item(
                rubric_type=rubric_item.type,
                rubric_description=rubric_item.description,
                rubric_points=rubric_item.points,
                rubric_options=rubric_item.options,
                source_files=processed_files,
                section_context=section_context,
                caveats=relevant_caveats  # Pass caveats to LLM
            )
            tasks.append(task)
        
        # Wait for all evaluations
        verdicts = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and log them
        valid_verdicts = []
        failed_count = 0
        for i, result in enumerate(verdicts):
            if isinstance(result, Exception):
                failed_count += 1
                print(f"❌ LLM call {i+1} failed for rubric item {rubric_item.id}: {type(result).__name__}: {result}")
            else:
                valid_verdicts.append(result)
        
        if failed_count > 0:
            print(f"⚠️  Rubric item {rubric_item.id}: {len(valid_verdicts)}/{len(verdicts)} LLM calls succeeded")
        else:
            print(f"✅ Rubric item {rubric_item.id}: All {len(verdicts)} LLM calls succeeded")
        
        if not valid_verdicts:
            # All calls failed, return low-confidence decision
            print(f"⚠️ All LLM calls failed for rubric item {rubric_item.id}, using fallback decision")
            return self._create_fallback_decision(rubric_item)
        
        # Perform majority voting
        final_verdict, confidence = self._majority_vote(valid_verdicts, rubric_item.type)
        
        # Create grading decision
        return GradingDecision(
            rubric_item_id=rubric_item.id,
            type=rubric_item.type,
            verdict=final_verdict,
            confidence=confidence,
            reasoning=self._generate_reasoning(valid_verdicts)
        )
    
    def _majority_vote(
        self,
        verdicts: List[Union[CheckboxVerdict, RadioVerdict]],
        rubric_type: RubricType
    ) -> tuple[Union[CheckboxVerdict, RadioVerdict], float]:
        """Perform majority voting on verdicts."""
        
        if rubric_type == RubricType.CHECKBOX:
            # Vote on checkbox decisions
            decisions = [v.decision for v in verdicts]
            decision_counts = Counter(decisions)
            
            # Get majority decision
            majority_decision = decision_counts.most_common(1)[0][0]
            majority_count = decision_counts[majority_decision]
            
            # Find verdict with majority decision and highest confidence
            matching_verdicts = [v for v in verdicts if v.decision == majority_decision]
            best_verdict = max(matching_verdicts, key=lambda v: v.confidence)
            
            # Calculate confidence based on agreement
            confidence = (majority_count / len(verdicts)) * (best_verdict.confidence / 100)
            
            return best_verdict, confidence
        
        else:  # RADIO
            # Vote on selected options
            options = [v.selected_option for v in verdicts]
            option_counts = Counter(options)
            
            # Check for ties
            top_options = option_counts.most_common(2)
            if len(top_options) > 1 and top_options[0][1] == top_options[1][1]:
                # Tie - pick any with low confidence
                tied_option = top_options[0][0]
                matching_verdicts = [v for v in verdicts if v.selected_option == tied_option]
                best_verdict = matching_verdicts[0]
                confidence = 0.5  # Low confidence due to tie
            else:
                # Clear winner
                majority_option = top_options[0][0]
                majority_count = top_options[0][1]
                
                matching_verdicts = [v for v in verdicts if v.selected_option == majority_option]
                best_verdict = max(matching_verdicts, key=lambda v: v.confidence)
                
                confidence = (majority_count / len(verdicts)) * (best_verdict.confidence / 100)
            
            return best_verdict, confidence
    
    def _create_fallback_decision(self, rubric_item: RubricItem) -> GradingDecision:
        """Create a fallback decision when all LLM calls fail."""
        
        if rubric_item.type == RubricType.CHECKBOX:
            # Default to not deducting points
            verdict = CheckboxVerdict(
                decision=RubricDecision.CHECK,
                evidence=Evidence(file="unknown", lines="0-0"),
                comment="Unable to evaluate automatically - please review manually",
                confidence=0
            )
        else:
            # Default to first option (usually full credit) - should be letter "Q"
            first_option = list(rubric_item.options.keys())[0] if rubric_item.options else "Q"
            verdict = RadioVerdict(
                selected_option=first_option,
                evidence=Evidence(file="unknown", lines="0-0"),
                comment="Unable to evaluate automatically - please review manually",
                confidence=0
            )
        
        return GradingDecision(
            rubric_item_id=rubric_item.id,
            type=rubric_item.type,
            verdict=verdict,
            confidence=0.0,
            reasoning="All LLM evaluation attempts failed"
        )
    
    def _generate_reasoning(self, verdicts: List[Union[CheckboxVerdict, RadioVerdict]]) -> str:
        """Generate internal reasoning based on verdicts."""
        
        if not verdicts:
            return "No valid evaluations"
        
        # Count agreements
        if isinstance(verdicts[0], CheckboxVerdict):
            decisions = [v.decision for v in verdicts]
            decision_counts = Counter(decisions)
            reasoning = f"Voting results: {dict(decision_counts)}"
        else:
            options = [v.selected_option for v in verdicts]
            option_counts = Counter(options)
            reasoning = f"Voting results: {dict(option_counts)}"
        
        # Add confidence info
        confidences = [v.confidence for v in verdicts]
        avg_confidence = sum(confidences) / len(confidences)
        reasoning += f". Average confidence: {avg_confidence:.1f}%"
        
        return reasoning 