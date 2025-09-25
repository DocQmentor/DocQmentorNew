// import React, { useRef, useState, useEffect } from "react";
// import "./Dashboard.css";
// import {
//   Upload,
//   Trash2,
//   FileText,
//   CheckCircle,
//   Clock,
//   AlertTriangle,
// } from "lucide-react";
// import { v4 as uuidv4 } from "uuid";
// import { useNavigate } from "react-router-dom";
// import { uploadToAzure } from "../utils/azureUploader";
// import Header from "../Layout/Header";
// import Footer from "../Layout/Footer";
// import { toast, ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
// import { getVendorFolders } from "../utils/blobService";
// import { useMsal } from "@azure/msal-react";
// import { useUser } from "../context/UserContext";
// import { sasToken } from "../sasToken";
// import useGroupAccess from "../utils/userGroupAccess";
// const Dashboard = () => {
//   const hasAccess = useGroupAccess();
//   const { accounts } = useMsal();
//   const currentUser = {
//     id: accounts[0]?.username || "unknown@user.com",
//     name: accounts[0]?.name || "Unknown User",
//   };

//   const [selectedFiles, setSelectedFiles] = useState([]);
//   // const [myFiles, setMyFiles] = useState([]);
//   const [allDocuments, setAllDocuments] = useState([]);
//   const [isUploading, setIsUploading] = useState(false);
//   const [vendors, setVendors] = useState([]);
//   const [selectedVendor, setSelectedVendor] = useState("");
//   const [currentPage, setCurrentPage] = useState(1);
//   const [modelType, setmodelType] = useState("");
//   const selectedmodelType = localStorage.getItem("selectedmodelType") || "Invoice";

//   const documentsPerPage = 10;
//   const fileInputRef = useRef(null);
//   const navigate = useNavigate();
//   const { email, name } = useUser();
//   useEffect(() => {
//     const selectedmodelType = localStorage.getItem("selectedmodelType");
//     if (selectedmodelType) {
//       setmodelType(selectedmodelType);
//     } else {
//       navigate("/select-document-type");
//     }
//   }, []);

//   useEffect(() => {
//     const fetchVendors = async () => {
//       try {
//         const list = await getVendorFolders();
//         setVendors(list);
//       } catch (error) {
//         console.error("Error fetching vendors", error);
//       }
//     };
//     fetchVendors();
//   }, []);

//   useEffect(() => {
//     const localUploads = JSON.parse(localStorage.getItem("myUploads") || "[]");
//     setMyFiles(localUploads);
//   }, []);

//   const hasAllMandatoryFields = (doc) => {
//     if (!doc || !doc.extractedData) return false;
//     const requiredFields = [
//       "VendorName",
//       "InvoiceId",
//       "InvoiceDate",
//       "LPO NO",
//       "SubTotal",
//       "VAT",
//       "InvoiceTotal",
//     ];
//     return requiredFields.every((field) => {
//       const value = doc.extractedData[field];
//       return (
//         value !== undefined && value !== null && String(value).trim() !== ""
//       );
//     });
//   };

//   const determineStatus = (doc) => {
//     if (
//       doc.status === "Reviewed" ||
//       doc.reviewStatus === "Reviewed" ||
//       doc.reviewedBy
//     ) {
//       return "Reviewed";
//     }
//     if (!doc || !doc.extractedData || !doc.confidenceScores) {
//       return "Manual Review";
//     }
//     const scoreStr = String(doc.totalConfidenceScore || "").toLowerCase();
//     if (scoreStr.includes("reviewed")) return "Reviewed";
//     if (!hasAllMandatoryFields(doc)) return "Manual Review";
//     const scores = Object.values(doc.confidenceScores || {});
//     if (scores.length === 0) return "Manual Review";
//     const avg =
//       scores.reduce((sum, val) => sum + Number(val), 0) / scores.length;
//     return avg >= 0.85 ? "Completed" : "Manual Review";
//   };

//   useEffect(() => {
//     const fetchDocumentsFromBackend = async () => {
//       try {
//         const response = await fetch(
//           " https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
//         );
//         if (!response.ok) throw new Error("Failed to fetch document data");

//         const documents = await response.json();
//         const withStatus = documents.map((doc) => ({
//           ...doc,
//           status: determineStatus(doc),
//         }));
//         // ✅ filter by modelType and user right after fetch
//         const userEmail = email || currentUser.id;
//         const filteredDocs = withStatus.filter(
//           (doc) =>
//             doc.modelType === modelType &&
//             (doc.uploadedBy?.id?.toLowerCase() === userEmail.toLowerCase() ||
//               doc.uploadedBy?.toLowerCase() === userEmail.toLowerCase())
//         );

//         setAllDocuments(filteredDocs);

//         const localUploads = JSON.parse(
//           localStorage.getItem("myUploads") || "[]"
//         );

//         const updatedFiles = localUploads.map((localFile) => {
//           let backendDoc = withStatus.find(
//             (doc) => doc.uploadId === localFile.uploadId
//           );
//           if (!backendDoc) {
//             backendDoc = withStatus.find(
//               (doc) =>
//                 doc.documentName === localFile.fileName ||
//                 doc.fileName === localFile.fileName
//             );
//           }

//           const isReviewed =
//             backendDoc?.status === "Reviewed" ||
//             backendDoc?.reviewStatus === "Reviewed" ||
//             backendDoc?.reviewedBy;

//           return {
//             ...localFile,
//             status: isReviewed
//               ? "Reviewed"
//               : determineStatus(backendDoc || localFile),
//             url: backendDoc?.fileUrl?.includes("?")
//               ? backendDoc.fileUrl
//               : `${backendDoc?.fileUrl || localFile.url}${sasToken}`,
//             processedData: backendDoc || localFile.processedData,
//           };
//         });

//         withStatus.forEach((backendDoc) => {
//           const exists = updatedFiles.some(
//             (file) =>
//               file.uploadId === backendDoc.uploadId ||
//               file.fileName === (backendDoc.documentName || backendDoc.fileName)
//           );
//           if (!exists) {
//             const isReviewed =
//               backendDoc.status === "Reviewed" ||
//               backendDoc.reviewStatus === "Reviewed" ||
//               backendDoc.reviewedBy;

//             updatedFiles.push({
//               fileName: backendDoc.documentName || backendDoc.fileName,
//               status: isReviewed ? "Reviewed" : determineStatus(backendDoc),
//               uploadedAt: backendDoc.processedAt || new Date().toISOString(),
//               url: backendDoc.fileUrl?.includes("?")
//                 ? backendDoc.fileUrl
//                 : `${backendDoc.fileUrl}${sasToken}`,
//               processedData: backendDoc,
//               uploadId:
//                 backendDoc.uploadId ||
//                 `${
//                   backendDoc.documentName || backendDoc.fileName
//                 }-${Date.now()}`,
//             });
//           }
//         });

//         setMyFiles(updatedFiles);
//         localStorage.setItem("myUploads", JSON.stringify(updatedFiles));
//       } catch (error) {
//         console.error("Error loading backend documents:", error);
//       }
//     };

//     fetchDocumentsFromBackend();
//     const intervalId = setInterval(fetchDocumentsFromBackend, 10000);
//     return () => clearInterval(intervalId);
//   }, []);
//   // const getFilteredDocuments = () => {
//   //   if (!selectedVendor) return allDocuments;
//   //   return allDocuments.filter((doc) =>
//   //     (doc.documentName || "")
//   //       .toLowerCase()
//   //       .includes(selectedVendor.toLowerCase())
//   //   );
//   // };

//   // const getFilteredMyFiles = () => {
//   //   const userEmail = email || currentUser.id;

//   //   return myFiles
//   //     .filter((file) => {
//   //       const uploadedBy =
//   //         file.processedData?.uploadedBy?.id ||
//   //         file.uploadedBy?.id ||
//   //         file.uploadedBy;
//   //       return uploadedBy === userEmail;
//   //     })
//   //     .filter((file) => {
//   //       if (!selectedVendor) return true;
//   //       const docName = file.processedData?.documentName || file.fileName;
//   //       return docName.toLowerCase().includes(selectedVendor.toLowerCase());
//   //     });
//   // };
//   const getFilteredDocuments = () => {
//     return allDocuments.filter((doc) => doc.modelType === modelType);
//   };

//   const getFilteredMyFiles = () => {
//   const userEmail = (email || currentUser.id).toLowerCase();
//   return myFiles.filter((file) => {
//     const fileUser =
//       (file.processedData?.uploadedBy?.id ||
//         file.uploadedBy?.id ||
//         file.uploadedBy || "")
//         .toLowerCase();

//     const filemodelType =
//       (file.processedData?.modelType || file.modelType || "").toLowerCase();

//     return fileUser === userEmail && filemodelType === modelType.toLowerCase();
//   });
// };


//   const getDocumentStats = () => {
//     const filteredDocs = getFilteredDocuments();
//     const total = filteredDocs.length;
//     let completed = 0;
//     let manualReview = 0;
//     let inProcess = 0;

//     filteredDocs.forEach((doc) => {
//       const status = determineStatus(doc);
//       if (status === "Completed" || status === "Reviewed") completed++;
//       else if (status === "Manual Review") manualReview++;
//       else inProcess++;
//     });

//     return { total, completed, inProcess, manualReview };
//   };

//   const handleVendorChange = (e) => {
//     setSelectedVendor(e.target.value);
//     setCurrentPage(1);
//   };

//   // const FileChange = (e) => {
//   //   const newFiles = Array.from(e.target.files).map((file) => ({
//   //     file,
//   //     fileName: file.name,
//   //     uploadId: `${file.name}-${Date.now()}`,
//   //     uploadedAt: new Date().toISOString(),
//   //     status: "In Process",
//   //     url: null,
//   //   }));
//   //   setSelectedFiles((prev) => [...prev, ...newFiles]);
//   // };
//   const FileChange = (e) => {
//     const newFiles = Array.from(e.target.files).map((file) => ({
//       file,
//       fileName: file.name,
//       uploadId: uuidv4(), // Use the unique UUID here
//       uploadedAt: new Date().toISOString(),
//       status: "In Process",
//       url: null,
//     }));
//     setSelectedFiles((prev) => [...prev, ...newFiles]);
//   };
//   const handleDeleteFile = (index) => {
//     const updated = [...selectedFiles];
//     updated.splice(index, 1);
//     setSelectedFiles(updated);
//   };

//   const handleClick = () => {
//     fileInputRef.current.click();
//   };

//   const handleProcessFiles = async () => {
//     if (selectedFiles.length === 0) return;
//     setIsUploading(true);

//     const localUploads = JSON.parse(localStorage.getItem("myUploads") || "[]");

//     for (const fileObj of selectedFiles) {
//       const toastId = toast.info(`Uploading ${fileObj.fileName}...`, {
//         autoClose: 1000,
//       });

//       try {
//         const result = await uploadToAzure(
//           fileObj.file,
//           modelType,
//           email || currentUser.id,
//           name || currentUser.name,
//           (percent) => {
//             toast.update(toastId, {
//               render: `${fileObj.fileName} uploading: ${percent}%`,
//               isLoading: percent < 100,
//               autoClose: percent >= 100 ? 2000 : false,
//             });
//           },
//           selectedmodelType
//         );

//         toast.success(`${fileObj.fileName} uploaded successfully!`);

//         // Update localStorage/UI
//         const updatedUploads = [...localUploads, result];
//         setMyFiles(updatedUploads);
//         localStorage.setItem("myUploads", JSON.stringify(updatedUploads));
//       } catch (err) {
//         console.error(err);
//         toast.error(`Failed to upload ${fileObj.fileName}`);
//       }
//     }

//     setSelectedFiles([]);
//     setIsUploading(false);
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return "Unknown time";
//     const date = new Date(dateString);
//     if (isNaN(date.getTime())) return "Unknown time";
//     const now = new Date();
//     const diffInSeconds = Math.floor((now - date) / 1000);
//     if (diffInSeconds < 60) return "Just now";
//     if (diffInSeconds < 3600)
//       return `${Math.floor(diffInSeconds / 60)} minutes ago`;
//     if (diffInSeconds < 86400)
//       return `${Math.floor(diffInSeconds / 3600)} hours ago`;
//     return date.toLocaleString();
//   };

//   const filteredMyFiles = getFilteredMyFiles()
//     .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
//     .slice(0, 50);

//   const indexOfLast = currentPage * documentsPerPage;
//   const indexOfFirst = indexOfLast - documentsPerPage;
//   const currentDocs = filteredMyFiles.slice(indexOfFirst, indexOfLast);
//   const totalPages = Math.ceil(filteredMyFiles.length / documentsPerPage);
//   const stats = getDocumentStats();

//   const handleManualReviewClick = () => {
//     if (hasAccess === true) {
//       const manualReviewDocs = allDocuments.filter(
//         (doc) => determineStatus(doc) === "Manual Review"
//       );
//       if (manualReviewDocs.length === 0) {
//         toast.info("No documents require manual review");
//         return;
//       }
//       navigate("/manualreview", {
//         state: {
//           manualReviewDocs,
//           selectedVendor,
//         },
//       });
//     } else {
//       toast.error(
//         "You do not have permission to view this Manual Review page."
//       );
//     }
//   };

//   const handleViewDocument = (file) => {
//     let rawUrl = file.blobUrl || file.url || file.processedData?.blobUrl;

//     if (!rawUrl || !rawUrl.startsWith("http")) {
//       toast.error("File URL is not available");
//       return;
//     }

//     const baseUrl = rawUrl.split("?")[0];
//     const cleanSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
//     const finalUrl = `${baseUrl}${cleanSasToken}`;

//     window.open(finalUrl, "_blank");
//   };

//   return (
//     <div className="dashboard-total-container">
//       <header className="header">
//         <Header />
//       </header>
//       <div className="Dashboard-main-section">
//         <nav className="vendor-select">
//           <div>
//             <h2>{modelType} Dashboard</h2>
//             <p>Showing documents for {modelType}</p>

//             <p>View your document processing activity and insights</p>
//           </div>
//           <div className="Dashboard-main-section-vendor-select">
//             <label className="select">Select Vendor:</label>
//             <select
//               className="vendor-dropdown"
//               value={selectedVendor}
//               onChange={handleVendorChange}
//             >
//               <option value="">All Vendors</option>
//               {vendors.map((vendor, i) => (
//                 <option key={i} value={vendor}>
//                   {vendor}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </nav>

//         <main className="stats-container">
//           <div className="stat-box Total">
//             <FileText className="i" size={24} />
//             <p>Total</p>
//             <div className="total">{stats.total}</div>
//           </div>
//           <div className="stat-box completed">
//             <CheckCircle className="i" size={24} />
//             <p>Completed</p>
//             <div className="total">{stats.completed}</div>
//           </div>
//           <div className="stat-box inprocess">
//             <Clock className="i" size={24} />
//             <p>In Process</p>
//             <div className="total">{stats.inProcess}</div>
//           </div>
//           <div
//             className="stat-box manual-review"
//             onClick={handleManualReviewClick}
//           >
//             <AlertTriangle className="i" size={24} />
//             <p>Manual Review</p>
//             <div className="total">{stats.manualReview}</div>
//           </div>
//         </main>

//         <div className="Dashboard-upload-table-section">
//           <div className="upload-section">
//             <div className="upload-section-header-contants">
//               <h3>Upload Documents</h3>
//               <p>Upload documents for AI-powered data extraction</p>
//             </div>
//             <div className="input-section" onClick={handleClick}>
//               <Upload className="Upload" size={48} />
//               <h3 className="upload-section-h3">
//                 Drop files here or click to upload
//               </h3>
//               <p className="mb-4">Support for PDF, Word, JPG, PNG files</p>
//               <input
//                 type="file"
//                 ref={fileInputRef}
//                 style={{ display: "none" }}
//                 multiple
//                 onChange={FileChange}
//                 accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
//               />
//               <label
//                 className="btn btn-outline"
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   fileInputRef.current.click();
//                 }}
//               >
//                 <Upload size={16} className="selecte-icon" /> Select Files
//               </label>
//             </div>
//             <div className="file-load-section">
//               {selectedFiles.length > 0 && (
//                 <>
//                   <ul>
//                     {selectedFiles.map((fileObj, index) => (
//                       <li key={index}>
//                         {fileObj.fileName}
//                         <button
//                           onClick={() => handleDeleteFile(index)}
//                           className="delete-btn"
//                         >
//                           <Trash2 size={16} />
//                         </button>
//                       </li>
//                     ))}
//                   </ul>
//                   <button
//                     className="process-btn"
//                     onClick={handleProcessFiles}
//                     disabled={isUploading}
//                   >
//                     {isUploading ? "Uploading..." : "Process Files"}
//                   </button>
//                 </>
//               )}
//             </div>
//           </div>

//           <div className="status-section">
//             <div className="status-header">
//               <h3>Recent Documents</h3>
//               <p>
//                 {selectedVendor
//                   ? `Documents for vendor: ${selectedVendor}`
//                   : "List of your uploaded documents"}
//               </p>
//             </div>
//             <table>
//               <thead>
//                 <tr>
//                   <th>Name</th>
//                   <th>Status</th>
//                   <th>Uploaded</th>
//                   <th>Date</th>
//                   <th>Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {currentDocs.length > 0 ? (
//                   currentDocs.map((file, index) => (
//                     <tr key={index}>
//                       <td>{file.fileName}</td>
//                       <td>
//                         <span
//                           className={`badge ${file.status
//                             ?.toLowerCase()
//                             .replace(" ", "-")}`}
//                         >
//                           {file.status}
//                         </span>
//                       </td>
//                       <td>{formatDate(file.uploadedAt)}</td>
//                       <td>{new Date(file.uploadedAt).toLocaleDateString()}</td>
//                       <td>
//                         <button
//                           className="action-btn"
//                           onClick={() => handleViewDocument(file)}
//                         >
//                           View
//                         </button>
//                       </td>
//                     </tr>
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan="5" style={{ textAlign: "center" }}>
//                       {selectedVendor
//                         ? `No documents found for vendor: ${selectedVendor}`
//                         : "No documents uploaded yet"}
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//             <div className="pagination">
//               {Array.from({ length: totalPages }, (_, i) => (
//                 <button
//                   key={i}
//                   className={`page-btn ${
//                     currentPage === i + 1 ? "active" : ""
//                   }`}
//                   onClick={() => setCurrentPage(i + 1)}
//                 >
//                   {i + 1}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//       <footer>
//         <Footer />
//       </footer>
//       <ToastContainer />
//     </div>
//   );
// };

// export default Dashboard;
// import React, { useRef, useState, useEffect } from "react";
// import "./Dashboard.css";
// import Filepagination from "../Layout/Filepagination.jsx";
// import {
//   Upload,
//   Trash2,
//   FileText,
//   CheckCircle, 
//   Clock,
//   AlertTriangle,
//   Funnel,
// } from "lucide-react";
// import { v4 as uuidv4 } from "uuid";
// import { useNavigate } from "react-router-dom";
// import { uploadToAzure } from "../utils/azureUploader";
// import Header from "../Layout/Header";
// import Footer from "../Layout/Footer";
// import { toast, ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
// import { getVendorFolders } from "../utils/blobService";
// import { useMsal } from "@azure/msal-react";
// import { useUser } from "../context/UserContext";
// import { sasToken } from "../sasToken";
// import useGroupAccess from "../utils/userGroupAccess";

// const Dashboard = () => {
//   const hasAccess = useGroupAccess();
//   const { accounts } = useMsal();
//   const currentUser = {
//     id: accounts[0]?.username || "unknown@user.com",
//     name: accounts[0]?.name || "Unknown User",
//   };

//   const [selectedFiles, setSelectedFiles] = useState([]);
//   const [allDocuments, setAllDocuments] = useState([]);
//   const [isUploading, setIsUploading] = useState(false);
//   const [vendors, setVendors] = useState([]);
//   const [selectedVendor, setSelectedVendor] = useState("");
//   const [currentPage, setCurrentPage] = useState(1);
//   const [modelType, setModelType] = useState("");

//   const selectedmodelType = localStorage.getItem("selectedModelType") || "Invoice"; // ✅ keep only modelType
//   const documentsPerPage = 10;
//   const fileInputRef = useRef(null);
//   const navigate = useNavigate();
//   const { email, name } = useUser();

//   // Load modelType from localStorage
//   useEffect(() => {
//     const storedmodelType = localStorage.getItem("selectedModelType");
//     if (storedmodelType) {
//       setModelType(storedmodelType);
//     } else {
//       navigate("/select-document-type");
//     }
//   }, []);

//   // Fetch vendors list from blob
// useEffect(() => {
//   const fetchVendors = async () => {
//     if (!modelType) {
//       setVendors([]);
//       return;
//     }
//     try {
//       // getVendorFolders now accepts modelType and returns vendor folder names
//       const list = await getVendorFolders(modelType);
//       setVendors(list || []);
//     } catch (error) {
//       console.error("Error fetching vendors for modelType", modelType, error);
//       setVendors([]);
//     }
//   };

//   fetchVendors();
// }, [modelType]);


//   const hasAllMandatoryFields = (doc) => {
//     if (!doc || !doc.extractedData) return false;
//     const requiredFields = [
//       "VendorName",
//       "InvoiceId",
//       "InvoiceDate",
//       "LPO NO",
//       "SubTotal",
//       "VAT",
//       "InvoiceTotal",
//       //  "AccountHolder","AccountNumber","StatementPeriod","OpeningBalance","ClosingBalance"
//       // "Lendername", "Borrowername", "Loanamount", "Loantenure", "Interest",

//     ];
//     return requiredFields.every((field) => {
//       const value = doc.extractedData[field];
//       return (
//         value !== undefined && value !== null && String(value).trim() !== ""
//       );
//     });
//   };

//   const determineStatus = (doc) => {
//     if (
//       doc.status === "Reviewed" ||
//       doc.reviewStatus === "Reviewed" ||
//       doc.reviewedBy
//     ) {
//       return "Reviewed";
//     }
//     if (!doc || !doc.extractedData || !doc.confidenceScores) {
//       return "Manual Review";
//     }
//     const scoreStr = String(doc.totalConfidenceScore || "").toLowerCase();
//     if (scoreStr.includes("reviewed")) return "Reviewed";
//     if (!hasAllMandatoryFields(doc)) return "Manual Review";
//     const scores = Object.values(doc.confidenceScores || {});
//     if (scores.length === 0) return "Manual Review";
//     const avg =
//       scores.reduce((sum, val) => sum + Number(val), 0) / scores.length;
//     return avg >= 0.85 ? "Completed" : "Manual Review";
//   };

//   // ✅ fetch only from backend (no localStorage)
// //   useEffect(() => {
// //     const fetchDocumentsFromBackend = async () => {
// //       try {
// //         const response = await fetch(
// //           "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
// //         );
// //         if (!response.ok) throw new Error("Failed to fetch document data");

// //         const documents = await response.json();
// //         const withStatus = documents.map((doc) => ({
// //           ...doc,
// //           status: determineStatus(doc),
// //         }));

// //         const userEmail = email || currentUser.id;

// //         // ✅ filter docs by modelType + user only
// //         // const filteredDocs = withStatus.filter(
// //         //   (doc) =>
// //         //     doc.modelType?.toLowerCase() === modelType.toLowerCase() &&
// //         //     (doc.uploadedBy?.id?.toLowerCase() === userEmail.toLowerCase() ||
// //         //       doc.uploadedBy?.toLowerCase() === userEmail.toLowerCase())
// //         // );
// //         const filteredDocs = withStatus.filter((doc) => {
// //   const uploader =
// //     typeof doc.uploadedBy === "string"
// //       ? doc.uploadedBy
// //       : doc.uploadedBy?.id;

// //   return (
// //     doc.modelType?.toLowerCase() === modelType.toLowerCase() &&
// //     uploader?.toLowerCase() === userEmail.toLowerCase()
// //   );
// // });


// //         setAllDocuments(filteredDocs);
// //       } catch (error) {
// //         console.error("Error loading backend documents:", error);
// //       }
// //     };

// //     fetchDocumentsFromBackend();
// //     const intervalId = setInterval(fetchDocumentsFromBackend, 10000);
// //     return () => clearInterval(intervalId);
// //   }, [modelType, email, currentUser]);
// useEffect(() => {
//   let isMounted = true;

//   const fetchDocumentsFromBackend = async () => {
//     try {
//       const response = await fetch(
//         "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
//       );
//       if (!response.ok) throw new Error("Failed to fetch document data");

//       const documents = await response.json();
//       const withStatus = documents.map((doc) => ({
//         ...doc,
//         status: determineStatus(doc),
//       }));

//       const userEmail = email || currentUser.id;
//       const filteredDocs = withStatus.filter((doc) => {
//         const uploader =
//           typeof doc.uploadedBy === "string" ? doc.uploadedBy : doc.uploadedBy?.id;

//         return (
//           doc.modelType?.toLowerCase() === modelType.toLowerCase() &&
//           uploader?.toLowerCase() === userEmail.toLowerCase()
//         );
//       });

//       if (isMounted) setAllDocuments(filteredDocs);
//     } catch (error) {
//       console.error("Error loading backend documents:", error);
//     }
//   };

//   fetchDocumentsFromBackend();

//   // ✅ interval set only once
//   const intervalId = setInterval(fetchDocumentsFromBackend, 10000);

//   return () => {
//     isMounted = false;
//     clearInterval(intervalId);
//   };
// }, [modelType]); // 🔑 remove `email` & `currentUser` from deps


//   const getFilteredDocuments = () => {
//     if (!selectedVendor) return allDocuments;
//     return allDocuments.filter((doc) =>
//       (doc.documentName || "").toLowerCase().includes(selectedVendor.toLowerCase())
//     );
//   };

//   const getDocumentStats = () => {
//     const filteredDocs = getFilteredDocuments();
//     const total = filteredDocs.length;
//     let completed = 0;
//     let manualReview = 0;
//     let inProcess = 0;

//     filteredDocs.forEach((doc) => {
//       const status = determineStatus(doc);
//       if (status === "Completed" || status === "Reviewed") completed++;
//       else if (status === "Manual Review") manualReview++;
//       else inProcess++;
//     });

//     return { total, completed, inProcess, manualReview };
//   };

//   const handleVendorChange = (e) => {
//     setSelectedVendor(e.target.value);
//     setCurrentPage(1);
//   };

//   const FileChange = (e) => {
//     const newFiles = Array.from(e.target.files).map((file) => ({
//       file,
//       fileName: file.name,
//       uploadId: uuidv4(),
//       uploadedAt: new Date().toISOString(),
//       status: "In Process",
//       url: null,
//     }));
//     setSelectedFiles((prev) => [...prev, ...newFiles]);
//   };

//   const handleDeleteFile = (index) => {
//     const updated = [...selectedFiles];
//     updated.splice(index, 1);
//     setSelectedFiles(updated);
//   };
//   // const handleDeleteMyUpload = (uploadId) => {
//   //   const updatedFiles = myFiles.filter((file) => file.uploadId !== uploadId);
//   //   setMyFiles(updatedFiles);
//   //   localStorage.setItem("myUploads", JSON.stringify(updatedFiles));
//   //   toast.success("Document removed from recent uploads.");
//   // };
//   const handleClick = () => {
//     fileInputRef.current.click();
//   };

//   // ✅ upload but no localStorage save
//   const handleProcessFiles = async () => {
//     if (selectedFiles.length === 0) return;

//     setIsUploading(true);

//     for (const fileObj of selectedFiles) {
//       try {
//         await uploadToAzure(
//           fileObj.file,
//           modelType,
//           email || currentUser.id,
//           name || currentUser.name,
//           (percent) => {
//             toast.update(toastId, {
//               render: `${fileObj.fileName} uploading: ${percent}%`,
//               isLoading: percent < 100,
//               autoClose: percent >= 100 ? 2000 : false,
//             });
//           },
//           selectedmodelType
//         );

//         toast.success(`${fileObj.fileName} uploaded successfully!`);
//       } catch (err) {
//         console.error(err);
//         toast.error(`Failed to upload ${fileObj.fileName}`);
//       }
//     }

//     setMyFiles(updatedMyFiles);
//     setSelectedFiles([]);
//     setIsUploading(false);
//     toast.dismiss(uploadToastId);
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return "Unknown time";
//     const date = new Date(dateString);
//     if (isNaN(date.getTime())) return "Unknown time";

//     const now = new Date();
//     const diffInSeconds = Math.floor((now - date) / 1000);

//     if (diffInSeconds < 60) return "Just now";
//     if (diffInSeconds < 3600)
//       return `${Math.floor(diffInSeconds / 60)} minute ago`;
//     if (diffInSeconds < 86400)
//       return `${Math.floor(diffInSeconds / 3600)} hour ago`;

//     return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   // ✅ directly use allDocuments (no myFiles/localStorage)
//   const filteredDocs = getFilteredDocuments()
//     .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

//   const indexOfLast = currentPage * documentsPerPage;
//   const indexOfFirst = indexOfLast - documentsPerPage;
//   const currentDocs = filteredDocs.slice(indexOfFirst, indexOfLast);
//   const totalPages = Math.ceil(filteredDocs.length / documentsPerPage);
//   const stats = getDocumentStats();

//   const handleManualReviewClick = () => {
//     if (hasAccess === true) {
//       const manualReviewDocs = allDocuments.filter(
//         (doc) => determineStatus(doc) === "Manual Review"
//       );
//       if (manualReviewDocs.length === 0) {
//         toast.info("No documents require manual review");
//         return;
//       }
//       navigate("/manualreview", {
//         state: {
//           manualReviewDocs,
//           selectedVendor,
//         },
//       });
//     } else {
//       toast.error(
//         "You do not have permission to view this Manual Review page."
//       );
//     }
//   };

//   const handleViewDocument = (file) => {
//     let rawUrl = file.blobUrl || file.url;
//     if (!rawUrl || !rawUrl.startsWith("http")) {
//       toast.error("File URL is not available");
//       return;
//     }
//     const baseUrl = rawUrl.split("?")[0];
//     const cleanSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
//     const finalUrl = `${baseUrl}${cleanSasToken}`;
//     window.open(finalUrl, "_blank");
//   };

//   return (
//     <div className="dashboard-total-container">
//       <header className="header">
//         <Header />
//       </header>
//       <div className="Dashboard-main-section">
//         <nav className="vendor-select">
//           <div>
//             <h2>{modelType} Dashboard</h2>
//             <p>Showing documents for {modelType}</p>
//             <p>View your document processing activity and insights</p>
//           </div>
//           <div className="Dashboard-main-section-vendor-select">
//             <label className="select">Select Vendor:</label>
//             <select
//               className="vendor-dropdown"
//               value={selectedVendor}
//               onChange={handleVendorChange}
//             >
//               <option value="">All Vendors</option>
//               {vendors.map((vendor, i) => (
//                 <option key={i} value={vendor}>
//                   {vendor}
//                 </option>
//               ))}
//             </select>
//             <button 
//               className="Dashboard-reset-button"
//               onClick={() => {
//                 setSelectedVendor("");
//                 setCurrentPage(1);
//               }}
//             >
//               <Funnel className="i-Reset-Dashboard" size={16} />Reset
//             </button>
//           </div>
//         </nav>

//         <main className="stats-container">
//           <div className="stat-box Total">
//             <FileText className="i" size={24} />
//             <p>Total</p>
//             <div className="total">{stats.total}</div>
//           </div>
//           <div className="stat-box completed">
//             <CheckCircle className="i" size={24} />
//             <p>Completed</p>
//             <div className="total">{stats.completed}</div>
//           </div>
//           <div className="stat-box inprocess">
//             <Clock className="i" size={24} />
//             <p>In Process</p>
//             <div className="total">{stats.inProcess}</div>
//           </div>
//           <div
//             className="stat-box manual-review"
//             onClick={handleManualReviewClick}
//           >
//             <AlertTriangle className="i" size={24} />
//             <p>Manual Review</p>
//             <div className="total">{stats.manualReview}</div>
//           </div>
//         </main>

//         <div className="Dashboard-upload-table-section">
//           <div className="upload-section">
//             <div className="upload-section-header-contants">
//               <h3>Upload Documents</h3>
//               <p>Upload documents for AI-powered data extraction</p>
//             </div>
//             <div className="input-section" onClick={handleClick}>
//               <Upload className="Upload" size={48} />
//               <h3 className="upload-section-h3">
//                 Drop files here or click to upload
//               </h3>
//               <p className="mb-4">Support for PDF, Word, JPG, PNG files</p>
//               <input
//                 type="file"
//                 ref={fileInputRef}
//                 style={{ display: "none" }}
//                 multiple
//                 onChange={FileChange}
//                 accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
//               />
//               <label
//                 className="btn btn-outline"
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   fileInputRef.current.click();
//                 }}
//               >
//                 <Upload size={16} className="selecte-icon" /> Select Files
//               </label>
//             </div>
//             <div className="file-load-section">
//               {selectedFiles.length > 0 && (
//                 <>
//                   <ul>
//                     {selectedFiles.map((fileObj, index) => (
//                       <li key={index}>
//                         {fileObj.fileName}
//                         <button
//                           onClick={() => handleDeleteFile(index)}
//                           className="delete-btn"
//                         >
//                           <Trash2 size={16} />
//                         </button>
//                       </li>
//                     ))}
//                   </ul>
//                   <button
//                     className="process-btn"
//                     onClick={handleProcessFiles}
//                     disabled={isUploading}
//                   >
//                     {isUploading ? "Uploading..." : "Process Files"}
//                   </button>
//                 </>
//               )}
//             </div>
//           </div>

//           <div className="status-section">
//             <div className="status-header">
//               <h3>Recent Documents</h3>
//               <p>
//                 {selectedVendor
//                   ? `Documents for vendor: ${selectedVendor}`
//                   : "List of your uploaded documents"}
//               </p>
//             </div>
//             <table>
//               <thead>
//                 <tr>
//                   <th>
//                     <span className="sortable-header">Name</span>
//                   </th>
//                   <th>
//                     <span className="sortable-header">Status</span>
//                   </th>
//                   <th>
//                     <span className="sortable-header">Uploaded</span>
//                   </th>
//                   <th>
//                     <span className="sortable-header">Date</span>
//                   </th>
//                   <th>
//                     <span className="sortable-header">Actions</span>
//                   </th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {currentDocs.length > 0 ? (
//                   currentDocs.map((file, index) => (
//                     <tr key={index}>
//                       <td>{file.documentName || file.fileName}</td>
//                       <td>
//                         <span
//                           className={`badge ${file.status
//                             ?.toLowerCase()
//                             .replace(" ", "-")}`}
//                         >
//                           {file.status}
//                         </span>
//                       </td>
//                       <td>{formatDate(file.uploadedAt)}</td>
//                       <td>{new Date(file.uploadedAt).toLocaleDateString()}</td>
//                       <td>
//                         <button
//                           className="action-btn"
//                           onClick={() => handleViewDocument(file)}
//                         >
//                           View
//                         </button>
//                       </td>
//                     </tr>
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan="5" style={{ textAlign: "center" }}>
//                       {selectedVendor
//                         ? `No documents found for vendor: ${selectedVendor}`
//                         : "No documents uploaded yet"}
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//             {/* <div className="pagination">
//               {Array.from({ length: totalPages }, (_, i) => (
//                 <button
//                   key={i}
//                   className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
//                   onClick={() => setCurrentPage(i + 1)}
//                 >
//                   {i + 1}
//                 </button>
//               ))}
//             </div> */}
//             <FilePagination
//               currentPage={currentPage}
//               totalPages={totalPages}
//               onPageChange={setCurrentPage}
//               rowsPerPage={documentsPerPage}
//               totalItems={totalItems}
//             />
//           </div>
//         </div>
//       </div>
//       <footer>
//         <Footer />
//       </footer>
//       <ToastContainer />
//     </div>
//   );
// };

// export default Dashboard;
