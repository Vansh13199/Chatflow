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

    # 3. Construct Prompt (Messages array for Chat Completions API)
    system_prompt = "You are an intelligent assistant summarizing a chat conversation. Summarize the following conversation in 3-5 concise bullet points. Focus on the main topics discussed, key decisions, or interesting updates. Do not use asterisks or dashes for bullets in your raw output, just put each point on a new line. Keep it casual but clear."
    
    def call_hf_api(conversation, api_key):
        # We use Qwen 2.5 7B Instruct via the HF Inference Providers Router
        url = "https://router.huggingface.co/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "Qwen/Qwen2.5-7B-Instruct",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Conversation:\n{conversation}\n\nSummary:"}
            ],
            "max_tokens": 200,
            "temperature": 0.3
        }
        return requests.post(url, headers=headers, json=payload, timeout=15)

    try:
        # 4. Call Hugging Face API
        response = call_hf_api(conversation_text, api_key)
        
        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")
            
        result = response.json()
        
        # 5. Parse Response
        try:
            summary_text = result['choices'][0]['message']['content']
        except Exception as e:
            raise Exception(f"Unexpected API response structure: {str(e)} | Response: {str(result)}")
        
        # Split into bullet points
        lines = summary_text.strip().split('\n')
        bullet_points = [line.strip().lstrip('-•* ').strip() for line in lines if line.strip()]
        
        if not bullet_points:
            bullet_points = ["Could not generate a summary at this time."]

        return {
            "summary": bullet_points[:5],
            "updated_at": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ Hugging Face API Error: {e}")
        return {
            "summary": [f"Failed to generate summary: {str(e)}"],
            "updated_at": datetime.now().isoformat()
        }
