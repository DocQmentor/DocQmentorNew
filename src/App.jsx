import React from "react";
import './App.css'
import { Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
import { MsalProvider, useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { PublicClientApplication, InteractionStatus } from '@azure/msal-browser';
import Login from "./components/Login";
import Home from "./components/Home";
import Table from "./components/Table";
import Dashboard from "./components/Dashboard";
import Header from "./Layout/Header";
import Footer from "./Layout/Footer";
 
const msalConfig = {
  auth: {
    clientId: "450165b3-b418-4134-b525-cf04512bee71",
    authority: "https://login.microsoftonline.com/2b2653b1-1e48-445c-81a8-032920b2a550",
    redirectUri: window.location.origin,
  }
};
 
const pca = new PublicClientApplication(msalConfig);
 
const ProtectedLayout = () => {
  const { accounts } = useMsal();
  const navigate = useNavigate();
 
  if (accounts.length === 0) {
    navigate('/');
    return null;
  }
 
  return (
    <div className="app-container">
      <Header user={accounts[0]} />
      <main className="main-content">
        <Outlet />
      </main>
      {/* <Footer /> */}
    </div>
  );
};
 
const AppRoutes = () => {
  const { accounts, inProgress } = useMsal();
  const navigate = useNavigate();
  // Redirect to home if authenticated and on login page
  if (accounts.length > 0 && inProgress === InteractionStatus.None && window.location.pathname === '/') {
    navigate('/dashboard');
    return null;
  }
 
  return (
    <Routes>
      <Route path="/" element={
        <UnauthenticatedTemplate>
          <Login />
        </UnauthenticatedTemplate>
      } />
     
      <Route element={<ProtectedLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/table" element={<Table />} />
        <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/manualreview" element={<Dashboard />} />

      </Route>
 
      <Route path="*" element={
        accounts.length > 0 ? <Navigate to="/dashboard" /> : <Navigate to="/" />
      } />
    </Routes>
  );
};
 
const App = () => {
  return (
    <MsalProvider instance={pca}>
      <AppRoutes />
    </MsalProvider>
  );
}
 
export default App;
 