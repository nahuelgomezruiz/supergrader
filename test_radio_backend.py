#!/usr/bin/env python3
"""
Test script for radio button credit labeling functionality
"""

import json
import requests
import time

def test_radio_button_grading():
    """Test the radio button grading with credit labels"""
    
    # Mock grading request with radio button that has credit labels
    test_request = {
        "assignment_context": {
            "course_id": "123",
            "assignment_id": "456", 
            "submission_id": "789",
            "assignment_name": "Test Assignment"
        },
        "source_files": {
            "main.cpp": "// Test implementation\nint main() { return 0; }"
        },
        "rubric_items": [
            {
                "id": "3",
                "description": "Code Quality Assessment",
                "points": 5.0,
                "type": "RADIO",
                "options": {
                    "Q": "Excellent code quality with proper documentation and structure (Full credit)",
                    "W": "Good code quality with minor issues (Partial credit)", 
                    "E": "Poor code quality with significant issues (No credit)"
                }
            }
        ]
    }
    
    print("🧪 Testing Radio Button Credit Labeling")
    print("=" * 50)
    
    print("\n📤 Sending test request to backend...")
    print(f"Radio options being sent:")
    for letter, desc in test_request["rubric_items"][0]["options"].items():
        print(f"  {letter}: {desc}")
    
    try:
        # Send request to backend
        response = requests.post(
            'http://localhost:8000/api/v1/grade-submission',
            json=test_request,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            stream=True,
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ Error: HTTP {response.status_code}")
            print(response.text)
            return
            
        print(f"✅ Backend responded with status {response.status_code}")
        print("\n📨 Processing server-sent events...")
        
        # Process SSE stream
        buffer = ''
        for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
            if chunk:
                buffer += chunk
                lines = buffer.split('\n')
                buffer = lines.pop()
                
                for line in lines:
                    if line.startswith('data: '):
                        try:
                            event_data = json.loads(line[6:])
                            print(f"\n📨 Event: {event_data.get('type', 'unknown')}")
                            
                            if event_data.get('type') == 'partial_result':
                                decision = event_data.get('decision', {})
                                print(f"   Item ID: {event_data.get('rubric_item_id')}")
                                print(f"   Selected: {decision.get('selected_option', 'N/A')}")
                                print(f"   Comment: {decision.get('comment', 'N/A')[:100]}...")
                                print(f"   Confidence: {decision.get('confidence', 0)*100:.1f}%")
                                
                            elif event_data.get('type') == 'job_complete':
                                print("✅ Grading completed successfully!")
                                return
                                
                            elif event_data.get('type') == 'error':
                                print(f"❌ Error: {event_data.get('error')}")
                                return
                                
                        except json.JSONDecodeError as e:
                            print(f"⚠️ Failed to parse event: {line}")
                            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend. Make sure it's running on http://localhost:8000")
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def test_credit_label_logic():
    """Test the credit labeling logic independently"""
    
    print("\n🧪 Testing Credit Label Logic")
    print("=" * 30)
    
    test_cases = [
        {
            "name": "Standard 5/3/0 system",
            "options": [
                {"desc": "Perfect implementation", "points": 5.0},
                {"desc": "Good with minor issues", "points": 3.0}, 
                {"desc": "Poor implementation", "points": 0.0}
            ]
        },
        {
            "name": "Multiple partial levels", 
            "options": [
                {"desc": "Excellent work", "points": 10.0},
                {"desc": "Very good", "points": 7.0},
                {"desc": "Adequate", "points": 4.0},
                {"desc": "Inadequate", "points": 0.0}
            ]
        },
        {
            "name": "All same points (edge case)",
            "options": [
                {"desc": "Option A", "points": 2.0},
                {"desc": "Option B", "points": 2.0},
                {"desc": "Option C", "points": 2.0}
            ]
        }
    ]
    
    QWERTY_LETTERS = "QWERTYUIOPASDFGHJKLZXCVBNM"
    
    for case in test_cases:
        print(f"\n📋 {case['name']}:")
        
        # Find max points
        max_points = max(opt["points"] for opt in case["options"])
        
        # Apply credit labels
        for i, option in enumerate(case["options"]):
            letter = QWERTY_LETTERS[i]
            points = option["points"]
            desc = option["desc"]
            
            if points == max_points and max_points > 0:
                credit_label = " (Full credit)"
            elif points > 0 and points < max_points:
                credit_label = " (Partial credit)"
            elif points == 0:
                credit_label = " (No credit)"
            else:
                credit_label = ""
                
            final_text = desc + credit_label
            print(f"  {letter}: {final_text}")

if __name__ == "__main__":
    print("🚀 Radio Button Credit Labeling Test Suite")
    print("=" * 60)
    
    # Test the logic independently first
    test_credit_label_logic()
    
    # Test with backend if available
    print("\n" + "=" * 60)
    test_radio_button_grading()
    
    print("\n✅ Test suite completed!") 