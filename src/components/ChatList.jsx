import React, { useState } from 'react';

const ChatList = ({ conversations, activeChat, onSelectChat, onOpenNewChat, userStatuses, unreadCounts }) => {
  const [searchQuery, setSearchQuery] = useState("");

  // 🔎 Filter users
  const users = Object.keys(conversations).filter(user =>
    user.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 w-full bg-white dark:bg-gray-900">

      {/* Header & Search */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg dark:text-white">Chats</h2>
          <button
            onClick={onOpenNewChat}
            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition shadow-md"
            title="New Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* 🔎 Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm transition"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* List of Users */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {users.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm mt-4">
            {searchQuery ? "No chats found." : "No active chats."}
          </div>
        ) : (
          users.map((user) => {
            const lastMsg = conversations[user][conversations[user].length - 1];
            const isActive = activeChat === user;

            return (
              <div
                key={user}
                onClick={() => onSelectChat(user)}
                className={`flex items-center p-4 cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition ${isActive ? 'bg-blue-50 dark:bg-gray-800 border-l-4 border-l-blue-500' : ''}`}
              >
                <div className="relative mr-3 shrink-0">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                    {user.charAt(0).toUpperCase()}
                  </div>
                  {userStatuses && userStatuses[user]?.status === 'online' && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{user}</h3>
                    {lastMsg && <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1 mr-2 flex items-center gap-1">
                      {lastMsg ? lastMsg.message : "Draft"}
                    </p>

                    {unreadCounts && unreadCounts[user] > 0 && (
                      <span className="bg-green-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shrink-0 animate-bounce-short">
                        {unreadCounts[user] > 99 ? '99+' : unreadCounts[user]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatList;