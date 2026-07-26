from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import json
import os
from typing import Dict
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env

app = FastAPI()

# --- CORS SETUP (Allow Frontend) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE SETUP ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.chat_db
users_collection = db.users
messages_collection = db.messages
summaries_collection = db.summaries

# --- CONNECTION MANAGER (Robust Version) ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active_connections[username] = websocket
        
        # Update DB: Set User Online
        await users_collection.update_one(
            {"username": username},
            {"$set": {"status": "online", "last_seen": datetime.now()}},
            upsert=True
        )
        
        # Broadcast "User is Online" to everyone (including the new user)
        await self.broadcast_status(username, "online")
        
        # Send the new user the status of ALL users (offline with last_seen, and online)
        all_users = await users_collection.find().to_list(length=1000)
        for user in all_users:
            uname = user.get("username")
            if uname == username:
                continue
            
            # Determine status: "online" if in active_connections, else "offline" or DB status
            status = "online" if uname in self.active_connections else user.get("status", "offline")
            last_seen = user.get("last_seen")
            
            # If online, timestamp is now. If offline, use DB value.
            timestamp = datetime.now().isoformat() if status == "online" else (last_seen.isoformat() if last_seen else None)

            try:
                await websocket.send_text(json.dumps({
                    "type": "status_update",
                    "username": uname,
                    "status": status,
                    "timestamp": timestamp
                }))
            except:
                pass
        
        print(f"[CONNECTED] {username}. Online users: {list(self.active_connections.keys())}")

    async def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]
        
        # Update DB: Set User Offline with Timestamp
        await users_collection.update_one(
            {"username": username},
            {"$set": {"status": "offline", "last_seen": datetime.now()}}
        )
        
        # Broadcast Offline Status
        await self.broadcast_status(username, "offline")
        
        print(f"[DISCONNECTED] {username}.")

    # 1. BROADCAST STATUS (Safely handles dead connections)
    async def broadcast_status(self, username: str, status: str):
        event = {
            "type": "status_update",
            "username": username,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        # Iterate copy of keys to safely delete during iteration
        for user, conn in list(self.active_connections.items()):
            try:
                await conn.send_text(json.dumps(event))
            except RuntimeError:
                print(f"⚠️ Removing dead connection: {user}")
                del self.active_connections[user]

    # 2. SEND DIRECT MESSAGE
    async def send_personal_message(self, message: dict, target_user: str):
        if target_user in self.active_connections:
            try:
                await self.active_connections[target_user].send_text(json.dumps(message))
                return True
            except RuntimeError:
                del self.active_connections[target_user]
                return False
        return False

    # 3. NOTIFY SENDER (Update Ticks: Sent -> Delivered)
    async def notify_sender_update(self, sender: str, msg_id: float, status: str):
        if sender in self.active_connections:
            try:
                event = {
                    "type": "message_status_update",
                    "id": msg_id,
                    "status": status
                }
                await self.active_connections[sender].send_text(json.dumps(event))
            except RuntimeError:
                del self.active_connections[sender]

    # 4. NOTIFY CHAT DELETED/CLEARED
    async def notify_chat_update(self, target_user: str, partner_name: str, action_type: str):
        if target_user in self.active_connections:
            try:
                event = {
                    "type": action_type, # "chat_cleared" or "chat_removed"
                    "partner": partner_name
                }
                await self.active_connections[target_user].send_text(json.dumps(event))
            except RuntimeError:
                del self.active_connections[target_user]

    # 5. NOTIFY SINGLE MESSAGE DELETED
    async def notify_message_deleted(self, target_user: str, message_id: float):
        if target_user in self.active_connections:
            try:
                event = {
                    "type": "message_deleted",
                    "id": message_id
                }
                await self.active_connections[target_user].send_text(json.dumps(event))
            except RuntimeError:
                del self.active_connections[target_user]

manager = ConnectionManager()

# --- API ENDPOINTS ---

@app.get("/online_users")
async def get_online_users():
    """Return list of currently connected usernames."""
    return {"online": list(manager.active_connections.keys())}

@app.get("/check_user/{username}")
async def check_user(username: str):
    user = await users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User does not exist")
    return {"exists": True, "status": user.get("status", "offline")}

@app.delete("/chat/{user1}/{user2}")
async def delete_chat_history(user1: str, user2: str, type: str = "clear"):
    # Delete from DB
    await messages_collection.delete_many({
        "$or": [
            {"sender": user1, "target": user2},
            {"sender": user2, "target": user1}
        ]
    })
    
    # Determine signal type
    # type="delete" -> Removes contact from Sidebar ("chat_removed")
    # type="clear"  -> Keeps contact, empties messages ("chat_cleared")
    signal_type = "chat_removed" if type == "delete" else "chat_cleared"

    # Delete Summaries
    await summaries_collection.delete_many({
        "participants": {"$all": [user1, user2]}
    })

    # Notify BOTH users
    await manager.notify_chat_update(user1, user2, signal_type)
    await manager.notify_chat_update(user2, user1, signal_type)

    return {"status": "success", "action": type}

@app.delete("/message/{message_id}")
async def delete_single_message(message_id: float):
    # Find message to know who needs to be notified
    msg = await messages_collection.find_one({"id": message_id})
    if not msg:
        return {"status": "ignored"}

    # Delete from DB
    await messages_collection.delete_one({"id": message_id})

    # Notify Sender and Target
    await manager.notify_message_deleted(msg["sender"], message_id)
    await manager.notify_message_deleted(msg["target"], message_id)

    return {"status": "success"}


# --- NEW: SEARCH MESSAGES FOR A USER ---
# Using /search/messages/{username} to avoid any route conflicts
@app.get("/search/messages/{username}")
async def search_user_messages(username: str, q: str = ""):
    """Search messages containing the query string (minimum 3 characters)."""
    # Validate minimum query length
    if len(q) < 3:
        return {"results": [], "error": "Query must be at least 3 characters"}
    
    # Search messages where user is sender or target and message contains query
    # Using case-insensitive regex search
    messages = await messages_collection.find({
        "$and": [
            {
                "$or": [
                    {"sender": username},
                    {"target": username}
                ]
            },
            {
                "message": {"$regex": q, "$options": "i"}
            }
        ]
    }).sort("timestamp", -1).to_list(length=50)  # Limit to 50 results
    
    # Format results with conversation partner info
    results = []
    for msg in messages:
        partner = msg["target"] if msg["sender"] == username else msg["sender"]
        results.append({
            "id": msg["id"],
            "sender": msg["sender"],
            "target": msg["target"],
            "partner": partner,
            "message": msg["message"],
            "timestamp": msg["timestamp"],
            "status": msg.get("status", "sent")
        })
    
    return {"results": results}


# --- LOAD ALL CONVERSATIONS FOR A USER ---

# --- LOAD SIDEBAR (Last Message only) ---
@app.get("/messages/{username}")
async def get_user_messages(username: str):
    """
    Fetch the LAST message for each conversation partner (for the Sidebar).
    """
    pipeline = [
        # 1. Match messages where user is sender OR target
        {
            "$match": {
                "$or": [{"sender": username}, {"target": username}]
            }
        },
        # 2. Sort by timestamp descending (newest first)
        {"$sort": {"timestamp": -1}},
        # 3. Add 'partner' field to group by
        {
            "$addFields": {
                "partner": {
                    "$cond": {
                        "if": {"$eq": ["$sender", username]},
                        "then": "$target",
                        "else": "$sender"
                    }
                }
            }
        },
        # 4. Group by partner and take the first (latest) document AND count unread
        {
            "$group": {
                "_id": "$partner",
                "last_message": {"$first": "$$ROOT"},
                "unread_count": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$target", username]},     # I am the target
                                {"$ne": ["$status", "read"]}        # Status is NOT read
                            ]},
                            1,
                            0
                        ]
                    }
                }
            }
        },
        # 5. Project format
        {
            "$project": {
                "_id": 0,
                "partner": "$_id",
                "last_message": 1,
                "unread_count": 1
            }
        }
    ]

    cursor = messages_collection.aggregate(pipeline)
    results = await cursor.to_list(length=None)

    # Format for frontend (matches expected 'conversations' map structure but only 1 item)
    conversations = {}
    for res in results:
        partner = res["partner"]
        msg = res["last_message"]
        
        conversations[partner] = [{
            "id": msg["id"],
            "sender": msg["sender"],
            "target": msg["target"],
            "message": msg["message"],
            "type": msg.get("type", "text"),
            "timestamp": msg["timestamp"],
            "status": msg.get("status", "sent"),
            "_unread_count": res["unread_count"] # Pass this if needed for UI, or UI calculates
        }]
    
    return {"conversations": conversations}


# --- PAGINATED CHAT HISTORY ---
@app.get("/chat_history/{user1}/{user2}")
async def get_chat_history(user1: str, user2: str, limit: int = 50, before: str = None):
    """
    Fetch paginated chat history between two users.
    'before': ISO timestamp string. Get messages OLDER than this time.
    """
    
    query = {
        "$or": [
            {"sender": user1, "target": user2},
            {"sender": user2, "target": user1}
        ]
    }
    
    # Pagination cursor
    if before:
        query["timestamp"] = {"$lt": before}
        
    messages = await messages_collection.find(query)\
        .sort("timestamp", -1)\
        .limit(limit)\
        .to_list(length=limit)
        
    # Reverse to return in Chronological Order (Oldest -> Newest)
    # Frontend appends these to the TOP, so it might actually want them Reversed?
    # Usually "History" API returns chunk [Newest ... Oldest] or [Oldest ... Newest].
    # Let's return [Oldest ... Newest] so it looks like a normal chat segment.
    messages.reverse() 
    
    results = []
    for msg in messages:
        results.append({
            "id": msg["id"],
            "sender": msg["sender"],
            "target": msg["target"],
            "message": msg["message"],
            "type": msg.get("type", "text"),
            "timestamp": msg["timestamp"],
            "status": msg.get("status", "sent")
        })
        
    return {"messages": results}


# --- WEBSOCKET ENDPOINT ---

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(websocket, username)
    
    try:
        # 1. ON CONNECT: Deliver any offline messages & Notify Senders
        # (Changes "Single Tick" to "Double Tick")
        pending_messages = await messages_collection.find({
            "target": username, 
            "status": "sent"
        }).to_list(length=None)

        for msg in pending_messages:
            # Update DB
            await messages_collection.update_one({"id": msg["id"]}, {"$set": {"status": "delivered"}})
            # Notify Original Sender
            await manager.notify_sender_update(msg["sender"], msg["id"], "delivered")

        # 2. MESSAGE LOOP
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # --- HEARTBEAT PING/PONG ---
            if payload.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue
            
            # --- SENDING TEXT ---
            if payload.get("type") in ["text", "image"]:
                msg_id = payload.get("id") or datetime.now().timestamp()
                target = payload["target"]
                
                # Check if target is online
                is_target_online = target in manager.active_connections
                
                # If online -> 'delivered' (Double Tick). Else 'sent' (Single Tick)
                initial_status = "delivered" if is_target_online else "sent"
                
                msg_data = {
                    "id": msg_id,
                    "sender": username,
                    "target": target,
                    "message": payload["message"],
                    "type": payload.get("type", "text"),
                    "timestamp": datetime.now().isoformat(),
                    "status": initial_status 
                }
                
                # Save to DB
                await messages_collection.insert_one(msg_data)
                # 👇 FIX: Convert the ObjectId to a string immediately
                msg_data["_id"] = str(msg_data["_id"])

                # Send to Target (if online)
                if is_target_online:
                    await manager.send_personal_message(msg_data, target)
                    # Tell Sender: "Delivered"
                    await manager.notify_sender_update(username, msg_id, "delivered")

            # --- MARK READ (Blue Ticks) ---
            elif payload.get("type") == "mark_read":
                target_sender = payload["target"] 
                
                # Update DB to 'read'
                await messages_collection.update_many(
                    {"sender": target_sender, "target": username, "status": {"$ne": "read"}},
                    {"$set": {"status": "read"}}
                )
                
                # Tell Sender: "Read" (Blue Ticks)
                if target_sender in manager.active_connections:
                     await manager.active_connections[target_sender].send_text(json.dumps({
                         "type": "bulk_read_update",
                         "reader": username
                     }))

            # --- FETCH SAVED SUMMARY (No Generation) ---
            elif payload.get("type") == "fetch_summary":
                target_user = payload.get("with_user")
                if target_user:
                    # Find existing summary for this pair
                    # We store participants as a sorted list to ensure consistency, or use $all
                    # Let's use $all for query, but we might want a consistent way to key them.
                    # Actually, standardizing on sorted participants is better for unique constraints, 
                    # but $all is fine for retrieval.
                    
                    existing_summary = await summaries_collection.find_one({
                        "participants": {"$all": [username, target_user]}
                    })
                    
                    if existing_summary:
                        await websocket.send_text(json.dumps({
                            "type": "chat_summary",
                            "summary": existing_summary["summary"],
                            "updated_at": existing_summary["updated_at"]
                        }))
                    else:
                        # No summary exists yet
                        await websocket.send_text(json.dumps({
                            "type": "chat_summary",
                            "summary": None, # Indicates no summary
                            "updated_at": None
                        }))

            # --- GENERATE SUMMARY (With Checks) ---
            elif payload.get("type") == "generate_summary":
                target_user = payload.get("with_user")
                print(f"🧠 DEBUG: generate_summary request for {username} -> {target_user}")
                if target_user:
                    # 1. Check Existing Summary
                    existing_summary = await summaries_collection.find_one({
                        "participants": {"$all": [username, target_user]}
                    })
                    
                    should_generate = False
                    
                    if not existing_summary:
                        print("🧠 DEBUG: No existing summary found. Generating new.")
                        # Nevr generated -> Go ahead
                        should_generate = True
                    else:
                        last_gen_time = datetime.fromisoformat(existing_summary["updated_at"])
                        time_diff = datetime.now() - last_gen_time
                        print(f"🧠 DEBUG: Last generated: {last_gen_time}, Time diff: {time_diff}")
                        
                        # Rule 1: Must be > 24 hours
                        if time_diff.total_seconds() > 86400: # 24 hours
                            print("🧠 DEBUG: > 24 hours passed. Checking for new messages...")
                            # Rule 2: Must have new messages since last generation
                            # Find messages after last_gen_time
                            new_msgs_count = await messages_collection.count_documents({
                                "$or": [
                                    {"sender": username, "target": target_user},
                                    {"sender": target_user, "target": username}
                                ],
                                "timestamp": {"$gt": existing_summary["updated_at"]}
                            })
                            print(f"🧠 DEBUG: New messages count: {new_msgs_count}")
                            
                            if new_msgs_count > 0:
                                should_generate = True
                            else:
                                print("🧠 DEBUG: No new messages. Skipping generation.")
                        else:
                            print("🧠 DEBUG: < 24 hours. Skipping generation.")
                    
                    if should_generate:
                        print("🧠 DEBUG: Proceeding to generate summary...")
                        # Fetch conversation history
                        msgs = await messages_collection.find({
                            "$or": [
                                {"sender": username, "target": target_user},
                                {"sender": target_user, "target": username}
                            ]
                        }).sort("timestamp", 1).to_list(length=100) # Last 100
                        
                        print(f"🧠 DEBUG: Fetched {len(msgs)} messages for context.")

                        # Generate (BLOCKING CALL -> Thread Pool)
                        import asyncio
                        from functools import partial
                        from chat_summary import generate_chat_summary
                        
                        loop = asyncio.get_running_loop()
                        # Run synchronous API call in a thread
                        summary_data = await loop.run_in_executor(
                            None, 
                            partial(generate_chat_summary, msgs)
                        )
                        print(f"🧠 DEBUG: Summary generated")
                        
                        # Save to DB
                        print("🧠 DEBUG: Saving to DB...")
                        if existing_summary:
                            # Update existing document by ID to avoid query strictness issues
                            await summaries_collection.update_one(
                                {"_id": existing_summary["_id"]},
                                {"$set": {
                                    "summary": summary_data["summary"],
                                    "updated_at": summary_data["updated_at"]
                                }}
                            )
                        else:
                            # Insert new document with strict sorted participants
                            # Using exact match query + upsert ensures clean insertion
                            sorted_participants = sorted([username, target_user])
                            await summaries_collection.update_one(
                                {"participants": sorted_participants},
                                {"$set": {
                                    "participants": sorted_participants,
                                    "summary": summary_data["summary"],
                                    "updated_at": summary_data["updated_at"]
                                }},
                                upsert=True
                            )
                        
                        # Send back new summary
                        await websocket.send_text(json.dumps({
                            "type": "chat_summary",
                            "summary": summary_data["summary"],
                            "updated_at": summary_data["updated_at"]
                        }))
                    else:
                        print("🧠 DEBUG: Generation skipped. Sending 'no_update' response.")
                        # Did NOT generate (Rate limited or No new messages)
                        # Start by reusing the old one if it exists
                        if existing_summary:
                            await websocket.send_text(json.dumps({
                                "type": "chat_summary_no_update",
                                "message": "Summary is up to date (Wait 24h or continue chatting)",
                                "summary": existing_summary["summary"],
                                "updated_at": existing_summary["updated_at"]
                            }))  
                        else:
                             # Should technically be covered by "if not existing_summary -> should_generate=True"
                             # But purely safe fallback
                             pass

            # --- TYPING INDICATOR ---
            elif payload.get("type") == "typing":
                target = payload.get("target")
                is_typing = payload.get("isTyping", False)
                
                # Relay to target user if online
                if target in manager.active_connections:
                    try:
                        await manager.active_connections[target].send_text(json.dumps({
                            "type": "typing_indicator",
                            "username": username,
                            "isTyping": is_typing
                        }))
                    except:
                        pass

    except WebSocketDisconnect:
        await manager.disconnect(username)
    except Exception as e:
        print(f"Error in websocket: {e}")
        await manager.disconnect(username)
