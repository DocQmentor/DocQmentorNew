import React, { useEffect } from "react";
import "./App.css";
import { Routes, Route, Navigate, useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  MsalProvider,
  useMsal,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { PublicClientApplication, InteractionStatus } from "@azure/msal-browser";
 
import Login from "./components/Login";
import Home from "./components/Home";
import Table from "./components/Table";
import Dashboard from "./components/Dashboard";
import ManualReview from "./components/ManualReview";
import EditModal from "./components/EditModal";
import Header from "./Layout/Header";
import SelectDocumentType from "./components/SelectDocumentType";
import { UserProvider, useUser } from "./context/UserContext";
 
const msalConfig = {
  auth: {
    clientId: "450165b3-b418-4134-b525-cf04512bee71",
    authority: "https://login.microsoftonline.com/2b2653b1-1e48-445c-81a8-032920b2a550",
    redirectUri: window.location.origin,
  },
};
const pca = new PublicClientApplication(msalConfig);
 
 
const ProtectedLayout = () => {
  const { accounts, inProgress } = useMsal();
  const navigate = useNavigate();
  const { setUser } = useUser();
 
  useEffect(() => {
    if (inProgress === InteractionStatus.None) {
      if (accounts.length === 0) {
        navigate("/");
      } else {
        const account = accounts[0];
        setUser({
          email: account.username,
          name: account.name,
        });
      }
    }
  }, [accounts, navigate, setUser, inProgress]);
 
  if (accounts.length === 0) return null;
 
  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
 
const AppRoutes = () => {
  const { accounts, inProgress } = useMsal();
  const location = useLocation();
 
  if (inProgress !== InteractionStatus.None) {
    return <div>Loading authentication...</div>;
  }
 
  return (
    <Routes>
      <Route
        path="/"
        element={
          accounts.length > 0 ? (
            <Navigate to="/select" replace />
          ) : (
            <UnauthenticatedTemplate>
              <Login />
            </UnauthenticatedTemplate>
          )
        }
      />
      <Route element={<ProtectedLayout />}>
      <Route path="/select" element={<SelectDocumentType />} />
        <Route path="/home" element={<Home />} />
        <Route path="/table" element={<Table />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/manualreview" element={<ManualReview />} />
        <Route path="/editmodal" element={<EditModal />} />
      </Route>
      <Route path="*" element={<p>Page Not Found</p>} />
    </Routes>
  );
};
 
const App = () => {
  return (
    <MsalProvider instance={pca}>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </MsalProvider>
  );
};
 
export default App;
 
 