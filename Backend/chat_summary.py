import requests
import os
import json
from datetime import datetime
import textwrap

def generate_chat_summary(messages: list) -> dict:
    """
    Generates an AI-powered summary of the conversation using Hugging Face Inference API.
    
    Args:
        messages (list): List of message dictionaries containing 'message', 'sender', 'timestamp'.
        
    Returns:
        dict: {
            "summary": [str],  # List of bullet points
            "updated_at": str  # ISO timestamp
        }
    """
    if not messages:
        return {
            "summary": ["No messages in this conversation yet."],
            "updated_at": datetime.now().isoformat()
        }

    # 1. Check API Key
    api_key = os.getenv("HUGGINGFACE_API_KEY")
    if not api_key:
        print("⚠️ HUGGINGFACE_API_KEY not found in environment variables.")
        return {
            "summary": ["Smart summary is unavailable (API Key missing)."],
            "updated_at": datetime.now().isoformat()
        }

    # 2. Prepare Context (Last 50 messages)
    recent_messages = messages[-50:]
    conversation_text = ""
    for msg in recent_messages:
        sender = msg.get("sender", "Unknown")
        content = msg.get("message", "")
        conversation_text += f"{sender}: {content}\n"

    # 3. Construct Prompt (BART format - pure transcript)
    prompt_text = f"The following is a conversation between users:\n{conversation_text}\nSummary:"

    def call_hf_api(prompt_text, api_key):
        # We use BART Large CNN as it is a dedicated summarization model natively supported by the new HF Serverless Inference Router
        url = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "inputs": prompt_text,
            "parameters": {
                "max_length": 150,
                "min_length": 30,
                "temperature": 0.5
            }
        }
        return requests.post(url, headers=headers, json=payload, timeout=15)

    try:
        # 4. Call Hugging Face API
        response = call_hf_api(prompt_text, api_key)
        
        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")
            
        result = response.json()
        
        # 5. Parse Response
        try:
            if isinstance(result, list) and len(result) > 0 and 'summary_text' in result[0]:
                summary_text = result[0]['summary_text']
            elif isinstance(result, list) and len(result) > 0 and 'generated_text' in result[0]:
                summary_text = result[0]['generated_text']
            else:
                summary_text = str(result)
        except Exception as e:
            raise Exception(f"Unexpected API response structure: {str(e)} | Response: {str(result)}")
        
        # Split paragraph into sentences to fake bullet points
        sentences = [s.strip() for s in summary_text.replace('!', '.').replace('?', '.').split('.') if len(s.strip()) > 10]
        
        if not sentences:
            sentences = [summary_text]
            
        bullet_points = sentences[:5] # Keep max 5 bullet points

        return {
            "summary": bullet_points,
            "updated_at": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ Hugging Face API Error: {e}")
        return {
            "summary": [f"Failed to generate summary: {str(e)}"],
            "updated_at": datetime.now().isoformat()
        }
