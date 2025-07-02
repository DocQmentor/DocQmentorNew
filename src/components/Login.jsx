import './Login.css'
import React from 'react';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import Footer from '../Layout/Footer'; // adjust the path based on your folder structure

const Login = ({ setUser }) => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await instance.loginRedirect({
        scopes: ['openid', 'profile', 'User.Read'],
        prompt: 'select_account'
      });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };



  return (
    <div>
      <div className='main'>
        <header className='Login-header'>
          <img className='img-doc' src="src/assets/logo-docqmentor.png" alt="DocQmentor Logo" />
          <img className='img-tech' src="src/assets/6393841f01ab88522a2396b9_Techstar Logo (1) (1).png" alt="Techstar Logo" />
        </header>
 
         
        <div className='summary'>
          <h1 className="highlight">Welcome to <span className="highlight-letter">D</span>oc<span className="highlight-letter">Q</span>mentor</h1>
          <h1 className="main-title">Automate & Empower your Team's Productivity</h1>
          <p className='para'>
            Eliminate manual tasks in Finance, Logistics, HR Compliance functions with AI-Powered automation by leveraging Microsoft 365, AI and Power Platform tools.
          </p>
 
          <div className="auth-status">
              <button className="login-button" onClick={handleLogin}>Login with Microsoft</button>
          </div>
        </div>
 
        <div className='image-con'>
          <img className='image' src="src/assets/dq-mainimage.png" alt="Main Visual" />
        </div>
 
        {/* FEATURES SECTION */}
        {/* FEATURES SECTION */}
      <div className="features-section">
        <div className="feature-card">
          <div className="feature-header">
            <img src="src/assets/home.png" alt="Home Icon" className="feature-icon" />
            <h3>Home</h3>
          </div>
          <p>The Home Page serves as your document management command center with instant access to all key features and real-time notifications to keep your team aligned.</p>
        </div>
        <div className="feature-card">
          <div className="feature-header">
            <img src="src/assets/upload doc.png" alt="Dashboard Icon" className="feature-icon" />
            <h3>Dashboard</h3>
          </div>
          <p>Streamlined drag-and-drop dashboard with batch processing, file-type categorization, and upload analytics for smart document organization.</p>
        </div>
        <div className="feature-card">
          <div className="feature-header">
            <img src="src/assets/status tracker.png" alt="Status Tracker Icon" className="feature-icon" />
            <h3>Status Tracker</h3>
          </div>
          <p>Full visibility of document status with real-time stage tracking and timestamps, removing guesswork and improving accountability.</p>
        </div>
        <div className="feature-card">
          <div className="feature-header">
            <img src="src/assets/data view.png" alt="Data View Icon" className="feature-icon" />
            <h3>Data View</h3>
          </div>
          <p>Powerful filterable table with sorting, presets, and bulk actions for managing and processing documents at scale.</p>
        </div>
      </div>
      </div>
      <Footer />
    </div>
    );
};

export default Login; 