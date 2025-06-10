import React, { useState, useEffect } from "react";
import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import "./Table.css";
import { saveAs } from "file-saver";
 
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }
 
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.message || "An error occurred." };
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
  const [sortColumn, setSortColumn] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
 
  useEffect(() => {
    // Replace your current fetchInvoices function with this:
async function fetchInvoices() {
  setLoading(true);
  try {
    const response = await fetch("https://docap.azurewebsites.net/api/DocQmentorFunc?code=n4SOThz-nkfGfs96hGTtAsvm3ZS2wt7O3pqELLzWqi38AzFuUm090A==");
    if (!response.ok) throw new Error("Failed to fetch invoice data");
    const data = await response.json();
   
    const processed = Array.isArray(data)
      ? data.map((doc) => {
          // Extract fields from nested extractedData or use root fallback
          const extracted = doc.extractedData || {};
          return {
            vendorName: getString(extracted.VendorName || doc.vendorName),
            invoiceId: getString(extracted.InvoiceId || doc.invoiceId),
            invoiceDate: getString(extracted.InvoiceDate || doc.invoiceDate),
            lpoNo: getString(extracted["LPO NO"] || extracted.lpoNo || doc.lpoNo),
            subTotal: getString(extracted.SubTotal || doc.subTotal),
            vat: getString(extracted.VAT || doc.vat),
            invoicetotal: getString(extracted.InvoiceTotal || doc.invoicetotal || doc.invoiceTotal),
            uploadDate: doc.timestamp ? new Date(doc.timestamp).toLocaleDateString("en-CA") : "",
            rawUploadDate: doc.timestamp ? new Date(doc.timestamp) : null,
            // Include the full document for debugging
            _rawDocument: doc
          };
        })
      : [];
   
    console.log("Processed invoices:", processed); // Debug log
    setInvoiceData(processed);
    setError(null);
  } catch (err) {
    console.error("Fetch error:", err); // Debug log
    setError(err.message || "Unknown error");
  } finally {
    setLoading(false);
  }
}
    fetchInvoices();
  }, []);
 
  const toggleSort = (column) => {
    if (sortColumn === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortOrder("asc");
    }
  };
 
  const filteredData = invoiceData
    .filter((item) => {
      const matchesVendor = item.vendorName.toLowerCase().includes(vendorFilter.toLowerCase());
      const matchesSearch = item.invoiceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.lpoNo.toLowerCase().includes(searchQuery.toLowerCase());
 
      const itemInvoiceDate = item.invoiceDate ? new Date(item.invoiceDate) : null;
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
 
      return matchesVendor && matchesInvoiceDate && matchesUploadFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      let valA = a[sortColumn];
      let valB = b[sortColumn];
      if (sortColumn.toLowerCase().includes("date")) {
        valA = valA ? new Date(valA) : new Date(0);
        valB = valB ? new Date(valB) : new Date(0);
      } else {
        valA = valA?.toString().toLowerCase() || "";
        valB = valB?.toString().toLowerCase() || "";
      }
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
 
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredData.slice(startIndex, startIndex + rowsPerPage);
 
  const handlePrevious = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
 
  const renderSortIcon = (column) => {
    if (sortColumn === column) return sortOrder === "asc" ? " ▲" : " ▼";
    return "";
  };
 
  const handleExportCSV = () => {
  const csvHeader = ["Vendor Name", "Invoice ID", "Invoice Date", "LPO No", "Sub Total", "VAT", "Invoice Total", "Upload Date"];
  
  // Create CSV rows from filteredData
  const csvRows = filteredData.map(item => [
    `"${item.vendorName.replace(/"/g, '""')}"`,
    `"${item.invoiceId.replace(/"/g, '""')}"`,
    `"${item.invoiceDate.replace(/"/g, '""')}"`,
    `"${item.lpoNo.replace(/"/g, '""')}"`,
    `"${item.subTotal.replace(/"/g, '""')}"`,
    `"${item.vat.replace(/"/g, '""')}"`,
    `"${item.invoicetotal.replace(/"/g, '""')}"`,
    `"${item.uploadDate.replace(/"/g, '""')}"`
  ].join(","));

  // Combine header and rows with proper line breaks
  const csvContent = [csvHeader.join(","), ...csvRows].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `DocQmentor_Report_${new Date().toISOString().slice(0,10)}.csv`);
};
 
  useEffect(() => {
    setCurrentPage(1);
  }, [vendorFilter, fromDate, toDate, uploadDateFilter, sortColumn, sortOrder, searchQuery]);
 
  return (
    <div className="table-component-container">
      <Header />
      <div className="dataview-container">
        <h2>Data View</h2>
        <div style={{ display: "flex", gap: "20px", marginBottom: "15px", flexWrap: "wrap" }}>
          <label><strong>Vendor :</strong>
            <input type="text" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} placeholder="Enter vendor name" style={{ padding: "5px" }} />
          </label>
          <label><strong>From Date:</strong>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label><strong>To Date:</strong>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <label><strong>Upload Date:</strong>
            <select value={uploadDateFilter} onChange={(e) => setUploadDateFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </label>
        </div>
 
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", flexWrap: "wrap" }}>
          <input type="text" placeholder="Search by Invoice ID or LPO No" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: "5px", minWidth: "250px" }} />
          <button onClick={handleExportCSV} style={{ padding: "6px 12px", background: "#004080", color: "white", border: "none", borderRadius: "4px" }}>Export as CSV</button>
        </div>
 
        {loading && <p>Loading invoice data...</p>}
        {error && <p style={{ color: "red" }}>Error loading data: {error}</p>}
 
        <ErrorBoundary>
          {!loading && !error && (
            <>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("vendorName")}>Vendor Name{renderSortIcon("vendorName")}</th>
                    <th>Invoice ID</th>
                    <th onClick={() => toggleSort("invoiceDate")}>Invoice Date{renderSortIcon("invoiceDate")}</th>
                    <th>LPO No</th>
                    <th>Sub Total</th>
                    <th>VAT</th>
                    <th>Invoice Total</th>
                    <th>Upload Date</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.length > 0 ? (
                    currentRows.map((item, index) => (
                      <tr key={index} style={{
                        backgroundColor: (() => {
                          const invoiceDate = item.invoiceDate ? new Date(item.invoiceDate) : null;
                          if (!invoiceDate) return "";
                          const today = new Date();
                          const diff = (today - invoiceDate) / (1000 * 60 * 60 * 24);
                          if (diff <= 7) return "#d4edda";
                          else if (diff <= 30) return "#fff3cd";
                          else return "#f8d7da";
                        })()
                      }}>
                        <td>{item.vendorName}</td>
                        <td>{item.invoiceId}</td>
                        <td>{item.invoiceDate}</td>
                        <td>{item.lpoNo}</td>
                        <td>{item.subTotal}</td>
                        <td>{item.vat}</td>
                        <td>{item.invoicetotal}</td>
                        <td>{item.uploadDate}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="8" style={{ textAlign: "center" }}>No records found.</td></tr>
                  )}
                </tbody>
              </table>
 
              {filteredData.length > rowsPerPage && (
                <div style={{ marginTop: "15px", textAlign: "center" }}>
                  <button onClick={handlePrevious} disabled={currentPage === 1} style={{ padding: "6px 10px", marginRight: "10px" }}>Previous</button>
                  Page {currentPage} of {totalPages}
                  <button onClick={handleNext} disabled={currentPage === totalPages} style={{ padding: "6px 10px", marginLeft: "10px" }}>Next</button>
                </div>
              )}
            </>
          )}
        </ErrorBoundary>
      </div>
      <Footer />
    </div>
  );
}
 
export default Table;