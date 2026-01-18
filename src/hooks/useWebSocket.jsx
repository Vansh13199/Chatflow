import { useState, useEffect, useCallback, useRef } from 'react';

// Determine Environment
const isDev = import.meta.env.DEV; // Vite provides this boolean

let API_BASE, WS_BASE;

if (isDev) {
    // Local Development (Frontend 5173 -> Backend 8000)
    const API_HOST = window.location.hostname || '127.0.0.1';
    API_BASE = `http://${API_HOST}:8000`;
    WS_BASE = `ws://${API_HOST}:8000`;
} else {
    // Production (Nginx Proxy served from same origin)
    // API -> /api
    // WS -> /ws
    const host = window.location.host; // Includes port if any (e.g. example.com or 192.168.1.5:80)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    API_BASE = `/api`; // Nginx will proxy /api to backend
    WS_BASE = `${protocol}//${host}/ws`; // Nginx will proxy /ws to backend
}

export const useWebSocket = (myUsername) => {
    const [conversations, setConversations] = useState({});
    const [userStatuses, setUserStatuses] = useState({});
    const [typingUsers, setTypingUsers] = useState({});
    const [unreadCounts, setUnreadCounts] = useState({}); // { "UserB": 3 }
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeout = useRef(null);

    // --- HELPERS ---

    // Add or Update Message in State
    const addMessage = useCallback((otherUser, messageData) => {
        setConversations((prev) => {
            const existing = prev[otherUser] || [];
            // Check if message ID already exists (prevent duplicates)
            const index = existing.findIndex(m => m.id === messageData.id);

            if (index !== -1) {
                // Update existing message (e.g. status change 'sent' -> 'delivered')
                const updated = [...existing];
                updated[index] = { ...updated[index], ...messageData };
                return { ...prev, [otherUser]: updated };
            }

            // Append new message
            return { ...prev, [otherUser]: [...existing, messageData] };
        });
    }, []);

    // Update status of a specific message (for Ticks)
    const updateMessageStatus = useCallback((msgId, newStatus) => {
        setConversations(prev => {
            const newConversations = { ...prev };
            Object.keys(newConversations).forEach(user => {
                newConversations[user] = newConversations[user].map(msg =>
                    msg.id === msgId ? { ...msg, status: newStatus } : msg
                );
            });
            return newConversations;
        });
    }, []);

    // Mark all messages from a user as read (Bulk Update)
    const markAllAsRead = useCallback((user) => {
        setConversations(prev => {
            if (!prev[user]) return prev;
            return {
                ...prev,
                [user]: prev[user].map(msg =>
                    msg.sender !== myUsername ? { ...msg, status: 'read' } : msg
                )
            };
        });
    }, [myUsername]);


    // --- CONNECTION LOGIC ---

    // Load chat history from database
    const loadChatHistory = async () => {
        try {
            const response = await fetch(`${API_BASE}/messages/${myUsername}`);
            if (response.ok) {
                const data = await response.json();
                if (data.conversations) {
                    setConversations(data.conversations);
                    console.log("📜 Loaded chat history:", Object.keys(data.conversations).length, "conversations");
                }
            }
        } catch (error) {
            console.error("Failed to load chat history:", error);
        }
    };

    useEffect(() => {
        if (!myUsername) return;
        if (socketRef.current) return;

        // Load existing messages first
        loadChatHistory();

        console.log(`🔌 Connecting to ${WS_BASE}/ws/${myUsername}...`);
        const ws = new WebSocket(`${WS_BASE}/ws/${myUsername}`);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log("✅ Connected to Backend");
            setIsConnected(true);
            reconnectAttempts.current = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // ... (Status & Tick updates remain here) ...
                // ... (Status & Tick updates remain here) ...
                if (data.type === "message_deleted") {
                    const deletedId = data.id;

                    setConversations(prev => {
                        const newConvos = { ...prev };
                        // We don't know exactly which user chat this message belongs to easily,
                        // so we scan all chats and remove it. (Safe & Simple)
                        Object.keys(newConvos).forEach(user => {
                            newConvos[user] = newConvos[user].filter(msg => msg.id !== deletedId);
                        });
                        return newConvos;
                    });
                    return;
                }

                // 👇 CASE A: CLEAR HISTORY (Keep sidebar, empty messages)
                if (data.type === "chat_cleared") {
                    const partner = data.partner;
                    setConversations(prev => ({
                        ...prev,
                        [partner]: [] // ✅ Set to empty array (Sidebar stays)
                    }));
                    return;
                }
                if (data.type === "chat_removed") {
                    const partner = data.partner;
                    setConversations(prev => {
                        const newConvos = { ...prev };
                        delete newConvos[partner]; // ✅ Remove Key (Sidebar item disappears)
                        return newConvos;
                    });
                    return;
                }

                // 1. STATUS UPDATE (Online/Offline)
                if (data.type === "status_update") {
                    setUserStatuses(prev => ({
                        ...prev,
                        [data.username]: {
                            status: data.status,
                            lastSeen: data.timestamp
                        }
                    }));
                    return;
                }

                // 2. MESSAGE TICK UPDATE (Sent -> Delivered)
                if (data.type === "message_status_update") {
                    updateMessageStatus(data.id, data.status);
                    return;
                }

                // 3. BULK READ RECEIPT (User read my messages)
                if (data.type === "bulk_read_update") {
                    setConversations(prev => {
                        const updatedConvos = { ...prev };
                        if (updatedConvos[data.reader]) {
                            updatedConvos[data.reader] = updatedConvos[data.reader].map(msg =>
                                msg.sender === myUsername ? { ...msg, status: 'read' } : msg
                            );
                        }
                        return updatedConvos;
                    });
                    return;
                }

                // 4. TYPING INDICATOR
                if (data.type === "typing_indicator") {
                    setTypingUsers(prev => ({
                        ...prev,
                        [data.username]: data.isTyping
                    }));
                    return;
                }

                // 5. NORMAL MESSAGE
                const otherUser = data.sender === myUsername ? data.target : data.sender;

                // Play Sound & Increment unread if receiving (not from self)
                if (data.sender !== myUsername) {
                    const audio = new Audio('/notification.mp3');
                    audio.play().catch(e => { });

                    // Increment unread count for this sender
                    setUnreadCounts(prev => ({
                        ...prev,
                        [otherUser]: (prev[otherUser] || 0) + 1
                    }));
                }

                addMessage(otherUser, data);

            } catch (e) {
                console.error("Error parsing WebSocket message:", e);
            }
        };

        ws.onclose = () => {
            console.log("❌ Disconnected from Server");
            setIsConnected(false);
            socketRef.current = null;

            // Auto-reconnect with exponential backoff
            const reconnectDelay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts.current));
            reconnectAttempts.current += 1;
            console.log(`🔄 Reconnecting in ${reconnectDelay / 1000}s...`);

            reconnectTimeout.current = setTimeout(() => {
                if (myUsername && !socketRef.current) {
                    console.log(`🔌 Attempting reconnect to ${WS_BASE}/ws/${myUsername}...`);
                    const newWs = new WebSocket(`${WS_BASE}/ws/${myUsername}`);
                    socketRef.current = newWs;

                    newWs.onopen = ws.onopen;
                    newWs.onmessage = ws.onmessage;
                    newWs.onclose = ws.onclose;
                    newWs.onerror = (e) => console.error("WebSocket error:", e);
                }
            }, reconnectDelay);
        };

        return () => {
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            if (ws.readyState === 1) ws.close();
        };
    }, [myUsername, addMessage, updateMessageStatus]);


    // --- ACTIONS ---

    // 1. START CHAT (With DB Check)
    const startChat = async (targetUsername) => {
        // A. Self Check
        if (targetUsername === myUsername) {
            return false; // Fail silently (UI can handle specific error if needed, but 'User not found' covers it generally)
        }

        // B. Already Open
        if (conversations[targetUsername]) {
            return true;
        }

        try {
            // C. API Check
            const response = await fetch(`${API_BASE}/check_user/${targetUsername}`);

            if (!response.ok) {
                return false; // ❌ Return false, don't alert
            }

            const data = await response.json();

            setUserStatuses(prev => ({ ...prev, [targetUsername]: data.status }));
            setConversations((prev) => ({ ...prev, [targetUsername]: [] }));

            return true; // ✅ Success

        } catch (error) {
            console.error("Start Chat Error:", error);
            return false; // ❌ Return false
        }
    };
    // 2. SEND MESSAGE
    const sendMessage = (targetUsername, content, type = 'text') => {
        if (!content) return;
        const messageId = Date.now(); // Optimistic ID

        const localMsg = {
            id: messageId,
            sender: myUsername,
            message: content,
            type: type,
            timestamp: Date.now(),
            status: 'sent'
        };

        // Update UI immediately
        addMessage(targetUsername, localMsg);

        // Send to Backend
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                id: messageId,
                target: targetUsername,
                message: content,
                type: type
            }));
        } else {
            console.warn("WebSocket not open. Message saved locally but not sent.");
        }
    };

    // 3. SEND READ RECEIPT
    const sendReadReceipt = (targetUsername) => {
        // Safety check
        if (!targetUsername || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

        // Tell Server
        socketRef.current.send(JSON.stringify({
            type: "mark_read",
            target: targetUsername
        }));

        // 2. Optimistic Update (Optional: Mark incoming messages as read locally instantly)
        // We don't change 'sent' messages (that's for the other person), 
        // but we can ensure our internal state is consistent.
    };

    // 4. DELETE CHAT (From DB + UI)
    const deleteChat = async (targetUsername) => {
        // Optimistic UI
        setConversations(p => { const n = { ...p }; delete n[targetUsername]; return n; });

        try {
            // 👇 Send ?type=delete
            await fetch(`${API_BASE}/chat/${myUsername}/${targetUsername}?type=delete`, {
                method: 'DELETE'
            });
        } catch (err) { console.error(err); }
    };

    // 5. CLEAR HISTORY (From DB + UI)
    const clearChatHistory = async (targetUsername) => {
        // Optimistic UI
        setConversations(p => ({ ...p, [targetUsername]: [] }));

        try {
            // 👇 Send ?type=clear
            await fetch(`${API_BASE}/chat/${myUsername}/${targetUsername}?type=clear`, {
                method: 'DELETE'
            });
        } catch (err) { console.error(err); }
    };
    const deleteMessage = async (msgId) => {
        // Optimistic Update (Remove locally immediately)
        setConversations(prev => {
            const newConvos = { ...prev };
            Object.keys(newConvos).forEach(user => {
                newConvos[user] = newConvos[user].filter(msg => msg.id !== msgId);
            });
            return newConvos;
        });

        // Call Backend
        try {
            await fetch(`${API_BASE}/message/${msgId}`, { method: 'DELETE' });
        } catch (err) { console.error("Failed to delete message:", err); }
    };

    // 6. SEND TYPING INDICATOR
    const sendTypingIndicator = useCallback((targetUsername, isTyping) => {
        if (!targetUsername || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

        socketRef.current.send(JSON.stringify({
            type: "typing",
            target: targetUsername,
            isTyping: isTyping
        }));
    }, []);

    // 7. CLEAR UNREAD COUNT (when user opens a chat)
    const clearUnread = useCallback((username) => {
        setUnreadCounts(prev => {
            const updated = { ...prev };
            delete updated[username];
            return updated;
        });
    }, []);

    return {
        conversations,
        startChat,
        sendMessage,
        deleteChat,
        clearChatHistory,
        deleteMessage,
        isConnected,
        userStatuses,
        typingUsers,
        unreadCounts,
        sendReadReceipt,
        sendTypingIndicator,
        clearUnread
    };
};