import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, FileText, User, LogOut } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import './Header.css';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { instance, accounts } = useMsal();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Check MSAL account
    if (accounts && accounts.length > 0) {
      const account = accounts[0];
      setUserEmail(account.username || 'user@example.com');
      const nameParts = (account.name || 'User Name').split(' ');
      setUserName(`${nameParts[0]}${nameParts[1] ? ' ' + nameParts[1] : ''}`);
    } else {
      // Fallback to localStorage or redirect to login
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser) {
        setUserEmail(storedUser.email || 'user@example.com');
        const nameParts = (storedUser.name || 'User Name').split(' ');
        setUserName(`${nameParts[0]}${nameParts[1] ? ' ' + nameParts[1] : ''}`);
      } else {
        console.log('No user in Header');
        navigate('/');
      }
    }
  }, [accounts, navigate]);

  const handleLogout = async () => {
    try {
      await instance.logoutRedirect();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const initials = userName
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase();

  const handleNavigationClick = (e, path) => {
    if (location.pathname === path) {
      e.preventDefault(); // Prevent reload if already on the same page
    }
  };

  return (
    <div className="header-component-container">
      <header>
        <div className="logo-container">
          <img src="/src/assets/logo-docqmentor.png" alt="DocQmentor Logo" />
        </div>
        <ul>
          <li className={location.pathname === '/dashboard' ? 'active' : ''}>
            <NavLink 
              to="/dashboard" 
              className="a"
              onClick={(e) => handleNavigationClick(e, '/dashboard')}
            >
              <LayoutDashboard size={20} className="i" /> Dashboard
            </NavLink>
          </li>
          <li className={location.pathname === '/table' ? 'active' : ''}>
            <NavLink 
              to="/table" 
              className="a"
              onClick={(e) => handleNavigationClick(e, '/table')}
            >
              <FileText size={20} className="i" /> Data View
            </NavLink>
          </li>
          <li className={location.pathname === '/profile' ? 'active' : ''} onClick={toggleProfile}>
            <div className="a" style={{ cursor: 'pointer' }}>
              <User size={20} className="i" /> {userName}
            </div>
            {isProfileOpen && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <div className="profile-avatar">
                    {initials}
                  </div>
                  <div className="profile-info">
                    <div className="profile-name">{userName}</div>
                    <div className="profile-email">{userEmail}</div>
                  </div>
                </div>
                <div className="profile-footer">
                  <button className="logout-button" onClick={handleLogout}>
                    <LogOut size={16} className="i" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </li>
        </ul>
      </header>
    </div>
  );
};

export default Header;
