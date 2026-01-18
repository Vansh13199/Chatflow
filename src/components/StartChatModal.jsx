import React, { useState } from 'react';

const StartChatModal = ({ onClose, onStart }) => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState(""); // 🔴 State for Error Message
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setError(""); // Clear previous errors
    setLoading(true);

    try {
      // Call the parent function and wait for result
      const success = await onStart(username);
      
      if (!success) {
        // If false, show error text (Logic handled in startChat hook, but we catch the boolean here)
        setError("User not found"); 
      }
      // If success, the modal will close via parent prop, so we do nothing else
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-sm rounded-xl shadow-2xl p-6 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
        
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">New Chat</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input 
              type="text" 
              className={`w-full p-3 border rounded-lg bg-gray-50 dark:bg-[#2a3942] dark:text-white focus:outline-none focus:ring-2 transition-all
                ${error 
                  ? 'border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-900/30'
                }`}
              placeholder="Enter username..."
              value={username}
              onChange={(e) => {
                  setUsername(e.target.value);
                  if(error) setError(""); // Clear error when typing
              }}
              autoFocus
            />
            {/* 🔴 ERROR MESSAGE DISPLAY */}
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose} 
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-70 flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              Start Chat
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default StartChatModal;