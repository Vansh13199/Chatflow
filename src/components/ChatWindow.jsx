import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

// Helper function to get date label - moved outside component for reuse
const getDateLabel = (timestamp) => {
  const msgDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const msgDateStr = msgDate.toDateString();
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();

  if (msgDateStr === todayStr) return 'Today';
  if (msgDateStr === yesterdayStr) return 'Yesterday';

  // Check if within last 7 days
  const diffTime = today.getTime() - msgDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return weekdays[msgDate.getDay()];
  }

  // Older than a week - show date
  const day = String(msgDate.getDate()).padStart(2, '0');
  const month = String(msgDate.getMonth() + 1).padStart(2, '0');
  const year = msgDate.getFullYear();
  return `${day}/${month}/${year}`;
};

const ChatWindow = ({
  activeChat,
  messages,
  currentUser,
  onSendMessage,
  onBack,
  userStatus,
  isTyping,
  onTyping,
  onDeleteChat,
  onClearHistory,
  onDeleteMessage,
  scrollToMessageId,
  onScrollComplete,
  onRequestSummary,
  summaryData
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const dateSeparatorRefs = useRef({});
  const messageRefs = useRef({});
  const [showMenu, setShowMenu] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [lastSeenText, setLastSeenText] = useState('');
  const [currentFloatingDate, setCurrentFloatingDate] = useState(null);
  const [isFloatingDateVisible, setIsFloatingDateVisible] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isRequestingSummary, setIsRequestingSummary] = useState(false);

  // Auto-show summary when data arrives
  useEffect(() => {
    if (summaryData) {
      setShowSummary(true);
      setIsRequestingSummary(false);
    }
  }, [summaryData]);

  const handleRequestSummary = () => {
    if (showSummary) {
      setShowSummary(false);
    } else {
      setIsRequestingSummary(true);
      onRequestSummary();
    }
  };

  // Get unique date labels from messages
  const dateSections = useMemo(() => {
    const sections = [];
    let lastLabel = null;
    messages.forEach((msg, index) => {
      const label = getDateLabel(msg.timestamp);
      if (label !== lastLabel) {
        sections.push({ label, firstMessageIndex: index });
        lastLabel = label;
      }
    });
    return sections;
  }, [messages]);

  // Update floating date based on scroll position
  const updateFloatingDate = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || dateSections.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;

    let currentLabel = null;

    // Find the date separator that's currently at or just above the container top
    for (const section of dateSections) {
      const ref = dateSeparatorRefs.current[section.label];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        // If this separator is above or at the top of the container, it's the current one
        if (rect.top <= containerTop + 60) {
          currentLabel = section.label;
        }
      }
    }

    // If we found a label and we've scrolled past the first separator, show floating date
    if (currentLabel) {
      setCurrentFloatingDate(currentLabel);
      setIsFloatingDateVisible(true);
    } else {
      setIsFloatingDateVisible(false);
    }
  }, [dateSections]);

  // Format last seen time
  const getLastSeenText = () => {
    if (!userStatus) return '';
    if (userStatus.status === 'online') return null;
    if (!userStatus.lastSeen) return '';

    const lastSeenDate = new Date(userStatus.lastSeen);
    const now = new Date();
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'last seen recently';

    const timeStr = lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    if (lastSeenDate.toDateString() === now.toDateString()) {
      return `last seen today at ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastSeenDate.toDateString() === yesterday.toDateString()) {
      return `last seen yesterday at ${timeStr}`;
    }

    const day = String(lastSeenDate.getDate()).padStart(2, '0');
    const month = String(lastSeenDate.getMonth() + 1).padStart(2, '0');
    return `last seen ${day}/${month} at ${timeStr}`;
  };

  // Update last seen text dynamically every 30 seconds
  useEffect(() => {
    setLastSeenText(getLastSeenText());

    const interval = setInterval(() => {
      setLastSeenText(getLastSeenText());
    }, 30000);

    return () => clearInterval(interval);
  }, [userStatus]);

  // Scroll to bottom when chat first opens or when switching chats
  // Skip if we have a scrollToMessageId pending
  useEffect(() => {
    if (!activeChat || !messagesContainerRef.current) return;

    // If we have a message to scroll to, don't scroll to bottom
    if (scrollToMessageId) return;

    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [activeChat]); // Only depend on activeChat, not scrollToMessageId

  // Scroll to specific message when scrollToMessageId is set (from search)
  useEffect(() => {
    if (!scrollToMessageId) return;

    // Use longer delay to ensure:
    // 1. The chat has switched and rendered
    // 2. The messageRefs are populated
    // 3. Any initial scroll-to-bottom has been overridden
    const scrollTimer = setTimeout(() => {
      const messageElement = messageRefs.current[scrollToMessageId];
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(scrollToMessageId);

        // Remove highlight after 1 seconds
        setTimeout(() => {
          setHighlightedMessageId(null);
          if (onScrollComplete) onScrollComplete();
        }, 1000);
      } else {
        // Message not found, clear the scroll target
        if (onScrollComplete) onScrollComplete();
      }
    }, 300); // 300ms delay to ensure everything is rendered

    return () => clearTimeout(scrollTimer);
  }, [scrollToMessageId, activeChat, onScrollComplete]);

  // Auto-scroll on new messages only if user is near the bottom AND not jumping to a specific message
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Don't auto-scroll if we're in the middle of jumping to a specific message
    if (scrollToMessageId || highlightedMessageId) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, scrollToMessageId, highlightedMessageId]);

  // Track scroll position to show/hide scroll-to-bottom button and update floating date
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    setShowScrollButton(!isNearBottom);

    // Update the floating date header
    updateFloatingDate();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
              {isTyping ? (
                <span className="text-green-500 font-medium italic">typing...</span>
              ) : userStatus?.status === 'online' ? (
                <span className="text-green-500 font-medium">Online</span>
              ) : lastSeenText ? (
                <span className="text-gray-500 dark:text-gray-400">{lastSeenText}</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Summary Button 🧠 */}
          <button
            onClick={handleRequestSummary}
            className={`p-2 rounded-full transition relative
              ${isRequestingSummary || showSummary
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300'
              }`}
            title="Summary"
          >
            <span className="text-xl">🧠</span>
            {isRequestingSummary && (
              <span className="absolute top-0 right-0 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
              </span>
            )}
          </button>

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
      </div>

      {/* 3. MESSAGES AREA - WITH FLOATING DATE HEADER */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-1 custom-scrollbar relative
        bg-[#efeae2] dark:bg-[#0b141a] dark:bg-blend-overlay transition-colors"
        style={{
          backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
          backgroundRepeat: 'repeat',
          backgroundSize: '500px'
        }}
      >
        {/* SUMMARY CARD */}
        {showSummary && summaryData && (
          <div className="mx-4 my-4 p-4 bg-white dark:bg-[#1f2c33] rounded-xl shadow-lg border-l-4 border-purple-500 animate-slide-down">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span>🧠</span> Conversation Summary
              </h3>
              <button
                onClick={() => setShowSummary(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul className="space-y-2 mt-3">
              {summaryData.summary.map((point, i) => (
                <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0"></span>
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <span className="text-[10px] text-gray-400">
                Generated: {new Date(summaryData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        )}

        {/* Floating Date Header - Single sticky header that updates */}
        {isFloatingDateVisible && currentFloatingDate && (
          <div
            className="sticky top-2 z-20 flex justify-center pointer-events-none transition-opacity duration-300"
            style={{ opacity: isFloatingDateVisible ? 1 : 0 }}
          >
            <span className="bg-white/95 dark:bg-gray-700/95 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-lg shadow-md backdrop-blur-sm">
              {currentFloatingDate}
            </span>
          </div>
        )}

        {(() => {
          let lastDateLabel = null;

          return messages.map((msg, index) => {
            const dateLabel = getDateLabel(msg.timestamp);
            const showDateSeparator = dateLabel !== lastDateLabel;
            lastDateLabel = dateLabel;

            // Hide inline separator when floating header is showing the same date
            const isHiddenByFloatingHeader = isFloatingDateVisible && currentFloatingDate === dateLabel;

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <div
                    ref={(el) => { dateSeparatorRefs.current[dateLabel] = el; }}
                    className="flex justify-center my-2 pointer-events-none transition-opacity duration-200"
                    style={{ opacity: isHiddenByFloatingHeader ? 0 : 1 }}
                  >
                    <span className="bg-white/90 dark:bg-gray-700/90 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-lg shadow-sm backdrop-blur-sm">
                      {dateLabel}
                    </span>
                  </div>
                )}
                <div ref={(el) => { messageRefs.current[msg.id] = el; }}>
                  <MessageBubble
                    message={msg}
                    isMe={msg.sender === currentUser}
                    onDelete={onDeleteMessage}
                    isHighlighted={highlightedMessageId === msg.id}
                  />
                </div>
              </React.Fragment>
            );
          });
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 z-20 bg-white dark:bg-gray-700 shadow-lg rounded-full p-3 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all transform hover:scale-105"
          title="Scroll to bottom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-600 dark:text-gray-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
        </button>
      )}

      <MessageInput onSend={(text) => onSendMessage(activeChat, text)} onTyping={onTyping} />
    </div>
  );
};

export default ChatWindow;