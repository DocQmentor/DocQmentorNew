import { useState, useEffect } from "react";
import "./ManualReview.css";
import Footer from "../Layout/Footer";
import FilePagination from "../Layout/FilePagination";
import { useNavigate } from "react-router-dom";
import useSortableData from "../utils/useSortableData";
import { saveAs } from "file-saver";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useConfig } from "../context/ConfigContext";

const MODEL_TABS = [
  { key: "Invoice",       emoji: "💲", label: "Invoice" },
  { key: "BankStatement", emoji: "🏦", label: "Bank Statement" },
  { key: "MortgageForms", emoji: "🏠", label: "Mortgage Forms" },
];

const ManualReview = () => {
  const { config } = useConfig();
  const today = new Date().toISOString().split("T")[0];
  const [allReviewDocs,    setAllReviewDocs]    = useState([]);
  const [manualReviewDocs, setManualReviewDocs] = useState([]);
  const [filteredDocs,     setFilteredDocs]     = useState([]);
  const [tabCounts,        setTabCounts]        = useState({ Invoice: 0, BankStatement: 0, MortgageForms: 0 });
  const [refreshTrigger,   setRefreshTrigger]   = useState(false);
  const [vendorFilter,     setVendorFilter]     = useState("");
  const [fromDate,         setFromDate]         = useState("");
  const [toDate,           setToDate]           = useState("");
  const [uploadDateFilter, setUploadDateFilter] = useState("all");
  const [searchQuery,      setSearchQuery]      = useState("");
  const [currentPage,      setCurrentPage]      = useState(1);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [selectedModelType, setSelectedModelType] = useState(
    localStorage.getItem("selectedModelType") || "Invoice"
  );
  const rowsPerPage = 10;
  const navigate = useNavigate();

  const modelHeaders = {
    Invoice:       ["Vendor Name","Invoice ID","Invoice Date","LPO NO","Sub Total","VAT","Invoice Total","Upload Date","Confidence","Action"],
    BankStatement: ["Account Holder","Account Number","Statement Period","Opening Balance","Closing Balance","Upload Date","Confidence","Action"],
    MortgageForms: ["Lender Name","Borrower Name","Loan Amount","Interest","Loan Tenure","Upload Date","Confidence","Action"],
  };

  const modelKeys = {
    Invoice:       ["VendorName","InvoiceId","InvoiceDate","LPO NO","SubTotal","VAT","InvoiceTotal","uploadDate","confidenceScore","_rawDocument"],
    BankStatement: ["AccountHolder","AccountNumber","StatementPeriod","OpeningBalance","ClosingBalance","uploadDate","confidenceScore","_rawDocument"],
    MortgageForms: ["Lendername","Borrowername","Loanamount","Interest","Loantenure","uploadDate","confidenceScore","_rawDocument"],
  };

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
    return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  };

  const formatNumber = (value) => {
    if (!value) return "";
    const num = parseFloat(String(value).replace(/[^\d.-]/g, ""));
    if (isNaN(num)) return "";
    return num.toLocaleString("en-IN");
  };

  const getConfClass = (scoreStr) => {
    if (!scoreStr) return "conf-grey";
    const num = parseFloat(String(scoreStr).replace("%",""));
    if (isNaN(num)) return "conf-grey";
    return num >= 85 ? "conf-high" : "conf-low";
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
      keys.map((key) => `"${String(item[key] ?? "").replace(/"/g,'""')}"`).join(",")
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `ManualReview_${selectedModelType}_${new Date().toISOString().slice(0,10)}.csv`);
  };

  // Helpers to determine if a doc needs review
  const docNeedsReview = (doc, modelKey, threshold) => {
    const isReviewed =
      doc.wasReviewed === true ||
      doc.wasReviewed === "true" ||
      (doc.status && doc.status.toLowerCase() === "reviewed");
    if (isReviewed) return false;

    const rawScore = doc.averageConfidenceScore || doc.totalConfidenceScore;
    let totalScore = 0;
    if (rawScore) {
      const val = parseFloat(String(rawScore).replace("%","").trim());
      totalScore = val <= 1 ? val * 100 : val;
    }

    const requiredFieldsByModel = {
      invoice:       ["VendorName","InvoiceId","InvoiceDate","LPO NO","SubTotal","VAT","InvoiceTotal"],
      bankstatement: ["AccountHolder","AccountNumber","StatementPeriod","OpeningBalance","ClosingBalance"],
      mortgageforms: ["Lendername","Borrowername","Loanamount","Interest","Loantenure"],
    };

    const extracted = doc.extractedData || {};
    const requiredFields = requiredFieldsByModel[modelKey] || [];
    const hasMissing = requiredFields.some((f) => !extracted[f] || extracted[f].toString().trim() === "");

    return totalScore < threshold || hasMissing;
  };

  // Fetch ALL docs and compute tabCounts
  useEffect(() => {
    async function fetchAllDocs() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=5ttVguFIlYsgNTLnI7I-hGlMyInPTM_Y-3ihASWqOxLzAzFuaOzdpQ=="
        );
        if (!response.ok) throw new Error(`Server Error: ${response.status} ${response.statusText}`);

        const data = await response.json();

        const counts = { Invoice: 0, BankStatement: 0, MortgageForms: 0 };
        const allNeedingReview = [];

        data.forEach((doc) => {
          const rawModel = doc.modelType?.toLowerCase()?.trim();
          let tabKey = null;
          if (rawModel === "invoice")       tabKey = "Invoice";
          if (rawModel === "bankstatement") tabKey = "BankStatement";
          if (rawModel === "mortgageforms") tabKey = "MortgageForms";
          if (!tabKey) return;

          const threshold = config[tabKey] || 85;
          if (docNeedsReview(doc, rawModel, threshold)) {
            counts[tabKey]++;
            allNeedingReview.push(doc);
          }
        });

        setTabCounts(counts);
        setAllReviewDocs(allNeedingReview);
      } catch (err) {
        setError(err.message || "Failed to fetch documents");
      } finally {
        setLoading(false);
      }
    }
    fetchAllDocs();
  }, [refreshTrigger, config]);

  // Filter allReviewDocs by selected tab -> manualReviewDocs
  useEffect(() => {
    const filtered = allReviewDocs.filter(
      (doc) => doc.modelType?.toLowerCase()?.trim() === selectedModelType.toLowerCase()
    );
    setManualReviewDocs(filtered);
  }, [allReviewDocs, selectedModelType]);

  // Build & filter display rows
  useEffect(() => {
    const todayDate = new Date();
    const mapped = manualReviewDocs.map((doc) => {
      const extracted = doc.extractedData || {};
      const model = doc.modelType?.toLowerCase() || "";
      const timestamp = doc.UploadedAt || doc.uploadedAt || doc.timestamp || null;
      let rawDate = null;
      if (timestamp) { rawDate = new Date(timestamp); if (isNaN(rawDate.getTime())) rawDate = null; }

      const common = {
        uploadDate: rawDate ? formatDate(rawDate) : "",
        rawUploadDate: rawDate,
        confidenceScore: (() => {
          const val = doc.averageConfidenceScore || doc.totalConfidenceScore;
          if (!val) return "0.00%";
          let num = parseFloat(String(val).replace("%",""));
          if (num <= 1) num *= 100;
          return num.toFixed(2) + "%";
        })(),
        _rawDocument: doc,
      };

      if (model === "invoice") return { ...common,
        VendorName:   getString(extracted.VendorName),
        InvoiceId:    getString(extracted.InvoiceId),
        InvoiceDate:  formatDate(extracted.InvoiceDate),
        "LPO NO":     getString(extracted["LPO NO"]),
        SubTotal:     formatNumber(getString(extracted.SubTotal)),
        VAT:          formatNumber(getString(extracted.VAT)),
        InvoiceTotal: formatNumber(getString(extracted.InvoiceTotal)),
      };
      if (model === "bankstatement") return { ...common,
        AccountHolder:   getString(extracted.AccountHolder),
        AccountNumber:   getString(extracted.AccountNumber),
        StatementPeriod: getString(extracted.StatementPeriod),
        OpeningBalance:  formatNumber(getString(extracted.OpeningBalance)),
        ClosingBalance:  formatNumber(getString(extracted.ClosingBalance)),
      };
      if (model === "mortgageforms") return { ...common,
        Lendername:  getString(extracted.Lendername),
        Borrowername: getString(extracted.Borrowername),
        Loanamount:  formatNumber(getString(extracted.Loanamount)),
        Interest:    getString(extracted.Interest),
        Loantenure:  getString(extracted.Loantenure),
      };
      return common;
    });

    const filtered = mapped.filter((item) => {
      const itemDate = item.rawUploadDate;
      if (uploadDateFilter !== "all" && itemDate) {
        const ref = new Date(todayDate);
        if (uploadDateFilter === "7days")  { ref.setDate(ref.getDate()-7);  if (itemDate < ref) return false; }
        if (uploadDateFilter === "30days") { ref.setDate(ref.getDate()-30); if (itemDate < ref) return false; }
      }
      if (fromDate) { const f = new Date(fromDate); if (!isNaN(f) && itemDate < f) return false; }
      if (toDate)   { const t = new Date(toDate); t.setHours(23,59,59,999); if (!isNaN(t) && itemDate > t) return false; }

      const nameField = item.VendorName || item.AccountHolder || item.Lendername || "";
      if (vendorFilter && !nameField.toLowerCase().includes(vendorFilter.toLowerCase())) return false;
      if (searchQuery && !Object.values(item).join(" ").toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    setFilteredDocs(filtered);
    setCurrentPage(1);
  }, [manualReviewDocs, searchQuery, vendorFilter, uploadDateFilter, fromDate, toDate]);

  const { sortedData, toggleSort, renderSortIcon } = useSortableData(filteredDocs);
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const paginatedData = sortedData.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage);


  const handleEdit = (doc) => {
    const extracted = doc.extractedData || {};
    const editedDoc = {};
    Object.keys(extracted).forEach((k) => { editedDoc[k] = extracted[k] ?? ""; });
    navigate("/editmodal", {
      state: { selectedDocument: doc, editedData: editedDoc, documentType: doc.modelType },
    });
  };

  const vendorLabel = selectedModelType === "Invoice" ? "VENDOR" : selectedModelType === "BankStatement" ? "ACCOUNT HOLDER" : "LENDER NAME";

  return (
    <div className="mr-page">
      <div className="mr-content">
      {/* Model Tabs */}
      <div className="mr-tabs-bar">
        {MODEL_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`mr-tab${selectedModelType === tab.key ? " active" : ""}`}
            onClick={() => { setSelectedModelType(tab.key); localStorage.setItem("selectedModelType", tab.key); }}
          >
            {tab.emoji} {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span className="mr-tab-badge">{tabCounts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filter Card */}
      <div className="mr-filter-card">
        <div className="mr-filter-row">
          <div className="mr-filter-field">
            <label className="mr-filter-lbl">{vendorLabel}</label>
            <input
              className="mr-filter-input"
              type="text"
              placeholder={`Filter by ${vendorLabel.toLowerCase()}...`}
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            />
          </div>
          <div className="mr-filter-field">
            <label className="mr-filter-lbl">FROM DATE</label>
            <input className="mr-filter-input" type="date" value={fromDate} max={today} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="mr-filter-field">
            <label className="mr-filter-lbl">TO DATE</label>
            <input className="mr-filter-input" type="date" value={toDate} min={fromDate} max={today} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="mr-filter-field">
            <label className="mr-filter-lbl">UPLOAD DATE</label>
            <select className="mr-filter-input" value={uploadDateFilter} onChange={(e) => setUploadDateFilter(e.target.value)}>
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
          <div className="mr-filter-field mr-filter-field--grow">
            <label className="mr-filter-lbl">SEARCH ALL</label>
            <input className="mr-filter-input" type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="mr-filter-actions">
            <button className="mr-btn-reset" onClick={handleResetFilters}>&#8634; Reset</button>
            <button className="mr-btn-export" onClick={handleExportCSV}>&#8595; Export CSV</button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mr-error-box">
          <p>&#10060; {error}</p>
          <button className="mr-btn-retry" onClick={refreshData}>&#8635; Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="mr-table-wrap">
        <div className="mr-table-info">
          Showing <strong>{filteredDocs.length}</strong> of <strong>{manualReviewDocs.length}</strong> documents pending review
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className={`mr-table ${selectedModelType}`}>
            <thead>
              <tr>
                {modelHeaders[selectedModelType].map((header, idx) => (
                  <th key={idx} onClick={() => toggleSort(modelKeys[selectedModelType][idx])}>
                    {header} {renderSortIcon(modelKeys[selectedModelType][idx])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={modelHeaders[selectedModelType].length} className="mr-td-center">Loading documents...</td></tr>
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item, index) => (
                  <tr key={index}>
                    {modelKeys[selectedModelType].map((key, idx) =>
                      key === "_rawDocument" ? (
                        <td key={idx}>
                          <button className="mr-edit-btn" onClick={() => handleEdit(item._rawDocument)}>
                            &#9998; Edit
                          </button>
                        </td>
                      ) : key === "confidenceScore" ? (
                        <td key={idx}>
                          <span className={`conf-badge ${getConfClass(item[key])}`}>{item[key]}</span>
                        </td>
                      ) : (
                        <td key={idx}>{item[key]}</td>
                      )
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={modelHeaders[selectedModelType].length} className="mr-td-center">
                    No documents requiring manual review
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sortedData.length > rowsPerPage && (
          <FilePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            rowsPerPage={rowsPerPage}
            totalItems={sortedData.length}
          />
        )}
      </div>

      <ToastContainer />
      </div>
      <Footer />
    </div>
  );
};

export default ManualReview;
