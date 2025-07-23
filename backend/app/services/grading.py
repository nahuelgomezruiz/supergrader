"""Main grading service orchestrating the evaluation process."""

import asyncio
import uuid
from typing import Dict, List, Union, AsyncGenerator
from collections import Counter

from app.core.config import settings
from app.models import (
    RubricItem, RubricType, GradingDecision, PartialResult,
    CheckboxVerdict, RadioVerdict, RubricDecision, Evidence
)
from app.services.llm import LLMService
from app.services.preprocessing import PreprocessingService


class GradingService:
    """Service for orchestrating the grading process."""
    
    def __init__(self):
        self.llm_service = LLMService()
        self.preprocessing_service = PreprocessingService()
    
    async def grade_submission(
        self,
        course_id: str,
        assignment_id: str,
        submission_id: str,
        source_files: Dict[str, str],
        rubric_items: List[RubricItem]
    ) -> AsyncGenerator[PartialResult, None]:
        """
        Grade a submission by evaluating each rubric item.
        
        Yields PartialResult objects as items are processed.
        """
        # Preprocess the submission
        processed_files = await self.preprocessing_service.preprocess_submission(
            course_id, assignment_id, submission_id, source_files
        )
        
        total_items = len(rubric_items)
        completed_items = 0
        
        # Process each rubric item
        for rubric_item in rubric_items:
            # Evaluate the rubric item with multiple LLM calls
            decision = await self._evaluate_rubric_item(
                rubric_item, processed_files
            )
            
            completed_items += 1
            progress = completed_items / total_items
            
            # Yield partial result
            yield PartialResult(
                type="partial_result",
                rubric_item_id=rubric_item.id,
                decision=decision,
                progress=progress
            )
        
        # Send completion event
        yield PartialResult(
            type="job_complete",
            message="Grading completed successfully",
            progress=1.0
        )
    
    async def _evaluate_rubric_item(
        self,
        rubric_item: RubricItem,
        processed_files: Dict[str, str]
    ) -> GradingDecision:
        """Evaluate a single rubric item with multiple LLM calls and voting."""
        
        # Launch parallel LLM evaluations
        tasks = []
        for _ in range(settings.parallel_llm_calls):
            task = self.llm_service.evaluate_rubric_item(
                rubric_type=rubric_item.type,
                rubric_description=rubric_item.description,
                rubric_points=rubric_item.points,
                rubric_options=rubric_item.options,
                source_files=processed_files
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
        
        print(f"📊 Rubric item {rubric_item.id}: {len(valid_verdicts)}/{len(verdicts)} LLM calls succeeded")
        
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
            # Default to first option (usually full credit)
            first_option = list(rubric_item.options.keys())[0] if rubric_item.options else "unknown"
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