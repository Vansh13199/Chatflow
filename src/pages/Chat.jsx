import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import StartChatModal from '../components/StartChatModal';
import Header from '../components/Header';

const Chat = ({ username, sessionKey, onLogout, isDarkMode, toggleTheme }) => {
    // 1. Initialize WebSocket with Session Key
    const {
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
        setActiveChat: setActiveChatInHook // Sync active chat to hook
    } = useWebSocket(username, sessionKey);

    const [activeChat, setActiveChat] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Handle selecting a chat (also clears unread and syncs to hook)
    const handleSelectChat = (user) => {
        setActiveChat(user);
        setActiveChatInHook(user); // Sync to hook so it knows which chat is open
        clearUnread(user);
    };

    // Responsive: If on mobile, hide list when chat is open
    const isMobileChatOpen = activeChat !== null;
    const prevMessageCountRef = React.useRef(0);

    // 2. BLUE TICKS LOGIC: Mark messages read when chat opens or new messages arrive
    useEffect(() => {
        if (!activeChat) return;

        const currentMsgCount = (conversations[activeChat] || []).length;

        // Only send receipt when chat first opens or new messages arrive
        if (currentMsgCount !== prevMessageCountRef.current) {
            prevMessageCountRef.current = currentMsgCount;
            sendReadReceipt(activeChat);
        }
    }, [activeChat, conversations, isConnected, sendReadReceipt]);


    return (
        // Outer Background - fixed position with safe area insets
        <div className="fixed inset-0 bg-gray-200 dark:bg-black flex items-center justify-center transition-colors duration-300"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'env(safe-area-inset-left)',
                paddingRight: 'env(safe-area-inset-right)'
            }}>

            {/* Main Container - fills remaining space */}
            <div className="flex w-full h-full md:h-[95%] md:w-[95%] max-w-[1700px] bg-white dark:bg-gray-900 shadow-2xl overflow-hidden md:rounded-xl border dark:border-gray-800 relative">

                {/* Left Panel: Sidebar */}
                <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} w-full md:w-96 lg:w-[30%] flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10`}>
                    <Header
                        username={username}
                        connectionStatus={isConnected}
                        isDarkMode={isDarkMode}
                        toggleTheme={toggleTheme}
                        onLogout={onLogout}
                    />
                    <ChatList
                        conversations={conversations}
                        activeChat={activeChat}
                        onSelectChat={handleSelectChat}
                        onOpenNewChat={() => setIsModalOpen(true)}
                        userStatuses={userStatuses}
                        unreadCounts={unreadCounts}
                    />
                </div>

                {/* Right Panel: Chat Window */}
                <div className={`${!isMobileChatOpen ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#efe7dd] dark:bg-gray-900 h-full relative`}>
                    <ChatWindow
                        activeChat={activeChat}
                        messages={activeChat ? conversations[activeChat] || [] : []}
                        currentUser={username}
                        onSendMessage={sendMessage}
                        onBack={() => {
                            setActiveChat(null);
                            setActiveChatInHook(null); // Sync to hook when closing chat
                        }}
                        isTyping={activeChat ? typingUsers[activeChat] : false}
                        userStatus={activeChat ? userStatuses[activeChat] : null}
                        onTyping={(isTyping) => sendTypingIndicator(activeChat, isTyping)}

                        // Actions
                        onDeleteMessage={deleteMessage}
                        onDeleteChat={() => {
                            deleteChat(activeChat);
                            setActiveChat(null);
                            setActiveChatInHook(null);
                        }}
                        onClearHistory={() => {
                            clearChatHistory(activeChat);
                        }}
                    />
                </div>
            </div>

            {/* Modal for new chat */}
            {isModalOpen && (
                <StartChatModal
                    onClose={() => setIsModalOpen(false)}
                    onStart={async (target) => {
                        // Try to start chat. Returns true if user exists, false if not.
                        const success = await startChat(target);
                        if (success) {
                            setActiveChat(target);
                            setActiveChatInHook(target); // Sync to hook
                            setIsModalOpen(false);
                            return true;
                        }
                        return false; // Show error in modal
                    }}
                />
            )}
        </div>
    );
};

export default Chat;