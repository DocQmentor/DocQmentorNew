// Dashboard.jsx
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
import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import { uploadToAzure } from "../utils/azureUploader";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getVendorFolders } from "../utils/blobService";
 
const Dashboard = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const fileInputRef = useRef(null);
 
  // Load vendors on component mount
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
 
  // Load uploaded files from localStorage on mount
  useEffect(() => {
    const storedFiles = localStorage.getItem("uploadedFiles");
    if (storedFiles) {
      setUploadedFiles(JSON.parse(storedFiles));
    }
  }, []);
 
  // Check if document has all mandatory fields
  const hasAllMandatoryFields = (doc) => {
    const mandatoryFields = [
      doc.vendorName,
      doc.invoiceId,
      doc.invoiceDate,
      doc.invoiceTotal || doc.invoicetotal
    ];
   
    return mandatoryFields.every(field =>
      field !== undefined &&
      field !== null &&
      field !== "" &&
      String(field).trim() !== ""
    );
  };
 
  // Poll for status updates
  useEffect(() => {
    const pollForUpdates = async () => {
      try {
        const response = await fetch(
          "https://docap.azurewebsites.net/api/DocQmentorFunc?code=n4SOThz-nkfGfs96hGTtAsvm3ZS2wt7O3pqELLzWqi38AzFuUm090A=="
        );
        if (!response.ok) throw new Error("Failed to fetch processed data");
        const processedData = await response.json();
 
        if (Array.isArray(processedData) && processedData.length > 0) {
          setUploadedFiles(prevFiles => {
            const updatedFiles = prevFiles.map(file => {
              const processedDoc = processedData.find(doc =>
                doc.documentName === file.fileName ||
                doc.fileName === file.fileName
              );
             
              if (processedDoc) {
                let newStatus = "In Process";
               
                // Check if processing is complete
                if (processedDoc.status === "Completed") {
                  // Verify mandatory fields
                  newStatus = hasAllMandatoryFields(processedDoc)
                    ? "Completed"
                    : "Manual Review";
                }
               
                return {
                  ...file,
                  status: newStatus,
                  processedData: processedDoc // Store the full processed data
                };
              }
              return file;
            });
 
            // Only update localStorage if changes were made
            if (JSON.stringify(updatedFiles) !== JSON.stringify(prevFiles)) {
              localStorage.setItem("uploadedFiles", JSON.stringify(updatedFiles));
            }
            return updatedFiles;
          });
        }
      } catch (error) {
        console.error("Error polling for updates:", error);
      }
    };
 
    // Poll every 10 seconds
    const intervalId = setInterval(pollForUpdates, 10000);
   
    // Initial poll
    pollForUpdates();
 
    return () => clearInterval(intervalId);
  }, []);
 
  const FileChange = (e) => {
    const newFiles = Array.from(e.target.files).map((file) => ({
      file,
      fileName: file.name,
      uploadedAt: new Date(),
      status: "In Process"
    }));
 
    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.fileName));
      const uniqueNewFiles = newFiles.filter((f) => !existingNames.has(f.fileName));
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
    const results = [];
 
    for (const fileObj of selectedFiles) {
      const toastId = toast.info(`Uploading ${fileObj.fileName}...`, { autoClose: 1000 });
 
      try {
        const result = await uploadToAzure(fileObj.file, (percent) => {
          toast.update(toastId, {
            render: `${fileObj.fileName} uploading: ${percent}%`,
            isLoading: percent < 100,
            autoClose: percent >= 100 ? 2000 : false,
          });
        });
 
        if (result) {
          const processedFile = {
            ...fileObj,
            status: "In Process",
            uploadedAt: new Date().toISOString()
          };
          results.push(processedFile);
          toast.success(`${fileObj.fileName} uploaded successfully!`);
        }
      } catch (err) {
        console.error(`Failed to upload ${fileObj.fileName}:`, err);
        toast.error(`Failed to upload ${fileObj.fileName}`);
      }
    }
 
    setUploadedFiles((prev) => {
      const updated = [...prev, ...results];
      localStorage.setItem("uploadedFiles", JSON.stringify(updated));
      return updated;
    });
 
    setSelectedFiles([]);
    setIsUploading(false);
  };
 
  const formatDate = (dateString) => {
    if (!dateString) return "Just now";
   
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Just now";
   
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
   
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
   
    return date.toLocaleDateString();
  };
 
  return (
    <div className="dashboard-total-container">
      <header className="header"><Header /></header>
 
      <div className="Dashboard-main-section">
        <nav className="vendor-select">
          <div>
            <h2>Dashboard</h2>
            <p>View your document processing activity and insights</p>
          </div>
          <div>
            <label className="select">Select Vendor:</label>
            <select className="vendor-dropdown" defaultValue="">
              <option disabled value="">Select Vendor</option>
              {vendors.map((vendor, i) => (
                <option key={i} value={vendor}>{vendor}</option>
              ))}
            </select>
          </div>
        </nav>
 
        <main className="stats-container">
          <div className="stat-box Total">
            <FileText className="i" size={24} />
            <p>Total Documents</p>
            <div className="total">{uploadedFiles.length}</div>
          </div>
          <div className="stat-box completed">
            <CheckCircle className="i" size={24} />
            <p>Completed Documents</p>
            <div className="total">{uploadedFiles.filter((f) => f.status === "Completed").length}</div>
          </div>
          <div className="stat-box inprocess">
            <Clock className="i" size={24} />
            <p>In Process</p>
            <div className="total">{uploadedFiles.filter((f) => f.status === "In Process").length}</div>
          </div>
          <div className="stat-box manual-review">
            <AlertTriangle className="i" size={24} />
            <p>Manual Review</p>
            <div className="total">{uploadedFiles.filter((f) => f.status === "Manual Review").length}</div>
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
              <h3 className="upload-section-h3">Drop files here or click to upload</h3>
              <p className="mb-4">Support for PDF, Word, JPG, PNG files</p>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                multiple
                onChange={FileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <label className="btn btn-outline">
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
                        <button onClick={() => handleDeleteFile(index)} className="delete-btn">
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
              <p>List of recently uploaded documents</p>
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
                {uploadedFiles.length > 0 ? (
                  uploadedFiles.map((file, index) => (
                    <tr key={index}>
                      <td>{file.fileName}</td>
                      <td>
                        <span className={`badge ${file.status?.toLowerCase().replace(" ", "-")}`}>
                          {file.status}
                        </span>
                      </td>
                      <td>{formatDate(file.uploadedAt)}</td>
                      <td>{new Date(file.uploadedAt).toLocaleDateString()}</td>
                      <td>
                        <button className="action-btn">View</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center" }}>
                      No documents uploaded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
 
      <footer><Footer /></footer>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};
 
export default Dashboard;