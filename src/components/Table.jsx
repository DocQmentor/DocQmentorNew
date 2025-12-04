import React, { useState, useEffect } from "react";
import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import "./Table.css";
import { saveAs } from "file-saver";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import useSortableData from "../utils/useSortableData";
import { Info } from "lucide-react";
import FilePagination from "../Layout/FilePagination";

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

const modelTypeSearchFields = {
  Invoice: [
    "VendorName",
    "InvoiceId",
    "InvoiceDate",
    "LPO NO",
    "SubTotal",
    "VAT",
    "InvoiceTotal",
  ],
  BankStatement: [
    "AccountHolder",
    "AccountNumber",
    "StatementPeriod",
    "OpeningBalance",
    "ClosingBalance",
  ],
  MortgageForms: [
    "Lendername",
    "Borrowername",
    "Loanamount",
    "Interest",
    "Loantenure",
  ],
};

function Table() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedModelType, setSelectedModelType] = useState(
    localStorage.getItem("selectedModelType") || "Invoice"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploadDateFilter, setUploadDateFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [accountHolderFilter, setAccountHolderFilter] = useState("");
  const [lenderNameFilter, setLenderNameFilter] = useState("");

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
    handleResetFilters();
  };

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

  const { sortedData, toggleSort, renderSortIcon } = useSortableData(data);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const response = await fetch(
          "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
        );

        const fetched = await response.json();

        const processed = fetched
          .filter((doc) => {
            const model = doc.modelType?.toLowerCase();
            if (model !== selectedModelType.toLowerCase()) return false;

            const extracted = doc.extractedData || {};
            const totalScore = parseFloat(doc.totalConfidenceScore) || 0;

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

            const requiredFields = requiredFieldsByModel[model] || [];
            const allFieldsFilled = requiredFields.every(
              (f) => extracted[f] && extracted[f].toString().trim() !== ""
            );

            // ✅ Show only if: confidence ≥ 85 and fields complete OR already reviewed
            return (totalScore >= 85 && allFieldsFilled) || doc.wasReviewed;
          })
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

            const model = selectedModelType.toLowerCase();
            if (model === "invoice") {
              return {
                VendorName: getString(extracted.VendorName),
                InvoiceId: getString(extracted.InvoiceId),
                InvoiceDate: getString(extracted.InvoiceDate),
                "LPO NO": getString(extracted["LPO NO"]),
                SubTotal: getString(extracted.SubTotal),
                VAT: getString(extracted.VAT),
                InvoiceTotal: getString(extracted.InvoiceTotal),
                ...commonFields,
              };
            } else if (model === "bankstatement") {
              return {
                AccountHolder: getString(extracted.AccountHolder),
                AccountNumber: getString(extracted.AccountNumber),
                StatementPeriod: getString(extracted.StatementPeriod),
                OpeningBalance: getString(extracted.OpeningBalance),
                ClosingBalance: getString(extracted.ClosingBalance),
                ...commonFields,
              };
            } else if (model === "mortgageforms") {
              return {
                Lendername: getString(extracted.Lendername),
                Borrowername: getString(extracted.Borrowername),
                Loanamount: getString(extracted.Loanamount),
                Interest: getString(extracted.Interest),
                Loantenure: getString(extracted.Loantenure),
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

const filteredData = sortedData.filter((item) => {
  const itemDate = item.rawUploadDate ? new Date(item.rawUploadDate) : null;
  const today = new Date();

  // --- Upload Date Filter (7 days / 30 days) ---
  if (uploadDateFilter !== "all" && itemDate) {
    const last7 = new Date(today);
    last7.setDate(today.getDate() - 7);

    const last30 = new Date(today);
    last30.setDate(today.getDate() - 30);

    if (uploadDateFilter === "7days" && itemDate < last7) return false;
    if (uploadDateFilter === "30days" && itemDate < last30) return false;
  }

  // --- From Date Filter ---
  if (fromDate) {
    const from = new Date(fromDate);
    if (!itemDate || itemDate < from) return false;
  }

  // --- To Date Filter ---
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    if (!itemDate || itemDate > to) return false;
  }

  // --- Search Filter ---
  const matchesSearch =
    !searchQuery ||
    modelTypeSearchFields[selectedModelType].some((field) =>
      (item[field] || "")
        .toString()
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );

  // --- Model-specific Filters ---
  const matchesVendor =
    selectedModelType !== "Invoice" ||
    !vendorFilter ||
    (item.VendorName || "").toLowerCase().includes(vendorFilter.toLowerCase());

  const matchesAccountHolder =
    selectedModelType !== "BankStatement" ||
    !accountHolderFilter ||
    (item.AccountHolder || "")
      .toLowerCase()
      .includes(accountHolderFilter.toLowerCase());

  const matchesLenderName =
    selectedModelType !== "MortgageForms" ||
    !lenderNameFilter ||
    (item.Lendername || "")
      .toLowerCase()
      .includes(lenderNameFilter.toLowerCase());

  return (
    matchesSearch &&
    matchesVendor &&
    matchesAccountHolder &&
    matchesLenderName
  );
});

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
      keys
        .map((key) =>
          key === "_rawDocument"
            ? ""
            : `"${item[key]?.toString().replace(/"/g, '""') || ""}"`
        )
        .join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    saveAs(
      blob,
      `${selectedModelType}_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleViewDocument = (doc) => {
    const url = doc?.fileUrl || doc?.blobUrl;
    if (url) window.open(url, "_blank");
    else toast.error("File URL not available");
  };

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return `${String(date.getDate()).padStart(2, "0")}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${date.getFullYear()}`;
  }

 const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const currentRows = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    fromDate,
    toDate,
    uploadDateFilter,
    vendorFilter,
    accountHolderFilter,
    lenderNameFilter,
    selectedModelType,
  ]);

  return (
    <div className="table-component-container">
      <Header />
      <div className="dataview-container">
        <h1>{selectedModelType} Data View</h1>

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
               min={fromDate}  
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
              placeholder="Search..."
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
                        onClick={() =>
                          toggleSort(modelTypeKeys[selectedModelType][idx])
                        }
                      >
                        <span className="sortable-header">
                          {header}{" "}
                          {renderSortIcon(
                            modelTypeKeys[selectedModelType][idx]
                          )}
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
                                onClick={() =>
                                  handleViewDocument(item._rawDocument)
                                }
                              >
                                View
                              </button>
                            </td>
                          ) : key === "confidenceScore" ? (
                            <td key={idx}>
                              {item.confidenceScore !== "N/A"
                                ? `${parseFloat(item.confidenceScore).toFixed(
                                    2
                                  )}%`
                                : "N/A"}
                              {item._rawDocument?.status === "Reviewed" && (
                                <Info
                                  size={16}
                                  color="#007bff"
                                  style={{
                                    cursor: "pointer",
                                    marginLeft: "5px",
                                  }}
                                  onClick={() =>
                                    handleInfoClick(item._rawDocument)
                                  }
                                />
                              )}
                            </td>
                          ) :key.toLowerCase().includes("date")
? (
                            <td key={idx}>{formatDate(item[key])}</td>
                          ) : (
                            <td key={idx}>{item[key]}</td>
                          )
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={modelTypeHeaders[selectedModelType].length}
                        style={{ textAlign: "center" }}
                      >
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
