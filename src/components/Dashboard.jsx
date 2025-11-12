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
import { getVendorFolders } from "../utils/blobService";
import { useMsal } from "@azure/msal-react";
import { useUser } from "../context/UserContext";
import { sasToken } from "../sasToken";
import useGroupAccess from "../utils/userGroupAccess";

const Dashboard = () => {
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
      const value = doc.extractedData[key];
      return (
        value !== undefined && value !== null && String(value).trim() !== ""
      );
    });
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
    if (doc.totalConfidenceScore) {
      const raw = String(doc.totalConfidenceScore).replace(/[^\d.]/g, "");
      score = parseFloat(raw);
      if (score <= 1) score *= 100; // handles normalized scores like 0.83
    }

    // ✅ If mandatory fields missing or score < 85 → Manual Review
    const hasMissingFields = !hasAllMandatoryFields(doc);
    if (score < 85 || hasMissingFields) return "Manual Review";

    // ✅ Otherwise → Completed
    return "Completed";
  };

  const fetchDocumentsFromBackend = async () => {
    try {
      // ✅ Fetch data from Cosmos via Function API
      const response = await fetch(
        `https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA==`
      );
      if (!response.ok) throw new Error("Failed to fetch document data");

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
      const userEmail = (email || currentUser.id || "").toLowerCase();

      const userFilteredDocs = withStatus.filter((doc) => {
        const uploader =
          typeof doc.uploadedBy === "string"
            ? doc.uploadedBy
            : doc.uploadedBy?.id;
        return uploader?.toLowerCase() === userEmail;
      });

      // ✅ Set state
      setGlobalDocuments(withStatus);
      setAllDocuments(userFilteredDocs);

      console.log(
        `📦 Loaded ${withStatus.length} ${modelType} documents from DB`
      );
    } catch (error) {
      console.error("❌ Error loading backend documents:", error);
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
  }, [modelType, email, currentUser.id]);

  // 🧩 Vendor filter
  const handleVendorChange = (e) => {
    setSelectedVendor(e.target.value);
    setCurrentPage(1);
  };

  // 🧩 File upload and processing
  const FileChange = (e) => {
    const newFiles = Array.from(e.target.files).map((file) => ({
      file,
      fileName: file.name,
      uploadId: uuidv4(),
      uploadedAt: new Date().toISOString(),
      status: "In Process",
      url: null,
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
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

    for (const fileObj of selectedFiles) {
      const toastId = toast.info(`Uploading ${fileObj.fileName}...`, {
        autoClose: 1000,
      });

      try {
        await uploadToAzure(
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
        toast.success(`${fileObj.fileName} uploaded successfully!`);
      } catch (err) {
        console.error(err);
        toast.error(`Failed to upload ${fileObj.fileName}`);
      }
    }

    setSelectedFiles([]);
    setIsUploading(false);

    // ✅ Re-fetch after upload to prevent duplicates
    await fetchDocumentsFromBackend();
  };

  // 🧩 Date formatter
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown time";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown time";
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return date.toLocaleString();
  };

  // 🧩 Filtered user docs
  const getUserDocuments = () => {
    if (!selectedVendor) return allDocuments;
    return allDocuments.filter((doc) =>
      (doc.documentName || "")
        .toLowerCase()
        .includes(selectedVendor.toLowerCase())
    );
  };

  const userDocs = getUserDocuments().sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  const indexOfLast = currentPage * documentsPerPage;
  const indexOfFirst = indexOfLast - documentsPerPage;
  const currentDocs = userDocs.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(userDocs.length / documentsPerPage);

  const stats = (() => {
    // 🔹 Start with all global documents
    let filteredDocs = globalDocuments;

    // 🔹 If vendor selected, filter documents that match vendor name
    if (selectedVendor) {
      filteredDocs = filteredDocs.filter((doc) =>
        (doc.documentName || "")
          .toLowerCase()
          .includes(selectedVendor.toLowerCase())
      );
    }

    const total = filteredDocs.length;
    let completed = 0,
      manualReview = 0,
      inProcess = 0;

    // 🔹 Count status by category
    filteredDocs.forEach((doc) => {
      const status = determineStatus(doc);
      if (status === "Completed" || status === "Reviewed") completed++;
      else if (status === "Manual Review") manualReview++;
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

  return (
    <div className="dashboard-total-container">
      <div className="Dashboard-main-section">
        <nav className="vendor-select">
          <div className="vendor-select-details">
            <h2>
              {modelType.charAt(0).toUpperCase() + modelType.slice(1)} Dashboard
            </h2>

            <p>
              Showing documents for{" "}
              {modelType.charAt(0).toUpperCase() + modelType.slice(1)}
            </p>
            <p>View your document processing activity and insights</p>
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
                  <th>Name</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentDocs.length > 0 ? (
                  currentDocs.map((file, index) => (
                    <tr key={index}>
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
                      <td>{new Date(file.uploadedAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="action-btn"
                          onClick={() => handleViewDocument(file)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
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
