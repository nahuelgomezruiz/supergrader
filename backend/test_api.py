"""Test script for the Supergrader API."""

import asyncio
import json
import httpx
from typing import Dict, Any


async def test_grading_api():
    """Test the grading API with a sample request."""
    
    # Sample request data
    request_data = {
        "assignment_context": {
            "course_id": "12345",
            "assignment_id": "67890",
            "submission_id": "424242",
            "assignment_name": "Binary Search Tree Implementation"
        },
        "source_files": {
            "tree.h": """#ifndef TREE_H
#define TREE_H

class BinaryTree {
public:
    struct Node {
        int data;
        Node* left;
        Node* right;
        Node(int val) : data(val), left(nullptr), right(nullptr) {}
    };
    
    BinaryTree() : root(nullptr) {}
    void insert(int value);
    bool search(int value);
    void remove(int value);
    
private:
    Node* root;
};

#endif""",
            "tree.cpp": """#include "tree.h"

void BinaryTree::insert(int value) {
    // Missing null check - should handle edge case
    if (value < root->data) {
        // Insert logic here
    }
}

bool BinaryTree::search(int value) {
    Node* current = root;
    while (current != nullptr) {
        if (value == current->data) return true;
        current = (value < current->data) ? current->left : current->right;
    }
    return false;
}

void BinaryTree::remove(int value) {
    // TODO: Implement remove functionality
}""",
            "main.cpp": """#include <iostream>
#include "tree.h"

int main() {
    BinaryTree tree;
    tree.insert(10);
    tree.insert(5);
    tree.insert(15);
    
    std::cout << "Found 5: " << tree.search(5) << std::endl;
    std::cout << "Found 20: " << tree.search(20) << std::endl;
    
    return 0;
}""",
            "test_tree.cpp": """#include <cassert>
#include "tree.h"

void test_insert() {
    BinaryTree tree;
    tree.insert(10);
    assert(tree.search(10));
}

void test_search() {
    BinaryTree tree;
    tree.insert(5);
    tree.insert(10);
    tree.insert(3);
    assert(tree.search(5));
    assert(tree.search(10));
    assert(tree.search(3));
    assert(!tree.search(7));
}

int main() {
    test_insert();
    test_search();
    std::cout << "All tests passed!" << std::endl;
    return 0;
}"""
        },
        "rubric_items": [
            {
                "id": "RbA3C2",
                "description": "Proper error handling for edge cases (null pointer checks)",
                "points": -2,
                "type": "CHECKBOX"
            },
            {
                "id": "RbB1X4",
                "description": "Implementation completeness",
                "points": 0,
                "type": "RADIO",
                "options": {
                    "complete": "All methods implemented (0 pts)",
                    "partial": "Some methods missing (-2 pts)",
                    "minimal": "Many methods missing (-4 pts)"
                }
            },
            {
                "id": "RbC2Y7",
                "description": "Includes test cases",
                "points": 2,
                "type": "CHECKBOX"
            }
        ]
    }
    
    # Test the API
    async with httpx.AsyncClient() as client:
        try:
            # Test health endpoint
            health_response = await client.get("http://localhost:8000/api/v1/health")
            print("Health Check:", health_response.json())
            
            # Test grading endpoint with SSE
            print("\nStarting grading request...")
            async with client.stream(
                "POST",
                "http://localhost:8000/api/v1/grade-submission",
                json=request_data,
                headers={"Accept": "text/event-stream"}
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        print(f"\nReceived event: {data.get('type', 'unknown')}")
                        
                        if data.get('type') == 'partial_result':
                            decision = data.get('decision', {})
                            verdict = decision.get('verdict', {})
                            print(f"  Rubric Item: {decision.get('rubric_item_id')}")
                            print(f"  Confidence: {decision.get('confidence', 0) * 100:.1f}%")
                            
                            if decision.get('type') == 'CHECKBOX':
                                print(f"  Decision: {verdict.get('decision')}")
                            else:
                                print(f"  Selected: {verdict.get('selected_option')}")
                            
                            print(f"  Comment: {verdict.get('comment')}")
                            print(f"  Evidence: {verdict.get('evidence')}")
                        
                        elif data.get('type') == 'job_complete':
                            print(f"  Message: {data.get('message')}")
                            break
                        
                        elif data.get('type') == 'error':
                            print(f"  Error: {data.get('error')}")
                            break
                            
        except httpx.ConnectError:
            print("Error: Could not connect to API. Make sure the server is running on http://localhost:8000")
        except Exception as e:
            print(f"Error: {type(e).__name__}: {e}")


if __name__ == "__main__":
    asyncio.run(test_grading_api()) 