from chat_summary import generate_chat_summary
from dotenv import load_dotenv
import os

# Load env from .env file explicitly for test script
load_dotenv()

mock_messages = [
    {"sender": "UserA", "message": "Hi, are we still meeting today?", "timestamp": 1234567890},
    {"sender": "UserB", "message": "Yes, at 2 PM.", "timestamp": 1234567891},
    {"sender": "UserA", "message": "Great, see you then.", "timestamp": 1234567892},
    {"sender": "UserB", "message": "Don't forget the documents.", "timestamp": 1234567893}
]

print("🚀 Testing generate_chat_summary with new SDK...")
result = generate_chat_summary(mock_messages)

print("\n📊 Result:")
if "summary" in result:
    for point in result["summary"]:
        print(f" - {point}")
else:
    print(result)

if "Failed" in str(result.get("summary", [])):
    print("\n❌ Test FAILED.")
else:
    print("\n✅ Test SUCCESS!")
