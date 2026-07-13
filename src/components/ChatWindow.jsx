import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatWindow = ({ 
  activeChat, 
  messages, 
  currentUser, 
  onSendMessage, 
  onBack, 
  status, 
  onDeleteChat, 
  onClearHistory,
  onDeleteMessage
}) => {
  const messagesEndRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = () => setShowMenu(false);
    if (showMenu) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  // 1. EMPTY STATE
  if (!activeChat) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35] border-l border-gray-200 dark:border-gray-700 transition-colors">
        <div className="text-center">
          <div className="bg-gray-100 dark:bg-[#111b21] rounded-full p-6 inline-block mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400 dark:text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
             </svg>
          </div>
          <h2 className="text-xl text-gray-500 dark:text-gray-300 font-medium">ChatFlow Web</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Select a chat to start messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] transition-colors duration-300">
      
      {/* 2. HEADER */}
      <div className="bg-white dark:bg-[#202c33] px-4 py-2.5 flex items-center justify-between shadow-sm z-10 border-l border-gray-200 dark:border-gray-700 transition-colors">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden text-gray-600 dark:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
          
          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-600 dark:text-white font-bold uppercase">
            {activeChat.charAt(0)}
          </div>
          
          <div className="flex flex-col justify-center">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-[16px] leading-tight">
                {activeChat}
            </h2>
            <p className="text-[13px] leading-tight mt-0.5">
              {status === 'online' ? (
                <span className="text-green-500 font-medium">Online</span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">Last seen recently</span>
              )}
            </p>
          </div>
        </div>

        {/* Menu Button */}
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-300 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 w-48 bg-white dark:bg-[#233138] shadow-xl rounded-lg py-2 z-50 border border-gray-100 dark:border-gray-700">
              <button 
                onClick={() => { onClearHistory(); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#182229]"
              >
                Clear Messages
              </button>
              <button 
                onClick={() => { onDeleteChat(); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                Delete Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. MESSAGES AREA - UPDATED FOR DARK MODE */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar 
        bg-[#efeae2] dark:bg-[#0b141a] dark:bg-blend-overlay transition-colors"
        style={{ 
            backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", 
            backgroundRepeat: 'repeat', 
            backgroundSize: '500px'
        }}
      >
        <div className="flex flex-col justify-end min-h-0">
            {messages.map((msg) => (
            <MessageBubble 
                key={msg.id} 
                message={msg} 
                isMe={msg.sender === currentUser} 
                onDelete={onDeleteMessage} // 👈 Pass it here
            />
            ))}
            <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageInput onSend={(text) => onSendMessage(activeChat, text)} />
    </div>
  );
};

export default ChatWindow;