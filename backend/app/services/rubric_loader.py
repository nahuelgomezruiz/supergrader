"""Rubric loading and management service."""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional
from app.models import RubricItem

class RubricLoaderService:
    """Service for loading and managing rubric files."""
    
    def __init__(self):
        self.rubric_cache: Dict[str, Dict[str, List[RubricItem]]] = {}
        self.assignment_mapping = self._create_assignment_mapping()
    
    def _create_assignment_mapping(self) -> Dict[str, str]:
        """
        Create mapping from assignment_id to rubric directory.
        
        This maps assignment identifiers to their corresponding directories
        in the eval-data folder.
        """
        return {
            # Homework assignments
            "hw_arraylists": "hw_arraylists",
            "hw_linkedlists": "hw_linkedlists",
            
            # Project assignments  
            "proj_gerp": "proj_gerp",
            "proj_metrosim": "proj_metrosim",
            "proj_calcyoulater": "proj_calcyoulater", 
            "proj_zap": "proj_zap",
            
            # Alternative naming patterns
            "ArrayLists": "hw_arraylists",
            "LinkedLists": "hw_linkedlists",
            "Gerp": "proj_gerp",
            "MetroSim": "proj_metrosim",
            "CalcYouLater": "proj_calcyoulater",
            "Zap": "proj_zap"
        }
    
    def _get_rubric_directory(self, assignment_id: str) -> Optional[str]:
        """Get the rubric directory for a given assignment ID."""
        return self.assignment_mapping.get(assignment_id)
    
    def _load_rubric_file(self, file_path: Path) -> List[RubricItem]:
        """Load a single rubric file and parse it into RubricItem objects."""
        if not file_path.exists():
            return []
        
        rubric_items = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                
                # Split by double newlines to separate JSON objects
                json_blocks = [block.strip() for block in content.split('\n\n') if block.strip()]
                
                for json_block in json_blocks:
                    try:
                        item_data = json.loads(json_block)
                        rubric_item = RubricItem(**item_data)
                        rubric_items.append(rubric_item)
                    except json.JSONDecodeError as e:
                        print(f"⚠️ Failed to parse JSON block in {file_path}: {e}")
                        continue
                    except Exception as e:
                        print(f"⚠️ Failed to create RubricItem from {file_path}: {e}")
                        continue
                        
        except Exception as e:
            print(f"❌ Failed to load rubric file {file_path}: {e}")
            
        return rubric_items
    
    def load_full_rubric_sections(self, assignment_id: str) -> Dict[str, List[RubricItem]]:
        """
        Load all rubric sections for a given assignment.
        
        Returns:
            Dict with keys: 'Functionality and Design', 'Testing', 'Style Organization and Documentation'
        """
        # Check cache first
        cache_key = assignment_id
        if cache_key in self.rubric_cache:
            return self.rubric_cache[cache_key]
        
        # Get rubric directory
        rubric_dir = self._get_rubric_directory(assignment_id)
        if not rubric_dir:
            print(f"⚠️ No rubric mapping found for assignment_id: {assignment_id}")
            return self._get_empty_sections()
        
        # Construct paths to rubric files (relative to project root)
        eval_data_path = Path("../eval-data") / rubric_dir / "grades"
        
        sections = {
            'Functionality and Design': self._load_rubric_file(
                eval_data_path / "Functionality_and_Design_Rubric.txt"
            ),
            'Testing': self._load_rubric_file(
                eval_data_path / "Testing_Rubric.txt"
            ),
            'Style Organization and Documentation': self._load_rubric_file(
                eval_data_path / "Style_Organization_and_Documentation_Rubric.txt"
            )
        }
        
        # Cache the results
        self.rubric_cache[cache_key] = sections
        
        print(f"📚 Loaded rubric sections for {assignment_id}:")
        for section_name, items in sections.items():
            print(f"   • {section_name}: {len(items)} items")
        
        return sections
    
    def _get_empty_sections(self) -> Dict[str, List[RubricItem]]:
        """Return empty sections structure."""
        return {
            'Functionality and Design': [],
            'Testing': [],
            'Style Organization and Documentation': []
        }
    
    def get_section_for_rubric_item(self, rubric_item: RubricItem, all_sections: Dict[str, List[RubricItem]]) -> str:
        """
        Determine which section a rubric item belongs to by searching through all sections.
        
        Returns the section name or 'Unknown' if not found.
        """
        for section_name, section_items in all_sections.items():
            for item in section_items:
                if item.id == rubric_item.id:
                    return section_name
        
        # Fallback: try to infer from description keywords
        description_lower = rubric_item.description.lower()
        if any(keyword in description_lower for keyword in ['test', 'testing', 'unit test']):
            return 'Testing'
        elif any(keyword in description_lower for keyword in ['style', 'documentation', 'comment', 'organization']):
            return 'Style Organization and Documentation'
        else:
            return 'Functionality and Design'
    
    def format_section_context(self, section_items: List[RubricItem]) -> str:
        """
        Format a list of rubric items into a readable context string.
        """
        if not section_items:
            return "No rubric items available for this section."
        
        context_lines = []
        for i, item in enumerate(section_items, 1):
            if item.type.value == "RADIO":
                context_lines.append(f"{i}. {item.description} ({item.points} pts) [RADIO]")
                if item.options:
                    for option_key, option_text in item.options.items():
                        context_lines.append(f"   {option_key}: {option_text}")
            else:
                context_lines.append(f"{i}. {item.description} ({item.points} pts) [CHECKBOX]")
        
        return "\n".join(context_lines) 