import React, { useState, useEffect } from "react";
import Header from "../Layout/Header";
import Footer from "../Layout/Footer";
import "./Table.css";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      try {
        const response = await fetch(
          "https://docap.azurewebsites.net/api/DocQmentorFunc?code=n4SOThz-nkfGfs96hGTtAsvm3ZS2wt7O3pqELLzWqi38AzFuUm090A=="
        );
        if (!response.ok) throw new Error("Failed to fetch invoice data");
        const data = await response.json();

        const processed = Array.isArray(data)
          ? data.map((doc) => ({
              vendorName: getString(doc.vendorName),
              invoiceId: getString(doc.invoiceId),
              invoiceDate: getString(doc.invoiceDate),
              lpoNo: getString(doc.lpoNo),
              subTotal: getString(doc.subTotal),
              vat: getString(doc.vat),
              invoicetotal: getString(doc.invoicetotal),
            }))
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

  const filteredData = invoiceData.filter((item) => {
    const vendorName =
      typeof item.vendorName === "string" ? item.vendorName : "";
    const matchesVendor = vendorName
      .toLowerCase()
      .includes(vendorFilter.toLowerCase());

    const itemDate = item.invoiceDate ? new Date(item.invoiceDate) : null;
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    const matchesDate =
      (!from || (itemDate && itemDate >= from)) &&
      (!to || (itemDate && itemDate <= to));

    return matchesVendor && matchesDate;
  });

  const convertToCSV = (data) => {
    const headers = [
      "Vendor Name",
      "Invoice ID",
      "Invoice Date",
      "LPO No",
      "Sub Total",
      "VAT",
      "Invoice Total",
    ];
    const rows = data.map((item) =>
      [
        item.vendorName,
        item.invoiceId,
        item.invoiceDate,
        item.lpoNo,
        item.subTotal,
        item.vat,
        item.invoicetotal,
      ].join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  };

  const handleDownloadFilteredData = () => {
    if (filteredData.length === 0) {
      alert("No data to export.");
      return;
    }

    const fileType = prompt("Enter file type to export (csv or xlsx):", "csv");
    if (!fileType) return;

    const lowerType = fileType.toLowerCase();
    if (lowerType !== "csv" && lowerType !== "xlsx") {
      alert('Invalid file type. Please enter "csv" or "xlsx".');
      return;
    }

    const csvData = convertToCSV(filteredData);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const extension = lowerType === "csv" ? "csv" : "xlsx";
    link.download = `Filtered_Invoices_${new Date().toISOString()}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="table-component-container">
      <header>
        <Header />
      </header>

      <div className="dataview-container">
        <h2>Data View</h2>

        <div
          className="filters"
          style={{
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ marginRight: "10px" }}>
            <strong>Filter by Vendor Name:</strong>
            <input
              type="text"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              placeholder="Enter vendor name"
              style={{ marginLeft: "10px", padding: "5px" }}
            />
          </label>

          <label style={{ marginLeft: "20px", marginRight: "10px" }}>
            <strong>From Date:</strong>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ marginLeft: "10px", padding: "5px" }}
            />
          </label>

          <label style={{ marginLeft: "20px", marginRight: "20px" }}>
            <strong>To Date:</strong>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ marginLeft: "10px", padding: "5px" }}
            />
          </label>

          <button
            onClick={handleDownloadFilteredData}
            style={{
              marginLeft: "auto",
              padding: "8px 14px",
              backgroundColor: "#0d3c61",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
            title="Download Filtered Data"
          >
            Export 📥
          </button>
        </div>

        {loading && <p>Loading invoice data...</p>}
        {error && <p style={{ color: "red" }}>Error loading data: {error}</p>}

        <ErrorBoundary>
          {!loading && !error && (
            <table>
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Invoice ID</th>
                  <th>Invoice Date</th>
                  <th>LPO No</th>
                  <th>Sub Total</th>
                  <th>VAT</th>
                  <th>Invoice Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr key={index}>
                      <td>{item.vendorName}</td>
                      <td>{item.invoiceId}</td>
                      <td>{item.invoiceDate}</td>
                      <td>{item.lpoNo}</td>
                      <td>{item.subTotal}</td>
                      <td>{item.vat}</td>
                      <td>{item.invoicetotal}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </ErrorBoundary>
      </div>

      <footer className=".footer">
        <Footer />
      </footer>
    </div>
  );
}

export default Table;
 