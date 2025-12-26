import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Edit, History, File, X, Save } from "lucide-react";
import "./EditModal.css";
import Footer from "../Layout/Footer";

const sanitizeNumeric = (value) =>
  value ? value.toString().replace(/[^\d.]/g, "") : "";

const getFileFormat = (fileName) =>
  fileName ? fileName.split(".").pop().toUpperCase() : "PDF";

// ✅ Define editable fields for each document type
const documentTypeFields = {
  Invoice: [
    { key: "VendorName", label: "Vendor Name:", type: "text" },
    { key: "InvoiceId", label: "Invoice ID:", type: "text" },
    { key: "InvoiceDate", label: "Invoice Date:", type: "text" },
    { key: "LPO", label: "LPO Number:", type: "text" },
    { key: "SubTotal", label: "Sub Total:", type: "text", sanitize: true },
    { key: "VAT", label: "VAT:", type: "text", sanitize: true },
    {
      key: "InvoiceTotal",
      label: "Invoice Total:",
      type: "text",
      sanitize: true,
    },
  ],
  BankStatement: [
    { key: "AccountHolder", label: "Account Holder:", type: "text" },
    { key: "AccountNumber", label: "Account Number:", type: "text" },
    { key: "StatementPeriod", label: "Statement Period:", type: "text" },
    {
      key: "OpeningBalance",
      label: "Opening Balance:",
      type: "text",
      sanitize: true,
    },
    {
      key: "ClosingBalance",
      label: "Closing Balance:",
      type: "text",
      sanitize: true,
    },
  ],
  MortgageForms: [
    { key: "Lendername", label: "Lender Name:", type: "text" },
    { key: "Borrowername", label: "Borrower Name:", type: "text" },
    { key: "Loanamount", label: "Loan Amount:", type: "text", sanitize: true },
    { key: "Interest", label: "Interest Rate:", type: "text", sanitize: true },
    { key: "Loantenure", label: "Loan Tenure:", type: "text" },
  ],
};

// ✅ Match your Cosmos DB extractedData field names exactly
const fieldMapping = {
  Invoice: {
    VendorName: "VendorName",
    InvoiceId: "InvoiceId",
    InvoiceDate: "InvoiceDate",
    LPO: "LPO NO", // DB key
    SubTotal: "SubTotal",
    VAT: "VAT",
    InvoiceTotal: "InvoiceTotal",
  },
  BankStatement: {
    AccountHolder: "AccountHolder",
    AccountNumber: "AccountNumber",
    StatementPeriod: "StatementPeriod",
    OpeningBalance: "OpeningBalance",
    ClosingBalance: "ClosingBalance",
  },
  MortgageForms: {
    Lendername: "Lendername",
    Borrowername: "Borrowername",
    Loanamount: "Loanamount",
    Interest: "Interest",
    Loantenure: "Loantenure",
  },
};

const getString = (val) => {
  if (!val) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  if (typeof val === "object")
    return val?.valueString || val?.content || JSON.stringify(val);
  return "";
};

// Smart fetch function to handle Azure HTML errors
const smartFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  // ALWAYS read as text first (CRITICAL for Azure errors)
  const responseText = await response.text();
  
  // Check if it's an Azure HTML error page
  const isAzureHtmlError = 
    !response.ok && (
      responseText.includes('<!DOCTYPE') ||
      responseText.includes('<html>') ||
      responseText.trim().startsWith('The service') ||
      responseText.includes('Service Unavailable') ||
      responseText.includes('503') && responseText.includes('Azure')
    );

  if (isAzureHtmlError) {
    // This is Azure's cold start HTML page, not your JSON
    throw {
      type: 'AZURE_COLD_START',
      message: 'Azure Functions is starting up. This can take 30-60 seconds.',
      status: response.status
    };
  }

  // Check if response is JSON
  if (!responseText.trim()) {
    return null; // Empty response
  }

  // Try to parse as JSON
  try {
    return JSON.parse(responseText);
  } catch (jsonError) {
    // If it's not JSON and response was OK, throw parse error
    if (response.ok) {
      throw new Error(`Server returned invalid format: ${responseText.substring(0, 100)}`);
    }
    
    // If not JSON and not OK, throw HTTP error
    throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 100)}`);
  }
};

// Fetch with retry logic for cold starts
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`PUT attempt ${attempt}/${maxRetries}`);
      const result = await smartFetch(url, options);
      return result;
      
    } catch (error) {
      // If it's a cold start error, wait and retry
      if (error.type === 'AZURE_COLD_START' && attempt < maxRetries) {
        const delay = attempt * 10000; // 10s, 20s, 30s...
        console.log(`Cold start detected, waiting ${delay/1000} seconds before retry...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Re-throw other errors or if max retries reached
      throw error;
    }
  }
  throw new Error(`Maximum retries (${maxRetries}) exceeded`);
};

const EditModal = () => {
  const { state } = useLocation();
  const { accounts } = useMsal();
  const navigate = useNavigate();

  const selectedDocument = state?.selectedDocument;
  const initialEditedData = state?.editedData;
  const currentUser = { id: accounts[0]?.username, name: accounts[0]?.name };

  // ✅ Normalize modelType (case-insensitive)
  const rawType = (
    selectedDocument?.modelType ||
    localStorage.getItem("selectedModelType") ||
    "Invoice"
  ).toLowerCase();

  const modelMap = {
    invoice: "Invoice",
    bankstatement: "BankStatement",
    mortgageforms: "MortgageForms",
  };

  const selectedModelType = modelMap[rawType] || "Invoice";

  const [edited, setEdited] = useState({});
  const [editDetails, setEditDetails] = useState(true);
  const [versionHistory, setVersionHistory] = useState(false);
  const [pdfDetails, setPDFDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Added saving state
  const [saveError, setSaveError] = useState(null); // Added error state

  // ✅ Initialize field values
  useEffect(() => {
    if (!selectedDocument || !selectedModelType) return;

    const fields = documentTypeFields[selectedModelType];
    const extracted = selectedDocument.extractedData || {};
    const initialData = {};

    fields.forEach((field) => {
      const dbKey = fieldMapping[selectedModelType]?.[field.key] || field.key;
      const value =
        initialEditedData?.[field.key] ||
        extracted?.[dbKey] ||
        extracted?.[dbKey.toLowerCase()] || // 🛡️ Fallback to lowercase
        extracted?.[dbKey.replace(/\s+/g, "")] || // 🛡️ Fallback to no spaces
        selectedDocument?.[dbKey] ||
        "";

      // ✅ Keep DB format as-is for all fields, including date
      initialData[field.key] = field.sanitize
        ? sanitizeNumeric(value)
        : getString(value);
    });

    setEdited(initialData);
  }, [selectedDocument, initialEditedData, selectedModelType]);

  const handleCancel = () => navigate(-1);

  const handleFieldChange = (key, value, sanitize) => {
    setEdited((prev) => ({
      ...prev,
      [key]: sanitize ? sanitizeNumeric(value) : value,
    }));
  };

  // ✅ Clean and Robust Save Function with Azure error handling
  const handleSave = async () => {
    try {
      console.log("💾 handleSave STARTED (Clean Version)");
      setIsSaving(true);
      setSaveError(null);
     
      const fields = documentTypeFields[selectedModelType];
     
      // 1. Create a clean copy
      const updatedExtractedData = { ...selectedDocument.extractedData };

      fields.forEach((f) => {
        // The Key we WANT (PascalCase) matches DB column
        const correctKey = fieldMapping[selectedModelType]?.[f.key] || f.key;
        const newValue = edited[f.key] || "";

        // 2. SAFETY: Remove any "bad" legacy keys that might confuse the backend
        // e.g. remove "Lendername" if we are setting "Lendername"
        delete updatedExtractedData[correctKey.toLowerCase()];
        delete updatedExtractedData[correctKey.replace(/\s+/g, "")];
        delete updatedExtractedData[correctKey.toLowerCase().replace(/\s+/g, "")];

        // 3. Set the Correct Key
        updatedExtractedData[correctKey] = newValue;
       
        // 4. Special Handling for Invoice (Keep existing safety)
        if (correctKey === "LPO NO") updatedExtractedData["LPO NO"] = newValue;
        if (correctKey === "VAT") updatedExtractedData["VAT"] = newValue;
      });

      console.log("FINAL Payload extractedData:", updatedExtractedData);

      // Prepare Version History
      const newHistoryEntry = {
          version: (selectedDocument.versionHistory?.length || 0) + 1,
          action: "Manual Edit Saved",
          user: currentUser,
          timestamp: new Date().toISOString()
      };

      const updatedDoc = {
        ...selectedDocument,
        extractedData: updatedExtractedData,
        wasReviewed: true,
        reviewedBy: currentUser,
        reviewedAt: new Date().toISOString(),
        status: "Reviewed",
        // Append history correctly handling potential null
        versionHistory: [...(selectedDocument.versionHistory || []), newHistoryEntry]
      };

      // Use fetchWithRetry to handle Azure cold starts
      const response = await fetchWithRetry(
        "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA==",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedDoc),
        }
      );

      if (!response || !response.message) {
        throw new Error("Invalid response from server");
      }

      alert("✅ Document updated successfully!");
      navigate(-1);
      
    } catch (err) {
      console.error("Save error:", err);
      
      // User-friendly error messages
      let errorMsg = "Save failed: ";
      
      if (err.type === 'AZURE_COLD_START') {
        errorMsg = "Document service is starting up. This can take 30-60 seconds. Please wait and try again.";
      } else if (err.message.includes('Unexpected token')) {
        errorMsg = "Server returned unexpected response. Azure Functions might be starting up.";
      } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
        errorMsg = "Network connection issue. Please check your internet connection.";
      } else if (err.message.includes('Maximum retries')) {
        errorMsg = "Service is taking longer than expected to start. Please try again in a minute.";
      } else {
        errorMsg += err.message;
      }
      
      setSaveError(errorMsg);
      
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ Render edit fields per model type
  const renderEditFields = () => {
    const fields = documentTypeFields[selectedModelType];
    return fields.map((field) => (
      <div key={field.key} className="ManualReview-Edit-editDetails-form">
        <label>{field.label}</label>
        <input
          type={field.type}
          value={edited[field.key] || ""}
          onChange={(e) =>
            handleFieldChange(field.key, e.target.value, field.sanitize)
          }
          disabled={isSaving} // Disable fields while saving
        />
      </div>
    ));
  };

  return (
    <div className="ManualReview-Edit-main-container">
      <div className="ManualReview-Edit-container">
        {/* === PDF Preview Panel === */}
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

        {/* === Right Panel (Tabs + Edit) === */}
        <div className="ManualReview-Edit-options">
          <nav className="ManualReview-Edit-options-nav">
            <ul className="ManualReview-Edit-options-nav-ul">
              <li
                className={`ManualReview-Edit-options-nav-li ${
                  editDetails ? "active" : ""
                }`}
                onClick={() => {
                  setEditDetails(true);
                  setVersionHistory(false);
                  setPDFDetails(false);
                }}
              >
                <Edit size={20} /> Edit Details
              </li>
              <li
                className={`ManualReview-Edit-options-nav-li ${
                  versionHistory ? "active" : ""
                }`}
                onClick={() => {
                  setEditDetails(false);
                  setVersionHistory(true);
                  setPDFDetails(false);
                }}
              >
                <History size={20} /> Version History
              </li>
              <li
                className={`ManualReview-Edit-options-nav-li ${
                  pdfDetails ? "active" : ""
                }`}
                onClick={() => {
                  setEditDetails(false);
                  setVersionHistory(false);
                  setPDFDetails(true);
                }}
              >
                <File size={20} /> PDF Details
              </li>
              <li
                className="ManualReview-Edit-options-nav-li"
                onClick={handleCancel}
              >
                <X size={20} />
              </li>
            </ul>
          </nav>

          {/* === Edit Details Tab === */}
          {editDetails && (
            <div className="ManualReview-Edit-editDetails">
              <form className="ManualReview-Edit-editDetails-form">
                <h3>Edit Details - {selectedModelType}</h3>
                
                {/* Show save error if any */}
                {saveError && (
                  <div style={{
                    backgroundColor: '#ffebee',
                    border: '1px solid #ffcdd2',
                    borderRadius: '4px',
                    padding: '10px',
                    marginBottom: '15px',
                    color: '#c62828'
                  }}>
                    <p style={{ margin: 0 }}>{saveError}</p>
                  </div>
                )}
                
                {renderEditFields()}
                <ul className="ManualReview-Edit-editDetails-form-ul">
                  <li
                    className="ManualReview-Edit-editDetails-form-ul-Cancel"
                    onClick={handleCancel}
                    style={{ opacity: isSaving ? 0.6 : 1 }}
                  >
                    <X
                      size={20}
                      color="white"
                      strokeWidth={2}
                      style={{ background: "transparent", marginRight: 4 }}
                    />
                    <span style={{ background: "transparent", marginRight: 4 }}>Cancel</span>
                  </li>

                  <li
                    className="ManualReview-Edit-editDetails-form-ul-Save-Changes"
                    onClick={isSaving ? null : handleSave}
                    style={{ 
                      opacity: isSaving ? 0.6 : 1,
                      cursor: isSaving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Save
                      size={20}
                      color="white"
                      strokeWidth={2}
                      style={{ background: "transparent", marginRight: 4 }}
                    />
                    <span style={{ background: "transparent", marginRight: 4 }}>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </span>
                  </li>
                </ul>
              </form>
            </div>
          )}

          {/* === Version History Tab === */}
          {versionHistory && (
            <div className="ManualReview-Edit-versionHistory">
              <h3>Version History</h3>
              {selectedDocument?.versionHistory?.length ? (
                <ul>
                  {selectedDocument.versionHistory.map((v, i) => (
                    <li key={i}>
                      <strong>v{v.version}</strong> – {v.action} by{" "}
                      {v.user.name} ({v.user.id}) on{" "}
                      {new Date(v.timestamp).toLocaleString()}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No version history available.</p>
              )}
            </div>
          )}

          {/* === PDF Details Tab === */}
          {pdfDetails && (
            <div className="pdf-details-container">
              <h3>Document Details</h3>
              <ul>
                <li>
                  <b>File Name:</b> {selectedDocument?.documentName || "N/A"}
                </li>
                <li>
                  <b>File Format:</b>{" "}
                  {getFileFormat(selectedDocument?.documentName)}
                </li>
                <li>
                  <b>File Size:</b> {selectedDocument?.metadata?.fileSizeKB || "N/A"} KB
                </li>
                <li>
                  <b>Document Type:</b> {selectedModelType}
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