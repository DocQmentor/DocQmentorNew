import React, { useState, useEffect } from "react";
import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import "./Table.css";
import { saveAs } from "file-saver";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import useSortableData from "../utils/useSortableData";
import { Info } from "lucide-react";
import FilePagination from "../Layout/Filepagination";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error.message || "An error occurred.",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red", textAlign: "center" }}>
          <h2>Something went wrong.</h2>
          <p>{this.state.errorMessage}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function getString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  if (typeof val === "object") {
    if ("valueString" in val) return val.valueString;
    if ("content" in val) return val.content;
    return JSON.stringify(val);
  }
  return "";
}

const modelTypeHeaders = {
  Invoice: [
    "Vendor Name",
    "Invoice ID",
    "Invoice Date",
    "LPO No",
    "Sub Total",
    "VAT",
    "Invoice Total",
    "Upload Date",
    "Confidence Score",
    "Action",
  ],
  BankStatement: [
    "AccountHolder",
    "AccountNumber",
    "StatementPeriod",
    "OpeningBalance",
    "ClosingBalance",
    "Upload Date",
    "Confidence Score",
    "Action",
  ],
  MortgageForms: [
    "LenderName",
    "BorrowerName",
    "LoanAmount",
    "Interest",
    "LoanTenure",
    "Upload Date",
    "Confidence Score",
    "Action",
  ],
};

const modelTypeKeys = {
  Invoice: [
   "VendorName", "InvoiceId", "InvoiceDate", "LPO NO", "SubTotal", "VAT", "InvoiceTotal",
    "uploadDate",
    "confidenceScore",
    "_rawDocument",
  ],
  BankStatement: [
    "AccountHolder",
    "AccountNumber",
    "StatementPeriod",
    "OpeningBalance",
    "ClosingBalance",
    "uploadDate",
    "confidenceScore",
    "_rawDocument",
  ],
  MortgageForms: [
    "Lendername", "Borrowername", "Loanamount", "Interest", "Loantenure",
    "uploadDate",
    "confidenceScore",
    "_rawDocument",
  ],
};

// Model-specific search fields
const modelTypeSearchFields = {
  Invoice: ["VendorName", "InvoiceId", "InvoiceDate", "LPO NO", "SubTotal", "VAT", "InvoiceTotal"],
  BankStatement: ["AccountHolder", "AccountNumber", "StatementPeriod", "OpeningBalance", "ClosingBalance"],
  MortgageForms: ["Lendername", "Borrowername", "Loanamount", "Interest", "Loantenure"],
};

function Table() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedModelType, setSelectedModelType] = useState(localStorage.getItem("selectedModelType") || "Invoice");
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploadDateFilter, setUploadDateFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState(""); // For Invoice model only
  const [accountHolderFilter, setAccountHolderFilter] = useState(""); // For BankStatement model only
  const [lenderNameFilter, setLenderNameFilter] = useState(""); // For MortgageForms model only

  // Version History Modal
  const [versionModal, setVersionModal] = useState({
    visible: false,
    history: [],
    docName: "",
  });

  const rowsPerPage = 10;
  const today = new Date().toISOString().split("T")[0];

  const handleModelTypeChange = (type) => {
    setSelectedModelType(type);
    localStorage.setItem("selectedModelType", type);
    // Reset filters when model type changes
    handleResetFilters();
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setUploadDateFilter("all");
    setVendorFilter("");
    setAccountHolderFilter("");
    setLenderNameFilter("");
    setCurrentPage(1);
  };

  const { sortedData, toggleSort, renderSortIcon, sortColumn, sortOrder } =
    useSortableData(data);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const response = await fetch(
          "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
        );
        const fetched = await response.json();

        const processed = fetched
          .filter((doc) => doc.modelType === selectedModelType)
          .map((doc) => {
            const extracted = doc.extractedData || {};
            const commonFields = {
              uploadDate: doc.timestamp
                ? new Date(doc.timestamp).toLocaleDateString("en-CA")
                : "",
              rawUploadDate: doc.timestamp ? new Date(doc.timestamp) : null,
              confidenceScore: doc.totalConfidenceScore
                ? parseFloat(doc.totalConfidenceScore) || 0
                : "N/A",
              _rawDocument: doc,
            };

            if (selectedModelType === "Invoice") {
              return {
                vendorName: getString(extracted.VendorName),
                invoiceId: getString(extracted.InvoiceId),
                invoiceDate: getString(extracted.InvoiceDate),
                lpoNo: getString(extracted["LPO NO"]),
                subTotal: getString(extracted.SubTotal),
                vat: getString(extracted.VAT),
                invoicetotal: getString(extracted.InvoiceTotal),
                ...commonFields,
              };
            } else if (selectedModelType === "BankStatement") {
              return {
                AccountHolder: getString(extracted.AccountHolder),
                AccountNumber: getString(extracted.AccountNumber),
                StatementPeriod: getString(extracted.StatementPeriod),
                OpeningBalance: getString(extracted.OpeningBalance),
                ClosingBalance: getString(extracted.ClosingBalance),
                ...commonFields,
              };
            } else if (selectedModelType === "MortgageForms") {
              return {
                LenderName: getString(extracted.LenderName),
                BorrowerName: getString(extracted.BorrowerName),
                LoanAmount: getString(extracted.LoanAmount),
                Interest: getString(extracted.Interest),
                LoanTenure: getString(extracted.LoanTenure),
                ...commonFields,
              };
            }
            return commonFields;
          });

        setData(processed);
        setError(null);
      } catch (err) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedModelType]);

  // Apply filters to data
  const filteredData = sortedData.filter((item) => {
    // Search query filter
    const matchesSearch = searchQuery ? 
      modelTypeSearchFields[selectedModelType].some(field => 
        (item[field] || "").toString().toLowerCase().includes(searchQuery.toLowerCase())
      ) : true;

    // Date range filter (applies to date fields based on model type)
    let matchesDateRange = true;
    if (fromDate || toDate) {
      const dateField = selectedModelType === "Invoice" ? "invoiceDate" : 
                       selectedModelType === "BankStatement" ? "StatementPeriod" : "uploadDate";
      
      const itemDate = item[dateField] ? new Date(item[dateField]) : null;
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;

      if (itemDate) {
        matchesDateRange = (!from || itemDate >= from) && (!to || itemDate <= to);
      }
    }

    // Vendor filter (Invoice only)
    const matchesVendor = selectedModelType !== "Invoice" || !vendorFilter || 
      (item.vendorName || "").toLowerCase().includes(vendorFilter.toLowerCase());

    // Account Holder filter (BankStatement only)
    const matchesAccountHolder = selectedModelType !== "BankStatement" || !accountHolderFilter || 
      (item.AccountHolder || "").toLowerCase().includes(accountHolderFilter.toLowerCase());

    // Lender Name filter (MortgageForms only)
    const matchesLenderName = selectedModelType !== "MortgageForms" || !lenderNameFilter || 
      (item.LenderName || "").toLowerCase().includes(lenderNameFilter.toLowerCase());

    // Upload date filter
    const now = new Date();
    const uploadDate = item.rawUploadDate;
    let matchesUploadFilter = true;
    if (uploadDateFilter === "7days") {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      matchesUploadFilter = uploadDate >= sevenDaysAgo && uploadDate <= now;
    } else if (uploadDateFilter === "30days") {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      matchesUploadFilter = uploadDate >= thirtyDaysAgo && uploadDate <= now;
    }

    return matchesSearch && matchesDateRange && matchesVendor && 
           matchesAccountHolder && matchesLenderName && matchesUploadFilter;
  });

  // Version History handler
  const handleInfoClick = (file) => {
    if (file.versionHistory && Array.isArray(file.versionHistory)) {
      setVersionModal({
        visible: true,
        history: file.versionHistory,
        docName: file.documentName || file.blobUrl || "Document",
      });
    } else {
      toast.info("No version history available.");
    }
  };

  const handleExportCSV = () => {
    const headers = modelTypeHeaders[selectedModelType];
    const keys = modelTypeKeys[selectedModelType];

    const rows = filteredData.map((item) =>
      keys.map((key) =>
        key === "_rawDocument" ? "" : `"${item[key]?.toString().replace(/"/g, '""') || ""}"`
      ).join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${selectedModelType}_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleViewDocument = (doc) => {
    const url = doc?.fileUrl || doc?.blobUrl;
    if (url) window.open(url, "_blank");
    else toast.error("File URL not available");
  };

  // Format date for display
  function formatDate(dateString) {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  }

  // Pagination
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const currentRows = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate, uploadDateFilter, vendorFilter, accountHolderFilter, lenderNameFilter, selectedModelType]);

  return (
    <div className="table-component-container">
      <Header />
      <div className="dataview-container">
        <h2>{selectedModelType} Data View</h2>

        {/* Model Type Selector */}
        {/* <div className="model-type-selector">
          <label>
            <strong>Document Type:</strong>
            <select 
              value={selectedModelType} 
              onChange={(e) => handleModelTypeChange(e.target.value)}
            >
              <option value="Invoice">Invoice</option>
              <option value="BankStatement">Bank Statement</option>
              <option value="MortgageForms">Mortgage Forms</option>
            </select>
          </label>
        </div> */}

        {/* Filters */}
        <div className="filters">
          {/* Vendor Filter (Invoice only) */}
          {selectedModelType === "Invoice" && (
            <label>
              <strong>Vendor:</strong>
              <input
                type="text"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                placeholder="Enter vendor name"
              />
            </label>
          )}

          {/* Account Holder Filter (BankStatement only) */}
          {selectedModelType === "BankStatement" && (
            <label>
              <strong>Account Holder:</strong>
              <input
                type="text"
                value={accountHolderFilter}
                onChange={(e) => setAccountHolderFilter(e.target.value)}
                placeholder="Enter account holder name"
              />
            </label>
          )}

          {/* Lender Name Filter (MortgageForms only) */}
          {selectedModelType === "MortgageForms" && (
            <label>
              <strong>Lender Name:</strong>
              <input
                type="text"
                value={lenderNameFilter}
                onChange={(e) => setLenderNameFilter(e.target.value)}
                placeholder="Enter lender name"
              />
            </label>
          )}

          {/* Date Range Filter */}
          <label>
            <strong>From Date:</strong>
            <input
              type="date"
              value={fromDate}
              max={today}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label>
            <strong>To Date:</strong>
            <input
              type="date"
              value={toDate}
              max={today}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>

          {/* Upload Date Filter */}
          <label>
            <strong>Upload Date:</strong>
            <select
              value={uploadDateFilter}
              onChange={(e) => setUploadDateFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </label>

          {/* Search Filter */}
          <label>
            <strong>Search All:</strong>
            <input
              type="text"
              placeholder={`Search ${selectedModelType.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          {/* Action Buttons */}
          <div className="reset-export-bar">
            <button onClick={handleResetFilters}>Reset</button>
          </div>
          <div className="search-export-bar">
            <button onClick={handleExportCSV}>Export CSV</button>
          </div>
        </div>

        {loading && <p>Loading data...</p>}
        {error && <p style={{ color: "red" }}>Error: {error}</p>}

        <ErrorBoundary>
          {!loading && !error && (
            <>
              <table>
                <thead>
                  <tr>
                    {modelTypeHeaders[selectedModelType].map((header, idx) => (
                      <th
                        key={idx}
                        onClick={() => toggleSort(modelTypeKeys[selectedModelType][idx])}
                      >
                        <span className="sortable-header">
                          {header} {renderSortIcon(modelTypeKeys[selectedModelType][idx])}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentRows.length > 0 ? (
                    currentRows.map((item, index) => (
                      <tr key={index}>
                        {modelTypeKeys[selectedModelType].map((key, idx) =>
                          key === "_rawDocument" ? (
                            <td key={idx}>
                              <button 
                                className="action-btn"
                                onClick={() => handleViewDocument(item._rawDocument)}
                              >
                                View
                              </button>
                            </td>
                          ) : key === "confidenceScore" ? (
                            <td key={idx}>
                              {item.confidenceScore !== "N/A" ? 
                                `${parseFloat(item.confidenceScore).toFixed(2)}%` : "N/A"}
                              {item._rawDocument?.status === "Reviewed" && (
                                <Info
                                  size={16}
                                  color="#007bff"
                                  style={{ cursor: "pointer", marginLeft: "5px" }}
                                  onClick={() => handleInfoClick(item._rawDocument)}
                                />
                              )}
                            </td>
                          ) : key === "invoiceDate" || key === "uploadDate" || key === "StatementPeriod" ? (
                            <td key={idx}>{formatDate(item[key])}</td>
                          ) : (
                            <td key={idx}>{item[key]}</td>
                          )
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={modelTypeHeaders[selectedModelType].length} style={{ textAlign: "center" }}>
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Version History Modal */}
              {versionModal.visible && (
                <div className="modal-backdrop">
                  <div className="modal">
                    <h3>Version History - {versionModal.docName}</h3>
                    <table className="version-table">
                      <thead>
                        <tr>
                          <th>Version</th>
                          <th>Action</th>
                          <th>User</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versionModal.history.map((v, i) => (
                          <tr key={i}>
                            <td>{v.version}</td>
                            <td>{v.action}</td>
                            <td>{v.user?.name || v.user?.id || "N/A"}</td>
                            <td>{new Date(v.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      onClick={() =>
                        setVersionModal({
                          visible: false,
                          history: [],
                          docName: "",
                        })
                      }
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* File Pagination */}
              <FilePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                rowsPerPage={rowsPerPage}
                totalItems={filteredData.length}
              />
            </>
          )}
        </ErrorBoundary>
      </div>
      <ToastContainer />
      <Footer />
    </div>
  );
}

export default Table;