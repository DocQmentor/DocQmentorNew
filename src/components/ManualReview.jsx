import React, { useState, useEffect } from "react";
import "./ManualReview.css";
import Footer from "../Layout/Footer";
import EditModal from "./EditModal";
import { useNavigate } from "react-router-dom";
const ManualReview = () => {
  const [show, setShow] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [manualReviewDocs, setManualReviewDocs] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [editedData, setEditedData] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(false);
const navigate = useNavigate();
  const getString = (val) => {
    if (!val) return "";
    if (typeof val === "string" || typeof val === "number") return val;
    if (typeof val === "object") {
      return val?.valueString || val?.content || JSON.stringify(val);
    }
    return "";
  };
const handleEditClick = () => {
    navigate("/editmodal");
  };

  const refreshData = () => {
    setRefreshTrigger((prev) => !prev);
  };
  const formatNumber = (value) => {
    if (!value) return "";
    const num = parseFloat(String(value).replace(/[^\d.-]/g, ""));
    if (isNaN(num)) return "";
    return num.toLocaleString("en-IN"); // Indian comma format
  };

  useEffect(() => {
    async function fetchDocsFromCosmos() {
      try {
        const response = await fetch(
          "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=8QYoFUxEDeqtrIGoDppeFQQPHT2hVYL1fWbRGvk4egJKAzFudPd6AQ=="
        );
        const data = await response.json();
        const docsNeedingReview = data.filter((doc) => {
          if (doc.wasReviewed) return false;
          const extracted = doc.extractedData || {};
          const confidence = doc.confidenceScores || {};
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
  }, [refreshTrigger]);

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
  const editedDoc = {
    VendorName: getString(doc.extractedData?.VendorName),
    InvoiceId: getString(doc.extractedData?.InvoiceId),
    InvoiceDate: getString(doc.extractedData?.InvoiceDate),
    LPO: getString(doc.extractedData?.["LPO NO"]),
    SubTotal: getString(doc.extractedData?.SubTotal),
    VAT: getString(doc.extractedData?.VAT),
    InvoiceTotal: getString(doc.extractedData?.InvoiceTotal),
  };

  navigate("/editmodal", {
    state: {
      selectedDocument: doc,
      editedData: editedDoc,
    },
  });
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
                {/* <th>File Name</th> */}
                <th>Invoice ID</th>
                <th>Invoice Date</th>
                <th>LPO Number</th>
                <th>Sub Total</th>
                <th>VAT</th>
                <th>Total</th>
                <th>Confidence Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc, index) => (
                  <tr key={index}>
                    <td>{getString(doc?.extractedData?.VendorName)}</td>
                    {/* <td>{doc?.fileName || doc?.documentName || ""}</td> */}
                    <td>{getString(doc?.extractedData?.InvoiceId)}</td>
                    <td>{getString(doc?.extractedData?.InvoiceDate)}</td>
                    <td>{getString(doc?.extractedData?.["LPO NO"])}</td>
                    <td>{formatNumber(doc?.extractedData?.SubTotal)}</td>
                    <td>{formatNumber(doc?.extractedData?.VAT)}</td>
                    <td>{formatNumber(doc?.extractedData?.InvoiceTotal)}</td>
                    <td>
                      {typeof doc.totalConfidenceScore === "string"
                        ? doc.totalConfidenceScore
                        : `${(doc.totalConfidenceScore || 0).toFixed(2)}`}
                      {doc.wasReviewed && ", reviewed"}
                    </td>
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
        <EditModal
          selectedDocument={selectedDocument}
          editedData={editedData}
          setEditedData={setEditedData}
          setShow={setShow}
          refreshData={refreshData}
        />
      )}
      <footer>
        <Footer />
      </footer>
    </div>
  );
};

export default ManualReview;
