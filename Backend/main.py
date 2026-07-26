from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import json
import os
from typing import Dict

app = FastAPI()

# --- CORS SETUP (Allow Frontend) ---
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")
origins = ALLOWED_ORIGINS.split(",") if ALLOWED_ORIGINS != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE SETUP ---
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.chat_db
users_collection = db.users
messages_collection = db.messages

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
        
        # Broadcast "User is Online" to everyone
        await self.broadcast_status(username, "online")
        print(f"🔵 {username} connected.")

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]
        print(f"🔴 {username} disconnected.")

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

# --- NEW: LOAD ALL CONVERSATIONS FOR A USER ---
@app.get("/messages/{username}")
async def get_user_messages(username: str):
    """Fetch all messages where the user is sender or target, grouped by conversation partner."""
    messages = await messages_collection.find({
        "$or": [
            {"sender": username},
            {"target": username}
        ]
    }).sort("timestamp", 1).to_list(length=1000)
    
    # Group messages by conversation partner
    conversations = {}
    for msg in messages:
        # Determine conversation partner
        partner = msg["target"] if msg["sender"] == username else msg["sender"]
        
        if partner not in conversations:
            conversations[partner] = []
        
        # Convert ObjectId to string and format for frontend
        conversations[partner].append({
            "id": msg["id"],
            "sender": msg["sender"],
            "target": msg["target"],
            "message": msg["message"],
            "type": msg.get("type", "text"),
            "timestamp": msg["timestamp"],
            "status": msg.get("status", "sent")
        })
    
    return {"conversations": conversations}


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

    except WebSocketDisconnect:
        manager.disconnect(username)
        await users_collection.update_one({"username": username}, {"$set": {"status": "offline"}})
        await manager.broadcast_status(username, "offline")
    except Exception as e:
        print(f"Error in websocket: {e}")
        manager.disconnect(username)