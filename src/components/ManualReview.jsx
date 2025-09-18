import React, { useState, useEffect } from "react";
import "./ManualReview.css";
import Footer from "../Layout/Footer";
import EditModal from "./EditModal";
import { useNavigate } from "react-router-dom";
import useSortableData from "../utils/useSortableData";
import { saveAs } from "file-saver";

const ManualReview = () => {
  const [show, setShow] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [manualReviewDocs, setManualReviewDocs] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [editedData, setEditedData] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [vendorFilter, setVendorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploadDateFilter, setUploadDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const selectedModelType = localStorage.getItem("selectedModelType") || "Invoice";

  const rowsPerPage = 10;
  const navigate = useNavigate();

  const modelHeaders = {
    Invoice: ["Vendor Name", "Invoice ID", "Invoice Date", "LPO No", "Sub Total", "VAT", "Invoice Total", "Upload Date", "Confidence Score", "Action"],
    BankStatement: ["AccountHolder", "AccountNumber", "StatementPeriod", "OpeningBalance", "ClosingBalance", "Upload Date", "Confidence Score", "Action"],
    MortgageForms: ["LenderName", "BorrowerName", "LoanAmount", "Interest", "LoanTenure", "Upload Date", "Confidence Score", "Action"],
  };

  const modelKeys = {
    Invoice: ["vendorName", "invoiceId", "invoiceDate", "lpoNo", "subTotal", "vat", "invoicetotal", "uploadDate", "confidenceScore", "_rawDocument"],
    BankStatement: ["AccountHolder", "AccountNumber", "StatementPeriod", "OpeningBalance", "ClosingBalance", "uploadDate", "confidenceScore", "_rawDocument"],
    MortgageForms: ["LenderName", "BorrowerName", "LoanAmount", "Interest", "LoanTenure", "uploadDate", "confidenceScore", "_rawDocument"],
  };

  const getString = (val) => {
    if (!val) return "";
    if (typeof val === "string" || typeof val === "number") return val;
    if (typeof val === "object") {
      return val?.valueString || val?.content || JSON.stringify(val);
    }
    return "";
  };

  const refreshData = () => setRefreshTrigger((prev) => !prev);

  const formatNumber = (value) => {
    if (!value) return "";
    const num = parseFloat(String(value).replace(/[^\d.-]/g, ""));
    if (isNaN(num)) return "";
    return num.toLocaleString("en-IN");
  };

  const handleExportCSV = () => {
    const keys = modelKeys[selectedModelType];
    const headers = modelHeaders[selectedModelType];

    const csvRows = filteredDocs.map((item) =>
      keys.map((key) => {
        const value = item[key] ?? "";
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(",")
    );

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `ManualReview_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  useEffect(() => {
    async function fetchDocsFromCosmos() {
      setLoading(true);
      try {
        const response = await fetch(
          "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
        );
        const data = await response.json();
        const docsNeedingReview = data.filter((doc) => {
          if (doc.wasReviewed) return false;

          const extracted = doc.extractedData || {};
          const totalScore = doc.totalConfidenceScore ?? 0;

          const requiredFieldsByModel = {
            Invoice: ["VendorName", "InvoiceId", "InvoiceDate", "LPO NO", "SubTotal", "VAT", "InvoiceTotal"],
            BankStatement: ["AccountHolder", "AccountNumber", "StatementPeriod", "OpeningBalance", "ClosingBalance"],
            MortgageForms: ["LenderName", "BorrowerName", "LoanAmount", "Interest", "LoanTenure"],
          };

          const requiredFields = requiredFieldsByModel[doc.modelType] || [];
          const hasMissing = requiredFields.some((field) => !extracted[field] || !getString(extracted[field]));

          const lowTotalConfidence = (typeof totalScore === "number" ? totalScore : parseFloat(totalScore)) < 85;

          return hasMissing || lowTotalConfidence;
        });

        setManualReviewDocs(docsNeedingReview);
        setError(null);
      } catch (err) {
        setError(err.message || "Failed to fetch documents");
        console.error("❌ Failed to fetch from Cosmos DB:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDocsFromCosmos();
  }, [refreshTrigger]);

  useEffect(() => {
    const filtered = manualReviewDocs
      .map((doc) => {
        const extracted = doc.extractedData || {};
        const getScore = () => {
          const score = doc.totalConfidenceScore ?? 0;
          const numScore = typeof score === "string" ? parseFloat(score.replace("%", "")) || 0 : score;
          return `${numScore.toFixed(2)}%`;
        };

        // Map fields dynamically based on modelType
        let mapped = { confidenceScore: getScore(), _rawDocument: doc, uploadDate: doc.timestamp ? new Date(doc.timestamp).toLocaleDateString("en-CA") : "", rawUploadDate: doc.timestamp ? new Date(doc.timestamp) : null };
        if (doc.modelType === "Invoice") {
          mapped = {
            ...mapped,
            vendorName: getString(extracted.VendorName || doc.vendorName),
            invoiceId: getString(extracted.InvoiceId || doc.invoiceId),
            invoiceDate: getString(extracted.InvoiceDate || doc.invoiceDate),
            lpoNo: getString(extracted["LPO NO"] || extracted.lpoNo || doc.lpoNo),
            subTotal: getString(extracted.SubTotal || doc.subTotal),
            vat: getString(extracted.VAT || doc.vat),
            invoicetotal: getString(extracted.InvoiceTotal || doc.invoicetotal || doc.invoiceTotal),
          };
        } else if (doc.modelType === "BankStatement") {
          mapped = {
            ...mapped,
            AccountHolder: getString(extracted.AccountHolder || doc.AccountHolder),
            AccountNumber: getString(extracted.AccountNumber || doc.AccountNumber),
            StatementPeriod: getString(extracted.StatementPeriod || doc.StatementPeriod),
            OpeningBalance: getString(extracted.OpeningBalance || doc.OpeningBalance),
            ClosingBalance: getString(extracted.ClosingBalance || doc.ClosingBalance),
          };
        } else if (doc.modelType === "MortgageForms") {
          mapped = {
            ...mapped,
            LenderName: getString(extracted.LenderName || doc.LenderName),
            BorrowerName: getString(extracted.BorrowerName || doc.BorrowerName),
            LoanAmount: getString(extracted.LoanAmount || doc.LoanAmount),
            Interest: getString(extracted.Interest || doc.Interest),
            LoanTenure: getString(extracted.LoanTenure || doc.LoanTenure),
          };
        }
        return mapped;
      })
      .filter((item) => item._rawDocument?.modelType === selectedModelType)
      .filter((item) => {
        // Filtering logic remains the same
        const matchesVendor = item.vendorName?.toLowerCase().includes(vendorFilter.toLowerCase()) ?? true;
        const matchesSearch = Object.values(item).some((val) =>
          String(val).toLowerCase().includes(searchQuery.toLowerCase())
        );

        const itemDate = item.uploadDate ? new Date(item.uploadDate) : null;
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;
        const matchesDate = (!from || (itemDate && itemDate >= from)) && (!to || (itemDate && itemDate <= to));

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

        return matchesVendor && matchesSearch && matchesDate && matchesUploadFilter;
      });

    setFilteredDocs(filtered);
    setCurrentPage(1);
  }, [manualReviewDocs, vendorFilter, fromDate, toDate, uploadDateFilter, searchQuery, selectedModelType]);

  const { sortedData, toggleSort, renderSortIcon } = useSortableData(filteredDocs);

  const handleToggle = (doc) => {
    navigate("/editmodal", {
      state: { selectedDocument: doc, editedData: doc },
    });
  };

  const totalPages = Math.ceil(filteredDocs.length / rowsPerPage);
  const paginatedData = sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handlePrevious = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  return (
    <div className="ManualReview-full-container">
      {show ? (
        <div className="ManualReview-main-container">
          <div className="ManualReview-Table-header">
            <h1>Manual Review</h1>
            <div className="filters">
              <label>
                <strong>Vendor:</strong>
                <input type="text" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} placeholder="Enter vendor name" />
              </label>
              <label>
                <strong>From Date:</strong>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label>
                <strong>To Date:</strong>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </label>
              <label>
                <strong>Upload Date:</strong>
                <select value={uploadDateFilter} onChange={(e) => setUploadDateFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>
              </label>
              <label>
                <strong>Search All:</strong>
                <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </label>
              <label>
                <button className="export-button" style={{ marginLeft: "10px" }} onClick={handleExportCSV}>
                  Export CSV
                </button>
              </label>
            </div>
          </div>

          {loading && <p>Loading documents...</p>}
          {error && <p style={{ color: "red" }}>Error: {error}</p>}

          <table className="ManualReview-Table">
            <thead>
              <tr>
                {modelHeaders[selectedModelType].map((header, idx) => (
                  <th key={idx}>{header}</th>
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
                          <button onClick={() => handleToggle(item._rawDocument)}>Edit</button>
                        </td>
                      ) : (
                        <td key={idx}>{key.includes("subTotal") || key.includes("vat") || key.includes("total") ? formatNumber(item[key]) : item[key]}</td>
                      )
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={modelKeys[selectedModelType].length} style={{ textAlign: "center" }}>
                    {loading ? "Loading..." : "No documents requiring manual review"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {filteredDocs.length > rowsPerPage && (
            <div style={{ marginTop: "15px", textAlign: "center" }}>
              <button onClick={handlePrevious} disabled={currentPage === 1} style={{ padding: "6px 10px", marginRight: "10px" }}>
                Previous
              </button>
              Page {currentPage} of {totalPages}
              <button onClick={handleNext} disabled={currentPage === totalPages} style={{ padding: "6px 10px", marginLeft: "10px" }}>
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <EditModal selectedDocument={selectedDocument} editedData={editedData} setEditedData={setEditedData} setShow={setShow} refreshData={refreshData} />
      )}
      <footer>
        <Footer />
      </footer>
    </div>
  );
};

export default ManualReview;
