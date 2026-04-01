import React, { useEffect } from "react";
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
import Table from "./components/Table";
import Dashboard from "./components/Dashboard";
import ManualReview from "./components/ManualReview";
import EditModal from "./components/EditModal";
import Header from "./Layout/Header";
import Admin from "./components/Admin";
import Users from "./components/Users";
import SuperAdmin from "./components/SuperAdmin";
import SelectDocumentType from "./components/SelectDocumentType";
import { UserProvider, useUser } from "./context/UserContext";
 
const msalConfig = {
  auth: {
    clientId: "450165b3-b418-4134-b525-cf04512bee71",
    // authority: "https://login.microsoftonline.com/2b2653b1-1e48-445c-81a8-032920b2a550",
    authority: "https://login.microsoftonline.com/organizations",
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
            <Navigate to="/dashboard" replace />
          ) : (
            <UnauthenticatedTemplate>
              <Login />
            </UnauthenticatedTemplate>
          )
        }
      />
      <Route element={<ProtectedLayout />}>
      <Route path="/select" element={<SelectDocumentType />} />
        <Route path="/table" element={<Table />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/manualreview" element={<ManualReview />} />
        <Route path="/editmodal" element={<EditModal />} />
        <Route path="/superadmin" element={<SuperAdmin/>}/>
        <Route path="/admin" element={<Admin/>}/>
        <Route path="/users" element={<Users />} />
      </Route>
      <Route path="*" element={<p>Page Not Found</p>} />
    </Routes>
  );
};
 
import { ConfigProvider } from "./context/ConfigContext";

const App = () => {
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    pca.initialize().then(() => {
      setIsInitialized(true);
    }).catch(err => {
      console.error("MSAL Init Error:", err);
      setIsInitialized(true); // Proceed anyway, MSAL will fail later
    });
  }, []);

  if (!isInitialized) return <div className="loading-screen">Initializing...</div>;

  return (
    <MsalProvider instance={pca}>
      <UserProvider>
        <ConfigProvider>
          <AppRoutes />
        </ConfigProvider>
      </UserProvider>
    </MsalProvider>
  );
};
 
export default App;
 
 