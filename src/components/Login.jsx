import './Login.css';
import React, { Component } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
 
const config = {
  appId: "450165b3-b418-4134-b525-cf04512bee71",
  redirectUri: "/Dashboard",
  scopes: ["user.read"],
  authority: "https://login.microsoftonline.com/2b2653b1-1e48-445c-81a8-032920b2a550"
};
 
class Login extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      isAuthenticated: false,
      user: {}
    };
 
    this.publicClientApplication = new PublicClientApplication({
      auth: {
        clientId: config.appId,
        redirectUri: config.redirectUri,
        authority: config.authority
      },
      cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: true
      }
    });
  }
 
  async componentDidMount() {
    try {
      await this.publicClientApplication.initialize();
      const accounts = this.publicClientApplication.getAllAccounts();
      if (accounts.length > 0) {
        this.setState({
          isAuthenticated: true,
          user: accounts[0]
        });
      }
    } catch (err) {
      console.error("Initialization failed:", err);
    }
  }
 
  login = async () => {
    try {
      await this.publicClientApplication.loginRedirect({
        scopes: config.scopes,
        prompt: "select_account"
      });
 
      this.setState({ isAuthenticated: true });
      window.location.href = "/home";
    } catch (err) {
      this.setState({
        isAuthenticated: false,
        user: {},
        error: err
      });
    }
  }
 
  logout = () => {
    this.publicClientApplication.logoutRedirect();
  }
 
  render() {
    return (
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
            {this.state.isAuthenticated ? (
              <p className="success-message">Successfully logged in</p>
            ) : (
              <button className="login-button" onClick={this.login}>Login with Microsoft</button>
            )}
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
 
 
        <p className='Copyright'>© Copyright <b>Techstar Group.</b> All Rights Reserved</p>
      </div>
     
    );
  }
}
 
export default Login;
 