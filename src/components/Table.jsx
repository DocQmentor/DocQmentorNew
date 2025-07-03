import React, { useState, useEffect } from "react";
import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import "./Table.css";
import { saveAs } from "file-saver";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import useSortableData from "../utils/useSortableData";
import { Info } from "lucide-react";
import FilePagination from "../Layout/Filepagination";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error.message || "An error occurred.",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red", textAlign: "center" }}>
          <h2>Something went wrong.</h2>
          <p>{this.state.errorMessage}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function getString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  if (typeof val === "object") {
    if ("valueString" in val) return val.valueString;
    if ("content" in val) return val.content;
    return JSON.stringify(val);
  }
  return "";
}

function Table() {
  const [invoiceData, setInvoiceData] = useState([]);
  const [vendorFilter, setVendorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploadDateFilter, setUploadDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [versionModal, setVersionModal] = useState({
    visible: false,
    history: [],
    docName: "",
  });

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      try {
        const response = await fetch(
          "https://docqmentorfuncapp.azurewebsites.net/api/DocQmentorFunc?code=8QYoFUxEDeqtrIGoDppeFQQPHT2hVYL1fWbRGvk4egJKAzFudPd6AQ=="
        );
        if (!response.ok) throw new Error("Failed to fetch invoice data");
        const data = await response.json();

        const processed = Array.isArray(data)
          ? data
              .filter((doc) => {
                const extracted = doc.extractedData || {};
                const confidence = doc.confidence || {};

                const requiredFields = [
                  "VendorName",
                  "InvoiceId",
                  "InvoiceDate",
                  "LPO NO",
                  "SubTotal",
                  "VAT",
                  "InvoiceTotal",
                ];

                for (const field of requiredFields) {
                  const val = extracted[field];
                  const score = confidence[field] ?? 1;
                  if (!val || score < 0.85) return false;
                }

                return true;
              })
              .map((doc) => {
                const extracted = doc.extractedData || {};
                return {
                  vendorName: getString(extracted.VendorName || doc.vendorName),
                  invoiceId: getString(extracted.InvoiceId || doc.invoiceId),
                  invoiceDate: getString(
                    extracted.InvoiceDate || doc.invoiceDate
                  ),
                  lpoNo: getString(
                    extracted["LPO NO"] || extracted.lpoNo || doc.lpoNo
                  ),
                  subTotal: getString(extracted.SubTotal || doc.subTotal),
                  vat: getString(extracted.VAT || doc.vat),
                  invoicetotal: getString(
                    extracted.InvoiceTotal ||
                      doc.invoicetotal ||
                      doc.invoiceTotal
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
          : [];

        setInvoiceData(processed);
        setError(null);
      } catch (err) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const handleInfoClick = (file) => {
    if (file.versionHistory && Array.isArray(file.versionHistory)) {
      setVersionModal({
        visible: true,
        history: file.versionHistory,
        docName: file.documentName || file.blobUrl || "Document",
      });
    } else {
      toast.info("No version history available.");
    }
  };

  const filteredData = invoiceData.filter((item) => {
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
      (item.subTotal || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const { sortedData, toggleSort, renderSortIcon, sortColumn, sortOrder } =
    useSortableData(filteredData);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = sortedData.slice(startIndex, startIndex + rowsPerPage);

  const handlePrevious = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  const handleExportCSV = () => {
    const csvHeader = [
      "Vendor Name",
      "Invoice ID",
      "Invoice Date",
      "LPO No",
      "Sub Total",
      "VAT",
      "Invoice Total",
      "Upload Date",
    ];
    const csvRows = filteredData.map((item) =>
      [
        `"${item.vendorName.replace(/"/g, '""')}"`,
        `"${item.invoiceId.replace(/"/g, '""')}"`,
        `"${item.invoiceDate.replace(/"/g, '""')}"`,
        `"${item.lpoNo.replace(/"/g, '""')}"`,
        `"${item.subTotal.replace(/"/g, '""')}"`,
        `"${item.vat.replace(/"/g, '""')}"`,
        `"${item.invoicetotal.replace(/"/g, '""')}"`,
        `"${item.uploadDate.replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csvContent = [csvHeader.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `DocQmentor_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleViewDocument = (file) => {
    let url = null;
    if (file.blobUrl && file.blobUrl.startsWith("http")) {
      url = file.blobUrl;
    } else if (file.url && file.url.startsWith("http")) {
      url = file.url;
    } else if (file.processedData?.blobUrl) {
      url = file.processedData.blobUrl;
    }

    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("File URL is not available");
      console.warn("⚠️ Cannot open file. Data:", file);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [
    vendorFilter,
    fromDate,
    toDate,
    uploadDateFilter,
    sortColumn,
    sortOrder,
    searchQuery,
  ]);

  return (
    <div className="table-component-container">
      <Header />
      <div className="dataview-container">
        <h1>Data View</h1>

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
            <strong>INV From Date:</strong>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label>
            <strong>INV To Date:</strong>
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
          <div className="search-export-bar">
            <button onClick={handleExportCSV}>Export</button>
          </div>
        </div>

        {loading && <p>Loading invoice data...</p>}
        {error && <p style={{ color: "red" }}>Error loading data: {error}</p>}

        <ErrorBoundary>
          {!loading && !error && (
            <>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("vendorName")}>
                      <span className="sortable-header">
                        Vendor Name {renderSortIcon("vendorName")}
                      </span>
                    </th>
                    <th onClick={() => toggleSort("invoiceId")}>
                      <span className="sortable-header">
                        Invoice ID {renderSortIcon("invoiceId")}
                      </span>
                    </th>
                    <th onClick={() => toggleSort("invoiceDate")}>
                      <span className="sortable-header">
                        Invoice Date {renderSortIcon("invoiceDate")}
                      </span>
                    </th>
                    <th onClick={() => toggleSort("lpoNo")}>
                      <span className="sortable-header">
                        LPO No {renderSortIcon("lpoNo")}
                      </span>
                    </th>
                    <th onClick={() => toggleSort("subTotal")}>
                      <span className="sortable-header">
                        Sub Total {renderSortIcon("subTotal")}
                      </span>
                    </th>
                    <th onClick={() => toggleSort("vat")}>
                      <span className="sortable-header">
                        VAT {renderSortIcon("vat")}
                      </span>
                    </th>
                    <th onClick={() => toggleSort("invoicetotal")}>
                      <span className="sortable-header">
                        Invoice Total {renderSortIcon("invoicetotal")}
                      </span>
                    </th>
                    <th onClick={() => toggleSort("uploadDate")}>
                      <span className="sortable-header">
                        Upload Date {renderSortIcon("uploadDate")}
                      </span>
                    </th>
                    <th onClick={() => toggleSort("confidenceScore")}>
                      <span className="sortable-header">
                        Confidence Score {renderSortIcon("confidenceScore")}
                      </span>
                    </th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.length > 0 ? (
                    currentRows.map((item, index) => (
                      <tr key={index}>
                        <td>{item.vendorName}</td>
                        <td>{item.invoiceId}</td>
                        <td>{item.invoiceDate}</td>
                        <td>{item.lpoNo}</td>
                        <td>{item.subTotal}</td>
                        <td>{item.vat}</td>
                        <td>{item.invoicetotal}</td>
                        <td>{item.uploadDate}</td>
                        <td>
                          {item._rawDocument?.status === "Reviewed" ? (
                            <span>
                              {item._rawDocument?.totalConfidenceScore || "N/A"}{" "}
                              <Info
                                size={16}
                                color="#007bff"
                                style={{ cursor: "pointer" }}
                                onClick={() =>
                                  handleInfoClick(item._rawDocument)
                                }
                              />
                            </span>
                          ) : (
                            item._rawDocument?.totalConfidenceScore || "N/A"
                          )}
                        </td>
                        <td>
                          <button
                            className="action-btn"
                            onClick={() =>
                              handleViewDocument(item._rawDocument)
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" style={{ textAlign: "center" }}>
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {versionModal.visible && (
                <div className="modal-backdrop">
                  <div className="modal">
                    <h3>Version History - {versionModal.docName}</h3>
                    <table className="version-table">
                      <thead>
                        <tr>
                          <th>Version</th>
                          <th>Action</th>
                          <th>User</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versionModal.history.map((v, i) => (
                          <tr key={i}>
                            <td>{v.version}</td>
                            <td>{v.action}</td>
                            <td>{v.user?.name || v.user?.id}</td>
                            <td>{new Date(v.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      onClick={() =>
                        setVersionModal({
                          visible: false,
                          history: [],
                          docName: "",
                        })
                      }
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* {filteredData.length > rowsPerPage && (
                <div style={{ marginTop: "15px", textAlign: "center" }}>
                  <button onClick={handlePrevious} disabled={currentPage === 1}>
                    Previous
                  </button>
                  Page {currentPage} of {totalPages}
                  <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )} */}
              <FilePagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
  rowsPerPage={rowsPerPage}
  totalItems={sortedData.length}
/>

            </>
          )}
        </ErrorBoundary>
      </div>
      <ToastContainer />
      <Footer />
    </div>
  );
}

export default Table;
