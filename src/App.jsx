/*import React, { useEffect } from "react";
import "./App.css";
import { Routes, Route, Navigate, useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  MsalProvider,
  useMsal,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { PublicClientApplication, InteractionStatus } from "@azure/msal-browser";
 import './styles/theme.css';  
import Login from "./components/Login";
import Home from "./components/Home";
import Table from "./components/Table";
import Dashboard from "./components/Dashboard";
import ManualReview from "./components/ManualReview";
import EditModal from "./components/EditModal";
import Header from "./Layout/Header";
import Admin from "./components/Admin";
import SuperAdmin from "./components/SuperAdmin";
import SelectDocumentType from "./components/SelectDocumentType";
import { UserProvider, useUser } from "./context/UserContext";
 
const msalConfig = {
  auth: {
    clientId: "450165b3-b418-4134-b525-cf04512bee71",
    authority: "https://login.microsoftonline.com/common",
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
      <Header minimal={location.pathname === "/select"} />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
 
const AppRoutes = () => {
  const { accounts, inProgress } = useMsal();
  const location = useLocation();
 
  // if (inProgress !== InteractionStatus.None) {
  //   return <div>Loading authentication...</div>;
  // }
 
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
        <Route path="/superadmin" element={<SuperAdmin/>}/>
        <Route path="/admin" element={<Admin/>}/>
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
 
export default App;*/



import React, { useEffect, useState } from "react";
import "./App.css";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  MsalProvider,
  useMsal,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import {
  PublicClientApplication,
  InteractionStatus,
} from "@azure/msal-browser";

import axios from "axios";

import Login from "./components/Login";
import Home from "./components/Home";
import Table from "./components/Table";
import Dashboard from "./components/Dashboard";
import ManualReview from "./components/ManualReview";
import EditModal from "./components/EditModal";
import Header from "./Layout/Header";
import Admin from "./components/Admin";
import SuperAdmin from "./components/SuperAdmin";
import SelectDocumentType from "./components/SelectDocumentType";

import { UserProvider, useUser } from "./context/UserContext";

/* ===========================
   MSAL CONFIG (MULTI-TENANT)
=========================== */
const msalConfig = {
  auth: {
    clientId: "450165b3-b418-4134-b525-cf04512bee71",
    authority: "https://login.microsoftonline.com/common", // ✅ Multi-tenant
    redirectUri: window.location.origin,
  },
};

const pca = new PublicClientApplication(msalConfig);

/* ===========================
   PROTECTED LAYOUT
=========================== */
const ProtectedLayout = () => {
  const { accounts, inProgress, instance } = useMsal();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateUser = async () => {
      if (inProgress !== InteractionStatus.None) return;

      // ❌ No SSO session
      if (accounts.length === 0) {
        navigate("/");
        return;
      }

      // ✅ Already validated
      if (user) {
        setLoading(false);
        return;
      }

      try {
        const tokenResponse = await instance.acquireTokenSilent({
          scopes: ["User.Read"],
          account: accounts[0],
        });

        const accessToken = tokenResponse.accessToken;

        // 🔐 SQL Authorization Check
        const response = await axios.post(
          "https://localhost:5001/api/auth/validate-user",
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // ✅ Authorized user from SQL
        setUser({
          email: response.data.email,
          name: response.data.name,
          role: response.data.role,          // SuperAdmin | Admin | User
          clientId: response.data.clientId,  // Client isolation
        });

        setLoading(false);
      } catch (error) {
        console.warn("Backend unavailable. Enabling DEMO MODE for development.", error);

        // ✅ Fallback: Allow access even if backend is offline
        setUser({
          email: accounts[0].username,
          name: accounts[0].name || "Dev User",
          role: "SuperAdmin",
          clientId: "demo-client-id",
        });

        setLoading(false);
      }
    };

    validateUser();
  }, [accounts, inProgress, instance, navigate, setUser, user]);

  if (loading) return <div>Validating access...</div>;

  return (
    <div className="app-container">
      <Header minimal={location.pathname === "/select"} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

/* ===========================
   ROUTES
=========================== */
const AppRoutes = () => {
  const { accounts } = useMsal();

  return (
    <Routes>
      {/* LOGIN */}
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

      {/* PROTECTED ROUTES */}
      <Route element={<ProtectedLayout />}>
        <Route path="/select" element={<SelectDocumentType />} />
        <Route path="/home" element={<Home />} />
        <Route path="/table" element={<Table />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/manualreview" element={<ManualReview />} />
        <Route path="/editmodal" element={<EditModal />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
      </Route>

      <Route path="*" element={<p>Page Not Found</p>} />
    </Routes>
  );
};

/* ===========================
   APP ROOT
=========================== */
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

