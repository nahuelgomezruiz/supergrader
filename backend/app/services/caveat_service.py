"""Service for managing caveats with semantic search capability."""

import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import logging
import os
import pickle

from app.core.config import settings


logger = logging.getLogger(__name__)


class CaveatService:
    """Service for storing and retrieving caveats with semantic search."""
    
    def __init__(self):
        # Initialize sentence transformer for embeddings
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Storage paths
        self.storage_dir = os.path.join(settings.data_dir, 'caveats')
        os.makedirs(self.storage_dir, exist_ok=True)
        
        self.caveats_file = os.path.join(self.storage_dir, 'caveats.json')
        self.index_file = os.path.join(self.storage_dir, 'faiss_index.pkl')
        self.embeddings_file = os.path.join(self.storage_dir, 'embeddings.pkl')
        
        # Load existing data
        self.caveats: Dict[str, Dict[str, Any]] = self._load_caveats()
        self.index, self.embeddings = self._load_or_create_index()
        
        logger.info(f"CaveatService initialized with {len(self.caveats)} caveats")
    
    def _load_caveats(self) -> Dict[str, Dict[str, Any]]:
        """Load caveats from file."""
        if os.path.exists(self.caveats_file):
            try:
                with open(self.caveats_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading caveats: {e}")
        return {}
    
    def _save_caveats(self):
        """Save caveats to file."""
        try:
            with open(self.caveats_file, 'w') as f:
                json.dump(self.caveats, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving caveats: {e}")
    
    def _load_or_create_index(self):
        """Load or create FAISS index for semantic search."""
        if os.path.exists(self.index_file) and os.path.exists(self.embeddings_file):
            try:
                with open(self.index_file, 'rb') as f:
                    index = pickle.load(f)
                with open(self.embeddings_file, 'rb') as f:
                    embeddings = pickle.load(f)
                return index, embeddings
            except Exception as e:
                logger.error(f"Error loading index: {e}")
        
        # Create new index
        dimension = 384  # all-MiniLM-L6-v2 embedding dimension
        index = faiss.IndexFlatL2(dimension)
        embeddings = {}
        return index, embeddings
    
    def _save_index(self):
        """Save FAISS index to file."""
        try:
            with open(self.index_file, 'wb') as f:
                pickle.dump(self.index, f)
            with open(self.embeddings_file, 'wb') as f:
                pickle.dump(self.embeddings, f)
        except Exception as e:
            logger.error(f"Error saving index: {e}")
    
    async def store_caveat(
        self,
        rubric_question: str,
        caveat_text: str,
        original_feedback: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Store a new caveat with semantic embedding."""
        caveat_id = str(uuid.uuid4())
        
        # Create caveat record
        caveat = {
            "id": caveat_id,
            "rubric_question": rubric_question,
            "caveat_text": caveat_text,
            "original_feedback": original_feedback,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
            "usage_count": 0
        }
        
        # Generate embedding for the rubric question
        embedding = self.model.encode(rubric_question)
        
        # Add to FAISS index
        self.index.add(np.array([embedding]))
        self.embeddings[caveat_id] = embedding
        
        # Store caveat
        self.caveats[caveat_id] = caveat
        
        # Save to disk
        self._save_caveats()
        self._save_index()
        
        logger.info(f"Stored caveat {caveat_id}: {caveat_text[:50]}...")
        return caveat_id
    
    async def search_caveats(
        self,
        rubric_question: str,
        top_k: int = 5,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Search for relevant caveats based on rubric question similarity."""
        if not self.caveats:
            return []
        
        # Generate embedding for query
        query_embedding = self.model.encode(rubric_question)
        
        # Search in FAISS index
        distances, indices = self.index.search(
            np.array([query_embedding]), 
            min(top_k, len(self.caveats))
        )
        
        # Get caveat IDs from embeddings
        caveat_ids = list(self.embeddings.keys())
        
        # Collect relevant caveats
        relevant_caveats = []
        for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            if idx < len(caveat_ids):
                # Convert L2 distance to similarity score (0-1)
                similarity = 1 / (1 + distance)
                
                if similarity >= similarity_threshold:
                    caveat_id = caveat_ids[idx]
                    caveat = self.caveats[caveat_id].copy()
                    caveat['similarity_score'] = float(similarity)
                    relevant_caveats.append(caveat)
                    
                    # Increment usage count
                    self.caveats[caveat_id]['usage_count'] += 1
        
        # Save updated usage counts
        if relevant_caveats:
            self._save_caveats()
        
        logger.info(f"Found {len(relevant_caveats)} relevant caveats for: {rubric_question[:50]}...")
        return relevant_caveats
    
    async def get_caveat(self, caveat_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific caveat by ID."""
        return self.caveats.get(caveat_id)
    
    async def delete_caveat(self, caveat_id: str) -> bool:
        """Delete a caveat."""
        if caveat_id in self.caveats:
            del self.caveats[caveat_id]
            
            # Rebuild index without the deleted caveat
            await self._rebuild_index()
            
            self._save_caveats()
            logger.info(f"Deleted caveat {caveat_id}")
            return True
        return False
    
    async def _rebuild_index(self):
        """Rebuild the FAISS index from scratch."""
        dimension = 384
        self.index = faiss.IndexFlatL2(dimension)
        self.embeddings = {}
        
        for caveat_id, caveat in self.caveats.items():
            embedding = self.model.encode(caveat['rubric_question'])
            self.index.add(np.array([embedding]))
            self.embeddings[caveat_id] = embedding
        
        self._save_index()
    
    async def get_all_caveats(self) -> List[Dict[str, Any]]:
        """Get all stored caveats."""
        return list(self.caveats.values()) 