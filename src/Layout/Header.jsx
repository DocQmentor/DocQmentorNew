import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, FileText, User, LogOut } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import './Header.css';

const Header = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { instance } = useMsal();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (!user) {
    console.log('No user in Header');
    navigate('/');
    return null;
  }

  const handleLogout = async () => {
    try {
      await instance.logoutRedirect();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Get user display name and email directly from the MSAL account object
  const userDisplayName = user.name || user.username || 'User Name';
  const userEmail = user.username || 'user@example.com';
  const initials = userDisplayName
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase();

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  // Function to handle navigation clicks
  const handleNavigationClick = (e, path) => {
    if (location.pathname === path) {
      e.preventDefault(); // Prevent navigation if already on the same page
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
              <LayoutDashboard size={20} className="i"/>Dashboard
            </NavLink>
          </li>
          <li className={location.pathname === '/table' ? 'active' : ''}>
            <NavLink 
              to="/table" 
              className="a"
              onClick={(e) => handleNavigationClick(e, '/table')}
            >
              <FileText size={20} className="i"/> Data View
            </NavLink>
          </li>
          <li className={location.pathname === '/profile' ? 'active' : ''} onClick={toggleProfile}>
            <div className="a" style={{cursor: 'pointer'}}>
              <User size={20} className="i"/> {userDisplayName}
            </div>
            {isProfileOpen && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <div className="profile-avatar">
                    {initials}
                  </div>
                  <div className="profile-info">
                    <div className="profile-name">{userDisplayName}</div>
                    <div className="profile-email">{userEmail}</div>
                  </div>
                </div>
                <div className="profile-footer">
                  <button className="logout-button" onClick={handleLogout}>
                    <LogOut size={16} className="i"/> Sign Out
                  </button>
                </div>
              </div>
            )}
          </li>
        </ul>
      </header>
    </div>
  );
}

export default Header;