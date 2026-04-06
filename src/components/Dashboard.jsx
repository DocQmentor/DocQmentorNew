import { useRef, useState, useEffect } from "react";
import "./Dashboard.css";
import { AlertTriangle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { uploadToBlobOnly, detectTypeFromBlob, processDocument } from "../utils/azureUploader";
import Footer from "../Layout/Footer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getVendorFolders } from "../utils/blobService";
import { useMsal } from "@azure/msal-react";
import { useUser } from "../context/UserContext";
import { sasToken } from "../sasToken";
import useGroupAccess from "../utils/userGroupAccess";
import { useConfig } from "../context/ConfigContext";

/* ── Map backend detected type → UI type key ─────────────── */
const normalizeDetectedType = (t) => {
  if (!t) return null;
  const map = { invoice: "Invoice", bankstatement: "BankStatement", mortgageforms: "MortgageForms" };
  return map[t.toLowerCase()] || null;
};

const TYPE_META = {
  Invoice:       { emoji: "💲", label: "Invoice",        bg: "#e8f1fb", text: "#256695" },
  BankStatement: { emoji: "🏦", label: "Bank Statement", bg: "#e6f7ed", text: "#2e7a44" },
  MortgageForms: { emoji: "🏠", label: "Mortgage Forms", bg: "#fff3e0", text: "#b36a00" },
};

const TABS = [
  { key: "All",           emoji: "🗂", label: "All" },
  { key: "Invoice",       emoji: "💲", label: "Invoice" },
  { key: "BankStatement", emoji: "🏦", label: "Bank Statement" },
  { key: "MortgageForms", emoji: "🏠", label: "Mortgage Forms" },
];

const Dashboard = () => {
  const { config } = useConfig();
  useGroupAccess();
  const { accounts } = useMsal();
  const currentUser = {
    id:   accounts[0]?.username || "unknown@user.com",
    name: accounts[0]?.name    || "Unknown User",
  };

  /* ── State ─────────────────────────────────────────── */
  const [selectedFiles,   setSelectedFiles]   = useState([]);
  const [allDocuments,    setAllDocuments]     = useState([]);
  const [globalDocuments, setGlobalDocuments]  = useState([]);
  const [isUploading,     setIsUploading]      = useState(false);
  const [vendors,         setVendors]          = useState([]);
  const [selectedVendor,  setSelectedVendor]   = useState("");
  const [currentPage,     setCurrentPage]      = useState(1);
  const [localInProcess,  setLocalInProcess]   = useState([]);
  const [activeTab,       setActiveTab]        = useState("All");
  const [backendError,    setBackendError]     = useState(false);


  const documentsPerPage = 10;
  const fileInputRef = useRef(null);
  const { email, name } = useUser();

  /* ── Helpers ───────────────────────────────────────── */
  const splitCamelCase = (t) => t.replace(/([a-z])([A-Z])/g, "$1 $2");
  const extractFolderName = (filename) => {
    const base = filename.substring(0, filename.lastIndexOf(".")) || filename;
    return splitCamelCase(
      base.split(/[\s\-_]+/).filter((p) => !/^\d+$/.test(p) && !/^copy$/i.test(p)).join(" ")
    ).trim().toUpperCase();
  };

  const hasAllMandatoryFields = (doc) => {
    if (!doc?.extractedData) return false;
    const type = (doc.modelType || "").toLowerCase();
    const fields = {
      invoice:       ["VendorName","InvoiceId","InvoiceDate","LPO NO","SubTotal","VAT","InvoiceTotal"],
      bankstatement: ["AccountHolder","AccountNumber","StatementPeriod","OpeningBalance","ClosingBalance"],
      mortgageforms: ["Lendername","Borrowername","Loanamount","Loantenure","Interest"],
    };
    return (fields[type] || fields.invoice).every((k) => {
      const v = doc.extractedData[k];
      return v !== undefined && v !== null && String(v).trim() !== "";
    });
  };

  const determineStatus = (doc) => {
    if (!doc) return "Manual Review";
    if (
      doc.status?.toLowerCase() === "reviewed" ||
      doc.reviewStatus?.toLowerCase() === "reviewed" ||
      doc.wasReviewed || doc.reviewedBy
    ) return "Reviewed";

    let score = 0;
    const raw = String(doc.averageConfidenceScore || doc.totalConfidenceScore || "0").replace(/[^\d.]/g, "");
    score = parseFloat(raw) || 0;
    if (score <= 1) score *= 100;

    const typeKey = Object.keys(config || {}).find(
      (k) => k.toLowerCase() === (doc.modelType || "").toLowerCase()
    );
    const threshold = (typeKey && config[typeKey]) ?? 85;

    if (score < threshold || !hasAllMandatoryFields(doc)) return "Manual Review";
    return "Completed";
  };

  /* ── Fetch ALL documents (no model filter) ──────────── */
  const fetchDocumentsFromBackend = async () => {
    try {
      const ts = Date.now();
      const res = await fetch(
        `https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=5ttVguFIlYsgNTLnI7I-hGlMyInPTM_Y-3ihASWqOxLzAzFuaOzdpQ==&_t=${ts}`
      );
      if (res.status === 503) { setBackendError(true); return; }
      if (!res.ok) throw new Error("Failed to fetch");
      setBackendError(false);

      const docs = await res.json();
      const withStatus = docs.map((doc) => ({ ...doc, status: determineStatus(doc) }));

      const userName  = (currentUser.name || name  || "").trim().toLowerCase();
      const userEmail = (currentUser.id   || email || "").trim().toLowerCase();

      const userDocs = withStatus.filter((doc) => {
        const uploaderName =
          typeof doc.uploadedBy === "object" && doc.uploadedBy?.name
            ? doc.uploadedBy.name
            : String(doc.uploadedBy || "");
        const uploaderEmail =
          typeof doc.uploadedBy === "object" && doc.uploadedBy?.email
            ? doc.uploadedBy.email
            : String(doc.uploadedByEmail || "");

        const n = uploaderName.trim().toLowerCase();
        const e = uploaderEmail.trim().toLowerCase();

        return (userName  && (n === userName  || e === userName))  ||
               (userEmail && (n === userEmail  || e === userEmail));
      });

      setGlobalDocuments(withStatus);
      setAllDocuments(userDocs);
    } catch (err) {
      console.error("Error loading docs:", err);
      if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"))
        setBackendError(true);
    }
  };

  useEffect(() => {
    fetchDocumentsFromBackend();
    const id = setInterval(fetchDocumentsFromBackend, 10000);
    return () => clearInterval(id);
  }, [email, currentUser.name]);

  /* ── Fetch vendors for active tab ───────────────────── */
  useEffect(() => {
    if (activeTab === "All") { setVendors([]); return; }
    getVendorFolders(activeTab.toLowerCase())
      .then((list) => setVendors(list || []))
      .catch(() => setVendors([]));
  }, [activeTab]);

  /* ── Auto-clear localInProcess when backend arrives ─── */
  const prevDocCountRef = useRef(0);
  useEffect(() => {
    if (globalDocuments.length > prevDocCountRef.current && localInProcess.length > 0)
      setLocalInProcess((prev) => prev.slice(1));
    prevDocCountRef.current = globalDocuments.length;
  }, [globalDocuments.length]);

  /* ── Type override from queue dropdown ──────────────── */
  const handleTypeOverride = (uploadId, newType) =>
    setSelectedFiles((prev) =>
      prev.map((f) => (f.uploadId === uploadId ? { ...f, modelType: newType || null } : f))
    );

  /* ── File selection: upload → detect → show in queue ── */
  const FileChange = (e) => {
    const files = Array.from(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!files.length) return;

    for (const file of files) {
      const fileName = file.name;

      if (selectedFiles.some((f) => f.fileName.toLowerCase() === fileName.toLowerCase())) {
        toast.error(`"${fileName}" is already queued.`);
        continue;
      }

      const uploadId = uuidv4();
      // Add immediately with detecting state
      setSelectedFiles((prev) => [
        ...prev,
        { file, fileName, uploadId, folderName: extractFolderName(fileName), modelType: null, blobUrl: null, detecting: true },
      ]);

      // Upload then detect in background
      (async () => {
        try {
          const blobUrl = await uploadToBlobOnly(file);
          const raw     = await detectTypeFromBlob(blobUrl);
          const modelType = normalizeDetectedType(raw);
          setSelectedFiles((prev) =>
            prev.map((f) => f.uploadId === uploadId ? { ...f, blobUrl, modelType, detecting: false } : f)
          );
        } catch (err) {
          toast.error(`Failed to process "${fileName}": ${err.message}`);
          setSelectedFiles((prev) => prev.filter((f) => f.uploadId !== uploadId));
        }
      })();
    }
  };

  /* ── Delete from queue ──────────────────────────────── */
  const handleDeleteFile = (index) =>
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

  /* ── Process files ──────────────────────────────────── */
  const handleProcessFiles = async () => {
    if (!selectedFiles.length) return;
    setIsUploading(true);

    setLocalInProcess((prev) => [
      ...prev,
      ...selectedFiles.map((f) => ({
        id: f.uploadId, documentName: f.fileName, uploadedAt: new Date().toISOString(), status: "In Process",
      })),
    ]);

    for (const fileObj of selectedFiles) {
      const toastId = toast.info(`Uploading ${fileObj.fileName}...`, { autoClose: false });
      try {
        toast.update(toastId, { render: `${fileObj.fileName}: uploading to storage…`, autoClose: false });
        toast.update(toastId, { render: `${fileObj.fileName}: processing with AI…`, isLoading: true, autoClose: false });
        const result = await processDocument(
          fileObj.blobUrl,
          fileObj.fileName,
          fileObj.modelType,
          email || currentUser.id,
          name  || currentUser.name,
        );
        if (result?.error) {
          toast.update(toastId, { render: `❌ ${result.error}`, type: "error", isLoading: false, autoClose: 6000 });
          continue;
        }
        const splitMsg = result?.splitCount > 0
          ? `✅ ${fileObj.fileName}: split into ${result.splitCount} document(s)`
          : `⚠️ ${fileObj.fileName}: uploaded but no documents detected — check if model type is correct`;
        toast.update(toastId, { render: splitMsg, type: result?.splitCount > 0 ? "success" : "warning", isLoading: false, autoClose: 6000 });
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data || err?.message || "Unknown error";
        toast.update(toastId, {
          render: `❌ Upload failed: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`,
          type: "error", isLoading: false, autoClose: 8000
        });
      }
    }

    setSelectedFiles([]);
    setIsUploading(false);
    await fetchDocumentsFromBackend();
  };

  /* ── Date formatters ──────────────────────────────────── */
  const formatDate = (s) => {
    if (!s) return "Unknown";
    const d = new Date(s);
    if (isNaN(d)) return "Unknown";
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60)    return "Just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return d.toLocaleDateString();
  };

  const toLocalDDMMYYYY = (s) => {
    if (!s) return "-";
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d)) return s;
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  };

  /* ── Filtered / sorted docs ───────────────────────────── */
  const getTabDocs = (docs) => {
    if (activeTab === "All") return docs;
    return docs.filter(
      (d) => (d.modelType || "").toLowerCase() === activeTab.toLowerCase()
    );
  };

  const filteredGlobal = getTabDocs(globalDocuments);

  const vendorFiltered = (() => {
    let docs = getTabDocs(allDocuments);
    if (selectedVendor) {
      const lv = selectedVendor.toLowerCase();
      docs = docs.filter(
        (d) =>
          (d.extractedData?.VendorName || "").toLowerCase().includes(lv) ||
          (d.documentName || "").toLowerCase().includes(lv)
      );
    }
    return docs;
  })();

  const sortedDocs  = [...vendorFiltered].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const totalPages  = Math.ceil(sortedDocs.length / documentsPerPage);
  const currentDocs = sortedDocs.slice((currentPage - 1) * documentsPerPage, currentPage * documentsPerPage);

  /* ── Stats (based on active tab) ─────────────────────── */
  const stats = (() => {
    let completed = 0, manualReview = 0, inProcess = localInProcess.length;
    filteredGlobal.forEach((d) => {
      const s = determineStatus(d);
      if (s === "Completed" || s === "Reviewed") completed++;
      else if (s === "Manual Review" || s === "Review Required") manualReview++;
      else inProcess++;
    });
    return { total: filteredGlobal.length + localInProcess.length, completed, inProcess, manualReview };
  })();

  /* ── Tab counts ───────────────────────────────────────── */
  const tabCounts = {
    All:           globalDocuments.length,
    Invoice:       globalDocuments.filter((d) => d.modelType?.toLowerCase() === "invoice").length,
    BankStatement: globalDocuments.filter((d) => d.modelType?.toLowerCase() === "bankstatement").length,
    MortgageForms: globalDocuments.filter((d) => d.modelType?.toLowerCase() === "mortgageforms").length,
  };

  const handleViewDocument = (file) => {
    const rawUrl = file.blobUrl || file.url;
    if (!rawUrl?.startsWith("http")) { toast.error("File URL is not available"); return; }
    const base = rawUrl.split("?")[0];
    const sas  = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
    window.open(`${base}${sas}`, "_blank");
  };

  const resolveTypeMeta = (modelType) => {
    if (!modelType) return null;
    return TYPE_META[modelType] ||
      TYPE_META[Object.keys(TYPE_META).find((k) => k.toLowerCase() === modelType.toLowerCase())] ||
      null;
  };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="dashboard-total-container">

      {/* Backend error banner */}
      {backendError && (
        <div className="db-error-banner">
          <AlertTriangle size={16} />
          <span>
            <strong>Service Unavailable:</strong> The backend service is down (503).
            Check your Azure Function App.
          </span>
          <button onClick={() => setBackendError(false)}>✕</button>
        </div>
      )}

      <div className="dash-main">


        {/* ── Stat cards ────────────────────────────────── */}
        <div className="dash-stats">
          <div className="dash-stat-card">
            <span className="dash-stat-icon" style={{ background: "#e8f1fb" }}>📄</span>
            <div>
              <p className="dash-stat-label">TOTAL DOCUMENTS</p>
              <p className="dash-stat-value" style={{ color: "#256695" }}>{stats.total}</p>
            </div>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-icon" style={{ background: "#e6f7ed" }}>✅</span>
            <div>
              <p className="dash-stat-label">COMPLETED</p>
              <p className="dash-stat-value" style={{ color: "#2e9a55" }}>{stats.completed}</p>
            </div>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-icon" style={{ background: "#fff7e6" }}>⏳</span>
            <div>
              <p className="dash-stat-label">IN PROCESS</p>
              <p className="dash-stat-value" style={{ color: "#e09800" }}>{stats.inProcess}</p>
            </div>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-icon" style={{ background: "#ffeaea" }}>⚠️</span>
            <div>
              <p className="dash-stat-label">MANUAL REVIEW</p>
              <p className="dash-stat-value" style={{ color: "#ec2225" }}>{stats.manualReview}</p>
            </div>
          </div>
        </div>

        {/* ── Document type tabs ────────────────────────── */}
        <div className="dash-tabs-bar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`dash-tab-btn ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => { setActiveTab(tab.key); setCurrentPage(1); setSelectedVendor(""); }}
            >
              {tab.emoji} {tab.label}
              <span className="dash-tab-count">{tabCounts[tab.key]}</span>
            </button>
          ))}
        </div>

        {/* ── Upload panel + Documents table (side-by-side) */}
        <div className="dash-body">

          {/* Upload panel */}
          <div className="dash-upload-panel">
            <div className="dash-panel-hdr">
              <h3>📤 Upload Documents</h3>
              <p>Type is detected automatically from document content.</p>
            </div>
            <hr className="dash-divider" />

            {/* Drop zone */}
            <div className="dash-dropzone" onClick={() => fileInputRef.current.click()}>
              <span className="dash-drop-cloud">☁️</span>
              <p className="dash-drop-title">Drop files here or click to upload</p>
              <p className="dash-drop-sub">PDF, Word, JPG, PNG</p>
              <button
                className="dash-browse-btn"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
              >
                Browse Files
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              multiple
              onChange={FileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />

            {/* File queue */}
            {selectedFiles.length > 0 && (
              <>
                <p className="dash-queue-label">📋 SELECTED FILES ({selectedFiles.length})</p>
                <ul className="dash-file-list">
                  {selectedFiles.map((f, i) => {
                    const meta = f.modelType ? TYPE_META[f.modelType] : null;
                    return (
                      <li key={f.uploadId} className={`dash-file-item${!f.modelType && !f.detecting ? " unknown" : ""}`}>
                        <span className="dash-file-emoji">📄</span>
                        <div className="dash-file-info">
                          <span className="dash-file-name">{f.fileName}</span>
                          {f.detecting ? (
                            <span className="dash-type-badge detecting-badge">⏳ Uploading &amp; detecting…</span>
                          ) : (
                            <div className="dash-type-row">
                              {meta && (
                                <span className="dash-type-badge" style={{ background: meta.bg, color: meta.text }}>
                                  {meta.emoji} {meta.label}
                                </span>
                              )}
                              <select
                                className="dash-type-override-select"
                                value={f.modelType || ""}
                                onChange={(e) => handleTypeOverride(f.uploadId, e.target.value)}
                              >
                                <option value="">{meta ? "▼ Change type" : "❓ Select type…"}</option>
                                {Object.entries(TYPE_META).map(([key, m]) => (
                                  <option key={key} value={key}>{m.emoji} {m.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <button className="dash-file-del" onClick={() => handleDeleteFile(i)}>✕</button>
                      </li>
                    );
                  })}
                </ul>

                <button
                  className="dash-process-btn"
                  onClick={handleProcessFiles}
                  disabled={isUploading || selectedFiles.some((f) => f.detecting || !f.modelType)}
                >
                  ⚡ {isUploading ? "Processing..." : `Process Files (${selectedFiles.length})`}
                </button>

                {selectedFiles.some((f) => f.detecting) && (
                  <div className="dash-unknown-warn">
                    <span>⏳ Detecting document types, please wait…</span>
                  </div>
                )}
                {!selectedFiles.some((f) => f.detecting) && selectedFiles.some((f) => !f.modelType) && (
                  <div className="dash-unknown-warn">
                    <span>⚠️ Select a type for all files before processing</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Documents table panel */}
          <div className="dash-table-panel">
            <div className="dash-table-hdr">
              <h3>📋 Recent Documents</h3>
              {activeTab !== "All" && (
                <select
                  className="dash-vendor-sel"
                  value={selectedVendor}
                  onChange={(e) => { setSelectedVendor(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">All Vendors ▾</option>
                  {vendors.map((v, i) => <option key={i} value={v}>{v}</option>)}
                </select>
              )}
            </div>
            <hr className="dash-divider" />

            <table className="dash-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Document Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentDocs.length > 0 ? (
                  currentDocs.map((doc, i) => {
                    const meta = resolveTypeMeta(doc.modelType);
                    return (
                      <tr key={i} className={i % 2 === 1 ? "row-even" : ""}>
                        <td>{doc.id || "-"}</td>
                        <td className="td-name">{doc.documentName || doc.fileName}</td>
                        <td>
                          {meta ? (
                            <span className="dash-type-badge table-badge" style={{ background: meta.bg, color: meta.text }}>
                              {meta.emoji} {meta.label}
                            </span>
                          ) : <span className="td-none">—</span>}
                        </td>
                        <td>
                          <span className={`badge ${(doc.status || "").toLowerCase().replace(" ", "-")}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td>{formatDate(doc.uploadedAt)}</td>
                        <td>{toLocalDDMMYYYY(doc.uploadedAt)}</td>
                        <td>
                          <button className="action-btn" onClick={() => handleViewDocument(doc)}>View</button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="dash-empty-row">
                      {selectedVendor ? `No documents for vendor: ${selectedVendor}` : "No documents uploaded yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    className={`page-btn${currentPage === i + 1 ? " active" : ""}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>


      <Footer />
      <ToastContainer />
    </div>
  );
};

export default Dashboard;
