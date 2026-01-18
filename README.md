# ChatFlow - Realtime Chat Application

ChatFlow is a modern, full-stack real-time chat application built to replicate the experience of popular messaging apps like WhatsApp. It features a responsive React frontend and a high-performance FastAPI backend with WebSocket support.

## 🚀 Tech Stack

### Frontend
- **Framework:** React (Vite)
- **Styling:** Tailwind CSS
- **State Management:** React Hooks
- **Communication:** Native WebSockets

### Backend
- **Framework:** FastAPI (Python)
- **Database:** MongoDB (via Motor async driver)
- **Real-time:** WebSockets with Connection Manager

## ✨ Key Features

### 💬 Messaging
- **Real-time Communication:** Instant message delivery via WebSockets.
- **Message Persistence:** Chat history is stored in MongoDB and loads on login.
- **Read Receipts:** Double blue ticks indicate when a message has been read by the recipient.
- **Typing Indicators:** Real-time "typing..." status shown to the other user.
- **Unread Message Counters:** Green badge counts unread messages for each chat (WhatsApp style).

### 📱 User Experience
- **Responsive Design:** Fully optimized for Mobile and Desktop.
- **PWA Support:** Installable as a native-like app on mobile devices (fullscreen, safe areas).
- **Sticky Date Headers:** Date labels (Today, Yesterday) stick to the top while scrolling.
- **12-Hour Time Format:** All times displayed in AM/PM format.
- **Dark Mode:** Built-in theme toggler.

### 🟢 Status & Availability
- **Live Online/Offline Status:** Green dot indicator for online users.
- **Last Seen:** Detailed last seen info (e.g., "last seen today at 10:30 PM", "last seen recently").

## 🛠️ Setup Instructions

### Prerequisites
- Node.js & npm
- Python 3.8+
- MongoDB (Local or Atlas)

### 1. Backend Setup
1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Mac/Linux
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install fastapi uvicorn websockets motor python-multipart
   ```
4. Start the server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

### 2. Frontend Setup
1. Navigate to the root directory (where `package.json` is):
   ```bash
   cd ..
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` (or your local IP for mobile testing) in your browser.

## 📱 Mobile Testing
To test on mobile within your local network:
1. Ensure your computer and phone are on the same Wi-Fi.
2. Update `src/hooks/useWebSocket.jsx` to use your computer's local IP (or leave as `window.location.hostname` which automatically handles it).
3. Access the app via `http://<YOUR_PC_IP>:5173`.
4. Add to Home Screen for the full PWA experience.

## � Project Structure
```
Chatflow/
├── Backend/             # FastAPI Server & DB Logic
│   └── main.py          # Entry point
├── src/
│   ├── components/      # UI Components (ChatWindow, ChatList, etc.)
│   ├── hooks/           # Custom Hooks (useWebSocket)
│   ├── pages/           # Pages (Chat, Login)
│   └── index.css        # Global Styles (Tailwind imports)
├── public/
│   └── manifest.json    # PWA Configuration
└── README.md            # You are here
```