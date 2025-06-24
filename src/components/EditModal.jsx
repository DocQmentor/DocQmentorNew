import React, { useState, useRef } from "react";
import { Edit, History, File, X, Save } from "lucide-react";
import "./ManualReview.css";

const EditModal = ({ document, onClose, getString }) => {
  const [editDetails, setEditDetails] = useState(true);
  const [versionHistory, setVersionHistory] = useState(false);
  const [pdfDetails, setPDFDetails] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setFileUrl(url);
  };

  const handleViewFile = () => {
    if (!fileUrl) return;

    if (selectedFile.type === "application/pdf") {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    } else if (selectedFile.type.startsWith("image/")) {
      // image will preview in component
    } else {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = selectedFile.name || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const showSection = (section) => {
    setEditDetails(section === "editDetails");
    setVersionHistory(section === "versionHistory");
    setPDFDetails(section === "pdfDetails");
  };

  return (
    <div className="ManualReview-Edit-container">
      <div className="ManualReview-Edit-show-file">
        <header>
          {document?.fileName || document?.documentName || "Document"}
        </header>
        <iframe
  src={selectedDocument?.blobUrl}
  className="pdf-preview"
  title="PDF Viewer"
/>

        <div>
          {selectedFile && (
            <div className="file-display-section">
              <div className="file-info">
                <h3>Selected File: {selectedFile.name}</h3>
                <button onClick={handleViewFile} className="view-btn">
                  View File
                </button>
              </div>
              <div className="file-preview">
                {selectedFile.type.startsWith("image/") && (
                  <img src={fileUrl} alt="Preview" className="image-preview" />
                )}
                {selectedFile.type === "application/pdf" && (
                  <iframe
                    src={fileUrl}
                    title="PDF Preview"
                    className="pdf-preview"
                  />
                )}
                {!selectedFile.type.startsWith("image/") &&
                  selectedFile.type !== "application/pdf" && (
                    <div className="unsupported-preview">
                      <p>File preview not available for this format</p>
                      <p>Click "View File" to download</p>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="ManualReview-Edit-options">
        <nav className="ManualReview-Edit-options-nav">
          <ul className="ManualReview-Edit-options-nav-ul">
            <li
              className={`ManualReview-Edit-options-nav-li ${
                editDetails ? "active" : ""
              }`}
              onClick={() => showSection("editDetails")}
            >
              <Edit size={20} /> Edit Details
            </li>
            <li
              className={`ManualReview-Edit-options-nav-li ${
                versionHistory ? "active" : ""
              }`}
              onClick={() => showSection("versionHistory")}
            >
              <History size={20} /> Version History
            </li>
            <li
              className={`ManualReview-Edit-options-nav-li ${
                pdfDetails ? "active" : ""
              }`}
              onClick={() => showSection("pdfDetails")}
            >
              <File size={20} /> PDF Details
            </li>
            <li onClick={onClose}>
              <X size={20} />
            </li>
          </ul>
        </nav>
        {editDetails && document && (
          <div className="ManualReview-Edit-editDetails">
            <form className="ManualReview-Edit-editDetails-form">
              <h3>Edit Details</h3>
              <label>Vendor Name</label>
              <input
                type="text"
                defaultValue={getString(document?.extractedData?.VendorName)}
                placeholder="Please write Vendor Name..."
              />
              <label>Invoice Date</label>
              <input
                type="date"
                defaultValue={getString(document?.extractedData?.InvoiceDate)}
                placeholder="Please select Invoice Date..."
              />
              <label>LPO Number</label>
              <input
                type="text"
                defaultValue={getString(document?.extractedData?.["LPO NO"])}
                placeholder="Please write LPO Number..."
              />
              <label>Sub Total</label>
              <input
                type="number"
                defaultValue={getString(document?.extractedData?.SubTotal)}
                placeholder="Please write Sub Total..."
              />
              <label>VAT</label>
              <input
                type="number"
                defaultValue={getString(document?.extractedData?.VAT)}
                placeholder="Please write VAT..."
              />
              <label>Invoice Total</label>
              <input
                type="number"
                defaultValue={getString(document?.extractedData?.InvoiceTotal)}
                placeholder="Please write Invoice Total..."
              />
              <ul className="ManualReview-Edit-editDetails-form-ul">
                <li
                  className="ManualReview-Edit-editDetails-form-ul-Cancel"
                  onClick={onClose}
                >
                  <X size={20} /> Cancel
                </li>
                <li
                  className="ManualReview-Edit-editDetails-form-ul-Save-Changes"
                  onClick={onClose}
                >
                  <Save size={20} /> Save Changes
                </li>
              </ul>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditModal;