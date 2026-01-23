import React, { useState, useEffect, useRef, useCallback, memo } from 'react';

// Determine API base URL (same logic as useWebSocket)
const isDev = import.meta.env.DEV;
const getApiBase = () => {
  if (isDev) {
    const API_HOST = window.location.hostname || '127.0.0.1';
    return `http://${API_HOST}:8000`;
  }
  return '/api'; // Production uses Nginx proxy
};

const ChatList = memo(({ conversations, activeChat, onSelectChat, onOpenNewChat, userStatuses, unreadCounts, username }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [messageSearchResults, setMessageSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showMessageResults, setShowMessageResults] = useState(false);
  const debounceTimerRef = useRef(null);

  // API base URL - dynamically determined
  const API_BASE = getApiBase();

  // Debounced message search (minimum 3 characters, 500ms delay)
  const searchMessages = useCallback(async (query) => {
    if (query.length < 3) {
      setMessageSearchResults([]);
      setShowMessageResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE}/search/messages/${username}?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.results) {
        setMessageSearchResults(data.results);
        setShowMessageResults(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setMessageSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [username, API_BASE]);

  // Handle search input change with debouncing
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If less than 3 characters, clear results immediately
    if (query.length < 3) {
      setMessageSearchResults([]);
      setShowMessageResults(false);
      return;
    }

    // Debounce API call by 500ms
    debounceTimerRef.current = setTimeout(() => {
      searchMessages(query);
    }, 500);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle clicking a search result - pass message ID for jumping
  const handleSearchResultClick = (result) => {
    onSelectChat(result.partner, result.id); // Pass message ID to jump to
    setSearchQuery("");
    setShowMessageResults(false);
    setMessageSearchResults([]);
  };

  // 🔎 Filter users by name (existing functionality)
  const users = Object.keys(conversations).filter(user =>
    user.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Highlight matching text in search results
  const highlightMatch = (text, query) => {
    if (!query || query.length < 3) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600 rounded px-0.5">{part}</mark> : part
    );
  };

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
            placeholder="Search chats or messages (min 3 chars)"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-12 pr-4 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm transition"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 absolute left-4 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          {/* Loading indicator */}
          {isSearching && (
            <div className="absolute right-4 top-3">
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Search hint */}
        {searchQuery.length > 0 && searchQuery.length < 3 && (
          <p className="text-xs text-gray-400 mt-1">Type {3 - searchQuery.length} more character(s) to search messages</p>
        )}
      </div>

      {/* Message Search Results */}
      {showMessageResults && messageSearchResults.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-gray-800/50">
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Messages ({messageSearchResults.length})
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {messageSearchResults.map((result) => (
              <div
                key={result.id}
                onClick={() => handleSearchResultClick(result)}
                className="flex items-start p-3 cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-800 last:border-b-0"
              >
                <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-sm mr-3 shrink-0">
                  {result.partner.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{result.partner}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(result.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                    {result.sender === username ? 'You: ' : ''}
                    {highlightMatch(result.message, searchQuery)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No message results found */}
      {showMessageResults && messageSearchResults.length === 0 && searchQuery.length >= 3 && !isSearching && (
        <div className="px-4 py-3 text-sm text-gray-400 text-center bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          No messages found for "{searchQuery}"
        </div>
      )}

      {/* List of Users */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Section header when showing both */}
        {showMessageResults && users.length > 0 && (
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800">
            Chats
          </div>
        )}

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
});

ChatList.displayName = 'ChatList';

export default ChatList;