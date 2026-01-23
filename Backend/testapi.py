from google import genai
from dotenv import load_dotenv
import os

# 1. Load Environment Variables
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ Error: GEMINI_API_KEY not found in .env")
    exit(1)

print(f"🔑 Using API Key: {api_key[:5]}...{api_key[-3:]}")

try:
    # 2. Initialize Client
    client = genai.Client(api_key=api_key)
    
    print("🚀 Sending test prompt to gemini-2.0-flash...")
    
    # 3. Generate Content
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents='Hello, this is a test connection. Please reply with "Connection Successful".'
    )
    
    # 4. Print Result
    print("\n✅ Response received:")
    print("-" * 20)
    print(response.text)
    print("-" * 20)

except Exception as e:
    print(f"\n❌ API Call Failed: {e}")
