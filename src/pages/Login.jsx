import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = username.trim();

    // 🔒 Validation Logic
    // We only need to check minimum length now.
    // Max length is handled by the input field itself (maxLength="16").
    if (trimmedName.length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }

    // Clear error and proceed
    setError('');
    onLogin(trimmedName);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 p-4">
      
      {/* Card Container */}
      <div className="bg-white dark:bg-gray-900 w-full max-w-md p-8 rounded-2xl shadow-2xl transform transition-all hover:scale-[1.01]">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-9 h-9 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-2.281l-9.8-9.8a2.126 2.126 0 01-.476 2.281 4.25 4.25 0 00-9.346 8.334c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136.847 2.1 1.98 2.193.34.027.68.052 1.02.072v3.091l3-3c1.354 0 2.694-.055 4.02-.163a2.115 2.115 0 01.825-.242" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome Back</h1>
          <p className="text-gray-500 dark:text-gray-400">Enter your username to start chatting</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                value={username}
                // 👇 BLOCKING LOGIC: Stops typing after 16 chars
                maxLength={32} 
                onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(''); // Clear error while typing
                }}
                className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none ${error ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                placeholder="e.g. Vansh"
                autoFocus
              />
              
              {/* Character Count Hint (Updates dynamically) */}
              <div className={`absolute right-3 top-3.5 text-xs transition-colors ${username.length === 32  ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                {username.length}/32
              </div>
            </div>
            
            {/* Error Message */}
            {error && (
              <p className="mt-2 text-sm text-red-500 flex items-center gap-1 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] focus:ring-4 focus:ring-purple-500/30"
          >
            Join Chat
          </button>
        </form>

        {/* Footer Text */}
        <p className="mt-8 text-center text-sm text-gray-400">
          By joining, you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default Login;