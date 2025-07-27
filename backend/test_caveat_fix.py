#!/usr/bin/env python3
"""Simple test to verify caveat search fixes."""

import asyncio
import sys
import os
sys.path.append('.')

# Simple test without heavy dependencies
import json
import numpy as np

async def test_caveat_logic():
    """Test the caveat search logic without full service."""
    print("🧪 Testing Caveat Search Logic")
    print("=" * 40)
    
    # Load the existing caveat data
    caveats_file = 'data/caveats/caveats.json'
    if not os.path.exists(caveats_file):
        print("❌ No caveats.json found")
        return
    
    with open(caveats_file, 'r') as f:
        caveats = json.load(f)
    
    print(f"📊 Loaded {len(caveats)} caveats")
    
    # Show the stored caveat
    for caveat_id, caveat in caveats.items():
        print(f"📝 Caveat: {caveat['rubric_question']}")
        print(f"   Usage count: {caveat['usage_count']}")
        print()
    
    # Test similarity calculation manually
    original_question = "There is a description of any kind of algorithm in the Data Structures section."
    similar_questions = [
        "Is there an algorithm description in the Data Structures section?",
        "Does the Data Structures section contain algorithm descriptions?",
        "Are algorithms described in the Data Structures part?",
        "Completely unrelated question about weather"
    ]
    
    print("🔍 Testing question similarity (conceptual):")
    print(f"Original: {original_question}")
    print()
    
    for i, question in enumerate(similar_questions):
        print(f"{i+1}. {question}")
        # Simple word overlap similarity for testing
        orig_words = set(original_question.lower().split())
        test_words = set(question.lower().split())
        overlap = len(orig_words.intersection(test_words))
        total = len(orig_words.union(test_words))
        simple_similarity = overlap / total if total > 0 else 0
        print(f"   Simple word overlap similarity: {simple_similarity:.3f}")
        print()

if __name__ == "__main__":
    asyncio.run(test_caveat_logic()) 