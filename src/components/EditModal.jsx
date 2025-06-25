import React, { useState } from "react";
import { Edit, History, File, X, Save } from "lucide-react";
import "./ManualReview.css"; // or use EditModal.css if you separate styles

const EditModal = ({ selectedDocument, editedData, setEditedData, setShow }) => {
  const [editDetails, setEditDetails] = useState(true);
  const [versionHistory, setVersionHistory] = useState(false);
  const [pdfDetails, setPDFDetails] = useState(false);

  const showSection = (section) => {
    setEditDetails(section === "editDetails");
    setVersionHistory(section === "versionHistory");
    setPDFDetails(section === "pdfDetails");
  };

  return (
    <div className="ManualReview-Edit-container">
      <div className="ManualReview-Edit-show-file">
        <header>
          {selectedDocument?.fileName || selectedDocument?.documentName || "Document"}
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
              className={`ManualReview-Edit-options-nav-li ${editDetails ? "active" : ""}`}
              onClick={() => showSection("editDetails")}
            >
              <Edit size={20} /> Edit Details
            </li>
            <li
              className={`ManualReview-Edit-options-nav-li ${versionHistory ? "active" : ""}`}
              onClick={() => showSection("versionHistory")}
            >
              <History size={20} /> Version History
            </li>
            <li
              className={`ManualReview-Edit-options-nav-li ${pdfDetails ? "active" : ""}`}
              onClick={() => showSection("pdfDetails")}
            >
              <File size={20} /> PDF Details
            </li>
            <li onClick={() => setShow(true)}>
              <X size={20} />
            </li>
          </ul>
        </nav>

        {editDetails && (
          <div className="ManualReview-Edit-editDetails">
            <form className="ManualReview-Edit-editDetails-form">
              <h3>Edit Details</h3>

              <label>Vendor Name</label>
              <input
                type="text"
                value={editedData.VendorName}
                onChange={(e) =>
                  setEditedData({ ...editedData, VendorName: e.target.value })
                }
              />

              <label>Invoice Date</label>
              <input
                type="date"
                value={editedData.InvoiceDate}
                onChange={(e) =>
                  setEditedData({ ...editedData, InvoiceDate: e.target.value })
                }
              />

              <label>LPO Number</label>
              <input
                type="text"
                value={editedData.LPO}
                onChange={(e) =>
                  setEditedData({ ...editedData, LPO: e.target.value })
                }
              />

              <label>Sub Total</label>
              <input
                type="number"
                value={editedData.SubTotal}
                onChange={(e) =>
                  setEditedData({ ...editedData, SubTotal: e.target.value })
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
                  setEditedData({ ...editedData, InvoiceTotal: e.target.value })
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
                  onClick={() => setShow(true)} // Add save logic here if needed
                >
                  <Save size={20} /> Save Changes
                </li>
              </ul>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditModal;
