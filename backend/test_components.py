"""Test individual backend components without running the full server."""

import asyncio
import os
from app.models import RubricItem, RubricType, SubmissionRequest, AssignmentContext
from app.services.preprocessing import PreprocessingService
from app.services.grading import GradingService


async def test_preprocessing():
    """Test the preprocessing service."""
    print("🧪 Testing Preprocessing Service...")
    
    preprocessing_service = PreprocessingService()
    
    # Sample source files
    source_files = {
        "tree.h": """#ifndef TREE_H
#define TREE_H
class BinaryTree {
public:
    void insert(int value);
    bool search(int value);
private:
    Node* root;
};
#endif""",
        "tree.cpp": """#include "tree.h"
void BinaryTree::insert(int value) {
    // Missing null check
    if (value < root->data) {
        // Insert logic
    }
}""",
        "test_tree.cpp": """#include <cassert>
#include "tree.h"

void test_insert() {
    BinaryTree tree;
    tree.insert(10);
    assert(tree.search(10));
}

int main() {
    test_insert();
    return 0;
}""",
        "Makefile": """CC=g++
CFLAGS=-Wall -std=c++11

tree: tree.cpp tree.h
	$(CC) $(CFLAGS) -o tree tree.cpp

test: test_tree.cpp tree.cpp tree.h
	$(CC) $(CFLAGS) -o test_tree test_tree.cpp tree.cpp
	./test_tree

clean:
	rm -f tree test_tree""",
        "random_data.bin": "Binary file content that should be summarized" * 100
    }
    
    try:
        processed = await preprocessing_service.preprocess_submission(
            course_id="12345",
            assignment_id="67890", 
            submission_id="424242",
            source_files=source_files
        )
        
        print(f"✓ Processed {len(processed)} files")
        print(f"✓ Original files: {list(source_files.keys())}")
        print(f"✓ Processed files: {list(processed.keys())}")
        
        # Check that test files were summarized
        if "__TEST_FILES_SUMMARY__" in processed:
            print("✓ Test files were summarized")
            print(f"  Summary length: {len(processed['__TEST_FILES_SUMMARY__'])} chars")
        
        # Check that code files were included
        if "tree.h" in processed and len(processed["tree.h"]) > 50:
            print("✓ Code files included in full")
        
        # Check that binary/large files were handled
        if "random_data.bin" in processed and processed["random_data.bin"].startswith("[File Summary"):
            print("✓ Large files were summarized")
        
        return True
        
    except Exception as e:
        print(f"✗ Preprocessing failed: {e}")
        return False


async def test_models():
    """Test Pydantic models."""
    print("\n🧪 Testing Pydantic Models...")
    
    try:
        # Test RubricItem
        checkbox_item = RubricItem(
            id="RbA3C2",
            description="Proper error handling",
            points=-2,
            type=RubricType.CHECKBOX
        )
        
        radio_item = RubricItem(
            id="RbB1X4", 
            description="Code quality",
            points=0,
            type=RubricType.RADIO,
            options={
                "excellent": "Excellent (0 pts)",
                "good": "Good (-1 pt)",
                "poor": "Poor (-2 pts)"
            }
        )
        
        # Test SubmissionRequest
        request = SubmissionRequest(
            assignment_context=AssignmentContext(
                course_id="12345",
                assignment_id="67890", 
                submission_id="424242"
            ),
            source_files={"main.cpp": "int main() { return 0; }"},
            rubric_items=[checkbox_item, radio_item]
        )
        
        print("✓ All models created successfully")
        print(f"✓ Request has {len(request.rubric_items)} rubric items")
        print(f"✓ CHECKBOX item: {checkbox_item.description}")
        print(f"✓ RADIO item has {len(radio_item.options)} options")
        
        return True
        
    except Exception as e:
        print(f"✗ Models test failed: {e}")
        return False


async def test_without_llm():
    """Test grading service structure without making LLM calls."""
    print("\n🧪 Testing Grading Service Structure...")
    
    try:
        # This will fail because we don't have a real API key,
        # but it will test the import and basic structure
        from app.services.llm import LLMService
        
        print("✓ LLM service imports successfully")
        
        # Test that we can create the service
        try:
            llm_service = LLMService()
            print("✓ LLM service created (but won't work without real API key)")
        except ValueError as e:
            if "API key not configured" in str(e):
                print("⚠️ LLM service requires API key (expected)")
            else:
                raise
        
        return True
        
    except Exception as e:
        print(f"✗ LLM service test failed: {e}")
        return False


async def main():
    """Run all tests."""
    print("🚀 Testing Supergrader Backend Components\n")
    
    # Set a fake API key for testing
    os.environ["OPENAI_API_KEY"] = "test-key-for-structure-testing"
    
    results = []
    
    # Test models
    results.append(await test_models())
    
    # Test preprocessing 
    results.append(await test_preprocessing())
    
    # Test LLM service structure
    results.append(await test_without_llm())
    
    # Summary
    print(f"\n📊 Test Results: {sum(results)}/{len(results)} passed")
    
    if all(results):
        print("🎉 All component tests passed!")
        print("\n💡 Next steps:")
        print("   1. Set up Redis: docker run -p 6379:6379 redis:7-alpine")
        print("   2. Set real API key: $env:OPENAI_API_KEY='your-real-key'")
        print("   3. Start server: uvicorn app.main:app --reload")
        print("   4. Test with: python test_api.py")
    else:
        print("❌ Some tests failed - check the output above")


if __name__ == "__main__":
    asyncio.run(main()) 