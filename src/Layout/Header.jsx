import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import './Header.css';
import { LogOut, LayoutDashboard, FileText, User, Home } from 'lucide-react';
 
const Header = () => {
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
 
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (storedUser) {
      setUserEmail(storedUser.email || 'user@example.com');
      const nameParts = (storedUser.name || 'User Name').split(' ');
      setUserName(`${nameParts[0]}${nameParts[1] ? ' ' + nameParts[1] : ''}`);
    }
  }, []);
 
  const handleLogout = () => {
    // Add your logout logic here
    console.log('User logged out');
    setIsProfileOpen(false);
  };
 
  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };
 
  return (
    <div className="header-component-container">
      <header>
        <div className="logo-container">
          <img src="src\assets\logo-docqmentor.png" alt="" />
          {/* <div className="title-center">
            <h1>
              <span className="red-letter">D</span>
              <span className="blue-letter">oc</span>
              <span className="red-letter">Q</span>
              <span className="blue-letter">mentor<sup>TM</sup></span>
            </h1>
          </div>
          <center>
            <p>AI-powered document management solution</p>
          </center> */}
        </div>
        <ul>
          {/* <li className={location.pathname === '/home' ? 'active' : ''}>
            <NavLink to="/home" className="a">
              <Home size={20} className="i"/>Home
            </NavLink>
          </li> */}
          <li className={location.pathname === '/Dashboard' ? 'active' : ''}>
            <NavLink to="/Dashboard" className="a">
              <LayoutDashboard size={20} className="i"/>Dashboard
            </NavLink>
          </li>
          <li className={location.pathname === '/Table' ? 'active' : ''}>
            <NavLink to="/Table" className="a">
              <FileText size={20} className="i"/> Data View
            </NavLink>
          </li>
          <li className={location.pathname === '/Profile' ? 'active' : ''} onClick={toggleProfile}>
            <div className="a" style={{cursor: 'pointer'}}>
              <User size={20} className="i"/> Profile
            </div>
            {isProfileOpen && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <div className="profile-avatar">
                    {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="profile-info">
                    <div className="profile-name">{userName}</div>
                    <div className="profile-email">{userEmail}</div>
                  </div>
                </div>
                <div className="profile-footer">
                  <button onClick={handleLogout} className="logout-button">
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