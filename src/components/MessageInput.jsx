import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';

const MessageInput = ({ onSend, onTyping }) => {
  const [text, setText] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Maximum height before scrolling starts (in pixels)
  const MAX_HEIGHT = 120;

  // Auto-resize & Scroll Logic
  useEffect(() => {
    if (textareaRef.current) {
      // 1. Reset height to 'auto' to correctly calculate the new shrink/grow size
      textareaRef.current.style.height = 'auto';

      // 2. Calculate the correct height (capped at MAX_HEIGHT)
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, MAX_HEIGHT)}px`;

      // 3. If content is taller than max height, show scrollbar. Otherwise hide it.
      if (scrollHeight > MAX_HEIGHT) {
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [text]);

  // Handle typing indicator
  const handleTextChange = (e) => {
    setText(e.target.value);

    // Send "typing" event
    if (onTyping && e.target.value.length > 0) {
      onTyping(true);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing after 1.5 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    } else if (onTyping && e.target.value.length === 0) {
      onTyping(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (text.trim()) {
      // Stop typing indicator
      if (onTyping) onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      onSend(text);
      setText('');
      setShowPicker(false);
      // Reset height immediately after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  };

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
    if (onTyping) onTyping(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 relative">

      {/* EMOJI POPUP */}
      {showPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)}></div>
          <div className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-xl">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme="auto"
              searchDisabled={false}
              skinTonesDisabled={true}
              height={350}
              width={300}
            />
          </div>
        </>
      )}

      <form onSubmit={handleSend} className="flex items-end gap-2 max-w-4xl mx-auto">

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className={`p-3 mb-1 rounded-full transition ${showPicker ? 'text-blue-500 bg-blue-50 dark:bg-gray-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm6.75 0c0 .414-.168.75-.375.75S15 10.164 15 9.75 15.168 9 15.375 9s.375.336.375.75z" />
          </svg>
        </button>

        {/* 📝 Auto-Growing & Scrollable Text Area */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            // Changed overflow-hidden to allow dynamic scrolling
            className="w-full py-3 px-4 bg-transparent dark:text-white focus:outline-none resize-none leading-relaxed custom-scrollbar"
            style={{
              minHeight: '48px',
              maxHeight: `${MAX_HEIGHT}px`,
              overflowY: 'hidden' // Initial state
            }}
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-3 mb-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default MessageInput;