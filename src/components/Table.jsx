import React, { useState } from 'react';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import './Table.css'

function Table() {
  const invoiceData = [
    { vendorName: 'Acme Supplies', invoiceId: 'INV-001', invoiceDate: '2025-05-25', lpoNo: 'LPO-101', subTotal: '$1,000.00', vat: '$200.00', invoicetotal: '$1,200.00' },
    { vendorName: 'Beta Distributors', invoiceId: 'INV-002', invoiceDate: '2025-05-26', lpoNo: 'LPO-102', subTotal: '$2,000.00', vat: '$340.00', invoicetotal: '$2,340.00' },
    { vendorName: 'Gamma Traders', invoiceId: 'INV-003', invoiceDate: '2025-05-27', lpoNo: 'LPO-103', subTotal: '$850.00', vat: '$130.00', invoicetotal: '$980.00' },
    { vendorName: 'Delta Mart', invoiceId: 'INV-004', invoiceDate: '2025-05-25', lpoNo: 'LPO-104', subTotal: '$1,250.00', vat: '$250.00', invoicetotal: '$1,500.00' },
    { vendorName: 'Omega Supplies', invoiceId: 'INV-005', invoiceDate: '2025-05-26', lpoNo: 'LPO-105', subTotal: '$650.00', vat: '$100.00', invoicetotal: '$750.00' },
    { vendorName: 'Sigma Traders', invoiceId: 'INV-006', invoiceDate: '2025-05-27', lpoNo: 'LPO-106', subTotal: '$2,700.00', vat: '$450.00', invoicetotal: '$3,150.00' },
    { vendorName: 'Alpha Solutions', invoiceId: 'INV-007', invoiceDate: '2025-05-28', lpoNo: 'LPO-107', subTotal: '$4,000.00', vat: '$600.00', invoicetotal: '$4,600.00' },
    { vendorName: 'Zeta Corp', invoiceId: 'INV-008', invoiceDate: '2025-05-29', lpoNo: 'LPO-108', subTotal: '$2,400.00', vat: '$400.00', invoicetotal: '$2,800.00' }
  ];
 
  const [vendorFilter, setVendorFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
 
  const filteredData = invoiceData.filter(item => {
    const matchesVendor = item.vendorName.toLowerCase().includes(vendorFilter.toLowerCase());
    const itemDate = new Date(item.invoiceDate);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    const matchesDate = (!from || itemDate >= from) && (!to || itemDate <= to);
    return matchesVendor && matchesDate;
  });
 
  const convertToCSV = (data) => {
    const headers = ['Vendor Name', 'Invoice ID', 'Invoice Date', 'LPO No', 'Sub Total', 'VAT', 'Invoice Total'];
    const rows = data.map(item =>
      [item.vendorName, item.invoiceId, item.invoiceDate, item.lpoNo, item.subTotal, item.vat, item.invoicetotal].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  };
 
  const handleDownloadFilteredData = () => {
    if (filteredData.length === 0) {
      alert('No data to export.');
      return;
    }
 
    const fileType = prompt('Enter file type to export (csv or xlsx):', 'csv');
    if (!fileType) return;
 
    const lowerType = fileType.toLowerCase();
    if (lowerType !== 'csv' && lowerType !== 'xlsx') {
      alert('Invalid file type. Please enter "csv" or "xlsx".');
      return;
    }
 
    const csvData = convertToCSV(filteredData);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const extension = lowerType === 'csv' ? 'csv' : 'xlsx';
    link.download = `Filtered_Invoices_${new Date().toISOString()}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };
 
  return (
    <div className='table-component-container'>
      <header>
        <Header/>
      </header>
      <div className="dataview-container">
      <h2>Data View</h2>
 
      <div className="filters" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ marginRight: '10px' }}>
          <strong>Filter by Vendor Name:</strong>
          <input
            type="text"
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            placeholder="Enter vendor name"
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
 
        <label style={{ marginLeft: '20px', marginRight: '10px' }}>
          <strong>From Date:</strong>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
 
        <label style={{ marginLeft: '20px', marginRight: '20px' }}>
          <strong>To Date:</strong>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
 
        <button
          onClick={handleDownloadFilteredData}
          style={{
            marginLeft: 'auto',
            padding: '8px 14px',
            backgroundColor: '#0d3c61',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          title="Download Filtered Data"
        >
          Export 📥
        </button>
      </div>
 
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
              <td colSpan="7" style={{ textAlign: 'center' }}>No records found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <footer className='.footer'>
        <Footer/>
      </footer>
    </div>
  );
}
 
export default Table;