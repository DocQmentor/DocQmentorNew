import { useMsal } from '@azure/msal-react';
import { toast } from 'react-toastify';
import './Login.css';

import docQmentorLogo from '../assets/logo-docqmentor.png';
import techstarLogo   from '../assets/6393841f01ab88522a2396b9_Techstar Logo (1) (1).png';

const FEATURES = [
  { emoji: '🏠', title: 'Dashboard',      desc: 'Document management command centre with real-time insights.' },
  { emoji: '📤', title: 'Upload',         desc: 'Drag-and-drop batch processing with automatic type detection.' },
  { emoji: '📊', title: 'Status Tracker', desc: 'Real-time stage tracking and full processing visibility.' },
  { emoji: '📋', title: 'Data View',      desc: 'Filterable table with sorting, presets and bulk actions.' },
];

const MicrosoftIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
    <rect x="1"  y="1"  width="9" height="9" fill="#F25022" />
    <rect x="11" y="1"  width="9" height="9" fill="#7FBA00" />
    <rect x="1"  y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

const Login = () => {
  const { instance } = useMsal();

  const handleLogin = async () => {
    try {
      await instance.loginRedirect({
        scopes: ['openid', 'profile', 'User.Read'],
        prompt: 'select_account',
      });
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Microsoft Login failed. Please try again.');
    }
  };

  return (
    <div className="login-page-container">

      {/* ══════════════════════════════════════
          LEFT PANEL — Branding
      ══════════════════════════════════════ */}
      <div className="login-left">
        {/* Decorative background circles */}
        <span className="login-circle login-circle-1" />
        <span className="login-circle login-circle-2" />
        <span className="login-circle login-circle-3" />

        <div className="login-left-inner">

          {/* Logos */}
          <div className="login-logo-row">
            <img src={docQmentorLogo} alt="DocQmentor" className="login-logo-doc" />
            <img src={techstarLogo}   alt="Techstar"   className="login-logo-tech" />
          </div>

          {/* Headline */}
          <h1 className="login-headline">
            Welcome to{' '}
            <span className="login-hl-d">D</span>oc
            <span className="login-hl-q">Q</span>mentor
          </h1>
          <p className="login-tagline">Automate &amp; Empower your Team's Productivity</p>
          <p className="login-sub">
            Eliminate manual tasks in Finance, Logistics and HR Compliance with
            AI-powered automation built on Microsoft 365, AI and Power Platform.
          </p>

          {/* Feature cards */}
          <div className="login-feature-grid">
            {FEATURES.map(({ emoji, title, desc }) => (
              <div className="login-feature-card" key={title}>
                <span className="login-feat-icon-box">{emoji}</span>
                <div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="login-copy">© 2026 DocQmentor · Techstar Technologies</p>
        </div>
      </div>

      {/* ══════════════════════════════════════
          RIGHT PANEL — Login card
      ══════════════════════════════════════ */}
      <div className="login-right">
        <div className="login-card">
          {/* Red top accent */}
          <div className="login-card-accent" />

          <h2 className="login-card-title">Sign in to DocQmentor</h2>
          <p className="login-card-sub">Use your Microsoft organisational account</p>

          <div className="login-card-divider" />

          {/* Microsoft identity box */}
          <div className="login-ms-box">
            <span className="login-ms-icon"><MicrosoftIcon size={28} /></span>
            <div>
              <p className="login-ms-title">Microsoft Azure AD</p>
              <p className="login-ms-desc">Enterprise authentication with MFA support</p>
              <p className="login-ms-desc">Only organisational accounts are permitted</p>
            </div>
          </div>

          <button className="login-btn" onClick={handleLogin}>
            <MicrosoftIcon size={20} />&nbsp;&nbsp;Login with Microsoft
          </button>

          <p className="login-note">Secure single sign-on via Microsoft MSAL</p>
          <p className="login-lock">🔒 Your session is protected by Azure Active Directory</p>
        </div>
      </div>

    </div>
  );
};

export default Login;
