import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Chat from './pages/Chat';

function App() {
  const [username, setUsername] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Dark Mode Logic (Lazy Init)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('chatflow_theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 2. Apply Theme Class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('chatflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('chatflow_theme', 'light');
    }
  }, [isDarkMode]);

  // 3. Load User Session
  useEffect(() => {
    const savedUser = localStorage.getItem('chatflow_username');
    if (savedUser) setUsername(savedUser);
    setIsLoading(false);
  }, []);

  const handleLogin = (user) => {
    localStorage.setItem('chatflow_username', user);
    setUsername(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatflow_username');
    setUsername(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-black">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0b141a] text-gray-900 dark:text-white transition-colors duration-300">
      {username ? (
        <Chat 
          username={username} 
          onLogout={handleLogout} 
          isDarkMode={isDarkMode}
          toggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;