import React, { useState, useEffect } from "react";
import "./ManualReview.css";
import Footer from "../Layout/Footer";
import { Edit, History, File, X, Save } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const ManualReview = () => {
  const [show, setShow] = useState(true);
  const [editDetails, setEditDetails] = useState(true);
  const [versionHistory, setVersionHistory] = useState(false);
  const [pdfDetails, setPDFDetails] = useState(false);
  const [Properties, setProperties] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [manualReviewDocs, setManualReviewDocs] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [filteredDocs, setFilteredDocs] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();
  const [editedData, setEditedData] = useState({
    VendorName: "",
    InvoiceDate: "",
    LPO: "",
    SubTotal: "",
    VAT: "",
    InvoiceTotal: "",
  });

  const getString = (val) => {
    if (!val) return "";
    if (typeof val === "string" || typeof val === "number") return val;
    if (typeof val === "object") {
      return val?.valueString || val?.content || JSON.stringify(val);
    }
    return "";
  };

  useEffect(() => {
    async function fetchDocsFromCosmos() {
      try {
        const response = await fetch(
          "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=8QYoFUxEDeqtrIGoDppeFQQPHT2hVYL1fWbRGvk4egJKAzFudPd6AQ=="
        );
        const data = await response.json();
        const docsNeedingReview = data.filter((doc) => {
          const extracted = doc.extractedData || {};
          const confidence = doc.confidence || {};
          const totalScore = doc.totalConfidenceScore || 0;

          const requiredFields = [
            "VendorName",
            "InvoiceId",
            "InvoiceDate",
            "LPO NO",
            "SubTotal",
            "VAT",
            "InvoiceTotal",
          ];

          const hasMissing = requiredFields.some(
            (field) => !extracted[field] || !getString(extracted[field])
          );

          const lowFieldConfidence = requiredFields.some(
            (field) =>
              confidence[field] !== undefined && confidence[field] < 0.85
          );

          const lowTotalConfidence = totalScore < 85;

          return hasMissing || lowFieldConfidence || lowTotalConfidence;
        });

        setManualReviewDocs(docsNeedingReview);
      } catch (error) {
        console.error("❌ Failed to fetch from Cosmos DB:", error);
      }
    }

    fetchDocsFromCosmos();
  }, []);

  useEffect(() => {
    if (!selectedVendor) {
      setFilteredDocs(manualReviewDocs);
    } else {
      const filtered = manualReviewDocs.filter(
        (doc) =>
          (doc.vendorName || "")
            .toLowerCase()
            .includes(selectedVendor.toLowerCase()) ||
          (doc.documentName || "")
            .toLowerCase()
            .includes(selectedVendor.toLowerCase())
      );
      setFilteredDocs(filtered);
    }
  }, [manualReviewDocs, selectedVendor]);

  const handleToggle = (doc) => {
    setSelectedDocument(doc);
    setEditedData({
      VendorName: getString(doc.extractedData?.VendorName),
      InvoiceDate: getString(doc.extractedData?.InvoiceDate),
      LPO: getString(doc.extractedData?.["LPO NO"]),
      SubTotal: getString(doc.extractedData?.SubTotal),
      VAT: getString(doc.extractedData?.VAT),
      InvoiceTotal: getString(doc.extractedData?.InvoiceTotal),
    });
    showSection("editDetails");
    setShow(false);
  };

  const showSection = (section) => {
    setEditDetails(section === "editDetails");
    setVersionHistory(section === "versionHistory");
    setPDFDetails(section === "pdfDetails");
    setProperties(section === "properties");
  };

  const handleVendorChange = (e) => {
    setSelectedVendor(e.target.value);
  };

  const vendorOptions = [
    ...new Set(
      manualReviewDocs.map(
        (doc) => doc.vendorName || doc.documentName || "Unknown"
      )
    ),
  ]
    .filter(Boolean)
    .sort();

  return (
    <div className="ManualReview-full-container">
      {show ? (
        <div className="ManualReview-main-container">
          <div className="ManualReview-Table-header">
            <h1>Manual Review</h1>
            <div className="vendor-filter">
              <label>Filter by Vendor:</label>
              <select
                value={selectedVendor}
                onChange={handleVendorChange}
                className="vendor-dropdown"
              >
                <option value="">All Vendors</option>
                {vendorOptions.map((vendor, index) => (
                  <option key={index} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </div>
            <p>{filteredDocs.length} documents requiring manual review</p>
          </div>
          <table className="ManualReview-Table">
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>File Name</th>
                <th>Invoice ID</th>
                <th>Invoice Date</th>
                <th>LPO Number</th>
                <th>Sub Total</th>
                <th>VAT</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc, index) => (
                  <tr key={index}>
                    <td>{getString(doc?.extractedData?.VendorName)}</td>
                    <td>{doc?.fileName || doc?.documentName || ""}</td>
                    <td>{getString(doc?.extractedData?.InvoiceId)}</td>
                    <td>{getString(doc?.extractedData?.InvoiceDate)}</td>
                    <td>{getString(doc?.extractedData?.["LPO NO"])}</td>
                    <td>{getString(doc?.extractedData?.SubTotal)}</td>
                    <td>{getString(doc?.extractedData?.VAT)}</td>
                    <td>{getString(doc?.extractedData?.InvoiceTotal)}</td>
                    <td>
                      <button onClick={() => handleToggle(doc)}>Edit</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center" }}>
                    {selectedVendor
                      ? `No documents requiring manual review for vendor: ${selectedVendor}`
                      : "No documents requiring manual review"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
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
                  <li onClick={() => setShow(true)}>
                    <X size={20} />
                  </li>
                </ul>
              </nav>
              {editDetails && selectedDocument && (
                <div className="ManualReview-Edit-editDetails">
                  <form className="ManualReview-Edit-editDetails-form">
                    <h3>Edit Details</h3>
                    <label>Vendor Name</label>
                    <input
                      type="text"
                      value={editedData.VendorName}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          VendorName: e.target.value,
                        })
                      }
                    />

                    <label>Invoice Date</label>
                    <input
                      type="date"
                      value={editedData.InvoiceDate}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          InvoiceDate: e.target.value,
                        })
                      }
                    />

                    <label>LPO Number</label>
                    <input
                      type="text"
                      value={editedData.LPO}
                      onChange={(e) =>
                        setEditedData({ ...editedData, "LPO": e.target.value })
                      }
                    />

                    <label>Sub Total</label>
                    <input
                      type="number"
                      value={editedData.SubTotal}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          SubTotal: e.target.value,
                        })
                      }
                    />

                    <label>VAT</label>
                    <input
                      type="number"
                      value={editedData.VAT}
                      onChange={(e) =>
                        setEditedData({ ...editedData, VAT: e.target.value })
                      }
                    />

                    <label>Invoice Total</label>
                    <input
                      type="number"
                      value={editedData.InvoiceTotal}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          InvoiceTotal: e.target.value,
                        })
                      }
                    />

                    <ul className="ManualReview-Edit-editDetails-form-ul">
                      <li
                        className="ManualReview-Edit-editDetails-form-ul-Cancel"
                        onClick={() => setShow(true)}
                      >
                        <X size={20} /> Cancel
                      </li>
                      <li
                        className="ManualReview-Edit-editDetails-form-ul-Save-Changes"
                        onClick={() => setShow(true)}
                      >
                        <Save size={20} /> Save Changes
                      </li>
                    </ul>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <footer>
        <Footer />
      </footer>
    </div>
  );
};

export default ManualReview;
