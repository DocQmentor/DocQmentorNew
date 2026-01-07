import React, { createContext, useState, useEffect, useContext } from 'react';

const ConfigContext = createContext();

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({
    Invoice: 85,
    BankStatement: 85,
    MortgageForms: 85
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // API Configuration
  // Note: Using the same function key as the main function for now. 
  // If a specific key is needed for 'ConfidenceConfigFunc', it should be updated here.
  const API_BASE_URL = "https://docqmentorfuncapp.azurewebsites.net/api/confidence-config";
  const FUNC_KEY = "H4sgHod2tb26Mmhl_h4DfLQe428vjXDrlIo_Npk7sSr6AzFuPY_B6Q=="; 

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}?code=${FUNC_KEY}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      console.error("Error fetching confidence config:", err);
      setError(err.message);
      // Fallback is already set in initial state
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (newConfig) => {
    try {
      const response = await fetch(`${API_BASE_URL}/confidence-config?code=${FUNC_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to update config: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.config) {
        setConfig(result.config);
      } else {
         // If backend doesn't return the config, use the local newConfig
         setConfig(newConfig);
      }
      return { success: true };
    } catch (err) {
      console.error("Error updating confidence config:", err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, error, fetchConfig, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
