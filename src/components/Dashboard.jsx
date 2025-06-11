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
import { useNavigate } from 'react-router-dom';

import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import { uploadToAzure } from "../utils/azureUploader";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getVendorFolders } from "../utils/blobService";

const Dashboard = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [myFiles, setMyFiles] = useState([]); // current user uploads from localStorage + backend updates
  const [allDocuments, setAllDocuments] = useState([]); // all documents from database for stats
  const [isUploading, setIsUploading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(""); // New state for vendor filtering
  const fileInputRef = useRef(null);
const navigate = useNavigate();

  // Fetch vendors list once
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const list = await getVendorFolders();
        setVendors(list);
      } catch (error) {
        console.error("Error fetching vendors", error);
      }
    };
    fetchVendors();
  }, []);

  // Load localStorage uploads on mount
  useEffect(() => {
    const localUploads = JSON.parse(localStorage.getItem("myUploads") || "[]");
    setMyFiles(localUploads);
  }, []);

  // Poll backend every 10s to update status of current user uploads AND get all documents for stats
  useEffect(() => {
    const fetchDocumentsFromBackend = async () => {
      try {
        const response = await fetch(
          "https://docap.azurewebsites.net/api/DocQmentorFunc?code=n4SOThz-nkfGfs96hGTtAsvm3ZS2wt7O3pqELLzWqi38AzFuUm090A=="
        );
        if (!response.ok) throw new Error("Failed to fetch document data");

        const documents = await response.json();

        // Store all documents for stats display
        setAllDocuments(documents);

        // Filter backend docs for those files that current user uploaded (match by fileName)
        const localUploads = JSON.parse(
          localStorage.getItem("myUploads") || "[]"
        );
        const updatedFiles = localUploads.map((localFile) => {
          const backendDoc = documents.find(
            (doc) =>
              doc.documentName === localFile.fileName ||
              doc.fileName === localFile.fileName
          );
          if (backendDoc) {
            // Update status based on backend data
            const status = determineStatus(backendDoc);
            return {
              ...localFile,
              status,
              url: backendDoc.fileUrl || localFile.url || null,
              processedData: backendDoc,
            };
          }
          return localFile; // no backend update
        });

        setMyFiles(updatedFiles);
        localStorage.setItem("myUploads", JSON.stringify(updatedFiles));
      } catch (error) {
        console.error("Error loading backend documents:", error);
      }
    };

    const determineStatus = (doc) => {
      if (String(doc.status).toLowerCase() === "completed") {
        return hasAllMandatoryFields(doc) ? "Completed" : "Manual Review";
      }
      return "In Process";
    };

    const hasAllMandatoryFields = (doc) => {
      const mandatoryFields = [
        doc.vendorName,
        doc.invoiceId,
        doc.invoiceDate,
        doc.invoiceTotal || doc.invoicetotal,
      ];
      return mandatoryFields.every(
        (field) =>
          field !== undefined && field !== null && String(field).trim() !== ""
      );
    };

    fetchDocumentsFromBackend();
    const intervalId = setInterval(fetchDocumentsFromBackend, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // Function to filter documents by selected vendor
  const getFilteredDocuments = () => {
    if (!selectedVendor) {
      return allDocuments; // Show all documents if no vendor selected
    }

    return allDocuments.filter((doc) => {
      const documentName = doc.documentName || "";
      return documentName.toLowerCase().includes(selectedVendor.toLowerCase());
    });
  };

  // Function to filter myFiles by selected vendor
  const getFilteredMyFiles = () => {
    if (!selectedVendor) {
      return myFiles; // Show all files if no vendor selected
    }

    return myFiles.filter((file) => {
      // Check if file has processed data with vendor info
      if (file.processedData && file.processedData.documentName) {
        const fileDocName = file.processedData.documentName;
        return fileDocName.toLowerCase().includes(selectedVendor.toLowerCase());
      }

      // If no processed data, check if filename contains vendor name
      return file.fileName.toLowerCase().includes(selectedVendor.toLowerCase());
    });
  };

  // Calculate stats from filtered documents
  const getDocumentStats = () => {
    const filteredDocs = getFilteredDocuments();
    const total = filteredDocs.length;
    const completed = filteredDocs.filter((doc) => {
      if (doc.status === "Completed") {
        return hasAllMandatoryFields(doc);
      }
      return false;
    }).length;

    const inProcess = filteredDocs.filter(
      (doc) => doc.status !== "Completed"
    ).length;

    const manualReview = filteredDocs.filter((doc) => {
      if (doc.status === "Completed") {
        return !hasAllMandatoryFields(doc);
      }
      return false;
    }).length;

    return { total, completed, inProcess, manualReview };
  };

  const hasAllMandatoryFields = (doc) => {
    const mandatoryFields = [
      doc.vendorName,
      doc.invoiceId,
      doc.invoiceDate,
      doc.invoiceTotal || doc.invoicetotal,
    ];
    return mandatoryFields.every(
      (field) =>
        field !== undefined && field !== null && String(field).trim() !== ""
    );
  };

  // Handle vendor selection change
  const handleVendorChange = (e) => {
    setSelectedVendor(e.target.value);
    console.log("Selected vendor:", e.target.value); // Debug log
  };

  const stats = getDocumentStats();
  const filteredMyFiles = getFilteredMyFiles();

  const FileChange = (e) => {
    const newFiles = Array.from(e.target.files).map((file) => ({
      file,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      status: "In Process",
      url: null,
    }));

    // Avoid duplicate filenames in selection
    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.fileName));
      const uniqueNewFiles = newFiles.filter(
        (f) => !existingNames.has(f.fileName)
      );
      return [...prev, ...uniqueNewFiles];
    });
  };

  const handleDeleteFile = (index) => {
    const updated = [...selectedFiles];
    updated.splice(index, 1);
    setSelectedFiles(updated);
  };

  const handleClick = () => {
    fileInputRef.current.click();
  };

  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);

    const localUploads = JSON.parse(localStorage.getItem("myUploads") || "[]");

    // Add selected files immediately to localStorage and myFiles as "In Process"
    const newUploads = selectedFiles.map((fileObj) => ({
      fileName: fileObj.fileName,
      status: "In Process",
      uploadedAt: new Date().toISOString(),
      url: null,
    }));

    const updatedLocalUploads = [...newUploads, ...localUploads];
    localStorage.setItem("myUploads", JSON.stringify(updatedLocalUploads));
    setMyFiles((prev) => [...newUploads, ...prev]);

    // Upload each file asynchronously
    for (const fileObj of selectedFiles) {
      const toastId = toast.info(`Uploading ${fileObj.fileName}...`, {
        autoClose: 1000,
      });

      try {
        const result = await uploadToAzure(fileObj.file, (percent) => {
          toast.update(toastId, {
            render: `${fileObj.fileName} uploading: ${percent}%`,
            isLoading: percent < 100,
            autoClose: percent >= 100 ? 2000 : false,
          });
        });

        if (result) {
          toast.success(`${fileObj.fileName} uploaded successfully!`);

          // Update url for the file in myFiles + localStorage
          setMyFiles((prevFiles) =>
            prevFiles.map((f) =>
              f.fileName === fileObj.fileName ? { ...f, url: result.url } : f
            )
          );

          const updatedUploadsWithUrl = updatedLocalUploads.map((f) =>
            f.fileName === fileObj.fileName ? { ...f, url: result.url } : f
          );
          localStorage.setItem(
            "myUploads",
            JSON.stringify(updatedUploadsWithUrl)
          );
        }
      } catch (err) {
        console.error(`Failed to upload ${fileObj.fileName}:`, err);
        toast.error(`Failed to upload ${fileObj.fileName}`);
      }
    }

    setSelectedFiles([]);
    setIsUploading(false);
  };

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

  return (
    <div className="dashboard-total-container">
      <header className="header">
        <Header />
      </header>

      <div className="Dashboard-main-section">
        <nav className="vendor-select">
          <div>
            <h2>Dashboard</h2>
            <p>View your document processing activity and insights</p>
          </div>
          <div>
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
            <FileText className="i" size={24} />
            <p>Total Documents</p>
            <div className="total">{stats.total}</div>
          </div>
          <div className="stat-box completed">
            <CheckCircle className="i" size={24} />
            <p>Completed Documents</p>
            <div className="total">{stats.completed}</div>
          </div>
          <div className="stat-box inprocess">
            <Clock className="i" size={24} />
            <p>In Process</p>
            <div className="total">{stats.inProcess}</div>
          </div>
          <div className="stat-box manual-review" onClick={() => navigate('/manualreview')}>
            <AlertTriangle className="i" size={24} />
            <p>Manual Review</p>
            
            <div className="total">{stats.manualReview}</div>
          </div>
        </main>

        <div className="Dashboard-upload-table-section">
          <div className="upload-section">
            <div className="upload-section-header-contants">
              <h3>Upload Documents</h3>
              <p>Upload documents for AI-powered data extraction</p>
            </div>

            <div className="input-section" onClick={handleClick}>
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

              <label
                className="btn btn-outline"
                onClick={(e) => {
                  e.stopPropagation(); // prevent div click
                  fileInputRef.current.click();
                }}
              >
                <Upload size={16} className="selecte-icon" /> Select Files
              </label>
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
                {filteredMyFiles.length > 0 ? (
                  filteredMyFiles.map((file, index) => (
                    <tr key={index}>
                      <td>{file.fileName}</td>
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
                          onClick={() => {
                            if (file.url) {
                              window.open(file.url, "_blank");
                            } else {
                              toast.error("File URL not available");
                            }
                          }}
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
          </div>
        </div>
      </div>

      <footer>
        <Footer />
      </footer>

      <ToastContainer />
    </div>
  );
};

export default Dashboard;
