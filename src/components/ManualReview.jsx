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
const [lenderNameFilter, setLenderNameFilter] = useState("");

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
      "LPO No",
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
      "Lender Name",
      "Borrower Name",
      "Loan Amount",
      "Interest",
      "Loan Tenure",
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
      "LPONO",
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
      try {
        const response = await fetch(
          "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
        );
        const data = await response.json();

        const docsNeedingReview = data.filter((doc) => {
  const model = doc.modelType?.toLowerCase()?.trim();
  const selected = selectedModelType.toLowerCase();

  // ✅ Only include docs matching the current selected model type
  if (!model || model !== selected) return false;

  // ✅ Skip already reviewed
  if (doc.wasReviewed === true || doc.wasReviewed === "true") return false;

  // ✅ Parse confidence safely
  let totalScore = 0;
  if (typeof doc.totalConfidenceScore === "string") {
    totalScore =
      parseFloat(doc.totalConfidenceScore.replace("%", "").trim()) || 0;
  } else {
    totalScore = parseFloat(doc.totalConfidenceScore) || 0;
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
        setError(err.message || "Failed to fetch documents");
        console.error("❌ Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDocsFromCosmos();
  }, [refreshTrigger]);

  // Build & filter docs
useEffect(() => {
  const today = new Date();
  const mapped = manualReviewDocs.map((doc) => {
    const extracted = doc.extractedData || {};
    const model = doc.modelType?.toLowerCase() || "";
    const timestamp = doc.timestamp || doc.uploadDate || null;

    let rawDate = null;
    if (timestamp) {
      rawDate = new Date(timestamp);
      if (isNaN(rawDate.getTime())) rawDate = null;
    }

    const common = {
      uploadDate: rawDate ? formatDate(rawDate) : "",
      rawUploadDate: rawDate,
      confidenceScore: `${(
        parseFloat(doc.totalConfidenceScore?.replace("%", "")) || 0
      ).toFixed(2)}%`,
      _rawDocument: doc,
    };

    if (model === "invoice") {
      return {
        ...common,
        VendorName: getString(extracted.VendorName),
        InvoiceId: getString(extracted.InvoiceId),
        InvoiceDate: formatDate(extracted.InvoiceDate),
        LPONO: getString(extracted["LPO NO"] || extracted.LPONo || extracted.LpoNo),
        SubTotal: formatNumber(getString(extracted.SubTotal)),
        VAT: formatNumber(getString(extracted.VAT || extracted.Vat)),
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
        Lendername: getString(extracted.Lendername),
        Borrowername: getString(extracted.Borrowername),
        Loanamount: formatNumber(getString(extracted.Loanamount)),
        Interest: getString(extracted.Interest),
        Loantenure: getString(extracted.Loantenure),
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

    const matchVendor =
      (item.VendorName || item.AccountHolder || item.Lendername || "")
        .toLowerCase()
        .includes(vendorFilter.toLowerCase());

    return matchSearch && matchVendor;
  });

  setFilteredDocs(filtered);
  setCurrentPage(1); // reset page on filter changes

}, [manualReviewDocs, searchQuery, vendorFilter, uploadDateFilter, fromDate, toDate]);

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

            {/* <p style={{ color: "green" }}>
              Showing {filteredDocs.length} / {manualReviewDocs.length} documents
            </p> */}

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
          {error && <p style={{ color: "red" }}>Error: {error}</p>}

          
          <div style={{ overflowX: "auto" }}>
            <table className="ManualReview-Table">
             <thead>
  <tr>
    {modelHeaders[selectedModelType].map((header, idx) => (
      <th
        key={idx}
        onClick={() => toggleSort(modelKeys[selectedModelType][idx])}
      >
        <span className="sortable-header">
          {header} {renderSortIcon(modelKeys[selectedModelType][idx])}
        </span>
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
                ) : (
                  <tr>
                    <td
                      colSpan={modelKeys[selectedModelType].length}
                      style={{ textAlign: "center" }}
                    >
                      {loading
                        ? "Loading..."
                        : "No documents requiring manual review"}
                    </td>
                  </tr>
                )}
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
