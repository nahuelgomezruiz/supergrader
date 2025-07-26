#!/usr/bin/env python3
"""
Performance test script to compare sequential vs concurrent batch processing.

This script demonstrates the performance improvements achieved by processing 
multiple students concurrently across different assignments and projects.
"""

import asyncio
import time
from pathlib import Path
from evaluation_dashboard import (
    BackendClient, collect_evaluation_tasks, process_evaluation_batch, 
    evaluate_project, DEFAULT_CONCURRENT_BATCH_SIZE
)


async def test_performance_comparison(projects_dir: Path, num_students: int = 10):
    """Compare performance between sequential and concurrent processing."""
    
    print("🧪 Performance Comparison Test")
    print("=" * 50)
    
    # Create backend client
    backend_client = BackendClient("http://localhost:8000")
    
    # Test backend connection
    try:
        health_status = await backend_client.check_health()
        print(f"✅ Backend connection successful")
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        print("Make sure the backend server is running!")
        return
    
    # Collect all tasks first
    print(f"\n📋 Collecting evaluation tasks...")
    all_tasks = await collect_evaluation_tasks(projects_dir, num_students)
    
    if len(all_tasks) < 10:
        print(f"❌ Need at least 10 tasks for meaningful comparison, found {len(all_tasks)}")
        return
    
    # Take a sample of tasks for testing
    test_tasks = all_tasks[:min(40, len(all_tasks))]  # Test with up to 40 tasks
    print(f"🎯 Testing with {len(test_tasks)} evaluation tasks")
    
    # Test 1: Sequential Processing (simulating original approach)
    print(f"\n🐌 Test 1: Sequential Processing")
    print("-" * 30)
    sequential_start = time.time()
    
    sequential_results = []
    for i, task in enumerate(test_tasks):
        print(f"  Processing task {i+1}/{len(test_tasks)}: {task.project_name}/{task.csv_name}/{task.student_id}")
        try:
            result = await backend_client.grade_submission(
                assignment_context=task.assignment_context,
                source_files=task.source_files,
                rubric_items=task.rubric_items
            )
            sequential_results.append((task, result))
        except Exception as e:
            print(f"    ❌ Error: {e}")
            sequential_results.append((task, None))
    
    sequential_duration = time.time() - sequential_start
    sequential_successful = len([r for r in sequential_results if r[1] is not None])
    
    print(f"✅ Sequential completed in {sequential_duration:.1f}s")
    print(f"   Successful: {sequential_successful}/{len(test_tasks)}")
    print(f"   Average time per task: {sequential_duration/len(test_tasks):.2f}s")
    
    # Test 2: Concurrent Processing (new optimized approach)
    print(f"\n🚀 Test 2: Concurrent Processing")
    print("-" * 30)
    
    # Test different batch sizes
    batch_sizes = [5, 10, 20]
    if len(test_tasks) >= 30:
        batch_sizes.append(30)
    
    best_batch_size = DEFAULT_CONCURRENT_BATCH_SIZE
    best_time = float('inf')
    
    for batch_size in batch_sizes:
        if batch_size > len(test_tasks):
            continue
            
        print(f"\n  Testing batch size: {batch_size}")
        concurrent_start = time.time()
        
        # Process in batches
        concurrent_results = []
        total_batches = (len(test_tasks) + batch_size - 1) // batch_size
        
        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min(start_idx + batch_size, len(test_tasks))
            batch_tasks = test_tasks[start_idx:end_idx]
            
            batch_results = await process_evaluation_batch(
                batch_tasks, backend_client, batch_num + 1, total_batches
            )
            concurrent_results.extend(batch_results)
        
        concurrent_duration = time.time() - concurrent_start
        concurrent_successful = len([r for r in concurrent_results if r[1] is not None])
        
        print(f"  ✅ Batch size {batch_size}: {concurrent_duration:.1f}s")
        print(f"     Successful: {concurrent_successful}/{len(test_tasks)}")
        print(f"     Average time per task: {concurrent_duration/len(test_tasks):.2f}s")
        print(f"     Throughput: {len(test_tasks)/concurrent_duration:.1f} tasks/second")
        
        if concurrent_duration < best_time:
            best_time = concurrent_duration
            best_batch_size = batch_size
    
    # Summary
    print(f"\n🎉 Performance Comparison Summary")
    print("=" * 50)
    print(f"Sequential Processing:")
    print(f"  ⏱️  Total time: {sequential_duration:.1f}s")
    print(f"  📊 Throughput: {len(test_tasks)/sequential_duration:.1f} tasks/second")
    print(f"  ✅ Success rate: {sequential_successful/len(test_tasks)*100:.1f}%")
    
    print(f"\nConcurrent Processing (best: batch size {best_batch_size}):")
    print(f"  ⏱️  Total time: {best_time:.1f}s")
    print(f"  📊 Throughput: {len(test_tasks)/best_time:.1f} tasks/second")
    print(f"  ✅ Success rate: {concurrent_successful/len(test_tasks)*100:.1f}%")
    
    speedup = sequential_duration / best_time
    print(f"\n🚀 Performance Improvement:")
    print(f"  ⚡ Speedup: {speedup:.1f}x faster")
    print(f"  📈 Time saved: {sequential_duration - best_time:.1f}s ({(1-best_time/sequential_duration)*100:.1f}%)")
    
    if speedup >= 2.0:
        print(f"  🎯 Excellent optimization! {speedup:.1f}x speedup achieved")
    elif speedup >= 1.5:
        print(f"  ✅ Good optimization! {speedup:.1f}x speedup achieved")
    else:
        print(f"  ⚠️  Modest improvement. Consider increasing batch size or checking network latency.")
    
    await backend_client.close()


async def main():
    """Main function to run performance tests."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test concurrent processing performance")
    parser.add_argument("--projects-dir", type=str, default="evaluation_projects",
                        help="Directory containing project folders")
    parser.add_argument("--num-students", type=int, default=10,
                        help="Number of students to test per assignment")
    
    args = parser.parse_args()
    
    projects_dir = Path(args.projects_dir)
    if not projects_dir.exists():
        print(f"❌ Projects directory not found: {projects_dir}")
        return
    
    await test_performance_comparison(projects_dir, args.num_students)


if __name__ == "__main__":
    asyncio.run(main()) 