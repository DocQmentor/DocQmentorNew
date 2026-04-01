import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useLocation, useNavigate } from "react-router-dom";
import "./EditModal.css";
import Footer from "../Layout/Footer";
import { sasToken } from "../sasToken";

const sanitizeNumeric = (value) =>
  value ? value.toString().replace(/[^\d.]/g, "") : "";

const getFileFormat = (fileName) =>
  fileName ? fileName.split(".").pop().toUpperCase() : "PDF";

const documentTypeFields = {
  Invoice: [
    { key: "VendorName",    label: "Vendor Name",    type: "text" },
    { key: "InvoiceId",     label: "Invoice ID",     type: "text" },
    { key: "InvoiceDate",   label: "Invoice Date",   type: "text" },
    { key: "LPO",           label: "LPO Number",     type: "text" },
    { key: "SubTotal",      label: "Sub Total",      type: "text", sanitize: true },
    { key: "VAT",           label: "VAT",            type: "text", sanitize: true },
    { key: "InvoiceTotal",  label: "Invoice Total",  type: "text", sanitize: true },
  ],
  BankStatement: [
    { key: "AccountHolder",   label: "Account Holder",   type: "text" },
    { key: "AccountNumber",   label: "Account Number",   type: "text" },
    { key: "StatementPeriod", label: "Statement Period", type: "text" },
    { key: "OpeningBalance",  label: "Opening Balance",  type: "text", sanitize: true },
    { key: "ClosingBalance",  label: "Closing Balance",  type: "text", sanitize: true },
  ],
  MortgageForms: [
    { key: "Lendername",   label: "Lender Name",   type: "text" },
    { key: "Borrowername", label: "Borrower Name", type: "text" },
    { key: "Loanamount",   label: "Loan Amount",   type: "text", sanitize: true },
    { key: "Interest",     label: "Interest Rate", type: "text", sanitize: true },
    { key: "Loantenure",   label: "Loan Tenure",   type: "text" },
  ],
};

const fieldMapping = {
  Invoice: {
    VendorName: "VendorName", InvoiceId: "InvoiceId", InvoiceDate: "InvoiceDate",
    LPO: "LPO NO", SubTotal: "SubTotal", VAT: "VAT", InvoiceTotal: "InvoiceTotal",
  },
  BankStatement: {
    AccountHolder: "AccountHolder", AccountNumber: "AccountNumber",
    StatementPeriod: "StatementPeriod", OpeningBalance: "OpeningBalance", ClosingBalance: "ClosingBalance",
  },
  MortgageForms: {
    Lendername: "Lendername", Borrowername: "Borrowername",
    Loanamount: "Loanamount", Interest: "Interest", Loantenure: "Loantenure",
  },
};

const getString = (val) => {
  if (!val) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  if (typeof val === "object") return val?.valueString || val?.content || JSON.stringify(val);
  return "";
};

const EditModal = () => {
  const { state } = useLocation();
  const { accounts } = useMsal();
  const navigate = useNavigate();

  const selectedDocument = state?.selectedDocument;
  const initialEditedData = state?.editedData;
  const currentUser = { id: accounts[0]?.username, name: accounts[0]?.name };

  const rawType = (
    selectedDocument?.modelType || localStorage.getItem("selectedModelType") || "Invoice"
  ).toLowerCase();
  const modelMap = { invoice: "Invoice", bankstatement: "BankStatement", mortgageforms: "MortgageForms" };
  const selectedModelType = modelMap[rawType] || "Invoice";

  const [edited, setEdited]       = useState({});
  const [activeTab, setActiveTab] = useState("edit"); // "edit" | "history" | "pdf"
  const [saving, setSaving]       = useState(false);

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
        extracted?.[dbKey.toLowerCase()] ||
        extracted?.[dbKey.replace(/\s+/g, "")] ||
        selectedDocument?.[dbKey] || "";
      initialData[field.key] = field.sanitize ? sanitizeNumeric(value) : getString(value);
    });
    setEdited(initialData);
  }, [selectedDocument, initialEditedData, selectedModelType]);

  const handleFieldChange = (key, value, sanitize) => {
    setEdited((prev) => ({ ...prev, [key]: sanitize ? sanitizeNumeric(value) : value }));
  };

  const handleCancel = () => navigate(-1);

  const handleSave = async () => {
    setSaving(true);
    try {
      const fields = documentTypeFields[selectedModelType];
      const updatedExtractedData = { ...selectedDocument.extractedData };
      fields.forEach((f) => {
        const correctKey = fieldMapping[selectedModelType]?.[f.key] || f.key;
        const newValue = edited[f.key] || "";
        delete updatedExtractedData[correctKey.toLowerCase()];
        delete updatedExtractedData[correctKey.replace(/\s+/g, "")];
        delete updatedExtractedData[correctKey.toLowerCase().replace(/\s+/g, "")];
        updatedExtractedData[correctKey] = newValue;
        if (correctKey === "LPO NO") updatedExtractedData["LPO NO"] = newValue;
        if (correctKey === "VAT")    updatedExtractedData["VAT"]    = newValue;
      });

      const newHistoryEntry = {
        version:   (selectedDocument.versionHistory?.length || 0) + 1,
        action:    "Manual Edit Saved",
        user:      currentUser,
        timestamp: new Date().toISOString(),
      };

      const updatedDoc = {
        ...selectedDocument,
        extractedData:  updatedExtractedData,
        wasReviewed:    true,
        reviewedBy:     currentUser,
        reviewedAt:     new Date().toISOString(),
        status:         "Reviewed",
        versionHistory: [...(selectedDocument.versionHistory || []), newHistoryEntry],
      };

      const response = await fetch(
        "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=5ttVguFIlYsgNTLnI7I-hGlMyInPTM_Y-3ihASWqOxLzAzFuaOzdpQ==",
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedDoc) }
      );
      if (!response.ok) throw new Error(await response.text());
      alert("✅ Document updated successfully!");
      navigate(-1);
    } catch (err) {
      alert("❌ Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Confidence score
  const rawScore = selectedDocument?.averageConfidenceScore || selectedDocument?.totalConfidenceScore;
  let confidenceNum = 0;
  if (rawScore) {
    const val = parseFloat(String(rawScore).replace("%", ""));
    confidenceNum = val <= 1 ? val * 100 : val;
  }
  const confidencePct = confidenceNum.toFixed(1) + "%";
  const confIsLow = confidenceNum < 85;

  const typeLabel =
    selectedModelType === "BankStatement" ? "Bank Statement" :
    selectedModelType === "MortgageForms" ? "Mortgage Forms" : "Invoice";

  const docName = selectedDocument?.fileName || selectedDocument?.documentName || "Document";

  // Render field pairs in 2-column grid
  const renderEditFields = () => {
    const fields = documentTypeFields[selectedModelType];
    const rows = [];
    for (let i = 0; i < fields.length; i += 2) {
      const left  = fields[i];
      const right = fields[i + 1] || null;
      rows.push(
        <div className="em-field-row" key={i}>
          {renderField(left)}
          {right ? renderField(right) : <div className="em-field-slot" />}
        </div>
      );
    }
    // If odd number of fields, confidence box fills last right slot
    if (fields.length % 2 !== 0) {
      // Replace last row's empty right slot with confidence box
      rows[rows.length - 1] = (
        <div className="em-field-row" key="last">
          {renderField(fields[fields.length - 1])}
          {renderConfidenceBox()}
        </div>
      );
    } else {
      rows.push(
        <div className="em-field-row" key="conf">
          <div className="em-field-slot" />
          {renderConfidenceBox()}
        </div>
      );
    }
    return rows;
  };

  const renderField = (field) => {
    const isEmpty = !edited[field.key] || edited[field.key].toString().trim() === "";
    return (
      <div key={field.key} className={`em-field${isEmpty ? " em-field--error" : ""}`}>
        <label className="em-field-lbl">
          {field.label.toUpperCase()}
          {isEmpty && <span className="em-field-req"> ⚠ Required</span>}
        </label>
        <input
          className="em-field-input"
          type={field.type}
          value={edited[field.key] || ""}
          placeholder={isEmpty ? `Enter ${field.label.toLowerCase()}…` : ""}
          onChange={(e) => handleFieldChange(field.key, e.target.value, field.sanitize)}
        />
      </div>
    );
  };

  const renderConfidenceBox = () => (
    <div className={`em-conf-box${confIsLow ? " em-conf-box--low" : " em-conf-box--high"}`}>
      <div className="em-conf-title">AI Confidence Score</div>
      <div className="em-conf-score">{confidencePct}</div>
      <div className="em-conf-note">
        {confIsLow ? "Below threshold (85%) — review required" : "Above threshold — looks good"}
      </div>
      <div className="em-conf-bar-bg">
        <div className="em-conf-bar-fill" style={{ width: `${Math.min(confidenceNum, 100)}%` }} />
      </div>
    </div>
  );

  return (
    <div className="em-page">
      {/* Top accent bar */}
      <div className="em-accent" />

      {/* Header row */}
      <div className="em-header">
        <div className="em-header-title">
          Edit Details — <span>{typeLabel}</span>
        </div>
        <button className="em-close-btn" onClick={handleCancel} title="Close">✕</button>
      </div>

      {/* Tabs */}
      <div className="em-tabs-bar">
        <button className={`em-tab${activeTab === "edit"    ? " active" : ""}`} onClick={() => setActiveTab("edit")}>    ✏ Edit Details</button>
        <button className={`em-tab${activeTab === "history" ? " active" : ""}`} onClick={() => setActiveTab("history")}>🕐 Version History</button>
        <button className={`em-tab${activeTab === "pdf"     ? " active" : ""}`} onClick={() => setActiveTab("pdf")}>    📄 PDF Details</button>
      </div>

      {/* Body: PDF left + right panel */}
      <div className="em-body">
        {/* ── LEFT: PDF Preview ── */}
        <div className="em-pdf-panel">
          <div className="em-pdf-header">
            <span className="em-pdf-icon">📄</span>
            <span className="em-pdf-name">{docName}</span>
          </div>
          <div className="em-pdf-frame">
            {selectedDocument?.blobUrl ? (
              <iframe
                src={`${selectedDocument.blobUrl.split("?")[0]}${sasToken.startsWith("?") ? sasToken : "?" + sasToken}`}
                title="PDF Viewer"
                className="em-iframe"
              />
            ) : (
              <div className="em-pdf-empty">No PDF preview available</div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Tab Content ── */}
        <div className="em-right-panel">

          {/* ── EDIT DETAILS TAB ── */}
          {activeTab === "edit" && (
            <div className="em-edit-tab">
              <div className="em-form-heading">
                <div className="em-form-title">{typeLabel} Fields</div>
                <div className="em-form-sub">Edit the extracted data below and save your changes</div>
              </div>
              <hr className="em-divider" />

              <div className="em-fields-grid">
                {renderEditFields()}
              </div>

              <hr className="em-divider" />

              <div className="em-actions">
                <button className="em-btn-cancel" onClick={handleCancel}>✕ Cancel</button>
                <button className="em-btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "💾 Save Changes"}
                </button>
              </div>

              <div className="em-reviewed-note">
                <span className="em-reviewed-icon">✅</span>
                <div>
                  <div className="em-reviewed-title">Saving marks this document as "Reviewed"</div>
                  <div className="em-reviewed-sub">Status moves from Manual Review → Reviewed</div>
                </div>
              </div>
            </div>
          )}

          {/* ── VERSION HISTORY TAB ── */}
          {activeTab === "history" && (
            <div className="em-history-tab">
              <div className="em-form-heading">
                <div className="em-form-title">🕐 Version History</div>
                <div className="em-form-sub">Each save creates a new version entry with user and timestamp</div>
              </div>
              <hr className="em-divider" />
              {selectedDocument?.versionHistory?.length ? (
                <ul className="em-history-list">
                  {selectedDocument.versionHistory.map((v, i) => (
                    <li key={i} className="em-history-item">
                      <div className="em-history-ver">v{v.version}</div>
                      <div className="em-history-info">
                        <div className="em-history-action">{v.action}</div>
                        <div className="em-history-meta">
                          {v.user?.name} ({v.user?.id}) &mdash; {new Date(v.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="em-history-empty">No version history available.</p>
              )}
            </div>
          )}

          {/* ── PDF DETAILS TAB ── */}
          {activeTab === "pdf" && (
            <div className="em-pdf-details-tab">
              <div className="em-form-heading">
                <div className="em-form-title">📄 PDF Details</div>
                <div className="em-form-sub">Read-only metadata from the uploaded document</div>
              </div>
              <hr className="em-divider" />
              <div className="em-pdf-meta-grid">
                {[
                  ["File Name",      docName],
                  ["File Format",    getFileFormat(selectedDocument?.documentName)],
                  ["File Size",      selectedDocument?.metadata?.fileSizeKB ? `${selectedDocument.metadata.fileSizeKB} KB` : "N/A"],
                  ["Document Type",  typeLabel],
                  ["Upload Status",  selectedDocument?.status || "N/A"],
                  ["Uploaded By", (() => { const u = selectedDocument?.uploadedBy || selectedDocument?.createdBy; if (!u) return "N/A"; if (typeof u === "object") return u.name || u.id || JSON.stringify(u); return String(u); })()],
                ].map(([label, value]) => (
                  <div key={label} className="em-pdf-meta-row">
                    <span className="em-pdf-meta-lbl">{label}</span>
                    <span className="em-pdf-meta-val">{typeof value === "object" && value !== null ? (value.name || value.id || JSON.stringify(value)) : (value ?? "N/A")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <Footer />
    </div>
  );
};

export default EditModal;
