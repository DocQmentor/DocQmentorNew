import React, { useState, useEffect } from "react";
import "./ManualReview.css";
import Footer from "../Layout/Footer";
import FilePagination from "../Layout/FilePagination";
import EditModal from "./EditModal";
import { useNavigate } from "react-router-dom";
import useSortableData from "../utils/useSortableData";
import { saveAs } from "file-saver";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
      const result = await smartFetch(url, options);
      return result;
      
    } catch (error) {
      // If it's a cold start error, wait and retry
      if (error.type === 'AZURE_COLD_START' && attempt < maxRetries) {
        const delay = attempt * 10000; // 10s, 20s, 30s...
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Re-throw other errors or if max retries reached
      throw error;
    }
  }
  throw new Error(`Maximum retries (${maxRetries}) exceeded`);
};

const ManualReview = () => {
  const [show, setShow] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const today = new Date().toISOString().split("T")[0];
  const [manualReviewDocs, setManualReviewDocs] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [editedData, setEditedData] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [vendorFilter, setVendorFilter] = useState("");
  const [accountHolderFilter, setAccountHolderFilter] = useState("");
  const [LendernameFilter, setLendernameFilter] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploadDateFilter, setUploadDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const selectedModelType =
    localStorage.getItem("selectedModelType") || "Invoice";
  const rowsPerPage = 10;
  const navigate = useNavigate();

  // Table Headers & Keys
  const modelHeaders = {
    Invoice: [
      "Vendor Name",
      "Invoice ID",
      "Invoice Date",
      "LPO NO",
      "Sub Total",
      "VAT",
      "Invoice Total",
      "Upload Date",
      "Confidence Score",
      "Action",
    ],
    BankStatement: [
      "Account Holder",
      "Account Number",
      "Statement Period",
      "Opening Balance",
      "Closing Balance",
      "Upload Date",
      "Confidence Score",
      "Action",
    ],
    MortgageForms: [
      "Lendername",
      "Borrowername",
      "Loanamount",
      "Interest",
      "Loantenure",
      "Upload Date",
      "Confidence Score",
      "Action",
    ],
  };

  const modelKeys = {
    Invoice: [
      "VendorName",
      "InvoiceId",
      "InvoiceDate",
      "LPO NO",
      "SubTotal",
      "VAT",
      "InvoiceTotal",
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
      "Lendername",
      "Borrowername",
      "Loanamount",
      "Interest",
      "Loantenure",
      "uploadDate",
      "confidenceScore",
      "_rawDocument",
    ],
  };

  // Helpers
  const getString = (val) => {
    if (!val) return "";
    if (typeof val === "string" || typeof val === "number") return val;
    if (typeof val === "object") return val?.valueString || val?.content || "";
    return "";
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatNumber = (value) => {
    if (!value) return "";
    const num = parseFloat(String(value).replace(/[^\d.-]/g, ""));
    if (isNaN(num)) return "";
    return num.toLocaleString("en-IN");
  };

  const refreshData = () => setRefreshTrigger((prev) => !prev);

  const handleResetFilters = () => {
    setVendorFilter("");
    setAccountHolderFilter("");
    setLendernameFilter("");
    setFromDate("");
    setToDate("");
    setUploadDateFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const keys = modelKeys[selectedModelType];
    const headers = modelHeaders[selectedModelType];
    const csvRows = filteredDocs.map((item) =>
      keys
        .map((key) => {
          const value = item[key] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `ManualReview_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  // Fetch Cosmos DB docs that need review
  useEffect(() => {
    async function fetchDocsFromCosmos() {
      setLoading(true);
      setError(null); // Reset error on new fetch
      
      try {
        const data = await fetchWithRetry(
          "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
        );

        const docsNeedingReview = data.filter((doc) => {
          const model = doc.modelType?.toLowerCase()?.trim();
          const selected = selectedModelType.toLowerCase();

          // ✅ Only include docs matching the current selected model type
          if (!model || model !== selected) return false;

          // ✅ Skip already reviewed
          const isReviewed =
            doc.wasReviewed === true ||
            doc.wasReviewed === "true" ||
            (doc.status && doc.status.toLowerCase() === "reviewed");

          if (isReviewed) return false;

          // ✅ Parse confidence safely (SQL uses averageConfidenceScore)
          let totalScore = 0;
          const rawScore = doc.averageConfidenceScore || doc.totalConfidenceScore;

          if (rawScore) {
            const val = parseFloat(String(rawScore).replace("%", "").trim());
            totalScore = val <= 1 ? val * 100 : val;
          }

          const requiredFieldsByModel = {
            invoice: [
              "VendorName",
              "InvoiceId",
              "InvoiceDate",
              "LPO NO",
              "SubTotal",
              "VAT",
              "InvoiceTotal",
            ],
            bankstatement: [
              "AccountHolder",
              "AccountNumber",
              "StatementPeriod",
              "OpeningBalance",
              "ClosingBalance",
            ],
            mortgageforms: [
              "Lendername",
              "Borrowername",
              "Loanamount",
              "Interest",
              "Loantenure",
            ],
          };

          const extracted = doc.extractedData || {};
          const requiredFields = requiredFieldsByModel[model] || [];
          const hasMissing = requiredFields.some(
            (field) => !extracted[field] || extracted[field].toString().trim() === ""
          );

          // ✅ Keep only documents with low confidence or missing fields
          return totalScore < 85 || hasMissing;
        });

        console.log("📊 Docs needing review:", docsNeedingReview);
        setManualReviewDocs(docsNeedingReview);
        
      } catch (err) {
        console.error("❌ Fetch error:", err);
        
        // User-friendly error messages
        let errorMsg = "Failed to fetch documents. ";
        
        if (err.type === 'AZURE_COLD_START') {
          errorMsg = "Document service is starting up. This can take 30-60 seconds on first use. Please wait and try again.";
        } else if (err.message.includes('Unexpected token')) {
          errorMsg = "Server returned unexpected response. Azure Functions might be starting up.";
        } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
          errorMsg = "Network connection issue. Please check your internet connection.";
        } else if (err.message.includes('Maximum retries')) {
          errorMsg = "Service is taking longer than expected to start. Please refresh the page or try again in a minute.";
        } else {
          errorMsg += err.message;
        }
        
        setError(errorMsg);
        setManualReviewDocs([]); // Clear data on error
        
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocsFromCosmos();
  }, [refreshTrigger, selectedModelType]);

  // Build & filter docs
  useEffect(() => {
    const today = new Date();
    const mapped = manualReviewDocs.map((doc) => {
      const extracted = doc.extractedData || {};
      const model = doc.modelType?.toLowerCase() || "";
     
      // 🔍 DEBUG: Log Mortgage Data
      if (model === "mortgageforms") {
        console.log("🔍 ManualReview Mortgage Debug:", doc.id, extracted);
      }
     
      // 🛠️ Normalize Mortgage keys if coming as PascalCase from Backend
      const normalizedExtracted = { ...extracted };
      if (model === "mortgageforms") {
        // Pascal -> Lower
        if (normalizedExtracted.Lendername) normalizedExtracted.Lendername = normalizedExtracted.Lendername;
        if (normalizedExtracted.Borrowername) normalizedExtracted.Borrowername = normalizedExtracted.Borrowername;
        if (normalizedExtracted.Loanamount) normalizedExtracted.Loanamount = normalizedExtracted.Loanamount;
        if (normalizedExtracted.Loantenure) normalizedExtracted.Loantenure = normalizedExtracted.Loantenure;

        // Lower -> Pascal (Bidirectional safety)
        if (normalizedExtracted.Lendername) normalizedExtracted.Lendername = normalizedExtracted.Lendername;
        if (normalizedExtracted.Borrowername) normalizedExtracted.Borrowername = normalizedExtracted.Borrowername;
        if (normalizedExtracted.Loanamount) normalizedExtracted.Loanamount = normalizedExtracted.Loanamount;
        if (normalizedExtracted.Loantenure) normalizedExtracted.Loantenure = normalizedExtracted.Loantenure;
      }

      // ✅ Prioritize UploadedAt from SQL
      const timestamp = doc.UploadedAt || doc.uploadedAt || doc.timestamp || null;

      let rawDate = null;
      if (timestamp) {
        rawDate = new Date(timestamp);
        if (isNaN(rawDate.getTime())) rawDate = null;
      }

      const common = {
        uploadDate: rawDate ? formatDate(rawDate) : "",
        rawUploadDate: rawDate,
        confidenceScore: (() => {
            const val = doc.averageConfidenceScore || doc.totalConfidenceScore;
            if (!val) return "0.00%";
            let num = parseFloat(String(val).replace("%", ""));
            if (num <= 1) num *= 100;
            return num.toFixed(2) + "%";
        })(),
        _rawDocument: doc,
      };

      if (model === "invoice") {
        return {
          ...common,
          VendorName: getString(extracted.VendorName),
          InvoiceId: getString(extracted.InvoiceId),
          InvoiceDate: formatDate(extracted.InvoiceDate),
          "LPO NO": getString(extracted["LPO NO"]),
          SubTotal: formatNumber(getString(extracted.SubTotal)),
          VAT: formatNumber(getString(extracted.VAT || extracted.VAT)),
          InvoiceTotal: formatNumber(getString(extracted.InvoiceTotal)),
        };
      } else if (model === "bankstatement") {
        return {
          ...common,
          AccountHolder: getString(extracted.AccountHolder),
          AccountNumber: getString(extracted.AccountNumber),
          StatementPeriod: getString(extracted.StatementPeriod),
          OpeningBalance: formatNumber(getString(extracted.OpeningBalance)),
          ClosingBalance: formatNumber(getString(extracted.ClosingBalance)),
        };
      } else if (model === "mortgageforms") {
        return {
          ...common,
          Lendername: getString(extracted.Lendername || extracted.Lendername),
          Borrowername: getString(extracted.Borrowername || extracted.Borrowername),
          Loanamount: formatNumber(getString(extracted.Loanamount || extracted.Loanamount)),
          Interest: getString(extracted.Interest),
          Loantenure: getString(extracted.Loantenure || extracted.Loantenure),
        };
      }
      return common;
    });

    const filtered = mapped.filter((item) => {
      const itemDate = item.rawUploadDate;

      // Upload date window filtering
      if (uploadDateFilter !== "all" && itemDate) {
        const last7 = new Date(today);
        const last30 = new Date(today);
        last7.setDate(today.getDate() - 7);
        last30.setDate(today.getDate() - 30);

        if (uploadDateFilter === "7days" && itemDate < last7) return false;
        if (uploadDateFilter === "30days" && itemDate < last30) return false;
      }
      
      if (fromDate) {
        const from = new Date(fromDate);
        if (isNaN(from.getTime()) || itemDate < from) return false;
      }

      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (isNaN(to.getTime()) || itemDate > to) return false;
      }
      
      const matchSearch = Object.values(item)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      // Model-specific filters
      let matchFilter = true;
      
      if (selectedModelType === "Invoice" && vendorFilter) {
        matchFilter = (item.VendorName || "").toLowerCase().includes(vendorFilter.toLowerCase());
      } else if (selectedModelType === "BankStatement" && accountHolderFilter) {
        matchFilter = (item.AccountHolder || "").toLowerCase().includes(accountHolderFilter.toLowerCase());
      } else if (selectedModelType === "MortgageForms" && LendernameFilter) {
        matchFilter = (item.Lendername || "").toLowerCase().includes(LendernameFilter.toLowerCase());
      }

      return matchSearch && matchFilter;
    });

    setFilteredDocs(filtered);
    setCurrentPage(1); // reset page on filter changes

  }, [manualReviewDocs, searchQuery, vendorFilter, accountHolderFilter, LendernameFilter, uploadDateFilter, fromDate, toDate, selectedModelType]);

  const { sortedData, toggleSort, renderSortIcon } = useSortableData(filteredDocs);

  const handleToggle = (doc) => {
    const extracted = doc.extractedData || {};
    const editedDoc = {};

    // Dynamically flatten the extractedData
    Object.keys(extracted).forEach((key) => {
      editedDoc[key] = extracted[key] ?? "";
    });

    navigate("/editmodal", {
      state: {
        selectedDocument: doc,
        editedData: editedDoc, // ✅ flat object for EditModal
        documentType: doc.modelType,
      },
    });
  };
  
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div className="ManualReview-full-container">
      {show ? (
        <div className="ManualReview-main-container">
          <div className="ManualReview-Table-header">
            <h1> {selectedModelType} Manual Review</h1>

            <div className="filters">
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
                    value={LendernameFilter}
                    onChange={(e) => setLendernameFilter(e.target.value)}
                    placeholder="Enter lender name"
                  />
                </label>
              )}
              <label>
                <strong>{selectedModelType} From Date:</strong>
                <input
                  type="date"
                  value={fromDate}
                  max={today}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>
              <label>
                <strong>{selectedModelType} To Date:</strong>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}  
                  max={today}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
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
              <label>
                <strong>Search All:</strong>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>
              <button className="reset-button" onClick={handleResetFilters}>
                Reset
              </button>
              <button className="export-button" onClick={handleExportCSV}>
                Export CSV
              </button>
            </div>
          </div>

          {loading && <p>Loading documents...</p>}
          
          {/* Error Display with retry button */}
          {error && !loading && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              padding: '15px',
              margin: '15px 0',
              color: '#856404'
            }}>
              <p style={{ marginBottom: '10px' }}>{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  refreshData();
                }}
                style={{
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Retry Load
              </button>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className={`ManualReview-Table ${selectedModelType}`}>
              <thead>
                <tr>
                  {modelHeaders[selectedModelType].map((header, idx) => (
                    <th
                      key={idx}
                      onClick={() => toggleSort(modelKeys[selectedModelType][idx])}
                    >
                      {header} {renderSortIcon(modelKeys[selectedModelType][idx])}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((item, index) => (
                    <tr key={index}>
                      {modelKeys[selectedModelType].map((key, idx) =>
                        key === "_rawDocument" ? (
                          <td key={idx}>
                            <button
                              onClick={() => handleToggle(item._rawDocument)}
                            >
                              Edit
                            </button>
                          </td>
                        ) : (
                          <td key={idx}>{item[key]}</td>
                        )
                      )}
                    </tr>
                  ))
                ) : !loading && !error ? ( // Only show "no documents" if not loading and no error
                  <tr>
                    <td
                      colSpan={modelKeys[selectedModelType].length}
                      style={{ textAlign: "center" }}
                    >
                      No documents requiring manual review
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          
          {filteredDocs.length > rowsPerPage && (
            <FilePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              rowsPerPage={rowsPerPage}
              totalItems={sortedData.length}
            />
          )}
        </div>
      ) : (
        <EditModal
          selectedDocument={selectedDocument}
          editedData={editedData}
          setEditedData={setEditedData}
          setShow={setShow}
          refreshData={refreshData}
        />
      )}
      <ToastContainer />
      <Footer />
    </div>
  );
};

export default ManualReview;