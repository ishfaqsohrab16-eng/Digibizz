import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faPalette, faCheck, faAngleDown } from '@fortawesome/free-solid-svg-icons';
import { useTheme, ThemeOption } from '../context/ThemeContext';

const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Theme options configuration with descriptions
  const themeOptions: Record<ThemeOption, {
    name: string;
    icon: JSX.Element;
    description: string;
    isDark: boolean;
  }> = {
    mint: {
      name: 'Fresh Mint',
      icon: <div className="w-4 h-4 rounded-full bg-gradient-mint"></div>,
      description: 'Bright, energetic, modern',
      isDark: false,
    },
    aurora: {
      name: 'Aurora Night',
      icon: <div className="w-4 h-4 rounded-full bg-gradient-aurora"></div>,
      description: 'Vibrant dark with a glow feel',
      isDark: true,
    },
    ocean: {
      name: 'Ocean Breeze',
      icon: <div className="w-4 h-4 rounded-full bg-gradient-ocean"></div>,
      description: 'Cool and soothing',
      isDark: false,
    },
    slate: {
      name: 'Slate Royale',
      icon: <div className="w-4 h-4 rounded-full bg-gradient-slate"></div>,
      description: 'Elegant with strong contrast',
      isDark: false,
    },
    peach: {
      name: 'Peach Bloom',
      icon: <div className="w-4 h-4 rounded-full bg-gradient-peach"></div>,
      description: 'Warm and cozy dark theme',
      isDark: true,
    },
    system: {
      name: 'System',
      icon: <FontAwesomeIcon icon={faPalette} />,
      description: 'Match system preference',
      isDark: false,
    }
  };

  // Handle theme change
  const handleThemeChange = (newTheme: ThemeOption) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  // Get the current theme object safely
  const currentTheme = themeOptions[theme] || themeOptions.mint;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-card hover:bg-accent/10 transition-all border border-border shadow-sm"
        aria-label="Select theme"
      >
        <span className="flex items-center justify-center w-5 h-5">
          {currentTheme.icon}
        </span>
        <span className="hidden sm:inline-block font-medium">Theme</span>
        <FontAwesomeIcon icon={faAngleDown} className="text-xs opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-card rounded-lg shadow-lg border border-border overflow-hidden z-50 animate-fade-in">
          <div className="p-3 border-b border-border bg-primary/5">
            <h3 className="text-sm font-semibold text-foreground">Select Theme</h3>
          </div>
          
          <div className="p-3 space-y-2">
            {/* Light themes group */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2 pl-2">LIGHT THEMES</div>
              {Object.entries(themeOptions)
                .filter(([_, data]) => !data.isDark && _ !== 'system')
                .map(([key, data]) => (
                  <button
                    key={key}
                    onClick={() => handleThemeChange(key as ThemeOption)}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 hover:bg-accent/10 transition-all ${
                      theme === key ? 'bg-primary/10 border border-primary/20' : 'border border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center">
                      {data.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{data.name}</div>
                      <div className="text-xs text-muted-foreground">{data.description}</div>
                    </div>
                    {theme === key && (
                      <span className="text-primary">
                        <FontAwesomeIcon icon={faCheck} />
                      </span>
                    )}
                  </button>
                ))}
            </div>
            
            {/* Dark themes group */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2 pl-2">DARK THEMES</div>
              {Object.entries(themeOptions)
                .filter(([_, data]) => data.isDark)
                .map(([key, data]) => (
                  <button
                    key={key}
                    onClick={() => handleThemeChange(key as ThemeOption)}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 hover:bg-accent/10 transition-all ${
                      theme === key ? 'bg-primary/10 border border-primary/20' : 'border border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center">
                      {data.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{data.name}</div>
                      <div className="text-xs text-muted-foreground">{data.description}</div>
                    </div>
                    {theme === key && (
                      <span className="text-primary">
                        <FontAwesomeIcon icon={faCheck} />
                      </span>
                    )}
                  </button>
                ))}
            </div>
            
            {/* System theme */}
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => handleThemeChange('system')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 hover:bg-accent/10 transition-all ${
                  theme === 'system' ? 'bg-primary/10 border border-primary/20' : 'border border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                  {themeOptions.system.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">{themeOptions.system.name}</div>
                  <div className="text-xs text-muted-foreground">{themeOptions.system.description}</div>
                </div>
                {theme === 'system' && (
                  <span className="text-primary">
                    <FontAwesomeIcon icon={faCheck} />
                  </span>
                )}
              </button>
            </div>
          </div>
          
          <div className="p-2 border-t border-border bg-primary/5">
            <p className="text-xs text-muted-foreground text-center">
              Theme preferences are saved automatically
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
