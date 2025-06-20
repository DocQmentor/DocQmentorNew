import React, { useState, useEffect} from "react";
import './ManualReview.css';
import Footer from "../Layout/Footer";
import { Edit, History, File, FileText, X, Save } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const ManualReview = () => {
    const [show, setShow] = useState(true);
    const [editDetails, setEditDetails] = useState(true);
    const [versionHistory, setVersionHistory] = useState(false);
    const [pdfDetails, setPDFDetails] = useState(false);
    const [Properties, setProperties] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [manualReviewDocs, setManualReviewDocs] = useState([]);
    const [selectedVendor, setSelectedVendor] = useState('');
    const [filteredDocs, setFilteredDocs] = useState([]);
    
    const location = useLocation();
// ////////
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileUrl, setFileUrl] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        
        // Create a URL for the file to display it
        const url = URL.createObjectURL(file);
        setFileUrl(url);
    };

    const handleViewFile = () => {
        if (!fileUrl) return;

        // For PDF files - display in new tab
        if (selectedFile.type === 'application/pdf') {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        } 
        // For images - display in the component
        else if (selectedFile.type.startsWith('image/')) {
        // Already handled in the render section
        }
        // For other file types - download
        else {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = selectedFile.name || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        }
    };
// //////////
    useEffect(() => {
        // Get manual review documents and selected vendor from location state
        if (location.state?.manualReviewDocs) {
            setManualReviewDocs(location.state.manualReviewDocs);
            setSelectedVendor(location.state.selectedVendor || '');
        }
    }, [location.state]);

    useEffect(() => {
        // Filter documents based on selected vendor
        if (!selectedVendor) {
            setFilteredDocs(manualReviewDocs);
        } else {
            const filtered = manualReviewDocs.filter(doc => 
                (doc.vendorName || '').toLowerCase().includes(selectedVendor.toLowerCase()) ||
                (doc.documentName || '').toLowerCase().includes(selectedVendor.toLowerCase())
            );
            setFilteredDocs(filtered);
        }
    }, [manualReviewDocs, selectedVendor]);

    const handleToggle = (doc) => {
        setSelectedDocument(doc);
        showSection('editDetails');
        setShow(!show);
        handleFileChange(doc);
    };

    const showSection = (section) => {
        setEditDetails(section === 'editDetails');
        setVersionHistory(section === 'versionHistory');
        setPDFDetails(section === 'pdfDetails');
        setProperties(section === 'properties');
    };

    const handleVendorChange = (e) => {
        setSelectedVendor(e.target.value);
    };

    // Get unique vendor names from the documents
    const vendorOptions = [...new Set(
        manualReviewDocs.map(doc => doc.vendorName || doc.documentName || 'Unknown')
    )].filter(Boolean).sort();

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
                                    <option key={index} value={vendor}>{vendor}</option>
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
                                        <td>{doc.vendorName || 'Null'}</td>
                                        <td>{doc.fileName || doc.documentName || 'Null'}</td>
                                        <td>{doc.invoiceId || 'Null'}</td>
                                        <td>{doc.invoiceDate || 'Null'}</td>
                                        <td>{doc.lpoNumber || 'Null'}</td>
                                        <td>{doc.subTotal || 'Null'}</td>
                                        <td>{doc.vat || 'Null'}</td>
                                        <td>{doc.invoiceTotal || doc.invoicetotal || 'Null'}</td>
                                        <td>
                                            <button onClick={() => handleToggle(doc)}>Edit</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center' }}>
                                        {selectedVendor 
                                            ? `No documents requiring manual review for vendor: ${selectedVendor}`
                                            : 'No documents requiring manual review'
                                        }
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
                            <header>{selectedDocument?.fileName || selectedDocument?.documentName || 'Document'}</header>
                            <div>
                            {selectedFile && (
                                <div className="file-display-section">
                                <div className="file-info">
                                    <h3>Selected File: {selectedFile.name}</h3>
                                    <button onClick={handleViewFile} className="view-btn">
                                    View File
                                    </button>
                                </div>
                                
                                <div className="file-preview">
                                    {selectedFile.type.startsWith('image/') && (
                                    <img src={fileUrl} alt="Preview" className="image-preview" />
                                    )}
                                    
                                    {selectedFile.type === 'application/pdf' && (
                                    <iframe 
                                        src={fileUrl} 
                                        title="PDF Preview"
                                        className="pdf-preview"
                                    />
                                    )}
                                    
                                    {!selectedFile.type.startsWith('image/') && 
                                    selectedFile.type !== 'application/pdf' && (
                                    <div className="unsupported-preview">
                                        <p>File preview not available for this format</p>
                                        <p>Click "View File" to download</p>
                                    </div>
                                    )}
                                </div>
                                </div>
                            )}
                            </div>
                        </div>
                        <div className="ManualReview-Edit-options">
                            <nav className="ManualReview-Edit-options-nav">
                                <ul className="ManualReview-Edit-options-nav-ul">
                                    <li className={`ManualReview-Edit-options-nav-li ${editDetails ? 'active' : ''}`} 
                                        onClick={() => showSection('editDetails')}>
                                        <Edit size={20} /> Edit Details
                                    </li>
                                    <li className={`ManualReview-Edit-options-nav-li ${versionHistory ? 'active' : ''}`} 
                                        onClick={() => showSection('versionHistory')}>
                                        <History size={20} /> Version History
                                    </li>
                                    <li className={`ManualReview-Edit-options-nav-li ${pdfDetails ? 'active' : ''}`} 
                                        onClick={() => showSection('pdfDetails')}>
                                        <File size={20} /> PDF Details
                                    </li>
                                    <li className={`ManualReview-Edit-options-nav-li ${Properties ? 'active' : ''}`} 
                                        onClick={() => showSection('properties')}>
                                        <FileText size={20} /> Properties
                                    </li>
                                    <li onClick={() => setShow(!show)}>
                                        <X size={20} /> Close
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
                                            defaultValue={selectedDocument.vendorName || ''}
                                            placeholder="Please write Vendor Name..."
                                        />
                                        <label>Invoice Date</label>
                                        <input 
                                            type="date" 
                                            defaultValue={selectedDocument.invoiceDate || ''}
                                            placeholder="Please select Vendor Date..."
                                        />
                                        <label>LPO Number</label>
                                        <input 
                                            type="number" 
                                            defaultValue={selectedDocument.lpoNumber || ''}
                                            placeholder="Please write Vendor Number..."
                                        />
                                        <label>Confidence Score</label>
                                        <input 
                                            type="number" 
                                            defaultValue={selectedDocument.confidenceScore || ''}
                                            placeholder="Please write Confidence Score..."
                                        />
                                        <label>Sub Total</label>
                                        <input 
                                            type="number" 
                                            defaultValue={selectedDocument.subTotal || ''}
                                            placeholder="Please write Sub Total..."
                                        />
                                        <label>VAT</label>
                                        <input 
                                            type="number" 
                                            defaultValue={selectedDocument.vat || ''}
                                            placeholder="Please write VAT Number..."
                                        />
                                        <label>Invoice Total</label>
                                        <input 
                                            type="number" 
                                            defaultValue={selectedDocument.invoiceTotal || selectedDocument.invoicetotal || ''}
                                            placeholder="Please write Invoice Total..."
                                        />
                                        <ul className="ManualReview-Edit-editDetails-form-ul">
                                            <li className="ManualReview-Edit-editDetails-form-ul-Cancel" 
                                                onClick={() => setShow(!show)}>
                                                <X className="ManualReview-Edit-editDetails-form-ul-Cancel-i" size={20} /> Cancel
                                            </li>
                                            <li className="ManualReview-Edit-editDetails-form-ul-Save-Changes" 
                                                onClick={() => setShow(!show)}>
                                                <Save className="ManualReview-Edit-editDetails-form-ul-Save-Changes-i" size={20} /> Save Changes
                                            </li>
                                        </ul>
                                    </form>
                                </div>
                            )}
                            {/* Other sections remain the same */}
                        </div>
                    </div>
                </div>
            )}
            <footer>
                <Footer />
            </footer>
        </div>
    );
}

export default ManualReview;