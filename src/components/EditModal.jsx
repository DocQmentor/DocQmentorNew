import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Edit, History, File, X, Save } from "lucide-react";
import "./EditModal.css";
import Footer from "../Layout/Footer";

const sanitizeNumeric = (value) => {
  if (!value) return "";
  return value.toString().replace(/[^\d.]/g, "");
};

const formatNumber = (value) => {
  if (!value) return "";
  return parseFloat(value).toLocaleString("en-IN");
};

const formatDate = (timestamp) => {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ", " + date.toLocaleTimeString();
};

const formatFileSize = (bytes) => {
  if (bytes === undefined || bytes === null) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getFileFormat = (fileName) => {
  if (!fileName) return "PDF";
  const extension = fileName.split('.').pop().toUpperCase();
  return extension || "PDF";
};

// Field configurations for each document type
const documentTypeFields = {
  Invoice: [
    { key: "VendorName", label: "Vendor Name:", type: "text"},
    { key: "InvoiceId", label: "Invoice ID:", type: "text" },
    { key: "InvoiceDate", label: "Invoice Date:", type: "date" },
    { key: "LPO", label: "LPO Number:", type: "text", sanitize: true },
    { key: "SubTotal", label: "Sub Total:", type: "text", sanitize: true },
    { key: "VAT", label: "VAT", type: "text:", sanitize: true },
    { key: "InvoiceTotal", label: "Invoice Total:", type: "text", sanitize: true }
  ],
  BankStatement: [
    { key: "AccountHolder", label: "Account Holder:", type: "text" },
    { key: "AccountNumber", label: "Account Number:", type: "text" },
    { key: "StatementPeriod", label: "Statement Period:", type: "text" },
    { key: "OpeningBalance", label: "Opening Balance:", type: "text", sanitize: true },
    { key: "ClosingBalance", label: "Closing Balance:", type: "text", sanitize: true }
  ],
  MortgageForms: [
    { key: "LenderName", label: "Lender Name:", type: "text" },
    { key: "BorrowerName", label: "Borrower Name:", type: "text" },
    { key: "LoanAmount", label: "Loan Amount:", type: "text", sanitize: true },
    { key: "Interest", label: "Interest:", type: "text", sanitize: true },
    { key: "LoanTenure", label: "Loan Tenure:", type: "text" }
  ]
};

// Field mapping for extracted data keys
const fieldMapping = {
  Invoice: {
    VendorName: "VendorName",
    InvoiceId: "InvoiceId",
    InvoiceDate: "InvoiceDate",
    LPO: "LPO NO",
    SubTotal: "SubTotal",
    VAT: "VAT",
    InvoiceTotal: "InvoiceTotal"
  },
  BankStatement: {
    AccountHolder: "AccountHolder",
    AccountNumber: "AccountNumber",
    StatementPeriod: "StatementPeriod",
    OpeningBalance: "OpeningBalance",
    ClosingBalance: "ClosingBalance"
  },
  MortgageForms: {
    LenderName: "LenderName",
    BorrowerName: "BorrowerName",
    LoanAmount: "LoanAmount",
    Interest: "Interest",
    LoanTenure: "LoanTenure"
  }
};

const getString = (val) => {
  if (!val) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  if (typeof val === "object") {
    return val?.valueString || val?.content || JSON.stringify(val);
  }
  return "";
};

const EditModal = () => {
  const { state } = useLocation();
  const { accounts } = useMsal();
  const navigate = useNavigate();

  const currentUser = {
    id: accounts[0]?.username,
    name: accounts[0]?.name,
  };

  const selectedDocument = state?.selectedDocument;
  const initialEditedData = state?.editedData;
  
  // Get the selected model type from localStorage or document
  const selectedModelType = selectedDocument?.modelType || 
                           localStorage.getItem("selectedModelType") || 
                           "Invoice";

  const refreshData = () => window.location.reload();
  const setShow = () => navigate(-1);

  const [editDetails, setEditDetails] = useState(true);
  const [versionHistory, setVersionHistory] = useState(false);
  const [pdfDetails, setPDFDetails] = useState(false);
  const [saveSuccessful, setSaveSuccessful] = useState(false);

  // Initialize edited state dynamically based on document type
  const [edited, setEdited] = useState({});

  useEffect(() => {
    if (initialEditedData && selectedModelType) {
      const fields = documentTypeFields[selectedModelType] || [];
      const initialData = {};
      
      fields.forEach(field => {
        const extractedKey = fieldMapping[selectedModelType]?.[field.key] || field.key;
        const value = initialEditedData[field.key] || 
                     initialEditedData.extractedData?.[extractedKey] || 
                     "";
        
        initialData[field.key] = field.sanitize ? sanitizeNumeric(value) : getString(value);
      });

      setEdited(initialData);
    }
  }, [initialEditedData, selectedModelType]);

  useEffect(() => {
    if (saveSuccessful) {
      navigate("/table");
    }
  }, [saveSuccessful]);

  const showSection = (section) => {
    setEditDetails(section === "editDetails");
    setVersionHistory(section === "versionHistory");
    setPDFDetails(section === "pdfDetails");
  };

  const handleCancel = () => {
    setShow(true);
  };

  const handleSave = async () => {
    const fields = documentTypeFields[selectedModelType] || [];
    const isEmpty = fields.some(field => !edited[field.key] || edited[field.key].trim() === "");

    if (isEmpty) {
      alert("⚠️ Please fill all fields before saving.");
      return;
    }

    try {
      const score = selectedDocument.totalConfidenceScore;
      let numericScore =
        typeof score === "string"
          ? parseFloat(score.replace(/[^\d.]/g, ""))
          : Number(score);

      const reviewedScore = isNaN(numericScore)
        ? "Reviewed"
        : `${numericScore.toFixed(2)}% Reviewed`;

      const existingHistory = Array.isArray(selectedDocument.versionHistory)
        ? [...selectedDocument.versionHistory]
        : [];

      const newVersion = {
        version: existingHistory.length + 1,
        action: "Reviewed",
        timestamp: new Date().toISOString(),
        user: {
          id: currentUser.id || "unknown@domain.com",
          name: currentUser.name || "Unknown User",
        },
      };

      // Build extracted data dynamically
      const extractedData = {};
      const fieldsConfig = documentTypeFields[selectedModelType] || [];
      
      fieldsConfig.forEach(field => {
        const extractedKey = fieldMapping[selectedModelType]?.[field.key] || field.key;
        extractedData[extractedKey] = edited[field.key];
      });

      const updatedDoc = {
        ...selectedDocument,
        id: selectedDocument.id,
        extractedData: extractedData,
        wasReviewed: true,
        reviewedBy: {
          id: currentUser.id || "unknown@domain.com",
          name: currentUser.name || "Unknown User",
        },
        reviewedAt: new Date().toISOString(),
        totalConfidenceScore: reviewedScore,
        status: "Reviewed",
        versionHistory: [...existingHistory, newVersion],
        fileUrl: selectedDocument.fileUrl || "",
        blobUrl: selectedDocument.blobUrl || "",
      };

      console.log("📤 Sending to PUT:", updatedDoc);

      const response = await fetch(
        "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA==",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedDoc),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error("Failed to update: " + errText);
      }

      refreshData();
      setShow(true);
      setSaveSuccessful(true);
    } catch (err) {
      console.error("❌ Save error:", err);
      alert("❌ Failed to update document:\n" + err.message);
    }
  };

  const handleFieldChange = (fieldKey, value, shouldSanitize = false) => {
    setEdited(prev => ({
      ...prev,
      [fieldKey]: shouldSanitize ? sanitizeNumeric(value) : value
    }));
  };

  const renderEditFields = () => {
    const fields = documentTypeFields[selectedModelType] || [];
    
    return fields.map(field => (
      <div key={field.key} className="ManualReview-Edit-editDetails-form">
        <label>{field.label}</label>
        <input
          type={field.type}
          value={edited[field.key] || ""}
          onChange={(e) => handleFieldChange(field.key, e.target.value, field.sanitize)}
        />
      </div>
    ));
  };

  return (
    <div className="ManualReview-Edit-main-container">
      <div className="ManualReview-Edit-container">
        <div className="ManualReview-Edit-show-file">
          <header className="ManualReview-Edit-show-file-name">
            {selectedDocument?.fileName ||
              selectedDocument?.documentName ||
              "Document"}
          </header>
          {selectedDocument?.blobUrl ? (
            <iframe
              src={selectedDocument.blobUrl}
              className="ManualReview-Edit-show-file-pdf-preview"
              title="PDF Viewer"
            />
          ) : (
            <p>No PDF URL found for this document</p>
          )}
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
              <li className="ManualReview-Edit-options-nav-li" onClick={handleCancel}>
                <X size={20} />
              </li>
            </ul>
          </nav>

          {editDetails && (
            <div className="ManualReview-Edit-editDetails">
              <form className="ManualReview-Edit-editDetails-form">
                <h3>Edit Details - {selectedModelType}</h3>
                {renderEditFields()}
                
                <ul className="ManualReview-Edit-editDetails-form-ul">
                  <li
                    className="ManualReview-Edit-editDetails-form-ul-Cancel"
                    onClick={handleCancel}
                  >
                    <X size={20} className="ManualReview-Edit-editDetails-form-ul-Cancel-i" /> Cancel
                  </li>
                  <li
                    className="ManualReview-Edit-editDetails-form-ul-Save-Changes"
                    onClick={handleSave}
                  >
                    <Save size={20} className="ManualReview-Edit-editDetails-form-ul-Save-Changes-i"/> Save Changes
                  </li>
                </ul>
              </form>
            </div>
          )}

          {versionHistory && (
            <div className="ManualReview-Edit-versionHistory">
              <h3>Version History</h3>
              {selectedDocument?.versionHistory?.length > 0 ? (
                <ul>
                  {selectedDocument.versionHistory.map((entry, index) => (
                    <li key={index}>
                      <strong>v{entry.version}</strong> – {entry.action} by{" "}
                      <span>
                        {entry.user.name} ({entry.user.id})
                      </span>{" "}
                      on{" "}
                      <em>{new Date(entry.timestamp).toLocaleString()}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No version history found.</p>
              )}
            </div>
          )}

          {pdfDetails && (
            <div className="pdf-details-container">
              <h3>Document Details</h3>
              <ul className="pdf-details-list">
                <li>
                  <b className="detail-label">File Name:</b>
                  <span className="detail-value">
                    {selectedDocument?.metadata?.FileName || selectedDocument?.documentName || "N/A"}
                  </span>
                </li>
                <li>
                  <b className="detail-label">File Size:</b>
                  <span className="detail-value">
                    {formatFileSize(selectedDocument?.metadata?.FileSize)}
                  </span>
                </li>
                <li>
                  <b className="detail-label">Pages:</b>
                  <span className="detail-value">
                    {selectedDocument?.metadata?.PageCount || "N/A"}
                  </span>
                </li>
                <li>
                  <b className="detail-label">File Format:</b>
                  <span className="detail-value">
                    {selectedDocument?.metadata?.FileFormat || getFileFormat(selectedDocument?.documentName)}
                  </span>
                </li>
                <li>
                  <b className="detail-label">Document Type:</b>
                  <span className="detail-value">
                    {selectedModelType}
                  </span>
                </li>
                <li>
                  <b className="detail-label">Uploaded Date:</b>
                  <span className="detail-value">
                    {formatDate(selectedDocument?.metadata?.UploadDate || selectedDocument?.uploadedAt)}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default EditModal;