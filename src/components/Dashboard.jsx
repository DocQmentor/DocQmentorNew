import React, { useRef, useState, useEffect } from "react";
import "./Dashboard.css";
// import Filepagination from "../Layout/Filepagination.jsx";
import {
  Upload,
  Trash2,
  FileText,
  CheckCircle, 
  Clock,
  AlertTriangle,
  Funnel,
} from "lucide-react";
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
// import FilePagination from "../Layout/Filepagination.jsx";
import FilePagination from "../Layout/FilePagination";
const Dashboard = () => {
  const hasAccess = useGroupAccess();
  const { accounts } = useMsal();
  const currentUser = {
    id: accounts[0]?.username || "unknown@user.com",
    name: accounts[0]?.name || "Unknown User",
  };

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [myFiles, setMyFiles] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const documentsPerPage = 10;
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { email, name } = useUser();

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

  useEffect(() => {
    const localUploads = JSON.parse(localStorage.getItem("myUploads") || "[]");
    setMyFiles(localUploads);
  }, []);
  const hasAllMandatoryFields = (doc) => {
    if (!doc || !doc.extractedData) return false;
    const requiredFields = [
      "VendorName",
      "InvoiceId",
      "InvoiceDate",
      "LPO NO",
      "SubTotal",
      "VAT",
      "InvoiceTotal",
    ];
    return requiredFields.every((field) => {
      const value = doc.extractedData[field];
      return (
        value !== undefined && value !== null && String(value).trim() !== ""
      );
    });
  };

  const determineStatus = (doc) => {
    if (
      doc.status === "Reviewed" ||
      doc.reviewStatus === "Reviewed" ||
      doc.reviewedBy
    ) {
      return "Reviewed";
    }
    if (!doc || !doc.extractedData || !doc.confidenceScores) {
      return "Manual Review";
    }
    const scoreStr = String(doc.totalConfidenceScore || "").toLowerCase();
    if (scoreStr.includes("reviewed")) return "Reviewed";
    if (!hasAllMandatoryFields(doc)) return "Manual Review";
    const scores = Object.values(doc.confidenceScores || {});
    if (scores.length === 0) return "Manual Review";
    const avg =
      scores.reduce((sum, val) => sum + Number(val), 0) / scores.length;
    return avg >= 0.85 ? "Completed" : "Manual Review";
  };

  useEffect(() => {
    const fetchDocumentsFromBackend = async () => {
      try {
        const response = await fetch(
          "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
        );
        if (!response.ok) throw new Error("Failed to fetch document data");

        const documents = await response.json();
        const withStatus = documents.map((doc) => ({
          ...doc,
          status: determineStatus(doc),
        }));

        setAllDocuments(withStatus);
        const localUploads = JSON.parse(
          localStorage.getItem("myUploads") || "[]"
        );

        const updatedFiles = localUploads.map((localFile) => {
          let backendDoc = withStatus.find(
            (doc) => doc.uploadId === localFile.uploadId
          );
          if (!backendDoc) {
            backendDoc = withStatus.find(
              (doc) =>
                doc.documentName === localFile.fileName ||
                doc.fileName === localFile.fileName
            );
          }

          const isReviewed =
            backendDoc?.status === "Reviewed" ||
            backendDoc?.reviewStatus === "Reviewed" ||
            backendDoc?.reviewedBy;

          return {
            ...localFile,
            status: isReviewed
              ? "Reviewed"
              : determineStatus(backendDoc || localFile),
            url: backendDoc?.fileUrl?.includes("?")
              ? backendDoc.fileUrl
              : `${backendDoc?.fileUrl || localFile.url}${sasToken}`,
            processedData: backendDoc || localFile.processedData,
          };
        });

        withStatus.forEach((backendDoc) => {
          const exists = updatedFiles.some(
            (file) =>
              file.uploadId === backendDoc.uploadId ||
              file.fileName === (backendDoc.documentName || backendDoc.fileName)
          );
          if (!exists) {
            const isReviewed =
              backendDoc.status === "Reviewed" ||
              backendDoc.reviewStatus === "Reviewed" ||
              backendDoc.reviewedBy;

            updatedFiles.push({
              fileName: backendDoc.documentName || backendDoc.fileName,
              status: isReviewed ? "Reviewed" : determineStatus(backendDoc),
              uploadedAt: backendDoc.processedAt || new Date().toISOString(),
              url: backendDoc.fileUrl?.includes("?")
                ? backendDoc.fileUrl
                : `${backendDoc.fileUrl}${sasToken}`,
              processedData: backendDoc,
              uploadId:
                backendDoc.uploadId ||
                `${
                  backendDoc.documentName || backendDoc.fileName
                }-${Date.now()}`,
            });
          }
        });

        const latest50 = updatedFiles
          .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
          .slice(0, 50);

        setMyFiles(latest50);
        
        // Only store minimal metadata in localStorage to avoid quota overflow
        const safeUploads = latest50.map(
          ({ fileName, uploadId, uploadedAt, status, url }) => ({
            fileName,
            uploadId,
            uploadedAt,
            status,
            url,
          })
        );
        localStorage.setItem("myUploads", JSON.stringify(safeUploads));
      } catch (error) {
        console.error("Error loading backend documents:", error);
      }
    };

    fetchDocumentsFromBackend();
    const intervalId = setInterval(fetchDocumentsFromBackend, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const getFilteredDocuments = () => {
    if (!selectedVendor) return allDocuments;
    return allDocuments.filter((doc) =>
      (doc.documentName || "")
        .toLowerCase()
        .includes(selectedVendor.toLowerCase())
    );
  };
  const getFilteredRecentDocuments = () => {
  const userEmail = email || currentUser.id;

  return allDocuments
    .filter((doc) => doc.uploadedBy?.id === userEmail)
    .filter((doc) => {
      if (!selectedVendor) return true;
      const docName = doc.documentName || doc.fileName;
      return docName.toLowerCase().includes(selectedVendor.toLowerCase());
    })
    .sort((a, b) => new Date(b.processedAt || b.uploadedAt) - new Date(a.processedAt || a.uploadedAt));
  };

  const getDocumentStats = () => {
    const filteredDocs = getFilteredDocuments();
    const total = filteredDocs.length;
    let completed = 0;
    let manualReview = 0;
    let inProcess = 0;

    filteredDocs.forEach((doc) => {
      const status = determineStatus(doc);
      if (status === "Completed" || status === "Reviewed") completed++;
      else if (status === "Manual Review") manualReview++;
      else inProcess++;
    });

    return { total, completed, inProcess, manualReview };
  };

  const handleVendorChange = (e) => {
    setSelectedVendor(e.target.value);
    setCurrentPage(1);
  };

  const FileChange = (e) => {
    const newFiles = Array.from(e.target.files).map((file) => ({
      file,
      fileName: file.name,
      uploadId: `${file.name}-${Date.now()}`,
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
  // const handleDeleteMyUpload = (uploadId) => {
  //   const updatedFiles = myFiles.filter((file) => file.uploadId !== uploadId);
  //   setMyFiles(updatedFiles);
  //   localStorage.setItem("myUploads", JSON.stringify(updatedFiles));
  //   toast.success("Document removed from recent uploads.");
  // };
  const handleClick = () => {
    fileInputRef.current.click();
  };

 const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    const uploadToastId = toast.loading("Uploading files...");

    const updatedMyFiles = [...myFiles];

    for (const fileObj of selectedFiles) {
      try {
        const result = await uploadToAzure(fileObj.file, (percent) => {
          toast.update(uploadToastId, {
            render: `Uploading ${fileObj.fileName}: ${percent}%`,
            isLoading: percent < 100,
          });
        });

        toast.success(`${fileObj.fileName} uploaded successfully!`);

        const payload = {
          documentName: fileObj.fileName,
          blobUrl: result.url,
          uploadedBy: { id: email || currentUser.id, name: name || currentUser.name },
          versionHistory: [
            {
              version: 1,
              action: "Uploaded",
              timestamp: new Date().toISOString(),
              user: { id: email || currentUser.id, name: name || currentUser.name },
            },
          ],
          uploadId: fileObj.uploadId,
        };

        await fetch("https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA==", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        updatedMyFiles.unshift({
          fileName: fileObj.fileName,
          uploadId: fileObj.uploadId,
          uploadedAt: new Date().toISOString(),
          status: "In Process",
          url: result.url,
          processedData: payload,
        });

      } catch (err) {
        console.error(`Error uploading ${fileObj.fileName}:`, err);
        toast.error(`Failed to upload ${fileObj.fileName}`);
      }
    }

    setMyFiles(updatedMyFiles);
    setSelectedFiles([]);
    setIsUploading(false);
    toast.dismiss(uploadToastId);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown time";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown time";

    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minute ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hour ago`;

    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

const recentDocs = getFilteredRecentDocuments();
const totalItems = recentDocs.length;
const indexOfLast = currentPage * documentsPerPage;
const indexOfFirst = indexOfLast - documentsPerPage;
const currentDocs = recentDocs.slice(indexOfFirst, indexOfLast);
const totalPages = Math.ceil(totalItems / documentsPerPage); 

  const stats = getDocumentStats();

  const handleManualReviewClick = () => {
    if (hasAccess === true) {
      const manualReviewDocs = allDocuments.filter(
        (doc) => determineStatus(doc) === "Manual Review"
      );
      if (manualReviewDocs.length === 0) {
        toast.info("No documents require manual review");
        return;
      }
      navigate("/manualreview", {
        state: {
          manualReviewDocs,
          selectedVendor,
        },
      });
    } else {
      toast.error(
        "You do not have permission to view this Manual Review page."
      );
    }
  };

 const handleViewDocument = (file) => {
  let url = null;
  if (file.blobUrl && file.blobUrl.startsWith("http")) {
    url = file.blobUrl;
  } else if (file.url && file.url.startsWith("http")) {
    url = file.url;
  } else if (file.processedData?.blobUrl) {
    url = file.processedData.blobUrl;
  }

  if (url) {
    window.open(url, "_blank");
  } else {
    toast.error("File URL is not available");
    console.warn("⚠️ Cannot open file. Data:", file);
  }
};


  return (
    <div className="dashboard-total-container">
      <header className="header">
        <Header />
      </header>
      <div className="Dashboard-main-section">
        <nav className="vendor-select">
          <div>
            <h1 className="dashboard-heading">Dashboard</h1>

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
            <button 
              className="Dashboard-reset-button"
              onClick={() => {
                setSelectedVendor("");
                setCurrentPage(1);
              }}
            >
              <Funnel className="i-Reset-Dashboard" size={16} />Reset
            </button>
          </div>
        </nav>

        <main className="stats-container">
          <div className="stat-box Total">
            <FileText className="i" size={24} />
            <p>Total</p>
            <div className="total">{stats.total}</div>
          </div>
          <div className="stat-box completed">
            <CheckCircle className="i" size={24} />
            <p>Completed</p>
            <div className="total">{stats.completed}</div>
          </div>
          <div className="stat-box inprocess">
            <Clock className="i" size={24} />
            <p>In Process</p>
            <div className="total">{stats.inProcess}</div>
          </div>
          <div
            className="stat-box manual-review"
            onClick={handleManualReviewClick}
          >
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
                  e.stopPropagation();
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
                  <th>
                    <span className="sortable-header">Name</span>
                  </th>
                  <th>
                    <span className="sortable-header">Status</span>
                  </th>
                  <th>
                    <span className="sortable-header">Uploaded</span>
                  </th>
                  <th>
                    <span className="sortable-header">Date</span>
                  </th>
                  <th>
                    <span className="sortable-header">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentDocs.length > 0 ? (
                  currentDocs.map((file, index) => (
                    <tr key={index}>
                    <td>{file.documentName || file.fileName}</td>
                    <td>
                      <span className={`badge ${determineStatus(file)?.toLowerCase().replace(" ", "-")}`}>
                        {determineStatus(file)}
                      </span>
                    </td>
                    <td>{formatDate(file.processedAt || file.uploadedAt)}</td>
                    <td>{new Date(file.processedAt || file.uploadedAt).toLocaleDateString()}</td>
                    <td>
                      <button className="action-btn" onClick={() => handleViewDocument(file)}>
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
            {/* <div className="pagination">
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
            </div> */}
            <FilePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              rowsPerPage={documentsPerPage}
              totalItems={totalItems}
            />
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
