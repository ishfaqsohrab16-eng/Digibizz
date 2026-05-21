import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons';

type Theme = 'light' | 'dark' | 'system';

const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('system');

  // Initialize theme on component mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Default to system theme if no saved preference
      setTheme('system');
      applySystemTheme();
    }
  }, []);

  // Apply theme based on system preference
  const applySystemTheme = () => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
  };

  // Apply specific theme
  const applyTheme = (newTheme: Theme) => {
    if (newTheme === 'system') {
      applySystemTheme();
    } else {
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
    localStorage.setItem('theme', newTheme);
  };

  // Handle theme change
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return (
    <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm">
      <button
        onClick={() => handleThemeChange('light')}
        className={`p-2 rounded-md ${
          theme === 'light' 
            ? 'bg-blue-100 text-blue-600' 
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
        title="Light Mode"
      >
        <FontAwesomeIcon icon={faSun} />
      </button>
      
      <button
        onClick={() => handleThemeChange('dark')}
        className={`p-2 rounded-md ${
          theme === 'dark' 
            ? 'bg-blue-100 text-blue-600 dark:bg-gray-700 dark:text-blue-400' 
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
        title="Dark Mode"
      >
        <FontAwesomeIcon icon={faMoon} />
      </button>
      
      <button
        onClick={() => handleThemeChange('system')}
        className={`p-2 rounded-md ${
          theme === 'system' 
            ? 'bg-blue-100 text-blue-600 dark:bg-gray-700 dark:text-blue-400' 
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
        title="System Theme"
      >
        <FontAwesomeIcon icon={faDesktop} />
      </button>
    </div>
  );
};

export default ThemeSwitcher;
