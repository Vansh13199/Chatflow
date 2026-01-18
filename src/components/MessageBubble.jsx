import React, { useState } from 'react';

const MessageBubble = ({ message, isMe, onDelete }) => {
  const [showActions, setShowActions] = useState(false);

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
        className={`relative max-w-[75%] md:max-w-[60%] px-3 py-1.5 rounded-lg shadow-sm text-[15px] leading-relaxed overflow-hidden
          ${isMe
            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-white rounded-tr-none'
            : 'bg-white dark:bg-[#202c33] text-gray-900 dark:text-white rounded-tl-none'
          }`}
        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      >
        <p className="mb-1 whitespace-pre-wrap">{message.message}</p>

        <div className={`text-[10px] flex justify-end items-center gap-1 
            ${isMe ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400 dark:text-gray-400'}`}
        >
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
  );
};

export default MessageBubble;