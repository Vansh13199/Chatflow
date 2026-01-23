import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"🔑 Creating test... API Key found: {'Yes' if api_key else 'No'}")

if not api_key:
    print("❌ Error: GEMINI_API_KEY is missing in .env")
    exit(1)

try:
    import google.generativeai
    print("✅ google-generativeai package is installed.")
except ImportError:
    print("❌ Error: google-generativeai package is NOT installed.")
    exit(1)

print(f"GenerativeAI Version: {genai.__version__}")

if len(api_key) < 10:
    print(f"⚠️ Warning: API Key looks suspicious (length {len(api_key)}).")
else:
    print(f"✅ API Key present (starts with {api_key[:4]}...)")

try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    print("Sending request to gemini-1.5-flash...")
    response = model.generate_content("Hello")
    print(f"✅ SUCCESS! Response: {response.text}")
except Exception as e:
    print(f"❌ FAILED: {e}")
    # Inspect internal details if available
    if hasattr(e, 'args'):
        print(f"Args: {e.args}")
