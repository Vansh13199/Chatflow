# ChatFlow - Realtime Chat Application

## 📌 Overview
ChatFlow is a modern, responsive frontend for a real-time chat application built with **React** and **Tailwind CSS**. It features a clean UI, dark mode support, and a custom WebSocket architecture for handling real-time messaging.

## 🚀 Tech Stack
- **Frontend Library:** React (Vite)
- **Styling:** Tailwind CSS
- **State Management:** React Hooks (useState, useEffect, useRef)
- **Architecture:** Component-Based with Custom Hooks

## 📂 Project Structure
src/
 ├── components/      # Reusable UI components (MessageBubble, Input, etc.)
 ├── hooks/           # Logic abstraction (useWebSocket)
 ├── pages/           # Application views (Login, Chat)
 ├── utils/           # Helper functions (Time formatting)
 └── App.jsx          # Main entry point with Theme management

## ✨ Key Features
1.  **Real-time Simulation:** Custom hook simulates server latency and bot replies.
2.  **Auto-Scroll:** Chat window automatically scrolls to the newest message.
3.  **Dark Mode:** Built-in theme toggler using Tailwind's `dark` class.
4.  **Responsive Design:** Optimized for both Desktop and Mobile views.

## 🛠️ Setup Instructions
1.  Clone the repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm run dev` to start the local server.