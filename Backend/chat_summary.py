from google import genai
import os
from datetime import datetime
import textwrap

def generate_chat_summary(messages: list) -> dict:
    """
    Generates an AI-powered summary of the conversation using Google Gemini (google-genai SDK).
    
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
    prompt = textwrap.dedent(f"""\
        You are an intelligent assistant summarizing a chat conversation.
        Summarize the following conversation in 3-5 concise bullet points.
        Focus on the main topics discussed, key decisions, or interesting updates.
        Do not use asterisks or dashes for bullets in your raw output, just put each point on a new line.
        Keep it casual but clear.

        Conversation:
        {conversation_text}
        
        Summary:
    """)

    try:
        # 4. Call Gemini API (New SDK)
        client = genai.Client(api_key=api_key)
        
        response = client.models.generate_content(
            model='gemini-2.0-flash', 
            contents=prompt
        )
        
        summary_text = response.text
        
        # 5. Parse Response
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
