import { useState, useEffect, useCallback, useRef } from 'react';

// Determine Environment
const isDev = import.meta.env.DEV; // Vite provides this boolean

let API_BASE, WS_BASE;

const envApiUrl = import.meta.env.VITE_BACKEND_URL;

if (envApiUrl) {
    API_BASE = envApiUrl;
    WS_BASE = envApiUrl.startsWith('https') 
        ? envApiUrl.replace('https://', 'wss://') 
        : envApiUrl.replace('http://', 'ws://');
} else if (isDev) {
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
    WS_BASE = `${protocol}//${host}`; // Nginx will proxy /ws to backend
}

// Notification sound - unlocks on first user interaction
let notificationAudio = null;
let audioUnlocked = false;

try {
    notificationAudio = new Audio('/notification.mp3');
    notificationAudio.preload = 'auto';
    notificationAudio.volume = 0; // Start silent to avoid "pop" on unlock
} catch (e) {
    console.warn('Could not preload notification sound:', e);
}

// Unlock audio on any user interaction
const unlockAudio = () => {
    if (audioUnlocked || !notificationAudio) return;

    // Play silent audio to unlock autoplay
    const playPromise = notificationAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            notificationAudio.pause();
            notificationAudio.currentTime = 0;
            audioUnlocked = true;
            console.log('🔇 Audio unlocked silently');
        }).catch(() => {
            // Still needs interaction, will retry on next event
        });
    }
};

// Listen for ANY user interaction to unlock audio
if (typeof document !== 'undefined') {
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(event => {
        document.addEventListener(event, unlockAudio, { passive: true });
    });
}

// Throttle notification sound (max once every 1 minute)
let lastNotificationTime = 0;
const NOTIFICATION_THROTTLE_MS = 60000; // 1 minute

// Play notification sound (throttled)
const playNotification = (senderName, message) => {
    if (!notificationAudio || !audioUnlocked) {
        if (!audioUnlocked) {
            console.log('🔇 Audio not unlocked yet - interact with page first');
        }
        return;
    }

    const now = Date.now();
    if (now - lastNotificationTime < NOTIFICATION_THROTTLE_MS) {
        console.log('🔕 Notification throttled');
        return;
    }

    lastNotificationTime = now;
    const sound = notificationAudio.cloneNode();
    sound.volume = 1.0; // Set volume to 1.0 for actual notification
    sound.play()
        .then(() => console.log('✅ Notification sound played!'))
        .catch(e => console.warn('Sound failed:', e.message));
};

// Export for potential use
export const requestNotificationPermission = async () => 'granted'; // Dummy for compatibility
export const getNotificationPermission = () => 'granted'; // Dummy for compatibility

export const useWebSocket = (myUsername) => {
    const [conversations, setConversations] = useState({});
    const [userStatuses, setUserStatuses] = useState({});
    const [typingUsers, setTypingUsers] = useState({});
    const [unreadCounts, setUnreadCounts] = useState({}); // { "UserB": 3 }
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeout = useRef(null);
    const activeChatRef = useRef(null); // Track currently open chat

    // 🔍 DEBUG: Log Init
    useEffect(() => {
        console.log("🪝 useWebSocket Hook Initialized");
        console.log("   - myUsername:", myUsername);
        console.log("   - API_BASE:", API_BASE);
        console.log("   - WS_BASE:", WS_BASE);
        console.log("   - isDev:", isDev);
    }, [myUsername]);

    // Function to update which chat is currently open (call from Chat.jsx)
    const setActiveChat = useCallback((username) => {
        activeChatRef.current = username;
    }, []);

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

    // Load chat history from database (Sidebar / Inbox)
    const loadChatHistory = async () => {
        console.log("📡 loadChatHistory calling:", `${API_BASE}/messages/${myUsername}`);
        try {
            const response = await fetch(`${API_BASE}/messages/${myUsername}`);
            if (response.ok) {
                const data = await response.json();
                console.log("📡 loadChatHistory received:", data);
                if (data.conversations) {
                    // 🛡️ Sanitize conversations to ensure they are arrays
                    const sanitizedConversations = {};
                    const rawConversations = data.conversations || {};

                    Object.keys(rawConversations).forEach(key => {
                        const val = rawConversations[key];
                        sanitizedConversations[key] = Array.isArray(val) ? val : [];
                    });

                    setConversations(sanitizedConversations);

                    // 🧠 Initialize Unread Counts from Backend
                    const initialUnread = {};
                    Object.values(data.conversations).forEach(msgs => {
                        if (msgs.length > 0) {
                            const lastMsg = msgs[0];
                            // Backend attaches _unread_count to the last message object
                            if (lastMsg._unread_count > 0) {
                                const partner = lastMsg.sender === myUsername ? lastMsg.target : lastMsg.sender;
                                initialUnread[partner] = lastMsg._unread_count;
                            }
                        }
                    });
                    setUnreadCounts(initialUnread);

                    console.log("📜 Loaded chat history:", Object.keys(data.conversations).length, "conversations");
                }
            }
        } catch (error) {
            console.error("❌ Failed to load chat history:", error);
            if (isDev) {
                console.warn("⚠️ Is Backend Running? Check http://localhost:8000/docs");
            }
        }
    };

    // 🧠 PAGINATION: Fetch specific chat history
    const fetchChatHistory = useCallback(async (targetUser, beforeTimestamp = null) => {
        if (!targetUser) {
            console.warn("fetchChatHistory called with no targetUser");
            return { count: 0 }; // 🧠 FIX: Return object to prevent crash
        }

        try {
            console.log(`📡 Fetching history for ${targetUser}, before=${beforeTimestamp}`);
            let url = `${API_BASE}/chat_history/${myUsername}/${targetUser}?limit=50`;
            if (beforeTimestamp) {
                url += `&before=${beforeTimestamp}`;
            }

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                const newMessages = data.messages || [];

                if (newMessages.length === 0) return { count: 0 };

                setConversations(prev => {
                    const currentMsgs = prev[targetUser] || [];

                    // If fetching initial history (no beforeTimestamp), replace the "Last Message Preview" 
                    // BUT only if we have just 1 message (heuristic for "sidebar loaded only")
                    // Actually, safer to merge by ID to avoid duplicates.

                    // Merge Strategy: Combine arrays and deduplicate by ID
                    const combined = beforeTimestamp
                        ? [...newMessages, ...currentMsgs] // Prepend older messages
                        : [...currentMsgs, ...newMessages]; // Initial load might be mostly empty or just preview

                    // Robust Deduplication
                    const seenIds = new Set();
                    const uniqueMsgs = [];

                    // If prepending, we want to respect time order. 
                    // We just sort by timestamp at the end to be safe.
                    const allMsgs = [...newMessages, ...currentMsgs];

                    // Sort ASC
                    allMsgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                    allMsgs.forEach(msg => {
                        if (!seenIds.has(msg.id)) {
                            seenIds.add(msg.id);
                            uniqueMsgs.push(msg);
                        }
                    });

                    return {
                        ...prev,
                        [targetUser]: uniqueMsgs
                    };
                });

                return { count: newMessages.length };
            }
        } catch (error) {
            console.error("Failed to fetch chat history:", error);
            return { count: 0 };
        }
    }, [myUsername]);

    useEffect(() => {
        if (!myUsername) return;

        let heartbeatInterval = null;

        const connect = () => {
            if (socketRef.current) return;

            console.log(`🔌 Connecting to ${WS_BASE}/ws/${myUsername}...`);
            const ws = new WebSocket(`${WS_BASE}/ws/${myUsername}`);
            socketRef.current = ws;

            ws.onopen = () => {
                console.log("✅ Connected to Backend");
                setIsConnected(true);
                reconnectAttempts.current = 0;

                // Fetch all currently online users (reliable HTTP fallback)
                fetch(`${API_BASE}/online_users`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.online) {
                            setUserStatuses(prev => {
                                const updated = { ...prev };
                                // Mark everyone as offline first, then set online ones
                                Object.keys(updated).forEach(u => updated[u] = { status: 'offline', lastSeen: new Date().toISOString() });
                                data.online.forEach(u => { 
                                    if (u !== myUsername) {
                                        updated[u] = { status: 'online', lastSeen: new Date().toISOString() };
                                    } 
                                });
                                return updated;
                            });
                        }
                    })
                    .catch(e => console.error("Failed to fetch online users:", e));

                // Heartbeat: Send ping every 25s to keep connection alive on Render
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                heartbeatInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "ping" }));
                    }
                }, 25000);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Ignore pong responses
                    if (data.type === "pong") return;

                    if (data.type === "message_deleted") {
                        const deletedId = data.id;

                        setConversations(prev => {
                            const newConvos = { ...prev };
                            Object.keys(newConvos).forEach(user => {
                                newConvos[user] = newConvos[user].filter(msg => msg.id !== deletedId);
                            });
                            return newConvos;
                        });
                        return;
                    }

                    if (data.type === "chat_cleared") {
                        const partner = data.partner;
                        setConversations(prev => ({
                            ...prev,
                            [partner]: []
                        }));
                        if (activeChatRef.current === partner) setActiveSummary(null);
                        return;
                    }
                    if (data.type === "chat_removed") {
                        const partner = data.partner;
                        setConversations(prev => {
                            const newConvos = { ...prev };
                            delete newConvos[partner];
                            return newConvos;
                        });
                        if (activeChatRef.current === partner) setActiveSummary(null);
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

                    // 4. CHAT SUMMARY RECEIVED
                    if (data.type === "chat_summary") {
                        setActiveSummary(data);
                        return;
                    }

                    // 4b. SUMMARY NO UPDATE (Cached)
                    if (data.type === "chat_summary_no_update") {
                        setActiveSummary(data);
                        return;
                    }

                    // 20. TYPING INDICATOR
                    if (data.type === "typing_indicator") {
                        setTypingUsers(prev => ({
                            ...prev,
                            [data.username]: data.isTyping
                        }));
                        return;
                    }

                    // 5. NORMAL MESSAGE
                    const otherUser = data.sender === myUsername ? data.target : data.sender;

                    if (data.sender !== myUsername) {
                        const isChatCurrentlyOpen = activeChatRef.current === otherUser;
                        if (!isChatCurrentlyOpen) {
                            playNotification(otherUser, data.message);
                            setUnreadCounts(prev => ({
                                ...prev,
                                [otherUser]: (prev[otherUser] || 0) + 1
                            }));
                        }
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
                if (heartbeatInterval) clearInterval(heartbeatInterval);

                const reconnectDelay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts.current));
                reconnectAttempts.current += 1;
                console.log(`🔄 Reconnecting in ${reconnectDelay / 1000}s...`);

                reconnectTimeout.current = setTimeout(() => {
                    if (myUsername && !socketRef.current) {
                        connect();
                    }
                }, reconnectDelay);
            };

            ws.onerror = (e) => console.error("WebSocket error:", e);
        };

        loadChatHistory();
        connect();

        return () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.close();
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

    // 8. REQUEST SUMMARY
    const [activeSummary, setActiveSummary] = useState(null);

    const fetchSavedSummary = useCallback((targetUsername) => {
        if (!targetUsername || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

        // Clear previous summary
        setActiveSummary(null);

        socketRef.current.send(JSON.stringify({
            type: "fetch_summary",
            with_user: targetUsername
        }));
    }, []);

    const generateNewSummary = useCallback((targetUsername) => {
        if (!targetUsername || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

        // Optional: Set a loading state here if desired
        // setActiveSummary({ loading: true }); 

        socketRef.current.send(JSON.stringify({
            type: "generate_summary",
            with_user: targetUsername
        }));
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
        clearUnread,
        fetchSavedSummary,
        generateNewSummary,
        activeSummary,
        fetchChatHistory, // 🧠 Exported
        setActiveChatInHook: setActiveChat // Export this so Chat.jsx can sync state
    };
};
