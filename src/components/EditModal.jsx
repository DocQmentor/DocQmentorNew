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
    { key: "LenderName", label: "Lender Name:", type: "text" },
    { key: "BorrowerName", label: "Borrower Name:", type: "text" },
    { key: "LoanAmount", label: "Loan Amount:", type: "text", sanitize: true },
    { key: "Interest", label: "Interest Rate:", type: "text", sanitize: true },
    { key: "LoanTenure", label: "Loan Tenure:", type: "text" },
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
    LenderName: "Lendername",
    BorrowerName: "Borrowername",
    LoanAmount: "Loanamount",
    Interest: "Interest",
    LoanTenure: "Loantenure",
  },
};

const getString = (val) => {
  if (!val) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  if (typeof val === "object")
    return val?.valueString || val?.content || JSON.stringify(val);
  return "";
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

  // ✅ Save edited data to DB
  const handleSave = async () => {
    try {
      const fields = documentTypeFields[selectedModelType];
      const updatedExtractedData = {};

      fields.forEach((f) => {
        const dbKey = fieldMapping[selectedModelType]?.[f.key] || f.key;
        updatedExtractedData[dbKey] = edited[f.key] || "";
        
        // 🛡️ Safety: Save both formats to ensure Backend (SqlDbService) finds it
        if (dbKey === "LPO NO") updatedExtractedData["LpoNo"] = updatedExtractedData[dbKey];
        if (dbKey === "VAT") updatedExtractedData["Vat"] = updatedExtractedData[dbKey];
        
        // Inverse case
        if (dbKey === "LpoNo") updatedExtractedData["LPO NO"] = updatedExtractedData[dbKey];
        if (dbKey === "Vat") updatedExtractedData["VAT"] = updatedExtractedData[dbKey];
      });

      const updatedDoc = {
        ...selectedDocument,
        extractedData: updatedExtractedData,
        wasReviewed: true,
        reviewedBy: currentUser,
        reviewedAt: new Date().toISOString(),
        status: "Reviewed",
      };

      const response = await fetch(
        "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA==",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedDoc),
        }
      );

      if (!response.ok) throw new Error(await response.text());

      alert("✅ Document updated successfully!");
      navigate(-1);
    } catch (err) {
      alert("❌ Save failed: " + err.message);
      console.error(err);
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
                {renderEditFields()}
                <ul className="ManualReview-Edit-editDetails-form-ul">
                  <li
                    className="ManualReview-Edit-editDetails-form-ul-Cancel"
                    onClick={handleCancel}
                  >
                    <X
                      size={20}
                      color="white"
                      strokeWidth={2}
                      style={{ background: "transparent", marginRight: 4 }}
                    />
                    <span color="white"
                      strokeWidth={2}
                      style={{ background: "transparent", marginRight: 4 }}>Cancel</span>
                  </li>

                  <li
                    className="ManualReview-Edit-editDetails-form-ul-Save-Changes"
                    onClick={handleSave}
                  >
                    <Save
                      size={20}
                      color="white"
                      strokeWidth={2}
                      style={{ background: "transparent", marginRight: 4 }}
                    />
                    <span color="white"
                      strokeWidth={2}
                      style={{ background: "transparent", marginRight: 4 }}>Save Changes</span>
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
