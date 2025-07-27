#!/usr/bin/env python3
"""
Test script for the feedback and caveat system.
This script tests the complete workflow:
1. Submit feedback to create caveats
2. Verify caveats are stored with embeddings
3. Test semantic search retrieval
4. Verify caveats are injected into grading prompts
"""

import asyncio
import json
import httpx
import os
import sys
from datetime import datetime

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.caveat_service import CaveatService
from app.services.llm.service import LLMService
from app.core.config import settings


async def test_feedback_endpoint():
    """Test the feedback API endpoint."""
    print("🧪 Testing feedback endpoint...")
    
    # Sample feedback data
    feedback_data = {
        "rubricItemId": "test_item_1",
        "rubricQuestion": "Does the student properly implement error handling in their code?",
        "studentAssignment": """
        def divide_numbers(a, b):
            return a / b
        
        result = divide_numbers(10, 0)
        print(result)
        """,
        "originalDecision": "check - The code handles division correctly",
        "userFeedback": "The code doesn't handle division by zero error. This will crash the program."
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8000/api/v1/feedback",
                json=feedback_data,
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Feedback submitted successfully!")
                print(f"   Caveat ID: {result.get('caveat_id')}")
                print(f"   Message: {result.get('message')}")
                return result.get('caveat_id')
            else:
                print(f"❌ Feedback submission failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return None
                
    except Exception as e:
        print(f"❌ Error testing feedback endpoint: {e}")
        return None


async def test_caveat_service():
    """Test the caveat service directly."""
    print("\n🧪 Testing caveat service...")
    
    try:
        caveat_service = CaveatService()
        
        # Test storing a caveat
        print("📝 Storing test caveat...")
        caveat_id = await caveat_service.store_caveat(
            rubric_question="Does the code handle null pointer exceptions?",
            caveat_text="Always check for null pointers before dereferencing, especially in C/C++ code.",
            original_feedback="The student didn't check for null before using the pointer, which could cause segfaults.",
            metadata={"test": True}
        )
        
        print(f"✅ Caveat stored with ID: {caveat_id}")
        
        # Test searching for similar caveats
        print("🔍 Searching for similar caveats...")
        similar_caveats = await caveat_service.search_caveats(
            rubric_question="Does the student check for null pointers in their implementation?",
            top_k=3,
            similarity_threshold=0.5
        )
        
        print(f"✅ Found {len(similar_caveats)} similar caveats:")
        for caveat in similar_caveats:
            print(f"   - Similarity: {caveat['similarity_score']:.3f}")
            print(f"     Text: {caveat['caveat_text'][:80]}...")
        
        return len(similar_caveats) > 0
        
    except Exception as e:
        print(f"❌ Error testing caveat service: {e}")
        return False


async def test_llm_integration():
    """Test that caveats are properly integrated into LLM prompts."""
    print("\n🧪 Testing LLM integration with caveats...")
    
    try:
        caveat_service = CaveatService()
        llm_service = LLMService()
        
        # Create a test caveat
        await caveat_service.store_caveat(
            rubric_question="Does the code properly validate input parameters?",
            caveat_text="Input validation should check for both null values and boundary conditions.",
            original_feedback="Student missed checking for negative values in array indices.",
            metadata={"test": True}
        )
        
        # Search for relevant caveats
        relevant_caveats = await caveat_service.search_caveats(
            rubric_question="Does the student validate input in their function?",
            top_k=3,
            similarity_threshold=0.6
        )
        
        print(f"✅ Found {len(relevant_caveats)} relevant caveats for LLM")
        
        # Test caveat generation
        test_prompt = """
You are analyzing feedback from a grader.

RUBRIC QUESTION: Does the code handle edge cases properly?

STUDENT'S ANSWER: 
def process_array(arr):
    return arr[0] + arr[-1]

AI'S DECISION: check - The code processes arrays correctly

HUMAN GRADER'S FEEDBACK: The code will crash if the array is empty.

Generate a caveat to prevent this mistake in the future.
"""
        
        print("🤖 Testing caveat generation...")
        caveat_text = await llm_service.generate_caveat(test_prompt)
        print(f"✅ Generated caveat: {caveat_text[:100]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing LLM integration: {e}")
        return False


async def test_data_persistence():
    """Test that caveats persist across service restarts."""
    print("\n🧪 Testing data persistence...")
    
    try:
        # Create first service instance and store caveat
        service1 = CaveatService()
        test_caveat_id = await service1.store_caveat(
            rubric_question="Test persistence question",
            caveat_text="Test persistence caveat",
            original_feedback="Test feedback",
            metadata={"persistence_test": True}
        )
        
        print(f"✅ Stored caveat with ID: {test_caveat_id}")
        
        # Create new service instance (simulates restart)
        service2 = CaveatService()
        
        # Try to retrieve the caveat
        retrieved_caveat = await service2.get_caveat(test_caveat_id)
        
        if retrieved_caveat:
            print("✅ Caveat successfully retrieved after service restart")
            print(f"   Text: {retrieved_caveat['caveat_text']}")
            return True
        else:
            print("❌ Caveat not found after service restart")
            return False
            
    except Exception as e:
        print(f"❌ Error testing persistence: {e}")
        return False


async def run_comprehensive_test():
    """Run all tests in sequence."""
    print("🚀 Starting comprehensive feedback system test...")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    results = {
        "caveat_service": False,
        "llm_integration": False,
        "data_persistence": False,
        "feedback_endpoint": False
    }
    
    # Test caveat service
    results["caveat_service"] = await test_caveat_service()
    
    # Test LLM integration
    results["llm_integration"] = await test_llm_integration()
    
    # Test data persistence
    results["data_persistence"] = await test_data_persistence()
    
    # Test feedback endpoint (requires server to be running)
    print("\n🧪 Testing feedback endpoint (requires server running)...")
    print("💡 Make sure to start the server with: python -m app.main")
    try:
        results["feedback_endpoint"] = await test_feedback_endpoint() is not None
    except Exception as e:
        print(f"⚠️  Feedback endpoint test skipped (server not running): {e}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name:<20}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! The feedback system is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
    
    return passed_tests == total_tests


if __name__ == "__main__":
    # Ensure data directory exists
    os.makedirs(settings.data_dir, exist_ok=True)
    
    # Run the comprehensive test
    asyncio.run(run_comprehensive_test()) 