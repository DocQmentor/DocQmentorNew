import React, { useRef, useState, useEffect } from "react";
import "./Dashboard.css";

import {
  Upload,
  Trash2,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import { uploadToAzure } from "../utils/azureUploader";
import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getVendorFolders, checkFileExists } from "../utils/blobService";
import { useMsal } from "@azure/msal-react";
import { useUser } from "../context/UserContext";
import { sasToken } from "../sasToken";
import useGroupAccess from "../utils/userGroupAccess";

import { useConfig } from "../context/ConfigContext";

const Dashboard = () => {
  const { config } = useConfig();
  const hasAccess = useGroupAccess();
  const { accounts } = useMsal();
  const currentUser = {
    id: accounts[0]?.username || "unknown@user.com",
    name: accounts[0]?.name || "Unknown User",
  };

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [globalDocuments, setGlobalDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modelType, setModelType] = useState("");
  const [localInProcess, setLocalInProcess] = useState([]);
  const selectedmodelType =
    localStorage.getItem("selectedModelType") || "Invoice";
  const documentsPerPage = 10;
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { email, name } = useUser();

  // 🧩 Load modelType from localStorage
  useEffect(() => {
    const storedmodelType = localStorage.getItem("selectedModelType");
    if (storedmodelType) {
      setModelType(storedmodelType.toLowerCase());
    } else {
      navigate("/select");
    }
  }, []);

  // 🧩 Fetch vendors
  useEffect(() => {
    const fetchVendors = async () => {
      if (!modelType) return setVendors([]);
      try {
        const list = await getVendorFolders(modelType);
        setVendors(list || []);
      } catch (error) {
        console.error("Error fetching vendors:", error);
        setVendors([]);
      }
    };
    fetchVendors();
  }, [modelType]);

  const hasAllMandatoryFields = (doc) => {
    if (!doc || !doc.extractedData) return false;

    const type = (doc.modelType || modelType || "invoice").toLowerCase();

    const modelFields = {
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
        "Loantenure",
        "Interest",
      ],
    };

    const required = modelFields[type] || modelFields.invoice;

    return required.every((key) => {
      let value = doc.extractedData[key];
      
      // key aliases for SQL vs Analyzer formats
      if (key === "LPO NO") value = value || doc.extractedData["LPO NO"];
      if (key === "VAT") value = value || doc.extractedData["VAT"] || doc.extractedData["VAT"];
      if (key === "Lendername") value = value || doc.extractedData["Lendername"];
      if (key === "Borrowername") value = value || doc.extractedData["Borrowername"];

      return (
        value !== undefined && value !== null && String(value).trim() !== ""
      );
    });
  };
 const splitCamelCase = (text) => text.replace(/([a-z])([A-Z])/g, "$1 $2");

  const extractFolderName = (filename) => {
    const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;
    let parts = baseName.split(/[\s\-_]+/);

    const filtered = parts.filter((p) => !/^\d+$/.test(p) && !/^copy$/i.test(p));
    let cleaned = filtered.join(" ");
    cleaned = splitCamelCase(cleaned);
    return cleaned.trim().toUpperCase();
  };
  const determineStatus = (doc) => {
    if (!doc) return "Manual Review";

    // ✅ If reviewed manually
    if (
      doc.status?.toLowerCase() === "reviewed" ||
      doc.reviewStatus?.toLowerCase() === "reviewed" ||
      doc.wasReviewed === true ||
      doc.reviewedBy
    ) {
      return "Reviewed";
    }

    // ✅ Extract total confidence score (handles both 83.24% or 0.83 formats)
    let score = 0;
    const rawScore = doc.averageConfidenceScore || doc.totalConfidenceScore;
    
    if (rawScore) {
      const raw = String(rawScore).replace(/[^\d.]/g, "");
      score = parseFloat(raw);
      if (score <= 1) score *= 100; // handles normalized scores like 0.83
    }
    
    // ✅ Retrieve Dynamic Config based on Model (e.g. "Invoice")
    // We try to match the localStorage key (e.g. "Invoice") or fallback to 85
    let currentThreshold = 85; 
    
    // Attempt to map modelType 'invoice' -> 'Invoice', etc.
    // The context config keys are PascalCase: Invoice, BankStatement, MortgageForms
    const typeKey = Object.keys(config || {}).find(
      k => k.toLowerCase() === (modelType || "").toLowerCase()
    );
    
    if (typeKey && config[typeKey] !== undefined) {
        currentThreshold = config[typeKey];
    } else if (config[selectedmodelType]) {
        currentThreshold = config[selectedmodelType];
    }

    // ✅ If mandatory fields missing or score < threshold → Manual Review
    const hasMissingFields = !hasAllMandatoryFields(doc);
    if (score < currentThreshold || hasMissingFields) return "Manual Review";

    // ✅ Otherwise → Completed
    return "Completed";
  };

  const fetchDocumentsFromBackend = async () => {
    try {
      // ✅ Fetch data from Cosmos/SQL via Function API
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(
        `https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=5ttVguFIlYsgNTLnI7I-hGlMyInPTM_Y-3ihASWqOxLzAzFuaOzdpQ==&_t=${timestamp}`
      );

      // 🚨 Check specifically for 503 or generic failure
      if (response.status === 503) {
        setBackendError(true);
        console.warn("Backend 503: Service Unavailable");
        // We do not throw here if we want to suppress the "Uncaught" noise, 
        // but we should exit the function since we have no data.
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch document data");

      // If success, clear error
      setBackendError(false);
      
      const documents = await response.json();

      // ✅ Normalize modelType (case-insensitive match)
      const normalizedModelType = (modelType || "").toLowerCase();

      // ✅ Only keep documents matching current dashboard’s modelType
      const filteredDocs = documents.filter(
        (doc) => doc.modelType?.toLowerCase() === normalizedModelType
      );

      // ✅ Apply status logic
      const withStatus = filteredDocs.map((doc) => ({
        ...doc,
        status: determineStatus(doc),
      }));

      // ✅ Separate into all/global & user-specific sets
      // ⚠️ Backend stores User Name, not Email. Filter by Name.
      const currentUserName = (currentUser.name || "").trim().toLowerCase();

      // FILTER: Only keep docs for current user (List View)
      const userFilteredDocs = withStatus.filter((doc) => {
        const uploaderName =
          typeof doc.uploadedBy === "object" && doc.uploadedBy?.name
            ? doc.uploadedBy.name
            : String(doc.uploadedBy || "");  
        return uploaderName.trim().toLowerCase() === currentUserName;
      });
      
      // ✅ Set state
      setGlobalDocuments(withStatus); // Stats use this (Global)
      setAllDocuments(userFilteredDocs); // List uses this (User Only)

      console.log(
        `📦 Loaded ${withStatus.length} ${modelType} documents from DB. User docs: ${userFilteredDocs.length}`
      );
    } catch (error) {
      console.error("❌ Error loading backend documents:", error);
      // Optional: if network error (fetch failed completely), implies down too
      if(error.message && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))) {
          setBackendError(true);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (modelType) fetchDocumentsFromBackend();
    const intervalId = setInterval(() => {
      if (modelType) fetchDocumentsFromBackend();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [modelType, email, currentUser.name]); // Updated dependency to currentUser.name

  // 🧩 Vendor filter
  const handleVendorChange = (e) => {
    setSelectedVendor(e.target.value);
    setCurrentPage(1);
  };

  // 🧩 File upload and processing
  // FileChange: validate duplicates against DB (globalDocuments) and local queue (localInProcess)
  const FileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      const fileName = file.name;
      const folderName = extractFolderName(fileName);

      // 1) Check local in-process queue first (files just selected or uploading)
      const foundInLocal = localInProcess.some(
        (item) => item.documentName?.toLowerCase() === fileName.toLowerCase()
      );
      if (foundInLocal) {
        toast.error(`File "${fileName}" is already queued for upload.`);
        continue;
      }

      // 2) Check ACTUAL Blob Storage (async)
      const existsInStorage = await checkFileExists(modelType, fileName);
      if (existsInStorage) {
        toast.error(`File "${fileName}" already exists in storage. Please rename and select again.`);
        continue;
      }
      
      // Passed checks -> add to selected files list
      setSelectedFiles((prev) => [
          ...prev, 
          {
            file,
            fileName,
            uploadId: uuidv4(),
            folderName,
            status: "Pending" // Initial status
          }
      ]);
    }
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };



  const handleDeleteFile = (index) => {
    const updated = [...selectedFiles];
    updated.splice(index, 1);
    setSelectedFiles(updated);
  };

  const handleClick = () => fileInputRef.current.click();

  const handleProcessFiles = async () => {
  if (selectedFiles.length === 0) return;
  setIsUploading(true);

  // Add selected files to local in-process list
  const localQueueItems = selectedFiles.map((fileObj) => ({
    id: fileObj.uploadId,
    documentName: fileObj.fileName,
    uploadedAt: new Date().toISOString(),
    status: "In Process",
  }));

  setLocalInProcess((prev) => [...prev, ...localQueueItems]);

  for (const fileObj of selectedFiles) {
    const toastId = toast.info(`Uploading ${fileObj.fileName}...`, {
      autoClose: 1000,
    });

    try {
      const result = await uploadToAzure(
        fileObj.file,
        modelType,
        email || currentUser.id,
        name || currentUser.name,
        (percent) => {
          toast.update(toastId, {
            render: `${fileObj.fileName} uploading: ${percent}%`,
            isLoading: percent < 100,
            autoClose: percent >= 100 ? 2000 : false,
          });
        }
      );

      // Duplicate Error (no console error)
      if (result?.error) {
        toast.error(result.error);
        continue;
      }

      toast.success(`${fileObj.fileName} uploaded successfully!`);

    } catch (err) {
      toast.error("Upload failed. Please try again.");
    }
  }

  setSelectedFiles([]);
  setIsUploading(false);

  await fetchDocumentsFromBackend();
};


  // 🧩 Date formatter
  // 🧩 Date formatter
  // 🧩 Date formatter
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown time";
    
    // Check if it's already a valid date object or string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown time";
    
    // For calculating "ago", we need to be careful with timezones.
    // If the string lacks a 'Z' or offset, browsers might interpret it as local.
    // However, backend sends 'o' format (ISO) or similar.
    // We'll trust the browser's parsing of the ISO string.
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 0) return "Just now"; // Clock skew or future date handling
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      
    // Fallback to local string for older dates
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 🧩 Filtered user docs
  const getUserDocuments = () => {
    if (!selectedVendor) return allDocuments;
    const lowerVendor = selectedVendor.toLowerCase();
    
    return allDocuments.filter((doc) => {
      // 1. Check extracted VendorName
      const vendorName = doc.extractedData?.VendorName || "";
      if (vendorName.toLowerCase().includes(lowerVendor)) return true;

      // 2. Check filename / documentName
      const docName = doc.documentName || doc.fileName || "";
      if (docName.toLowerCase().includes(lowerVendor)) return true;

      return false;
    });
  };

  // Sorting: Newest First
  // Table List: ONLY show Backend Documents (from SQL)
  // We do NOT show localInProcess here anymore, as per user request.
  const userDocs = getUserDocuments().sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  const indexOfLast = currentPage * documentsPerPage;
  const indexOfFirst = indexOfLast - documentsPerPage;
  const currentDocs = userDocs.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(userDocs.length / documentsPerPage);

  // 🧩 Auto-remove localInProcess items when backend documents arrive
  // This simulates the "Processing... -> Done" flow.
  const prevDocCountRef = useRef(0);
  useEffect(() => {
      if (globalDocuments.length > prevDocCountRef.current) {
          // New docs arrived! Remove equivalent number of local processing items
          // simple logic: remove 1 local item for every new DB batch update?
          // Or just clear one by one.
          if (localInProcess.length > 0) {
              setLocalInProcess(prev => prev.slice(1)); // Remove oldest
          }
      }
      prevDocCountRef.current = globalDocuments.length;
  }, [globalDocuments.length]);

  const stats = (() => {
    // 🔹 Start with all global documents (from SQL)
    let filteredDocs = globalDocuments;

    // 🔹 If vendor selected, filter documents that match vendor name
    if (selectedVendor) {
      const lowerVendor = selectedVendor.toLowerCase();
      filteredDocs = filteredDocs.filter((doc) => {
         const vendorName = doc.extractedData?.VendorName || "";
         const docName = doc.documentName || doc.fileName || "";
         return vendorName.toLowerCase().includes(lowerVendor) || docName.toLowerCase().includes(lowerVendor);
      });
    }

    // Include local items in Total and InProcess
    const total = filteredDocs.length + localInProcess.length;
    let completed = 0,
      manualReview = 0,
      inProcess = localInProcess.length; // Start with local queue

    // 🔹 Count status by category
    filteredDocs.forEach((doc) => {
      const status = determineStatus(doc);
      if (status === "Completed" || status === "Reviewed") completed++;
      else if (status === "Manual Review" || status === "Review Required") manualReview++;
      else inProcess++;
    });

    return { total, completed, inProcess, manualReview };
  })();

  const handleViewDocument = (file) => {
    let rawUrl = file.blobUrl || file.url;
    if (!rawUrl || !rawUrl.startsWith("http")) {
      toast.error("File URL is not available");
      return;
    }
    const baseUrl = rawUrl.split("?")[0];
    const cleanSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
    const finalUrl = `${baseUrl}${cleanSasToken}`;
    window.open(finalUrl, "_blank");
  };

  const [backendError, setBackendError] = useState(false);

  return (
    <div className="dashboard-total-container">
      {backendError && (
        <div className="backend-error-banner" style={{
          backgroundColor: '#fee2e2',
          borderBytom: '1px solid #ef4444',
          color: '#b91c1c',
          padding: '12px',
          textAlign: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={20} />
          <span>
            <strong>Service Unavailable:</strong> The backend service is currently down (503). 
            Please check your Azure Function App status.
          </span>
          <button 
            onClick={() => setBackendError(false)}
            style={{
              marginLeft: '16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#991b1b',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>
      )}
      <div className="Dashboard-main-section" style={{ marginTop: backendError ? '48px' : '0' }}>
        <nav className="vendor-select">
          <div className="vendor-select-details">
            <h2>
              {modelType.charAt(0).toUpperCase() + modelType.slice(1)} Dashboard
            </h2>

            <p>
              Showing documents for{" "}
              {modelType.charAt(0).toUpperCase() + modelType.slice(1)}
            </p>
            <p>View your document processing activity and insights </p>
          </div>
          <div className="Dashboard-main-section-vendor-select">
            <label className="select">Select Vendor:</label>
            <select
              className="vendor-dropdown"
              value={selectedVendor}
              onChange={handleVendorChange}
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor, i) => (
                <option key={i} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
          </div>
        </nav>

        <main className="stats-container">
          <div className="stat-box Total">
            <FileText className="stat-icon" size={24} />
            <p className="stat-label">Total</p>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-box completed">
            <CheckCircle className="stat-icon" size={24} />
            <p className="stat-label">Completed</p>
            <div className="stat-value">{stats.completed}</div>
          </div>
          <div className="stat-box inprocess">
            <Clock className="stat-icon" size={24} />
            <p className="stat-label">In Process</p>
            <div className="stat-value">{stats.inProcess}</div>
          </div>
          <div className="stat-box manual-review">
            <AlertTriangle className="stat-icon" size={24} />
            <p className="stat-label">Manual Review</p>
            <div className="stat-value">{stats.manualReview}</div>
          </div>
        </main>

        <div className="Dashboard-upload-table-section">
          <div className="upload-section">
            <div className="upload-section-header-contants">
              <h3>Upload Documents</h3>
              <p>Upload documents for AI-powered data extraction</p>
            </div>
            <div className="input-section">
              <Upload className="Upload" size={48} />
              <h3 className="upload-section-h3">
                Drop files here or click to upload
              </h3>
              <p className="mb-4">Support for PDF, Word, JPG, PNG files</p>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                multiple
                onChange={FileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <button className="browse-btn" onClick={handleClick}>
                Browse Files
              </button>
            </div>

            <div className="file-load-section">
              {selectedFiles.length > 0 && (
                <>
                  <ul>
                    {selectedFiles.map((fileObj, index) => (
                      <li key={index}>
                        {fileObj.fileName}
                        <button
                          onClick={() => handleDeleteFile(index)}
                          className="delete-btn"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    className="process-btn"
                    onClick={handleProcessFiles}
                    disabled={isUploading}
                  >
                    {isUploading ? "Uploading..." : "Process Files"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="status-section">
            <div className="status-header">
              <h3>Recent Documents</h3>
              <p>
                {selectedVendor
                  ? `Documents for vendor: ${selectedVendor}`
                  : "List of your uploaded documents"}
              </p>
            </div>

            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentDocs.length > 0 ? (
                  currentDocs.map((file, index) => {
                     // Helper for DD/MM/YYYY
                     const toLocalDDMMYYYY = (dStr) => {
                        if (!dStr) return "-";
                        // If already DD/MM/YYYY, return as is
                        if (/^\d{2}\/\d{2}\/\d{4}/.test(dStr)) return dStr;
                        
                        const dateObj = new Date(dStr);
                        if (isNaN(dateObj.getTime())) return dStr; // Fallback
                        
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const year = dateObj.getFullYear();
                        return `${day}/${month}/${year}`;
                     };

                     return (
                    <tr key={index}>
                      <td>{file.id || "-"}</td>
                      <td>{file.documentName || file.fileName}</td>
                      <td>
                        <span
                          className={`badge ${file.status
                            ?.toLowerCase()
                            .replace(" ", "-")}`}
                        >
                          {file.status}
                        </span>
                      </td>
                      <td>{formatDate(file.uploadedAt)}</td>
                      <td>{toLocalDDMMYYYY(file.uploadedAt)}</td>
                      <td>
                        <button
                          className="action-btn"
                          onClick={() => handleViewDocument(file)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )})
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center" }}>
                      {selectedVendor
                        ? `No documents found for vendor: ${selectedVendor}`
                        : "No documents uploaded yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={`page-btn ${
                    currentPage === i + 1 ? "active" : ""
                  }`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <ToastContainer />
    </div>
   
  );
};

export default Dashboard;
