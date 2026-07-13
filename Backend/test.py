from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

def test_mongodb():
    try:
        # Connect to MongoDB
        client = MongoClient(
            "mongodb://localhost:27017/",
            serverSelectionTimeoutMS=5000
        )

        # Force connection check
        client.admin.command("ping")
        print("✅ MongoDB server is running")

        # Create / access test database
        db = client["test_chat_db"]

        # Create / access collection
        collection = db["test_messages"]

        # Insert test document
        test_doc = {
            "sender": "system",
            "message": "MongoDB test successful",
            "status": "ok"
        }

        insert_result = collection.insert_one(test_doc)

        # Read back the document
        fetched_doc = collection.find_one(
            {"_id": insert_result.inserted_id}
        )

        print("✅ Test database and collection created")
        print("📄 Sample document:", fetched_doc)

    except ServerSelectionTimeoutError:
        print("❌ MongoDB server is NOT running or not reachable")

    except Exception as e:
        print("❌ Error:", e)

    finally:
        client.close()

if __name__ == "__main__":
    test_mongodb()
