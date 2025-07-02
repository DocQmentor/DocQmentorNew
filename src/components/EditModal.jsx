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

  const refreshData = () => window.location.reload(); // fallback
  const setShow = () => navigate(-1); // fallback

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
    const isEmpty = Object.entries(edited).some(
      ([key, value]) => !value || value.trim() === ""
    );

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

      const response = await fetch(
        "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=8QYoFUxEDeqtrIGoDppeFQQPHT2hVYL1fWbRGvk4egJKAzFudPd6AQ==",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedDoc),
        }
      );

      if (!response.ok) throw new Error("Failed to update");

      refreshData();
      setShow(true);
      setSaveSuccessful(true);
    } catch (err) {
      console.error("❌ Save error:", err);
    }
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
                    setEdited({
                      ...edited,
                      LPO: sanitizeNumeric(e.target.value),
                    })
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
            <div>
              <ul>
                <li>
                  <p>name:</p>
                  <p>{selectedDocument.documentName}</p>
                </li>
                <li>
                  <p>PDF version:</p>
                  <p>1.4</p>
                </li>
                <li>
                  <p>Page count:</p>
                  <p>1</p>
                </li>
                <li>
                  <p>Page size:</p>
                  <p>8.26 x 11.69 in (portrait)</p>
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
