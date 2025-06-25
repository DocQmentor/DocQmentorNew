import React, { useState, useEffect } from "react";

import { useLocation, useNavigate } from "react-router-dom";
import { Edit, History, File, X, Save } from "lucide-react";
import "./EditModal.css";

const sanitizeNumeric = (value) => {
  if (!value) return "";
  return value.toString().replace(/[^\d.]/g, "");
};

const formatNumber = (value) => {
  if (!value) return "";
  return parseFloat(value).toLocaleString("en-IN");
};

// import { useLocation, useNavigate } from "react-router-dom";

const EditModal = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const selectedDocument = state?.selectedDocument;
  const initialEditedData = state?.editedData;

  const refreshData = () => window.location.reload(); // fallback if no prop
  const setShow = () => navigate(-1); // fallback for closing modal

  const [editDetails, setEditDetails] = useState(true);
  const [versionHistory, setVersionHistory] = useState(false);
  const [pdfDetails, setPDFDetails] = useState(false);
  const [saveSuccessful, setSaveSuccessful] = useState(false);

  const [edited, setEdited] = useState({
    VendorName: "",
    InvoiceId: "",
    InvoiceDate: "",
    LPO: "",
    SubTotal: "",
    VAT: "",
    InvoiceTotal: "",
  });

  useEffect(() => {
    if (initialEditedData) {
      setEdited({
        VendorName: initialEditedData.VendorName || "",
        InvoiceId: initialEditedData.InvoiceId || "",
        InvoiceDate: initialEditedData.InvoiceDate || "",
        LPO: sanitizeNumeric(initialEditedData.LPO),
        SubTotal: sanitizeNumeric(initialEditedData.SubTotal),
        VAT: sanitizeNumeric(initialEditedData.VAT),
        InvoiceTotal: sanitizeNumeric(initialEditedData.InvoiceTotal),
      });
    }
  }, [initialEditedData]);

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
  try {
    // Clean the original score
    const score = selectedDocument.totalConfidenceScore;
    let numericScore = typeof score === "string"
      ? parseFloat(score.replace(/[^\d.]/g, ""))
      : Number(score);

    const reviewedScore = isNaN(numericScore)
      ? "Reviewed"
      : `${numericScore.toFixed(2)}% Reviewed`;

    const updatedDoc = {
      ...selectedDocument,
      extractedData: {
        VendorName: edited.VendorName,
        InvoiceId: edited.InvoiceId,
        InvoiceDate: edited.InvoiceDate,
        "LPO NO": edited.LPO,
        SubTotal: edited.SubTotal,
        VAT: edited.VAT,
        InvoiceTotal: edited.InvoiceTotal,
      },
      wasReviewed: true,
      totalConfidenceScore: reviewedScore, // ✅ update score with "Reviewed"
    };

    const response = await fetch(
      "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=8QYoFUxEDeqtrIGoDppeFQQPHT2hVYL1fWbRGvk4egJKAzFudPd6AQ==",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedDoc),
      }
    );

    if (!response.ok) throw new Error("Failed to update");

    refreshData();         // Reload the table data
    setShow(true);         // Hide modal
    setSaveSuccessful(true); // Redirect to table
  } catch (err) {
    console.error("❌ Save error:", err);
  }
};


  return (
    <div className="ManualReview-Edit-container">
      <div className="ManualReview-Edit-show-file">
        <header>
          {selectedDocument?.fileName ||
            selectedDocument?.documentName ||
            "Document"}
        </header>
        {selectedDocument?.blobUrl ? (
          <iframe
            src={selectedDocument.blobUrl}
            className="pdf-preview"
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
            <li onClick={handleCancel}>
              <X size={20} />
            </li>
          </ul>
        </nav>

        {editDetails && (
          <div className="ManualReview-Edit-editDetails">
            <form className="ManualReview-Edit-editDetails-form">
              <h3>Edit Details</h3>

              <label>Vendor Name</label>
              <input
                type="text"
                value={edited.VendorName}
                onChange={(e) =>
                  setEdited({ ...edited, VendorName: e.target.value })
                }
              />

              <label>Invoice ID</label>
              <input
                type="text"
                value={edited.InvoiceId}
                onChange={(e) =>
                  setEdited({ ...edited, InvoiceId: e.target.value })
                }
              />

              <label>Invoice Date</label>
              <input
                type="date"
                value={edited.InvoiceDate}
                onChange={(e) =>
                  setEdited({ ...edited, InvoiceDate: e.target.value })
                }
              />

              <label>LPO Number</label>
              <input
                type="text"
                value={edited.LPO}
                onChange={(e) =>
                  setEdited({ ...edited, LPO: sanitizeNumeric(e.target.value) })
                }
              />

              <label>Sub Total</label>
              <input
                type="text"
                value={edited.SubTotal}
                onChange={(e) =>
                  setEdited({
                    ...edited,
                    SubTotal: sanitizeNumeric(e.target.value),
                  })
                }
              />

              <label>VAT</label>
              <input
                type="text"
                value={edited.VAT}
                onChange={(e) =>
                  setEdited({
                    ...edited,
                    VAT: sanitizeNumeric(e.target.value),
                  })
                }
              />

              <label>Invoice Total</label>
              <input
                type="text"
                value={edited.InvoiceTotal}
                onChange={(e) =>
                  setEdited({
                    ...edited,
                    InvoiceTotal: sanitizeNumeric(e.target.value),
                  })
                }
              />

              <ul className="ManualReview-Edit-editDetails-form-ul">
                <li
                  className="ManualReview-Edit-editDetails-form-ul-Cancel"
                  onClick={handleCancel}
                >
                  <X size={20} /> Cancel
                </li>
                <li
                  className="ManualReview-Edit-editDetails-form-ul-Save-Changes"
                  onClick={handleSave}
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
