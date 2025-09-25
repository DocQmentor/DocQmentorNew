import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home,Search, LayoutDashboard, FileText, User, LogOut } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import './Header.css';
import useGroupAccess from "../utils/userGroupAccess";
const Header = ({ minimal }) => {
  const hasAccess = useGroupAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const { instance, accounts } = useMsal();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('User');
  // Accept minimal prop
  // const minimal = arguments[0]?.minimal;

  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const account = accounts[0];
      setUserEmail(account.username || 'user@example.com');
      // const nameParts = (account.name || 'User Name').split(' ');
      setUserName(account.name || 'User Name');
    } else {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser) {
        setUserEmail(storedUser.email || 'user@example.com');
        // const nameParts = (storedUser.name || 'User Name').split(' ');
        setUserName(storedUser.name || 'User Name');
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

  const handleNavigationClick = (e, path) => {
    if (location.pathname === path) {
      e.preventDefault();
    }
  };

  const initials = userName
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase();

  return (
    <div className="header-component-container">
      <header>
        <div className="logo-container">
          <img src="/src/assets/logo-docqmentor.png" alt="DocQmentor Logo" />
        </div>
        <ul>
          {!minimal && (
            <>
            <li className={location.pathname === '/select' ? 'active' : ''}>
                <NavLink
                  to="/select"
                  className="a"
                  onClick={(e) => handleNavigationClick(e, '/select')}
                >
                  <LayoutDashboard size={20} className="i" /> Models
                </NavLink>
              </li>
              <li className={location.pathname === '/dashboard' ? 'active' : ''}>
                <NavLink
                  to="/dashboard"
                  className="a"
                  onClick={(e) => handleNavigationClick(e, '/dashboard')}
                >
                  <LayoutDashboard size={20} className="i" /> Dashboard
                </NavLink>
              </li>
              
              {hasAccess === true && (
                <li className={location.pathname === '/manualreview' ? 'active' : ''}>
                    <NavLink
                    to="/manualreview"
                    className="a"
                    onClick={(e) => handleNavigationClick(e, '/manualreview')}
                  >
                    <Search size={20} className="i" /> Manual Review
                  </NavLink>
                </li>
              )}
              <li className={location.pathname === '/table' ? 'active' : ''}>
                <NavLink
                  to="/table"
                  className="a"
                  onClick={(e) => handleNavigationClick(e, '/table')}
                >
                  <FileText size={20} className="i" /> Data View
                </NavLink>
              </li>
              {/* <li className={location.pathname === '/superadmin' ? 'active' : ''}>
                <NavLink
                  to="/superadmin"
                  className="a"
                  onClick={(e) => handleNavigationClick(e, '/superadmin')}
                >
                  <FileText size={20} className="i" /> Super Admin
                </NavLink>
              </li> */}
              <li className={location.pathname === '/admin' ? 'active' : ''}>
                <NavLink
                  to="/admin"
                  className="a"
                  onClick={(e) => handleNavigationClick(e, '/admin')}
                >
                  <FileText size={20} className="i" /> Client Admin
                </NavLink>
              </li>
            </>
          )}
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
                    <LogOut size={16} className="LogOut-i"/> Sign Out
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
