#!/usr/bin/env python3
"""Debug script to test caveat search functionality."""

import asyncio
import sys
import os
sys.path.append('.')

from app.services.caveat_service import CaveatService
import json


async def debug_caveat_search():
    """Debug the caveat search functionality."""
    print("🔍 Debugging Caveat Search System")
    print("=" * 50)
    
    service = CaveatService()
    print(f"📊 Loaded caveats: {len(service.caveats)}")
    print(f"📊 FAISS index size: {service.index.ntotal}")
    print(f"📊 Embeddings count: {len(service.embeddings)}")
    print()
    
    # Show the stored caveat
    for caveat_id, caveat in service.caveats.items():
        print(f"📝 Stored Caveat ID: {caveat_id}")
        print(f"   Question: {caveat['rubric_question']}")
        print(f"   Usage count: {caveat['usage_count']}")
        print(f"   Created: {caveat['created_at']}")
        print()
    
    # Test 1: Exact match
    print("🧪 Test 1: Exact Question Match")
    exact_question = "There is a description of any kind of algorithm in the Data Structures section."
    results = await service.search_caveats(
        rubric_question=exact_question,
        top_k=5,
        similarity_threshold=0.5
    )
    
    print(f"Query: {exact_question}")
    print(f"Results: {len(results)}")
    for i, result in enumerate(results):
        print(f"  {i+1}. Similarity: {result.get('similarity_score', 'N/A'):.4f}")
        print(f"     Question: {result['rubric_question']}")
        print(f"     Usage count: {result['usage_count']}")
        print()
    
    # Test 2: Similar question
    print("🧪 Test 2: Similar Question")
    similar_question = "Is there an algorithm description in the Data Structures section?"
    results = await service.search_caveats(
        rubric_question=similar_question,
        top_k=5,
        similarity_threshold=0.5
    )
    
    print(f"Query: {similar_question}")
    print(f"Results: {len(results)}")
    for i, result in enumerate(results):
        print(f"  {i+1}. Similarity: {result.get('similarity_score', 'N/A'):.4f}")
        print(f"     Question: {result['rubric_question']}")
        print(f"     Usage count: {result['usage_count']}")
        print()
    
    # Test 3: Different threshold
    print("🧪 Test 3: Lower Threshold (0.3)")
    results = await service.search_caveats(
        rubric_question=similar_question,
        top_k=5,
        similarity_threshold=0.3
    )
    
    print(f"Query: {similar_question}")
    print(f"Results with threshold 0.3: {len(results)}")
    for i, result in enumerate(results):
        print(f"  {i+1}. Similarity: {result.get('similarity_score', 'N/A'):.4f}")
        print(f"     Question: {result['rubric_question']}")
        print(f"     Usage count: {result['usage_count']}")
        print()
    
    # Test 4: Check embeddings directly
    print("🧪 Test 4: Direct Embedding Analysis")
    if service.embeddings:
        import numpy as np
        
        # Get the stored embedding
        caveat_id = list(service.caveats.keys())[0]
        stored_embedding = service.embeddings[caveat_id]
        
        # Generate embedding for similar question
        query_embedding = service.model.encode(similar_question)
        
        # Calculate similarity manually
        # L2 distance
        l2_distance = np.linalg.norm(stored_embedding - query_embedding)
        # Cosine similarity
        cos_sim = np.dot(stored_embedding, query_embedding) / (
            np.linalg.norm(stored_embedding) * np.linalg.norm(query_embedding)
        )
        
        print(f"Manual calculations:")
        print(f"  L2 distance: {l2_distance:.4f}")
        print(f"  Cosine similarity: {cos_sim:.4f}")
        print(f"  Converted similarity (1/(1+L2)): {1/(1+l2_distance):.4f}")
        print()
    
    # Check current usage counts after searches
    print("📊 Final Usage Counts:")
    for caveat_id, caveat in service.caveats.items():
        print(f"   {caveat_id}: {caveat['usage_count']} uses")


if __name__ == "__main__":
    asyncio.run(debug_caveat_search()) 