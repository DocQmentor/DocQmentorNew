import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import './Admin.css';
import Footer from "../Layout/Footer";
import FilePagination from '../Layout/FilePagination';
import useSortableData from "../utils/useSortableData";
import './Users';
import { useConfig } from "../context/ConfigContext";

const MASTER_API_URL = "https://docqmentorfuncapp.azurewebsites.net/api/MasterDataFunc?code=Z1XY4-hEifOUkkmGCbvvCbHxnOzQf0QNYxTiRpwOgW3JAzFuQTYLnQ==";
const DYNAMIC_TABLE_API = "https://docqmentorfuncapp.azurewebsites.net/api/dynamictable?code=bbsE1Sshdh2O1GLYzxotgIWeM12JWkZ1bRnYZ-vFkM04AzFuXhibXA==";

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
  const [allDocuments, setAllDocuments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [selectedPeriod] = useState('7days');

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

  const [selectedTable, setSelectedTable] = useState('dateWise');



  const navigate = useNavigate();
  const location = useLocation();
  const [clientData, setClientData] = useState(null);
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [showPlanPopup, setShowPlanPopup] = useState(false);

  // Fetch client data from master table
  useEffect(() => {
    const fetchClientDetails = async () => {
      try {
        const masterResponse = await fetchWithRetry(MASTER_API_URL, { method: "GET" });

        if (Array.isArray(masterResponse)) {
          const clientName = location.state?.clientName;
          const client = clientName
            ? masterResponse.find(c => c.Name === clientName)
            : masterResponse[0];

          if (client) {
            setClientData(client);

            const sanitizeTableName = (name) => name.replace(/[^a-zA-Z0-9_]/g, '');
            const tableName = sanitizeTableName(client.Name);

            const userResponse = await fetch(DYNAMIC_TABLE_API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tableName, operation: "readall" })
            });

            const userText = await userResponse.text();
            let users = [];
            try {
              const parsed = JSON.parse(userText);
              if (Array.isArray(parsed)) users = parsed;
              else if (parsed.data && Array.isArray(parsed.data)) users = parsed.data;
              else if (parsed.users && Array.isArray(parsed.users)) users = parsed.users;
            } catch (e) {
              console.error("Error parsing user data:", e);
            }

            setActiveUserCount(
              users.filter(u => u.Permission === "Approve" || u.permission === "Approve").length
            );
          }
        }
      } catch (error) {
        console.error("Error fetching client data:", error);
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


  const handleTableSelect = (tableId) => {
    setSelectedTable(tableId);
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
        "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=5ttVguFIlYsgNTLnI7I-hGlMyInPTM_Y-3ihASWqOxLzAzFuaOzdpQ=="
      );

      setAllDocuments(allDocumentsData);

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


  // Use sortable data hooks for both tables
  const {
    sortedData: sortedDateData,
    toggleSort: toggleDateSort,
    renderSortIcon: renderDateSortIcon,
  } = useSortableData(filteredDateWiseData);

  const {
    sortedData: sortedVendorData,
    toggleSort: toggleVendorSort,
    renderSortIcon: renderVendorSortIcon,
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

  const getCompRateClass = (rate) => {
    if (rate >= 80) return "comp-high";
    if (rate >= 50) return "comp-mid";
    return "comp-low";
  };

  const NAV_ITEMS = [
    { id: "dateWise",      emoji: "📅", label: "Date-wise Stats" },
    { id: "vendorWise",    emoji: "🏢", label: "Vendor-wise Stats" },
    { id: "configuration", emoji: "⚙",  label: "Confidence Config" },
  ];

  // Render Date-wise Table
  const renderDateWiseTable = () => (
    <div className="ad-section-card">
      <div className="ad-section-accent" />
      <div className="ad-section-head">
        <div>
          <div className="ad-section-title">📅 Date-wise Statistics</div>
        </div>
        <div className="ad-filter-row">
          <div className="ad-filter-field">
            <label className="ad-filter-lbl">FROM</label>
            <input className="ad-filter-input" type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} />
          </div>
          <div className="ad-filter-field">
            <label className="ad-filter-lbl">TO</label>
            <input className="ad-filter-input" type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} />
          </div>
          <button className="ad-btn-export" onClick={() => exportToCSV(filteredDateWiseData, 'date_wise_stats')} disabled={filteredDateWiseData.length === 0}>
            &#8595; Export
          </button>
          <button className="ad-btn-reset" onClick={resetDateFilters}>&#8634; Reset</button>
        </div>
      </div>

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th onClick={() => toggleDateSort("date")}>Date {renderDateSortIcon("date")}</th>
              <th onClick={() => toggleDateSort("total")}>Total {renderDateSortIcon("total")}</th>
              <th onClick={() => toggleDateSort("completed")}>Completed {renderDateSortIcon("completed")}</th>
              <th onClick={() => toggleDateSort("manualReview")}>Manual Review {renderDateSortIcon("manualReview")}</th>
              <th onClick={() => toggleDateSort("completionRate")}>Completion Rate {renderDateSortIcon("completionRate")}</th>
            </tr>
          </thead>
          <tbody>
            {currentDateRows.length > 0 ? (
              currentDateRows.map((day, i) => (
                <tr key={i}>
                  <td>{new Date(day.date).toLocaleDateString()}</td>
                  <td>{day.total}</td>
                  <td>{day.completed}</td>
                  <td>{day.manualReview}</td>
                  <td><span className={`comp-badge ${getCompRateClass(day.completionRate)}`}>{day.completionRate.toFixed(1)}%</span></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" className="ad-td-empty">{dataLoading ? "Loading…" : `No ${selectedDocumentType} data available`}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sortedDateData.length > 0 && (
        <FilePagination currentPage={currentDatePage} totalPages={dateTotalPages} onPageChange={setCurrentDatePage} rowsPerPage={dateRowsPerPage} totalItems={sortedDateData.length} />
      )}
    </div>
  );

  // Render Vendor-wise Table
  const renderVendorWiseTable = () => (
    <div className="ad-section-card">
      <div className="ad-section-accent" />
      <div className="ad-section-head">
        <div className="ad-section-title">🏢 Vendor-wise Statistics</div>
        <div className="ad-filter-row">
          <div className="ad-filter-field">
            <label className="ad-filter-lbl">VENDOR</label>
            <select className="ad-filter-input" value={vendorSelectFilter} onChange={(e) => setVendorSelectFilter(e.target.value)}>
              <option value="">All Vendors</option>
              {getUniqueVendors().map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="ad-filter-field">
            <label className="ad-filter-lbl">SEARCH</label>
            <input className="ad-filter-input" type="text" placeholder="Search vendor…" value={vendorSearchFilter} onChange={(e) => setVendorSearchFilter(e.target.value)} />
          </div>
          <button className="ad-btn-export" onClick={() => exportToCSV(filteredVendorWiseData, 'vendor_wise_stats')} disabled={filteredVendorWiseData.length === 0}>
            &#8595; Export
          </button>
          <button className="ad-btn-reset" onClick={resetVendorFilters}>&#8634; Reset</button>
        </div>
      </div>

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th onClick={() => toggleVendorSort("vendor")}>Vendor Name {renderVendorSortIcon("vendor")}</th>
              <th onClick={() => toggleVendorSort("total")}>Total {renderVendorSortIcon("total")}</th>
              <th onClick={() => toggleVendorSort("completed")}>Completed {renderVendorSortIcon("completed")}</th>
              <th onClick={() => toggleVendorSort("manualReview")}>Manual Review {renderVendorSortIcon("manualReview")}</th>
              <th onClick={() => toggleVendorSort("completionRate")}>Completion Rate {renderVendorSortIcon("completionRate")}</th>
            </tr>
          </thead>
          <tbody>
            {currentVendorRows.length > 0 ? (
              currentVendorRows.map((v, i) => (
                <tr key={i}>
                  <td>{v.vendor}</td>
                  <td>{v.total}</td>
                  <td>{v.completed}</td>
                  <td>{v.manualReview}</td>
                  <td><span className={`comp-badge ${getCompRateClass(v.completionRate)}`}>{v.completionRate.toFixed(1)}%</span></td>
                </tr>
              ))
            ) : !dataLoading && !dataError ? (
              <tr><td colSpan="5" className="ad-td-empty">No {selectedDocumentType} data available</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {sortedVendorData.length > 0 && (
        <FilePagination currentPage={currentVendorPage} totalPages={vendorTotalPages} onPageChange={setCurrentVendorPage} rowsPerPage={vendorRowsPerPage} totalItems={sortedVendorData.length} />
      )}
    </div>
  );

  const CONF_META = {
    Invoice:       { emoji: "💲", label: "Invoice Threshold" },
    BankStatement: { emoji: "🏦", label: "Bank Statement Threshold" },
    MortgageForms: { emoji: "🏠", label: "Mortgage Threshold" },
  };

  const renderConfiguration = () => (
    <div className="ad-section-card">
      <div className="ad-section-accent ad-section-accent--red" />
      <div className="ad-section-head">
        <div>
          <div className="ad-section-title">⚙ Confidence Score Thresholds</div>
          <div className="ad-section-sub">Set the minimum confidence score for auto-completion per document type</div>
        </div>
      </div>

      {configLoading ? (
        <div className="ad-conf-loading">Loading configuration…</div>
      ) : (
        <div className="ad-conf-cards">
          {Object.keys(localConfig).map((key) => {
            const meta = CONF_META[key] || { emoji: "⚙", label: key };
            return (
              <div key={key} className="ad-conf-card">
                <div className="ad-conf-card-lbl">{meta.emoji} {meta.label.toUpperCase()}</div>
                <div className="ad-conf-card-input-row">
                  <input
                    type="number" min="0" max="100"
                    value={localConfig[key]}
                    onChange={(e) => handleConfigChange(key, e.target.value)}
                    className="ad-conf-input"
                  />
                  <span className="ad-conf-pct">%</span>
                </div>
                <div className="ad-conf-card-hint">Minimum score to auto-complete</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="ad-conf-actions">
        {configMessage && (
          <div className={`ad-conf-msg ${configMessage.type}`}>{configMessage.text}</div>
        )}
        <button className="ad-btn-save-conf" onClick={saveConfiguration} disabled={isSavingConfig || configLoading}>
          {isSavingConfig ? "Saving…" : "💾 Save Configuration"}
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

  const clientName = clientData?.Name || location.state?.clientName || "—";

  return (
    <div className="ad-page">
      <div className="ad-content">
      {/* Layout: sidebar + main */}
      <div className="ad-layout">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="ad-sidebar">
          <div className="ad-sidebar-accent" />
          <div className="ad-sidebar-title">Navigation</div>
          <hr className="ad-sidebar-hr" />

          <nav className="ad-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`ad-nav-item${selectedTable === item.id ? " active" : ""}`}
                onClick={() => handleTableSelect(item.id)}
              >
                <span className="ad-nav-emoji">{item.emoji}</span>
                {item.label}
              </button>
            ))}
            <button className="ad-manage-users-btn" onClick={handleToggle}>
              <span className="ad-nav-emoji">👥</span>
              Manage Users
            </button>
          </nav>

          {/* Client Info Card */}
          <div className="ad-client-card">
            <div className="ad-client-card-title">Client Information</div>
            <hr className="ad-client-card-hr" />
            {[
              ["CLIENT",     clientName],
              ["PLAN",       clientData?.PlanName || "—"],
              ["USER LIMIT", clientData?.UserLimits ? `${clientData.UserLimits} users` : "—"],
            ].map(([lbl, val]) => (
              <div key={lbl} className="ad-client-row">
                <div className="ad-client-lbl">{lbl}</div>
                <div className="ad-client-val">{val}</div>
              </div>
            ))}
            <button
              className="ad-client-plan-btn"
              onClick={() => clientData && setShowPlanPopup(true)}
              disabled={!clientData}
            >
              View Full Details
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="ad-main">

          {/* Summary Cards */}
          <div className="ad-summary-row">
            <div className="ad-summary-card">
              <div className="ad-summary-icon ad-summary-icon--docs">📄</div>
              <div>
                <div className="ad-summary-label">Total Docs</div>
                <div className="ad-summary-value">{dataLoading ? "…" : allDocuments.length}</div>
              </div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-icon ad-summary-icon--users">👥</div>
              <div>
                <div className="ad-summary-label">Active Users</div>
                <div className="ad-summary-value">{activeUserCount}</div>
              </div>
            </div>
          </div>

          {renderCurrentTable()}
        </main>
      </div>

      {/* Plan Details Popup */}
      {showPlanPopup && clientData && (
        <div className="ad-modal-overlay" onClick={() => setShowPlanPopup(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-head">
              <h3>{clientData.Name} — Plan Details</h3>
              <button className="ad-modal-close" onClick={() => setShowPlanPopup(false)}>✕</button>
            </div>
            <div className="ad-modal-grid">
              {[
                ["Client ID",       clientData.ID || clientData.id],
                ["Name",            clientData.Name],
                ["Plan",            clientData.PlanName],
                ["Start Date",      clientData.StartDate ? new Date(clientData.StartDate).toLocaleDateString() : "N/A"],
                ["End Date",        clientData.EndDate   ? new Date(clientData.EndDate).toLocaleDateString()   : "N/A"],
                ["Active Users",    activeUserCount],
                ["User Limit",      clientData.UserLimits],
                ["Invoice Count",   clientData.InvoiceCount],
                ["Bank Count",      clientData.BankStatementCount],
                ["Mortgage Count",  clientData.MortgageFormsCount],
                ["Invoice Status",  clientData.Invoice || "Inactive"],
                ["Bank Status",     clientData.BankStatement || "Inactive"],
                ["Mortgage Status", clientData.MortgageForms || "Inactive"],
              ].map(([lbl, val]) => (
                <div key={lbl} className="ad-modal-row">
                  <span className="ad-modal-lbl">{lbl}</span>
                  <span className="ad-modal-val">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      </div>
      <Footer />
    </div>
  );
};

export default Admin;