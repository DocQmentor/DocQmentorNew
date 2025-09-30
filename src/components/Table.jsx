import React, { useState, useEffect } from "react";
import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import FilePagination from "../Layout/Filepagination";
import "./Table.css";
import { saveAs } from "file-saver";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import useSortableData from "../utils/useSortableData";
import { Info } from "lucide-react";

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

const modelTypeHeaders = {
  Invoice: [
    "Vendor Name",
    "Invoice ID",
    "Invoice Date",
    "LPO No",
    "Sub Total",
    "VAT",
    "Invoice Total",
    "Upload Date",
    "Confidence Score",
    "Action",
  ],
  BankStatement: [
    "AccountHolder",
    "AccountNumber",
    "StatementPeriod",
    "OpeningBalance",
    "ClosingBalance",
    "Upload Date",
    "Confidence Score",
    "Action",
  ],
  MortgageForms: [
    "LenderName",
    "BorrowerName",
    "LoanAmount",
    "Interest",
    "LoanTenure",
    "Upload Date",
    "Confidence Score",
    "Action",
  ],
};

const modelTypeKeys = {
  Invoice: [
    "vendorName",
    "invoiceId",
    "invoiceDate",
    "lpoNo",
    "subTotal",
    "vat",
    "invoicetotal",
    "uploadDate",
    "confidenceScore",
    "_rawDocument",
  ],
  BankStatement: [
    "AccountHolder",
    "AccountNumber",
    "StatementPeriod",
    "OpeningBalance",
    "ClosingBalance",
    "uploadDate",
    "confidenceScore",
    "_rawDocument",
  ],
  MortgageForms: [
    "LenderName",
    "BorrowerName",
    "LoanAmount",
    "Interest",
    "LoanTenure",
    "uploadDate",
    "confidenceScore",
    "_rawDocument",
  ],
};

function Table() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedModelType, setSelectedModelType] = useState(localStorage.getItem("selectedModelType") || "Invoice");
  
  // Filter states
  const [vendorFilter, setVendorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploadDateFilter, setUploadDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const rowsPerPage = 10;

  const handleModelTypeChange = (type) => {
    setSelectedModelType(type);
    localStorage.setItem("selectedModelType", type);
  };

  // Reset all filters function
  const handleResetFilters = () => {
    setVendorFilter("");
    setFromDate("");
    setToDate("");
    setUploadDateFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const { sortedData, toggleSort, renderSortIcon } = useSortableData(filteredData);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const response = await fetch(
          "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
        );
        const fetched = await response.json();

        const processed = fetched
          .filter((doc) => doc.modelType === selectedModelType)
          .map((doc) => {
            const extracted = doc.extractedData || {};
            const commonFields = {
              uploadDate: doc.timestamp
                ? new Date(doc.timestamp).toLocaleDateString("en-CA")
                : "",
              rawUploadDate: doc.timestamp ? new Date(doc.timestamp) : null,
              confidenceScore: doc.totalConfidenceScore
                ? parseFloat(doc.totalConfidenceScore) || 0
                : "N/A",
              _rawDocument: doc,
            };

            if (selectedModelType === "Invoice") {
              return {
                vendorName: getString(extracted.VendorName),
                invoiceId: getString(extracted.InvoiceId),
                invoiceDate: getString(extracted.InvoiceDate),
                lpoNo: getString(extracted["LPO NO"]),
                subTotal: getString(extracted.SubTotal),
                vat: getString(extracted.VAT),
                invoicetotal: getString(extracted.InvoiceTotal),
                ...commonFields,
              };
            } else if (selectedModelType === "BankStatement") {
              return {
                AccountHolder: getString(extracted.AccountHolder),
                AccountNumber: getString(extracted.AccountNumber),
                StatementPeriod: getString(extracted.StatementPeriod),
                OpeningBalance: getString(extracted.OpeningBalance),
                ClosingBalance: getString(extracted.ClosingBalance),
                ...commonFields,
              };
            } else if (selectedModelType === "MortgageForms") {
              return {
                LenderName: getString(extracted.LenderName),
                BorrowerName: getString(extracted.BorrowerName),
                LoanAmount: getString(extracted.LoanAmount),
                Interest: getString(extracted.Interest),
                LoanTenure: getString(extracted.LoanTenure),
                ...commonFields,
              };
            }
            return commonFields;
          });

        setData(processed);
        setError(null);
      } catch (err) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedModelType]);

  // Apply filters whenever filter states or data changes
  useEffect(() => {
    const filtered = data.filter((item) => {
      // Vendor filter (for Invoice model type)
      const matchesVendor = selectedModelType === "Invoice" 
        ? (item.vendorName?.toLowerCase().includes(vendorFilter.toLowerCase()) ?? true)
        : true;

      // Search all fields
      const matchesSearch = Object.values(item).some((val) =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Date range filter (for Invoice Date)
      const itemDate = item.invoiceDate ? new Date(item.invoiceDate) : null;
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      const matchesDate = (!from || (itemDate && itemDate >= from)) && 
                         (!to || (itemDate && itemDate <= to));

      // Upload date filter
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

      return matchesVendor && matchesSearch && matchesDate && matchesUploadFilter;
    });

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [data, vendorFilter, fromDate, toDate, uploadDateFilter, searchQuery, selectedModelType]);

  const handleExportCSV = () => {
    const headers = modelTypeHeaders[selectedModelType];
    const keys = modelTypeKeys[selectedModelType];

    const rows = filteredData.map((item) =>
      keys.map((key) =>
        key === "_rawDocument" ? "" : `"${item[key]?.toString().replace(/"/g, '""') || ""}"`
      ).join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${selectedModelType}_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleViewDocument = (doc) => {
    const url = doc?.fileUrl || doc?.blobUrl;
    if (url) window.open(url, "_blank");
    else toast.error("File URL not available");
  };

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const currentRows = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div className="table-component-container">
      <Header />
      <div className="dataview-container">
        <h2>{selectedModelType} Data View</h2>

        {/* Filters Section - Same as ManualReview */}
        <div className="filters">
          {/* Vendor Filter (only show for Invoice) */}
          {selectedModelType === "Invoice" && (
            <label>
              <strong>Vendor:</strong>
              <input
                type="text"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                placeholder="Enter vendor name"
              />
            </label>
          )}
          
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
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <label>
            <button className="reset-button" onClick={handleResetFilters}>
              Reset
            </button>
          </label>

          <label>
            <button className="export-button" onClick={handleExportCSV}>
              Export CSV
            </button>
          </label>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p style={{ color: "red" }}>Error: {error}</p>}

        <table>
          <thead>
            <tr>
              {modelTypeHeaders[selectedModelType].map((header, idx) => (
                <th
                  key={idx}
                  onClick={() => toggleSort(modelTypeKeys[selectedModelType][idx])}
                >
                  {header} {renderSortIcon(modelTypeKeys[selectedModelType][idx])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((item, index) => (
                <tr key={index}>
                  {modelTypeKeys[selectedModelType].map((key, idx) =>
                    key === "_rawDocument" ? (
                      <td key={idx}>
                        <button onClick={() => handleViewDocument(item._rawDocument)}>
                          View
                        </button>
                      </td>
                    ) : (
                      <td key={idx}>{item[key]}</td>
                    )
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={modelTypeHeaders[selectedModelType].length} style={{ textAlign: "center" }}>
                  {loading ? "Loading..." : "No records found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* FilePagination Component */}
        {filteredData.length > rowsPerPage && (
          <FilePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            rowsPerPage={rowsPerPage}
            totalItems={filteredData.length}
            previousLabel="Previous"
            nextLabel="Next"
            className="table-pagination"
          />
        )}
      </div>
      <Footer />
      <ToastContainer />
    </div>
  );
}

export default Table;