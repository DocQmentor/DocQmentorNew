import React, { useRef, useState } from "react";
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

const Dashboard = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const FileChange = (e) => {
    const newFiles = Array.from(e.target.files).map((file) => ({
      file,
      fileName: file.name,
      uploadedAt: new Date(),
      folderName:
        file.name.substring(0, file.name.lastIndexOf(".")) || file.name,
    }));

    console.log("Selected new files:", newFiles); // Debug log

    // Filter out duplicates by file name
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
    setIsUploading(true);
    const results = [];

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
          results.push({
            ...fileObj,
            status: "In Process",
          });
          toast.success(`${fileObj.fileName} uploaded successfully!`);
        }
      } catch (err) {
        toast.error(`Failed to upload ${fileObj.fileName}`);
      }
    }

    setUploadedFiles((prev) => [...prev, ...results]);
    setSelectedFiles([]);
    setIsUploading(false);
  };

  const formatDate = (dateObj) => {
    return new Date(dateObj).toISOString().split("T")[0];
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
            <h5>Select Vendors</h5>
            <select>
              <option>Vendor</option>
              <option>Vendor-1</option>
              <option>Vendor-2</option>
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
            <div className="total">
              {uploadedFiles.filter((f) => f.status === "Completed").length}
            </div>
          </div>
          <div className="stat-box inprocess">
            <Clock className="i" size={24} />
            <p>In Process</p>
            <div className="total">
              {uploadedFiles.filter((f) => f.status === "In Process").length}
            </div>
          </div>
          <div className="stat-box manual-review">
            <AlertTriangle className="i" size={24} />
            <p>Manual Review</p>
            <div className="total">
              {uploadedFiles.filter((f) => f.status === "Manual Review").length}
            </div>
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
              />

              <label className="btn btn-outline" onClick={handleClick}>
                <Upload size={16} /> Select Files
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
              <p>List of recently uploaded documents</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Folder</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploadedFiles.map((file, index) => (
                  <tr key={index}>
                    <td>{file.fileName}</td>
                    <td>{file.folderName}</td>
                    <td>
                      <span
                        className={`badge ${file.status
                          .toLowerCase()
                          .replace(" ", "-")}`}
                      >
                        {file.status}
                      </span>
                    </td>
                    <td>Just now</td>
                    <td>{formatDate(file.uploadedAt)}</td>
                    <td>
                      <button className="action-btn">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Footer />
      <ToastContainer />
    </div>
  );
};

export default Dashboard;
