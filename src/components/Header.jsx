import React from 'react';

const Header = ({ username, toggleTheme, isDarkMode, onLogout }) => {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {username.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-gray-700 dark:text-gray-200">{username}</span>
        </div>
        <div className="flex gap-2">
             <button onClick={toggleTheme} className="text-xl">
                 {isDarkMode ? '☀️' : '🌙'}
             </button>
             <button onClick={onLogout} className="text-red-500 text-sm hover:underline">
                 Logout
             </button>
        </div>
    </div>
  );
};
export default Header;