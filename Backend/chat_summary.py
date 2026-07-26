import requests
import os
import json
from datetime import datetime
import textwrap

def generate_chat_summary(messages: list) -> dict:
    """
    Generates an AI-powered summary of the conversation using Google Gemini via REST API.
    (Compatible with Python 3.8+)
    
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
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("⚠️ GEMINI_API_KEY not found in environment variables.")
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

    # 3. Construct Prompt
    prompt_text = textwrap.dedent(f"""\
        You are an intelligent assistant summarizing a chat conversation.
        Summarize the following conversation in 3-5 concise bullet points.
        Focus on the main topics discussed, key decisions, or interesting updates.
        Do not use asterisks or dashes for bullets in your raw output, just put each point on a new line.
        Keep it casual but clear.

        Conversation:
        {conversation_text}
        
        Summary:
    """)

    # Helper function for API calls
    def call_gemini_api(model_name, prompt_text, api_key):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {"contents": [{"parts": [{"text": prompt_text}]}]}
        return requests.post(url, headers=headers, json=payload, timeout=10)

    try:
        # 4. Call Gemini API (REST API via requests)
        # Try primary model first: gemini-1.5-flash
        primary_model = "gemini-2.5-flash-lite"
        response = call_gemini_api(primary_model, prompt_text, api_key)
        
        # If 404 (Not Found), try fallback model: gemini-pro
        if response.status_code == 404:
            print(f"⚠️ {primary_model} not found (404). Falling back to gemini-pro...")
            fallback_model = "gemini-pro"
            response = call_gemini_api(fallback_model, prompt_text, api_key)

        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")
            
        result = response.json()
        
        # 5. Parse Response
        # Structure: result['candidates'][0]['content']['parts'][0]['text']
        try:
            summary_text = result['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError) as e:
            # Handle safety ratings blocking content
            if "promptFeedback" in result:
                raise Exception(f"Content blocked by safety filters: {result.get('promptFeedback')}")
            raise Exception(f"Unexpected API response structure: {str(e)} | Response: {str(result)}")
        
        lines = summary_text.strip().split('\n')
        bullet_points = [line.strip().lstrip('-•* ').strip() for line in lines if line.strip()]
        
        if not bullet_points:
            bullet_points = ["Could not generate a summary at this time."]

        return {
            "summary": bullet_points,
            "updated_at": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ Gemini API Error: {e}")
        return {
            "summary": [f"Failed to generate summary: {str(e)}"],
            "updated_at": datetime.now().isoformat()
        }
