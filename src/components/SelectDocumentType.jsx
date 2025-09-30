import React from "react";
import { useNavigate } from "react-router-dom";
import "./SelectDocumentType.css";
import Footer from "../Layout/Footer";
import Header from "../Layout/Header";

const SelectDocumentType = () => {
  const navigate = useNavigate();

  const handleSelectmodelType = (modelType) => {
  localStorage.setItem("selectedModelType", modelType);
  navigate("/dashboard"); // Go to dashboard page
};

  return (
    <div className="container">
      <header className="header">
        <Header minimal={true} />
      </header>

      <main className="main1">
        <div className="sidebar">
          <h1>Select Document Type</h1>
          <p>
            Choose the document you want to upload and process with AI-powered
            automation.
          </p>
        </div>

        <div className="card-section">
          <div className="card invoice">
            <div className="icon">💲</div>
            <h2>Invoice</h2>
            <p>Upload invoices for payments and financial analysis.</p>
            <button
              className="blue"
              onClick={() => handleSelectmodelType("Invoice")}
            >
              Select
            </button>
          </div>

          <div className="card bank">
            <div className="icon">🏦</div>
            <h2>Bank Statement</h2>
            <p>
              Upload bank statements for transaction processing and account
              insights.
            </p>
            <button
              className="green"
              onClick={() => handleSelectmodelType("BankStatement")}
            >
              Select
            </button>
          </div>

          <div className="card mortgage">
            <div className="icon">🏠</div>
            <h2>Mortgage Forms</h2>
            <p>Upload mortgage-related documents for automated processing.</p>
            <button
              className="orange"
              onClick={() => handleSelectmodelType("MortgageForms")}
            >
              Select
            </button>
          </div>
        </div>
      </main>

      <footer>
        <Footer />
      </footer>
    </div>
  );
};

export default SelectDocumentType;
