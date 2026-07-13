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
    sendReadReceipt, // ✅ Imported for Blue Ticks
    isTyping 
  } = useWebSocket(username, sessionKey);
  
  const [activeChat, setActiveChat] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Responsive: If on mobile, hide list when chat is open
  const isMobileChatOpen = activeChat !== null;

  // 2. BLUE TICKS LOGIC: Mark messages read when chat is open
  useEffect(() => {
    if (!activeChat) return;

    // Send "I read this" signal immediately
    sendReadReceipt(activeChat);

    // Retry once after 1s (in case socket was just connecting)
    const timer = setTimeout(() => {
        if (isConnected) sendReadReceipt(activeChat);
    }, 1000);

    return () => clearTimeout(timer);
    
    // Trigger when: ActiveChat changes OR New messages arrive
  }, [activeChat, conversations[activeChat]?.length, isConnected, sendReadReceipt]);


  return (
    // Outer Background
    <div className="h-screen w-screen bg-gray-200 dark:bg-black flex items-center justify-center transition-colors duration-300">

        {/* Main Floating Card Container */}
        <div className="flex w-full h-full md:h-[95vh] md:w-[95%] max-w-[1700px] bg-white dark:bg-gray-900 shadow-2xl overflow-hidden md:rounded-xl border dark:border-gray-800 relative">
            
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
                   onSelectChat={setActiveChat}
                   onOpenNewChat={() => setIsModalOpen(true)}
                   userStatuses={userStatuses}
                />
            </div>

            {/* Right Panel: Chat Window */}
            <div className={`${!isMobileChatOpen ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#efe7dd] dark:bg-gray-900 h-full relative`}>
                <ChatWindow 
                    activeChat={activeChat}
                    messages={activeChat ? conversations[activeChat] || [] : []}
                    currentUser={username} 
                    onSendMessage={sendMessage}
                    onBack={() => setActiveChat(null)}
                    isTyping={isTyping}
                    status={activeChat ? userStatuses[activeChat] : 'offline'} 
                    
                    // Actions
                    onDeleteMessage={deleteMessage} 
                    onDeleteChat={() => {
                        deleteChat(activeChat); 
                        setActiveChat(null);    
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