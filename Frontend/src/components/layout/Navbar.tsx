import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBars, 
  faBell, 
  faUser, 
  faExpand, 
  faCompress, 
  faGear, 
  faSignOutAlt, 
  faChevronDown,
  faPalette 
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import ThemeSelector from '../ThemeSelector';
import logoImage from '../../assets/logo.png';
import mobileImage from '../../assets/icon.png';
import { UserData } from '../../types/admin';
import { useBatch } from '../../context/BatchContext';
import { useAuth } from '../../context/AuthContext';
import userImage  from '../../assets/userLogo.png'
interface NavbarProps {
  toggleSidebar: () => void;
  openForm: (formName: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar, openForm }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showMobileThemeSelector, setShowMobileThemeSelector] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const mobileThemeSelectorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();
  const BASE_URL = import.meta.env.VITE_BACKEND_URL;
  const [formData, setFormData] = useState<UserData>({
    id: 0,
    username: "",
    profile_photo: "",
    name: "",
    type: "",
    center_id: 0,
    course_id: 0,
    email: "",
    
  });

  // Safely access BatchContext
  let batchContext;
  let user_id = 0;
  try {
    batchContext = useBatch();
    user_id = batchContext?.user_id || 0;
  } catch (error) {
    console.warn("BatchContext not available, using default values");
  }
  
  // Check if screen is mobile-sized
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  // Handle fullscreen toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullScreen(true);
      }).catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullScreen(false);
        }).catch(err => {
          console.error(`Error attempting to exit fullscreen: ${err.message}`);
        });
      }
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      
      if (mobileThemeSelectorRef.current && !mobileThemeSelectorRef.current.contains(event.target as Node)) {
        setShowMobileThemeSelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle fullscreen change events from browser
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  // Get user data
  const getUserType = () => {
    try {
      const admin = localStorage.getItem(`admin${user_id}`);
      if (!admin) {
        console.log("No admin data found");
        return;
      }
      const parsedAdmin: UserData = JSON.parse(admin);
      if (parsedAdmin?.id) {
        setFormData({
          id: parsedAdmin.id,
          username: parsedAdmin.username,
          profile_photo: parsedAdmin.profile_photo,
          name: parsedAdmin.name,
          type: parsedAdmin.type,
          center_id: parsedAdmin.center_id,
          course_id: parsedAdmin.course_id,
          email: parsedAdmin.email,  
        });
      }
    } catch (error) {
      console.error("Error parsing admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user_id > 0) {
      getUserType();
    } else {
      // Use fallback user info when BatchContext is not available
      setFormData(prev => ({
        ...prev,
        name: "Guest User", 
        email: "guest@example.com"
      }));
      setLoading(false);
    }
  }, [user_id]);

  // Logout function
  const handleLogout = () => {
    logout();
  };

  // Handle theme selector toggle for mobile
  const toggleMobileThemeSelector = () => {
    setShowMobileThemeSelector(!showMobileThemeSelector);
    setShowUserDropdown(false); // Close user dropdown when opening theme selector
  };

  return (
    <header className="bg-background/95 backdrop-blur border-b border-border shadow-sm z-40 sticky top-0">
      <div className="px-4 h-16 flex items-center justify-between">
        {/* Left side - Logo and toggle button */}
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleSidebar}
            className="lg:hidden h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary/10 transition-colors relative z-50"
            aria-label="Toggle sidebar"
          >
            <FontAwesomeIcon icon={faBars} className="text-foreground" />
          </button>
          
          {/* Logo - Different for mobile and desktop */}
          <div className="flex items-center space-x-2">
            {isMobile ? (
              // Mobile logo (icon only)
              <div className="h-10 w-10 flex items-center justify-center">
                <img 
                  src={mobileImage} 
                  alt="DigiLMS Icon" 
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              // Desktop logo (full logo)
              <>
                <div className="h-10 flex items-center">
                  <img 
                    src={logoImage} 
                    alt="DigiLMS Logo" 
                    className="h-full object-contain max-w-[180px]"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right side - Theme selector, fullscreen, notifications, and user profile */}
        <div className="flex items-center space-x-2">
          {/* Theme selector for desktop */}
          <div className="hidden sm:block">
            <ThemeSelector />
          </div>
          
          {/* Mobile theme selector (separate from dropdown) */}
          {isMobile && (
            <div className="relative" ref={mobileThemeSelectorRef}>
              <button 
                onClick={toggleMobileThemeSelector} 
                className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary/10 transition-colors"
                aria-label="Change theme"
              >
                <FontAwesomeIcon icon={faPalette} className="text-foreground" />
              </button>
              
              {/* Mobile Theme Selector Dropdown */}
              {showMobileThemeSelector && (
                <div className="absolute right-0 mt-2 z-50">
                  <ThemeSelector />
                </div>
              )}
            </div>
          )}
          
          {/* Fullscreen button - hide on small mobile */}
          <button 
            onClick={toggleFullScreen}
            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-md hover:bg-primary/10 transition-colors" 
            aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <FontAwesomeIcon 
              icon={isFullScreen ? faCompress : faExpand} 
              className="text-foreground" 
            />
          </button>
          
        
          
          {/* User profile with dropdown */}
          <div className="relative" ref={userDropdownRef}>
            <button 
              className="flex items-center space-x-1 h-10 px-2 rounded-md hover:bg-primary/10 transition-colors"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <div className="py-2 px-4 border-b border-border flex items-center space-x-2">
              <p className="font-medium text-foreground">{formData.name}</p>
                {formData.profile_photo ? (
                  <img 
                  src={`${BASE_URL}${formData.profile_photo}`}
                    alt={`${formData.name}'s profile`}
                    className="h-8 w-8 object-cover"
                  />
                ) : (
                  <img 
                  src={userImage}
                    alt={`${formData.name}'s profile`}
                    className="h-8 w-8 object-cover"
                  />
                )}
              </div>
              <FontAwesomeIcon 
                icon={faChevronDown} 
                className="text-xs text-muted-foreground ml-1" 
              />
            </button>
            
            {/* User dropdown menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-md bg-card shadow-lg border border-border z-50 theme-transition animate-fade-in">
                <div className="py-2 px-4 border-b border-border">
                  <p className="font-medium text-foreground">{formData.name}</p>
                  <p className="text-xs text-muted-foreground">{formData.email}</p>
                </div>
                <div className="py-1">
                  <button 
                    className="flex items-center px-4 py-2 text-sm hover:bg-primary/10 text-foreground w-full text-left"
                    onClick={() => {
                      openForm("userSetting");
                      setShowUserDropdown(false);
                    }}
                  >
                    <FontAwesomeIcon icon={faGear} className="mr-2 w-4 h-4" />
                    Settings
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center px-4 py-2 text-sm hover:bg-primary/10 w-full text-left text-foreground"
                  >
                    <FontAwesomeIcon icon={faSignOutAlt} className="mr-2 w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
