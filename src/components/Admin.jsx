import React, { useState, useEffect } from 'react';
import { FileText, BarChart2, Users, Database, X, Shield, Download, RefreshCw, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useNavigate, useLocation } from "react-router-dom";
import './Admin.css';
import Footer from "../Layout/Footer";
import FilePagination from '../Layout/FilePagination';
import useSortableData from "../utils/useSortableData";
import './Users';
import { useConfig } from "../context/ConfigContext";
// Smart fetch function to handle Azure HTML errors
const smartFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...options.headers
    }
  });

  // ALWAYS read as text first (CRITICAL for Azure errors)
  const responseText = await response.text();

  // Check if it's an Azure HTML error page
  const isAzureHtmlError =
    !response.ok && (
      responseText.includes('<!DOCTYPE') ||
      responseText.includes('<html>') ||
      responseText.trim().startsWith('The service') ||
      responseText.includes('Service Unavailable') ||
      responseText.includes('503') && responseText.includes('Azure')
    );

  if (isAzureHtmlError) {
    // This is Azure's cold start HTML page, not your JSON
    throw {
      type: 'AZURE_COLD_START',
      message: 'Azure Functions is starting up. This can take 30-60 seconds.',
      status: response.status
    };
  }

  // Check if response is JSON
  if (!responseText.trim()) {
    return []; // Empty response
  }

  // Try to parse as JSON
  try {
    return JSON.parse(responseText);
  } catch (jsonError) {
    // If it's not JSON and response was OK, throw parse error
    if (response.ok) {
      throw new Error(`Server returned invalid format: ${responseText.substring(0, 100)}`);
    }

    // If not JSON and not OK, throw HTTP error
    throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 100)}`);
  }
};

// Fetch with retry logic for cold starts
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Admin fetch attempt ${attempt}/${maxRetries}`);
      const result = await smartFetch(url, options);
      return result;

    } catch (error) {
      // If it's a cold start error, wait and retry
      if (error.type === 'AZURE_COLD_START' && attempt < maxRetries) {
        const delay = attempt * 10000; // 10s, 20s, 30s...
        console.log(`Cold start detected, waiting ${delay / 1000} seconds before retry...`);

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Re-throw other errors or if max retries reached
      throw error;
    }
  }
  throw new Error(`Maximum retries (${maxRetries}) exceeded`);
};

const Admin = () => {
  // Config Context
  const { config, updateConfig, loading: configLoading } = useConfig();
  const [localConfig, setLocalConfig] = useState({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleConfigChange = (key, value) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: parseInt(value) || 0
    }));
  };

  const saveConfiguration = async () => {
    setIsSavingConfig(true);
    setConfigMessage(null);
    try {
      const result = await updateConfig(localConfig);
      if (result.success) {
        setConfigMessage({ type: 'success', text: 'Configuration saved successfully!' });
      } else {
        setConfigMessage({ type: 'error', text: 'Failed to save configuration: ' + result.error });
      }
    } catch (e) {
      setConfigMessage({ type: 'error', text: 'Error saving: ' + e.message });
    } finally {
      setIsSavingConfig(false);
      setTimeout(() => setConfigMessage(null), 3000);
    }
  };

  // Client Admin Data States
  const [dateWiseData, setDateWiseData] = useState([]);
  const [vendorWiseData, setVendorWiseData] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]); // Store original data
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');

  // Add selected document type state
  const [selectedDocumentType, setSelectedDocumentType] = useState('');

  // Filter states for date-wise table
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [dateCompletionRateFilter, setDateCompletionRateFilter] = useState('');

  // Filter states for vendor-wise table
  const [vendorSelectFilter, setVendorSelectFilter] = useState('');
  const [vendorSearchFilter, setVendorSearchFilter] = useState('');
  const [vendorCompletionRateFilter, setVendorCompletionRateFilter] = useState('');

  // Pagination states for date-wise table
  const [currentDatePage, setCurrentDatePage] = useState(1);
  const [dateRowsPerPage] = useState(6);

  // Pagination states for vendor-wise table
  const [currentVendorPage, setCurrentVendorPage] = useState(1);
  const [vendorRowsPerPage] = useState(6);

  // Table Navigation State
  const [currentTableIndex, setCurrentTableIndex] = useState(0);
  const [selectedTable, setSelectedTable] = useState('dateWise');



  const navigate = useNavigate();
  const location = useLocation();
  const [clientData, setClientData] = useState(null);
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [showPlanPopup, setShowPlanPopup] = useState(false);
  const [loadingClientDetails, setLoadingClientDetails] = useState(false);

  // Fetch specific client data if navigated from SuperAdmin
  useEffect(() => {
    const fetchClientDetails = async () => {
      const clientName = location.state?.clientName;

      if (clientName) {
        setLoadingClientDetails(true);
        try {
          // 1. Fetch Master Data to find client details
          const masterResponse = await fetchWithRetry(
            "https://docqmentorfuncapp.azurewebsites.net/api/MasterDataFunc?code=-naL4WUo1IvQ0tFNiOvKYNQVpFrlEOKr6XoAzDWRIS6HAzFuwFqgTA=="
          );

          if (Array.isArray(masterResponse)) {
            const client = masterResponse.find(c => c.Name === clientName);
            if (client) {
              setClientData(client);

              // 2. Fetch Active Users count from DynamicTable
              // Using POST method as per requirement
              const userResponse = await fetch("https://docqmentorfuncapp.azurewebsites.net/api/dynamictable?code=hti8hivQlsGePwd1jhdOMmm3cy_28hghWbLdWy2BLx1dAzFuchAdrA==", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  tableName: clientName,
                  operation: "readall"
                })
              });

              const userText = await userResponse.text();
              let users = [];
              try {
                const parsed = JSON.parse(userText);
                // Handle different response structures
                if (Array.isArray(parsed)) users = parsed;
                else if (parsed.data && Array.isArray(parsed.data)) users = parsed.data;
                else if (parsed.users && Array.isArray(parsed.users)) users = parsed.users;
              } catch (e) {
                console.error("Error parsing user data:", e);
              }

              const approvedCount = users.filter(u =>
                (u.Permission === "Approve" || u.permission === "Approve")
              ).length;

              setActiveUserCount(approvedCount);
            }
          }
        } catch (error) {
          console.error("Error fetching client specific data:", error);
        } finally {
          setLoadingClientDetails(false);
        }
      }
    };

    fetchClientDetails();
  }, [location.state]);

  const handleToggle = () => {
    navigate('/users', {
      state: {
        clientName: location.state?.clientName || clientData?.Name,
        clientData: clientData,
        userLimit: clientData?.UserLimits || 0
      }
    });
  }
  // Table Configuration
  const tableConfig = [
    {
      id: 'dateWise',
      name: 'Date-wise Statistics',
      component: 'dateWise'
    },
    {
      id: 'vendorWise',
      name: 'Vendor-wise Statistics',
      component: 'vendorWise'
    },
    {
      id: 'configuration',
      name: 'Confidence Configuration',
      component: 'configuration'
    }
  ];

  // User Management States
  const [users, setUsers] = useState([
    { id: 1, email: "admin@example.com", role: "Admin" },
    { id: 2, email: "reviewer@example.com", role: "Contributor" },
    { id: 3, email: "user1@example.com", role: "Member" },
    { id: 4, email: "user2@example.com", role: "Member" }
  ]);

  // User Filter and Popup States
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState(users);
  const [roleFilter, setRoleFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  // Table Navigation Functions
  const handleTableSelect = (tableId) => {
    const index = tableConfig.findIndex(table => table.id === tableId);
    if (index !== -1) {
      setSelectedTable(tableId);
      setCurrentTableIndex(index);
    }
  };

  const goToPreviousTable = () => {
    setCurrentTableIndex(prev => {
      const newIndex = prev > 0 ? prev - 1 : tableConfig.length - 1;
      setSelectedTable(tableConfig[newIndex].id);
      return newIndex;
    });
  };

  const goToNextTable = () => {
    setCurrentTableIndex(prev => {
      const newIndex = prev < tableConfig.length - 1 ? prev + 1 : 0;
      setSelectedTable(tableConfig[newIndex].id);
      return newIndex;
    });
  };

  // Load selected document type from localStorage on component mount
  useEffect(() => {
    const storedDocumentType = localStorage.getItem('selectedModelType');
    if (storedDocumentType) {
      setSelectedDocumentType(storedDocumentType);
    } else {
      // Default to Invoice if no selection exists
      setSelectedDocumentType('Invoice');
    }
  }, []);

  // Fetch data from API
  const fetchData = async () => {
    try {
      setDataLoading(true);
      setDataError(null);

      const allDocumentsData = await fetchWithRetry(
        "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=H4sgHod2tb26Mmhl_h4DfLQe428vjXDrlIo_Npk7sSr6AzFuPY_B6Q=="
      );

      setAllDocuments(allDocumentsData);

      // Process data for date-wise statistics (filtered by document type)
      const dateStats = processDateWiseData(allDocumentsData);
      setDateWiseData(dateStats);

      // Process data for vendor-wise statistics (filtered by document type)
      const vendorStats = processVendorWiseData(allDocumentsData);
      setVendorWiseData(vendorStats);

    } catch (err) {
      console.error('Error fetching admin data:', err);

      // User-friendly error messages
      let errorMsg = "Failed to load admin statistics. ";

      if (err.type === 'AZURE_COLD_START') {
        errorMsg = "Document service is starting up. This can take 30-60 seconds on first use. Statistics will appear when ready.";
      } else if (err.message.includes('Unexpected token')) {
        errorMsg = "Server returned unexpected response. Azure Functions might be starting up.";
      } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
        errorMsg = "Network connection issue. Please check your internet connection.";
      } else if (err.message.includes('Maximum retries')) {
        errorMsg = "Service is taking longer than expected to start. Please refresh the page or try again in a minute.";
      } else {
        errorMsg += err.message;
      }

      setDataError(errorMsg);

      // Set empty arrays on error
      setAllDocuments([]);
      setDateWiseData([]);
      setVendorWiseData([]);

    } finally {
      setDataLoading(false);
    }
  };

  // Filter documents by selected document type
  const filterDocumentsByType = (documents) => {
    if (!selectedDocumentType) return documents;

    return documents.filter(doc => {
      const docModelType = doc.modelType || '';
      return docModelType.toLowerCase() === selectedDocumentType.toLowerCase();
    });
  };

  // Determine document status (same logic as other components)
  const determineStatus = (doc) => {
    if (doc.status === "Reviewed" || doc.reviewStatus === "Reviewed" || doc.reviewedBy) {
      return "Reviewed";
    }
    if (!doc || !doc.extractedData || !doc.confidenceScores) {
      return "Manual Review";
    }

    const hasAllMandatoryFields = (doc) => {
      if (!doc || !doc.extractedData) return false;
      const requiredFields = [
        "VendorName",
        "InvoiceId",
        "InvoiceDate",
        "LPO NO",
        "SubTotal",
        "VAT",
        "InvoiceTotal",
      ];
      return requiredFields.every((field) => {
        let value = doc.extractedData[field];
        if (field === "LPO NO") value = value || doc.extractedData["LPO NO"] || doc.extractedData["LPO NO"];
        if (field === "VAT") value = value || doc.extractedData["VAT"] || doc.extractedData["VAT"];
        return value !== undefined && value !== null && String(value).trim() !== "";
      });
    };

    const scoreStr = String(doc.totalConfidenceScore || "").toLowerCase();
    if (scoreStr.includes("reviewed")) return "Reviewed";
    if (!hasAllMandatoryFields(doc)) return "Manual Review";

    const scores = Object.values(doc.confidenceScores || {});
    if (scores.length === 0) return "Manual Review";

    const avg = scores.reduce((sum, val) => sum + Number(val), 0) / scores.length;
    return avg >= 0.85 ? "Completed" : "Manual Review";
  };

  // Process data for date-wise statistics (filtered by document type)
  const processDateWiseData = (documents) => {
    // Filter documents by selected type first
    const filteredDocs = filterDocumentsByType(documents);

    const dateMap = {};

    filteredDocs.forEach(doc => {
      // ✅ Prioritize UploadedAt from SQL (PascalCase or camelCase)
      const rawTimestamp = doc.UploadedAt || doc.uploadedAt || doc.timestamp;

      if (!rawTimestamp) return; // Skip if no valid date found

      const dateObj = new Date(rawTimestamp);
      if (isNaN(dateObj.getTime())) return; // Skip invalid dates

      const uploadDate = dateObj.toISOString().split('T')[0];

      if (!dateMap[uploadDate]) {
        dateMap[uploadDate] = {
          date: uploadDate,
          total: 0,
          completed: 0,
          manualReview: 0,
          rawDate: dateObj,
          completionRate: 0
        };
      }

      dateMap[uploadDate].total++;
      const status = determineStatus(doc);

      if (status === "Completed" || status === "Reviewed") {
        dateMap[uploadDate].completed++;
      } else if (status === "Manual Review") {
        dateMap[uploadDate].manualReview++;
      }

      // Calculate completion rate
      dateMap[uploadDate].completionRate = dateMap[uploadDate].total > 0 ?
        (dateMap[uploadDate].completed / dateMap[uploadDate].total) * 100 : 0;
    });

    // Convert to array and sort by date (newest first)
    return Object.values(dateMap)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, getPeriodLimit());
  };

  // Process data for vendor-wise statistics (filtered by document type)
  const processVendorWiseData = (documents) => {
    // Filter documents by selected type first
    const filteredDocs = filterDocumentsByType(documents);

    const vendorMap = {};

    filteredDocs.forEach(doc => {
      const vendorName = doc.extractedData?.VendorName || doc.vendorName || 'Unknown Vendor';

      if (!vendorMap[vendorName]) {
        vendorMap[vendorName] = {
          vendor: vendorName,
          total: 0,
          completed: 0,
          manualReview: 0,
          completionRate: 0
        };
      }

      vendorMap[vendorName].total++;
      const status = determineStatus(doc);

      if (status === "Completed" || status === "Reviewed") {
        vendorMap[vendorName].completed++;
      } else if (status === "Manual Review") {
        vendorMap[vendorName].manualReview++;
      }

      // Calculate completion rate
      vendorMap[vendorName].completionRate = vendorMap[vendorName].total > 0 ?
        (vendorMap[vendorName].completed / vendorMap[vendorName].total) * 100 : 0;
    });

    // Convert to array and sort by total documents (descending)
    return Object.values(vendorMap)
      .sort((a, b) => b.total - a.total);
  };

  const getPeriodLimit = () => {
    switch (selectedPeriod) {
      case '7days': return 7;
      case '30days': return 30;
      default: return 100; // Show more records for "all"
    }
  };

  // Filter date-wise data
  const filterDateWiseData = () => {
    let filtered = processDateWiseData(allDocuments);

    // Apply date range filter
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter);
      filtered = filtered.filter(item => new Date(item.date) >= fromDate);
    }

    if (dateToFilter) {
      const toDate = new Date(dateToFilter);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter(item => new Date(item.date) <= toDate);
    }

    // Apply completion rate filter
    if (dateCompletionRateFilter) {
      filtered = filtered.filter(item => {
        const completionRate = item.completionRate;

        switch (dateCompletionRateFilter) {
          case '0-10': return completionRate >= 0 && completionRate <= 10;
          case '10-20': return completionRate > 10 && completionRate <= 20;
          case '20-30': return completionRate > 20 && completionRate <= 30;
          case '30-40': return completionRate > 30 && completionRate <= 40;
          case '40-50': return completionRate > 40 && completionRate <= 50;
          case '50-60': return completionRate > 50 && completionRate <= 60;
          case '60-70': return completionRate > 60 && completionRate <= 70;
          case '70-80': return completionRate > 70 && completionRate <= 80;
          case '80-90': return completionRate > 80 && completionRate <= 90;
          case '90-100': return completionRate > 90 && completionRate <= 100;
          default: return true;
        }
      });
    }

    return filtered;
  };

  // Filter vendor-wise data
  const filterVendorWiseData = () => {
    let filtered = processVendorWiseData(allDocuments);

    // Apply vendor select filter (dropdown)
    if (vendorSelectFilter) {
      filtered = filtered.filter(item =>
        item.vendor === vendorSelectFilter
      );
    }

    // Apply vendor search filter
    if (vendorSearchFilter) {
      filtered = filtered.filter(item =>
        item.vendor.toLowerCase().includes(vendorSearchFilter.toLowerCase())
      );
    }

    // Apply completion rate filter
    if (vendorCompletionRateFilter) {
      filtered = filtered.filter(item => {
        const completionRate = item.completionRate;

        switch (vendorCompletionRateFilter) {
          case '0-10': return completionRate >= 0 && completionRate <= 10;
          case '10-20': return completionRate > 10 && completionRate <= 20;
          case '20-30': return completionRate > 20 && completionRate <= 30;
          case '30-40': return completionRate > 30 && completionRate <= 40;
          case '40-50': return completionRate > 40 && completionRate <= 50;
          case '50-60': return completionRate > 50 && completionRate <= 60;
          case '60-70': return completionRate > 60 && completionRate <= 70;
          case '70-80': return completionRate > 70 && completionRate <= 80;
          case '80-90': return completionRate > 80 && completionRate <= 90;
          case '90-100': return completionRate > 90 && completionRate <= 100;
          default: return true;
        }
      });
    }

    return filtered;
  };

  // Get unique vendor names for the dropdown (filtered by document type)
  const getUniqueVendors = () => {
    const vendors = processVendorWiseData(allDocuments).map(item => item.vendor);
    return [...new Set(vendors)].sort();
  };

  // Get filtered data
  const filteredDateWiseData = filterDateWiseData();
  const filteredVendorWiseData = filterVendorWiseData();

  // Calculate total documents based on current filters and active table
  const calculateCurrentTotalDocs = () => {
    if (selectedTable === 'vendorWise') {
      const total = filteredVendorWiseData.reduce((sum, item) => sum + item.total, 0);
      return total;
    } else {
      // Default to date-wise (or if dateWise is selected)
      const total = filteredDateWiseData.reduce((sum, item) => sum + item.total, 0);
      return total;
    }
  };

  // Calculate average metric based on active table
  const calculateAverageMetric = () => {
    if (selectedTable === 'vendorWise') {
      if (filteredVendorWiseData.length === 0) return '0';
      const totalDocs = filteredVendorWiseData.reduce((sum, item) => sum + item.total, 0);
      const avg = totalDocs / filteredVendorWiseData.length;
      return avg.toFixed(0);
    } else {
      if (filteredDateWiseData.length === 0) return '0';
      const totalDocs = filteredDateWiseData.reduce((sum, day) => sum + day.total, 0);
      const avg = totalDocs / Math.min(filteredDateWiseData.length, 30);
      return avg.toFixed(0);
    }
  };

  // Use sortable data hooks for both tables
  const {
    sortedData: sortedDateData,
    toggleSort: toggleDateSort,
    renderSortIcon: renderDateSortIcon,
    sortColumn: dateSortColumn,
    sortOrder: dateSortOrder
  } = useSortableData(filteredDateWiseData);

  const {
    sortedData: sortedVendorData,
    toggleSort: toggleVendorSort,
    renderSortIcon: renderVendorSortIcon,
    sortColumn: vendorSortColumn,
    sortOrder: vendorSortOrder
  } = useSortableData(filteredVendorWiseData);

  // Paginate date-wise data
  const dateTotalPages = Math.ceil(sortedDateData.length / dateRowsPerPage);
  const dateStartIndex = (currentDatePage - 1) * dateRowsPerPage;
  const currentDateRows = sortedDateData.slice(dateStartIndex, dateStartIndex + dateRowsPerPage);

  // Paginate vendor-wise data
  const vendorTotalPages = Math.ceil(sortedVendorData.length / vendorRowsPerPage);
  const vendorStartIndex = (currentVendorPage - 1) * vendorRowsPerPage;
  const currentVendorRows = sortedVendorData.slice(vendorStartIndex, vendorStartIndex + vendorRowsPerPage);

  // Reset all filters
  const resetDateFilters = () => {
    setDateFromFilter('');
    setDateToFilter('');
    setDateCompletionRateFilter('');
    setCurrentDatePage(1);
  };

  const resetVendorFilters = () => {
    setVendorSelectFilter('');
    setVendorSearchFilter('');
    setVendorCompletionRateFilter('');
    setCurrentVendorPage(1);
  };

  // Export to CSV function
  const exportToCSV = (data, filename) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csvContent = [headers, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${selectedDocumentType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter users when filters change
  useEffect(() => {
    const filtered = users.filter(user => {
      const roleMatch = !roleFilter || user.role === roleFilter;
      const nameMatch = !nameFilter || user.email.toLowerCase().includes(nameFilter.toLowerCase());
      return roleMatch && nameMatch;
    });
    setFilteredUsers(filtered);
  }, [users, roleFilter, nameFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentDatePage(1);
  }, [dateFromFilter, dateToFilter, dateCompletionRateFilter, selectedDocumentType]);

  useEffect(() => {
    setCurrentVendorPage(1);
  }, [vendorSelectFilter, vendorSearchFilter, vendorCompletionRateFilter, selectedDocumentType]);

  // Fetch data when selected document type changes
  useEffect(() => {
    if (selectedDocumentType) {
      fetchData();
    }
  }, [selectedDocumentType, selectedPeriod]);

  // User Management Functions
  const openUserPopup = () => {
    setShowUserPopup(true);
    setFilteredUsers(users);
  };



  // Render Date-wise Table
  const renderDateWiseTable = () => (
    <div className="admin-table-box">
      <div className="table-section-header">

        {/* Div 1: Document Type Header */}
        <div className="table-header-top">
          <h3 className="table-header-title">{selectedDocumentType} - Date-wise Statistics</h3>
          <div className="table-nav-controls">
            <button className="nav-btn" onClick={goToPreviousTable}>
              <ChevronLeft className='admin-ChevronLeft' size={20} />
            </button>
            <span style={{ fontWeight: '700', minWidth: '40px', textAlign: 'center' }}>
              {currentTableIndex + 1} / {tableConfig.length}
            </span>
            <button className="nav-btn" onClick={goToNextTable}>
              <ChevronRight className='admin-ChevronRight' size={20} />
            </button>
          </div>
        </div>


        {/* Div 2: Filters and Controls */}
        <div className="table-header-bottom">
          <div className="table-filters-container">
            <div className="table-filter-group">
              <label className='date-from-label' htmlFor="date-from">From Date:</label>
              <input
                className='date-from-input'
                type="date"
                id="date-from"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
              />
            </div>
            <div className="table-filter-group">
              <label className='date-to-label' htmlFor="date-to">To Date:</label>
              <input
                className='date-to-input'
                type="date"
                id="date-to"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="table-actions-container">
            <button
              onClick={() => exportToCSV(filteredDateWiseData, 'date_wise_stats')}
              className="export-btn"
              disabled={filteredDateWiseData.length === 0}
            >
              <Download className="export-btn-icon" size={16} />
              Export CSV
            </button>
            <button onClick={resetDateFilters} className="reset-filters-btn">
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <div className="table-scroll-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleDateSort("date")}>
                <span className="sortable-header">
                  Date {renderDateSortIcon("date")}
                </span>
              </th>
              <th onClick={() => toggleDateSort("total")}>
                <span className="sortable-header">
                  Total Docs Uploaded {renderDateSortIcon("total")}
                </span>
              </th>
              <th onClick={() => toggleDateSort("completed")}>
                <span className="sortable-header">
                  Completed {renderDateSortIcon("completed")}
                </span>
              </th>
              <th onClick={() => toggleDateSort("manualReview")}>
                <span className="sortable-header">
                  Manual Review {renderDateSortIcon("manualReview")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentDateRows.length > 0 ? (
              currentDateRows.map((day, index) => (
                <tr key={index}>
                  <td>{new Date(day.date).toLocaleDateString()}</td>
                  <td>{day.total}</td>
                  <td>{day.completed}</td>
                  <td>{day.manualReview}</td>
                </tr>
              ))
            ) : !dataLoading && !dataError ? ( // Only show "no data" if not loading and no error
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                  No {selectedDocumentType} data available for selected filters
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Date-wise Pagination */}
      {sortedDateData.length > 0 && (
        <FilePagination
          currentPage={currentDatePage}
          totalPages={dateTotalPages}
          onPageChange={setCurrentDatePage}
          rowsPerPage={dateRowsPerPage}
          totalItems={sortedDateData.length}
        />
      )}
    </div>
  );

  // Render Vendor-wise Table
  const renderVendorWiseTable = () => (
    <div className="admin-table-box">
      <div className="table-section-header">
        {/* Div 1: Document Type Header */}
        <div className="table-header-top">
          <h3 className="table-header-title">{selectedDocumentType} - Vendor-wise Statistics</h3>
          <div className="table-nav-controls">
            <button className="nav-btn" onClick={goToPreviousTable}>
              <ChevronLeft className='admin-ChevronLeft' size={20} />
            </button>
            <span style={{ fontWeight: '700', minWidth: '40px', textAlign: 'center' }}>
              {currentTableIndex + 1} / {tableConfig.length}
            </span>
            <button className="nav-btn" onClick={goToNextTable}>
              <ChevronRight className='admin-ChevronRight' size={20} />
            </button>
          </div>
        </div>
        {/* Div 2: Filters and Controls */}
        <div className="table-header-bottom">
          <div className="table-filters-container">
            <div className="table-filter-group">
              <label className='vendor-select-label' htmlFor="vendor-select">Select by Vendor:</label>
              <select
                className='vendor-select-input'
                id="vendor-select"
                value={vendorSelectFilter}
                onChange={(e) => setVendorSelectFilter(e.target.value)}
              >
                <option value="">All Vendors</option>
                {getUniqueVendors().map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            </div>
            <div className="table-filter-group">
              <label className='vendor-search-label' htmlFor="vendor-search">Search by Vendor:</label>
              <input
                className='vendor-search-input'
                type="text"
                id="vendor-search"
                placeholder="Enter vendor name"
                value={vendorSearchFilter}
                onChange={(e) => setVendorSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="table-actions-container">
            <button
              onClick={() => exportToCSV(filteredVendorWiseData, 'vendor_wise_stats')}
              className="export-btn"
              disabled={filteredVendorWiseData.length === 0}
            >
              <Download className="export-btn-icon" size={16} />
              Export CSV
            </button>
            <button onClick={resetVendorFilters} className="reset-filters-btn">
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <div className="table-scroll-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleVendorSort("vendor")}>
                <span className="sortable-header">
                  Vendor Name {renderVendorSortIcon("vendor")}
                </span>
              </th>
              <th onClick={() => toggleVendorSort("total")}>
                <span className="sortable-header">
                  Total Docs Uploaded {renderVendorSortIcon("total")}
                </span>
              </th>
              <th onClick={() => toggleVendorSort("completed")}>
                <span className="sortable-header">
                  Completed {renderVendorSortIcon("completed")}
                </span>
              </th>
              <th onClick={() => toggleVendorSort("manualReview")}>
                <span className="sortable-header">
                  Manual Review {renderVendorSortIcon("manualReview")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentVendorRows.length > 0 ? (
              currentVendorRows.map((vendor, index) => (
                <tr key={index}>
                  <td>{vendor.vendor}</td>
                  <td>{vendor.total}</td>
                  <td>{vendor.completed}</td>
                  <td>{vendor.manualReview}</td>
                </tr>
              ))
            ) : !dataLoading && !dataError ? ( // Only show "no data" if not loading and no error
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                  No {selectedDocumentType} data available for selected filters
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Vendor-wise Pagination */}
      {sortedVendorData.length > 0 && (
        <FilePagination
          currentPage={currentVendorPage}
          totalPages={vendorTotalPages}
          onPageChange={setCurrentVendorPage}
          rowsPerPage={vendorRowsPerPage}
          totalItems={sortedVendorData.length}
        />
      )}
    </div>
  );

  const renderConfiguration = () => (
    <div className="admin-table-box config-box">
      <div className="table-section-header ConfidenceScoreConfiguration">
        <div className="config-header">
          <h3>Confidence Score Configuration</h3>
          <p className="config-subtitle">Set the minimum confidence score (%) required for automatic completion.</p>
        </div>
        <div className="table-nav-controls">
            <button className="nav-btn" onClick={goToPreviousTable}>
              <ChevronLeft className='admin-ChevronLeft' size={20} />
            </button>
            <span style={{ fontWeight: '700', minWidth: '40px', textAlign: 'center' }}>
              {currentTableIndex + 1} / {tableConfig.length}
            </span>
            <button className="nav-btn" onClick={goToNextTable}>
              <ChevronRight className='admin-ChevronRight' size={20} />
            </button>
        </div>
      </div>

      {configLoading ? (
        <div className="config-loading">Loading configuration...</div>
      ) : (
        <div className="config-form">
          {Object.keys(localConfig).map((key) => (
            <div key={key} className="config-item">
              <label className="config-label">{key}</label>
              <div className="config-input-wrapper">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={localConfig[key]}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  className="config-input"
                />
                <span className="config-percent">%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="config-actions">
        {configMessage && (
          <div className={`config-message ${configMessage.type}`}>
            {configMessage.text}
          </div>
        )}
        <button
          className="save-config-btn"
          onClick={saveConfiguration}
          disabled={isSavingConfig || configLoading}
        >
          {isSavingConfig ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

    </div>
  );

  // Render current table based on selection
  const renderCurrentTable = () => {
    switch (selectedTable) {
      case 'dateWise':
        return renderDateWiseTable();
      case 'vendorWise':
        return renderVendorWiseTable();
      case 'configuration':
        return renderConfiguration();
      default:
        return renderDateWiseTable();
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  // Show loading or error states
  if (dataLoading) return <div className="loading">Loading admin data...</div>;

  // Render error state with retry button
  if (dataError) {
    return (
      <div className="admin-container">
        <main className="admin-main">
          <div className="error-container">
            <div className="error-card">
              <h3 className="error-title">⚠️ Connection Issue</h3>
              <p className="error-message">{dataError}</p>
              <button
                onClick={fetchData}
                className="refresh-data-btn"
                style={{ margin: '0 auto' }}
              >
                <RefreshCw size={18} /> Try Again
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="admin-container">
      <main className="admin-main">
        <section className='header-admin'>
          <p>{clientData ? `${clientData.Name} Dashboard` : "Admin Dashboard"}</p>
          <button onClick={fetchData}>
            <RefreshCw className='RefreshCw-admin' size={16} /> Refresh Data
          </button>
        </section>

        <section className='summarys-admin'>
          <div className="summary-card docs-summary">
            <div className="icon-box docs-icon">
              <Database className='Database-admin' size={24} />
            </div>
            <div className="card-content">
              <span className="label">Total {selectedDocumentType} Docs</span>
              <span className="value">{calculateCurrentTotalDocs().toLocaleString()}</span>
            </div>
          </div>

          <div className="summary-card stats-summary">
            <div className="icon-box stats-icon">
              <BarChart2 className='BarChart2-admin' size={24} />
            </div>
            <div className="card-content">
              <span className="label">
                {selectedTable === 'vendorWise'
                  ? `Avg ${selectedDocumentType} / Vendor`
                  : `Avg ${selectedDocumentType} / Day`}
              </span>
              <span className="value">{calculateAverageMetric()}</span>
            </div>
          </div>

          <div className="summary-card users-summary" onClick={openUserPopup} style={{ cursor: 'pointer' }}>
            <div className="icon-box users-icon">
              <Users className='Users-admin' size={24} />
            </div>
            <div className="card-content">
              <span className="label">Active Users</span>
              <span className="value">
                {clientData ? activeUserCount : users.length}
              </span>
            </div>
          </div>
          <div className="summary-card " onClick={openUserPopup} style={{ cursor: 'pointer' }}>
            <div className="icon-box users-icon">
              <Users className='Users-admin' size={24} />
            </div>
            <div className="card-content" onClick={handleToggle}>
              <span className="label">Users Management</span>
              <span className="value">View</span>
            </div>
          </div>

          <div
            className="summary-card plan-summary"
            onClick={() => clientData && setShowPlanPopup(true)}
            style={{ cursor: clientData ? 'pointer' : 'default' }}
          >
            <div className="icon-box plan-icon">
              <Shield className='Shield-admin' size={24} />
            </div>
            <div className="card-content">
              <span className="label">Active Plan</span>
              <span className="value" style={{ fontSize: '1.25rem' }}>
                {clientData ? clientData.PlanName : "Enterprise"}
              </span>
            </div>
          </div>
        </section>

        {/* Render Current Table */}
        <section className="dashboard-content">
          {renderCurrentTable()}
        </section>

        {/* Plan Summary Popup */}
        {showPlanPopup && clientData && (
          <div className="modal-overlay" onClick={() => setShowPlanPopup(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{clientData.Name} Plan Details</h3>
                <button className="close-btn" onClick={() => setShowPlanPopup(false)}>
                  <X className='Admin-X' size={24} />
                </button>
              </div>

              <div className="modal-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Client ID</span>
                  <span className="detail-value">{clientData.ID || clientData.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{clientData.Name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Plan Name</span>
                  <span className="detail-value">{clientData.PlanName}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Start Date</span>
                  <span className="detail-value">
                    {clientData.StartDate ? new Date(clientData.StartDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">End Date</span>
                  <span className="detail-value">
                    {clientData.EndDate ? new Date(clientData.EndDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                {/* User Statistics */}
                <div className="detail-item">
                  <span className="detail-label">Active Users</span>
                  <span className="detail-value" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                    {activeUserCount}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">User Limits</span>
                  <span className="detail-value">{clientData.UserLimits}</span>
                </div>

                {/* Document Limits */}
                <div className="detail-item">
                  <span className="detail-label">Invoice Count</span>
                  <span className="detail-value">{clientData.InvoiceCount}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Bank Count</span>
                  <span className="detail-value">{clientData.BankStatementCount}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Mortgage Count</span>
                  <span className="detail-value">{clientData.MortgageFormsCount}</span>
                </div>

                {/* Statuses */}
                <div className="detail-item">
                  <span className="detail-label">Invoice Status</span>
                  <span className={`detail-value status-${(clientData.Invoice || 'inactive').toLowerCase()}`}>
                    {clientData.Invoice || 'Inactive'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Bank Status</span>
                  <span className={`detail-value status-${(clientData.BankStatement || 'inactive').toLowerCase()}`}>
                    {clientData.BankStatement || 'Inactive'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Mortgage Status</span>
                  <span className={`detail-value status-${(clientData.MortgageForms || 'inactive').toLowerCase()}`}>
                    {clientData.MortgageForms || 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer>
        <Footer />
      </footer>
    </div>
  );
};

export default Admin;