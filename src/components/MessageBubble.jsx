import React, { useState, useRef, useEffect, useCallback, memo } from 'react';

// Helper function to get responsive line threshold based on screen width
const getLineThreshold = () => {
  if (typeof window === 'undefined') return 8;
  const width = window.innerWidth;
  if (width < 640) return 6;       // Mobile: 6 lines
  if (width < 1024) return 10;     // Tablet: 10 lines
  return 12;                        // Desktop: 12 lines
};

const MessageBubble = memo(({ message, isMe, onDelete, isHighlighted = false }) => {
  const [showActions, setShowActions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldCollapse, setShouldCollapse] = useState(false);
  const [lineThreshold, setLineThreshold] = useState(getLineThreshold());
  const textRef = useRef(null);

  // Update line threshold on window resize
  useEffect(() => {
    const handleResize = () => {
      setLineThreshold(getLineThreshold());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if message should be collapsed based on actual rendered height
  const checkCollapsibility = useCallback(() => {
    if (textRef.current) {
      const lineHeight = parseFloat(getComputedStyle(textRef.current).lineHeight) || 24;
      const actualHeight = textRef.current.scrollHeight;
      const maxHeight = lineHeight * lineThreshold;

      setShouldCollapse(actualHeight > maxHeight);
    }
  }, [lineThreshold]);

  // Check collapsibility on mount and when message or threshold changes
  useEffect(() => {
    checkCollapsibility();
  }, [message.message, lineThreshold, checkCollapsibility]);

  // Also check after fonts load
  useEffect(() => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(checkCollapsibility);
    }
  }, [checkCollapsibility]);

  // Calculate max-height for collapsed state (in pixels based on line height)
  const getCollapsedMaxHeight = () => {
    if (textRef.current) {
      const lineHeight = parseFloat(getComputedStyle(textRef.current).lineHeight) || 24;
      return `${lineHeight * lineThreshold}px`;
    }
    return `${lineThreshold * 1.5}rem`; // Fallback
  };

  return (
    <div
      className={`flex w-full mb-1 group ${isMe ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* DELETE BUTTON (Only shows on hover & only for my messages)
         Placed on the LEFT of the bubble for sender 
      */}
      {isMe && showActions && (
        <button
          onClick={() => onDelete(message.id)}
          className="self-center mr-2 p-1 text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
          title="Delete message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      )}

      {/* THE BUBBLE */}
      <div
        className={`relative max-w-[75%] md:max-w-[60%] px-3 py-1.5 rounded-lg shadow-sm text-[15px] leading-snug overflow-hidden transition-all duration-700 ease-in-out ring-2
          ${isHighlighted
            ? 'bg-yellow-200/50 dark:bg-yellow-900/50 ring-yellow-400/50 dark:ring-yellow-600/50 text-gray-900 dark:text-gray-100 scale-[1.02]'
            : isMe
              ? 'bg-[#d9fdd3] dark:bg-[#005c4b] ring-transparent text-gray-900 dark:text-white rounded-tr-none'
              : 'bg-white dark:bg-[#202c33] ring-transparent text-gray-900 dark:text-white rounded-tl-none'
          }`}
        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      >
        {/* Message Text Container */}
        <div className="relative">
          <p
            ref={textRef}
            className="whitespace-pre-wrap transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: shouldCollapse && !isExpanded ? getCollapsedMaxHeight() : 'none',
            }}
          >
            {message.message}
          </p>

          {/* Fade overlay when collapsed */}
          {shouldCollapse && !isExpanded && (
            <div
              className={`absolute bottom-0 left-0 right-0 h-5 pointer-events-none
                ${isMe
                  ? 'bg-gradient-to-t from-[#d9fdd3] dark:from-[#005c4b] to-transparent'
                  : 'bg-gradient-to-t from-white dark:from-[#202c33] to-transparent'
                }`}
            />
          )}
        </div>

        {/* Footer: Read More Button + Timestamp */}
        <div className={`text-[10px] flex items-center gap-2 ${shouldCollapse ? 'justify-between' : 'justify-end'} 
            ${isMe ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400 dark:text-gray-400'}`}
        >
          {/* Read More / Show Less Button */}
          {shouldCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={`text-[11px] font-medium hover:underline focus:outline-none transition-colors
                ${isMe
                  ? 'text-[#075e54] dark:text-[#25d366]'
                  : 'text-[#075e54] dark:text-[#25d366]'
                }`}
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}

          <div className="flex items-center gap-1">
            <span>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
            {isMe && (
              <span className={message.status === 'read' ? 'text-blue-500' : ''}>
                {message.status === 'sent' && '✓'}
                {message.status === 'delivered' && '✓✓'}
                {message.status === 'read' && '✓✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div >
  );
});

// Display name for debugging
MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;