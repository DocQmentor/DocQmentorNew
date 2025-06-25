import React, { useState, useEffect } from "react";
import "./ManualReview.css";
import Footer from "../Layout/Footer";
import EditModal from "./EditModal";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";

const ManualReview = () => {
  const [show, setShow] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [manualReviewDocs, setManualReviewDocs] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [editedData, setEditedData] = useState({
    VendorName: "",
    InvoiceDate: "",
    LPO: "",
    SubTotal: "",
    VAT: "",
    InvoiceTotal: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const location = useLocation();
const sanitizeNumeric = (val) => {
  if (!val) return "";
  const str = typeof val === "object" ? val?.valueString || JSON.stringify(val) : val.toString();
  return str.replace(/[^\d.-]/g, ""); // remove ₹, commas, spaces
};
const navigate = useNavigate();

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
  const editedDoc = {
    VendorName: getString(doc.extractedData?.VendorName),
    InvoiceDate: getString(doc.extractedData?.InvoiceDate),
    LPO: getString(doc.extractedData?.["LPO NO"]),
    SubTotal: sanitizeNumeric(doc.extractedData?.SubTotal),
    VAT: sanitizeNumeric(doc.extractedData?.VAT),
    InvoiceTotal: sanitizeNumeric(doc.extractedData?.InvoiceTotal),
  };

  navigate("/editmodal", {
    state: {
      selectedDocument: doc,
      editedData: editedDoc,
    },
  });
};



  // console.log("extractedData keys for debug:", Object.keys(doc.extractedData));

  const handleVendorChange = (e) => {
    setSelectedVendor(e.target.value);
    setCurrentPage(1); // reset pagination on filter change
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

  // Pagination logic
  const totalPages = Math.ceil(filteredDocs.length / rowsPerPage);
  const paginatedDocs = filteredDocs.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

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
              {paginatedDocs.length > 0 ? (
                paginatedDocs.map((doc, index) => (
                  <tr key={index}>
                    <td>{getString(doc?.extractedData?.VendorName)}</td>
                    {/* <td>{doc?.fileName || doc?.documentName || ""}</td> */}
                    <td>{getString(doc?.extractedData?.InvoiceId)}</td>
                    <td>{getString(doc?.extractedData?.InvoiceDate)}</td>
                    <td>{getString(doc?.extractedData?.["LPO NO"])}</td>
                    <td>{getString(doc?.extractedData?.SubTotal)}</td>
                    <td>{getString(doc?.extractedData?.VAT)}</td>
                    <td>{getString(doc?.extractedData?.InvoiceTotal)}</td>
                    <td>{doc.totalConfidenceScore?.toFixed(2) || "0.00"}%</td>
                    <td>
                      <button onClick={() => handleToggle(doc)}>Edit</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center" }}>
                    {selectedVendor
                      ? `No documents requiring manual review for vendor: ${selectedVendor}`
                      : "No documents requiring manual review"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {filteredDocs.length > rowsPerPage && (
            <div style={{ marginTop: "15px", textAlign: "center" }}>
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                style={{ padding: "6px 10px", marginRight: "10px" }}
              >
                Previous
              </button>
              Page {currentPage} of {totalPages}
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                style={{ padding: "6px 10px", marginLeft: "10px" }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <EditModal
          selectedDocument={selectedDocument}
          editedData={editedData}
          setEditedData={setEditedData}
          setShow={setShow}
        />
      )}
      <footer>
        <Footer />
      </footer>
    </div>
  );
};

export default ManualReview;
