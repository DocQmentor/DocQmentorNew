import React, { useState, useEffect } from "react";
import "./ManualReview.css";
import Footer from "../Layout/Footer";
import EditModal from "./EditModal";
import { useNavigate } from "react-router-dom";
import useSortableData from "../utils/useSortableData";
 
const ManualReview = () => {
  const [show, setShow] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [manualReviewDocs, setManualReviewDocs] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [editedData, setEditedData] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [vendorFilter, setVendorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploadDateFilter, setUploadDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const rowsPerPage = 10;
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
      setLoading(true);
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
        setError(null);
      } catch (error) {
        setError(error.message || "Failed to fetch documents");
        console.error("❌ Failed to fetch from Cosmos DB:", error);
      } finally {
        setLoading(false);
      }
    }
 
    fetchDocsFromCosmos();
  }, [refreshTrigger]);
 
  useEffect(() => {
    const filtered = manualReviewDocs
      .map((doc) => {
        const extracted = doc.extractedData || {};
        return {
          vendorName: getString(extracted.VendorName || doc.vendorName),
          invoiceId: getString(extracted.InvoiceId || doc.invoiceId),
          invoiceDate: getString(extracted.InvoiceDate || doc.invoiceDate),
          lpoNo: getString(extracted["LPO NO"] || extracted.lpoNo || doc.lpoNo),
          subTotal: getString(extracted.SubTotal || doc.subTotal),
          vat: getString(extracted.VAT || doc.vat),
          invoicetotal: getString(
            extracted.InvoiceTotal || doc.invoicetotal || doc.invoiceTotal
          ),
          uploadDate: doc.timestamp
            ? new Date(doc.timestamp).toLocaleDateString("en-CA")
            : "",
          rawUploadDate: doc.timestamp ? new Date(doc.timestamp) : null,
          fileUrl: doc.fileUrl || null,
          confidenceScore:
            typeof doc.totalConfidenceScore === "string"
              ? doc.totalConfidenceScore
              : `${(doc.totalConfidenceScore || 0).toFixed(2)}`,
          _rawDocument: doc,
        };
      })
      .filter((item) => {
        const matchesVendor = item.vendorName
          .toLowerCase()
          .includes(vendorFilter.toLowerCase());
        const matchesSearch =
          (item.invoiceId || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (item.invoiceDate || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (item.subTotal || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (item.vat || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.invoicetotal || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (item.lpoNo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
 
        const itemInvoiceDate = item.invoiceDate
          ? new Date(item.invoiceDate)
          : null;
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;
        const matchesInvoiceDate =
          (!from || (itemInvoiceDate && itemInvoiceDate >= from)) &&
          (!to || (itemInvoiceDate && itemInvoiceDate <= to));
 
        const now = new Date();
        const uploadDate = item.rawUploadDate;
        let matchesUploadFilter = true;
        if (uploadDateFilter === "7days") {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          matchesUploadFilter = uploadDate >= sevenDaysAgo && uploadDate <= now;
        } else if (uploadDateFilter === "30days") {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          matchesUploadFilter = uploadDate >= thirtyDaysAgo && uploadDate <= now;
        }
 
        return (
          matchesVendor &&
          matchesInvoiceDate &&
          matchesUploadFilter &&
          matchesSearch
        );
      });
 
    setFilteredDocs(filtered);
    setCurrentPage(1);
  }, [manualReviewDocs, vendorFilter, fromDate, toDate, uploadDateFilter, searchQuery]);
 
  const { sortedData, toggleSort, renderSortIcon } = useSortableData(filteredDocs);
 
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
 
  const totalPages = Math.ceil(filteredDocs.length / rowsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
 
  const handlePrevious = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
 
  return (
    <div className="ManualReview-full-container">
      {show ? (
        <div className="ManualReview-main-container">
          <div className="ManualReview-Table-header">
            <h1>Manual Review</h1>
            <div className="filters">
              <label>
                <strong>Vendor:</strong>
                <input
                  type="text"
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  placeholder="Enter vendor name"
                />
              </label>
              <label>
                <strong>From Date:</strong>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>
              <label>
                <strong>To Date:</strong>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
              <label>
                <strong>Upload Date:</strong>
                <select
                  value={uploadDateFilter}
                  onChange={(e) => setUploadDateFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>
              </label>
              <label>
                <strong>Search All:</strong>
                <input
                  type="text"
                  placeholder="Search by Invoice ID or LPO No"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>
            </div>
            <p>{filteredDocs.length} documents requiring manual review</p>
          </div>
 
          {loading && <p>Loading documents...</p>}
          {error && <p style={{ color: "red" }}>Error: {error}</p>}
 
          <table className="ManualReview-Table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("vendorName")}>
                  Vendor Name {renderSortIcon("vendorName")}
                </th>
                <th onClick={() => toggleSort("invoiceId")}>
                  Invoice ID {renderSortIcon("invoiceId")}
                </th>
                <th onClick={() => toggleSort("invoiceDate")}>
                  Invoice Date {renderSortIcon("invoiceDate")}
                </th>
                <th onClick={() => toggleSort("lpoNo")}>
                  LPO Number {renderSortIcon("lpoNo")}
                </th>
                <th onClick={() => toggleSort("subTotal")}>
                  Sub Total {renderSortIcon("subTotal")}
                </th>
                <th onClick={() => toggleSort("vat")}>
                  VAT {renderSortIcon("vat")}
                </th>
                <th onClick={() => toggleSort("invoicetotal")}>
                  Total {renderSortIcon("invoicetotal")}
                </th>
                <th onClick={() => toggleSort("confidenceScore")}>
                  Confidence Score {renderSortIcon("confidenceScore")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item, index) => (
                  <tr key={index}>
                    <td>{item.vendorName}</td>
                    <td>{item.invoiceId}</td>
                    <td>{item.invoiceDate}</td>
                    <td>{item.lpoNo}</td>
                    <td>{formatNumber(item.subTotal)}</td>
                    <td>{formatNumber(item.vat)}</td>
                    <td>{formatNumber(item.invoicetotal)}</td>
                    <td>{item.confidenceScore}</td>
                    <td>
                      <button onClick={() => handleToggle(item._rawDocument)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center" }}>
                    {loading
                      ? "Loading..."
                      : "No documents requiring manual review"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
 
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
 