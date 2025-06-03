import React from "react";
import './Home.css';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';

const Home = () => {
  const features = [
    {
      title: "Home",
      image: "src/assets/home.png", // Dummy logo
      description: `The Home Page serves as your document management command center, providing instant access to all key features. A personalized dashboard displays recent activities, pending tasks, and quick-access tools to jumpstart your workflow. Real-time notifications keep you updated on document changes, while customizable widgets let you prioritize frequently used functions. This intuitive landing page reduces navigation time by putting everything you need within reach, whether you're starting a new project or checking ongoing work.`
    },
    {
      title: "Dashboard",
      image: "src/assets/upload doc.png", // Dummy logo
      description: `Our streamlined upload dashboard makes submitting documents effortless with drag-and-drop functionality and batch processing capabilities. The system automatically categorizes files by type (PDF, Word, images) and begins AI-powered analysis during upload. A live progress tracker shows current uploads while maintaining a searchable history of all past submissions. The dashboard includes visual storage metrics and tools to manage your document repository efficiently.`
    },
    {
      title: "Status Tracker",
      image: "src/assets/status tracker.png", // Dummy logo
      description: `Experience complete transparency with tracking system that monitors every document through its entire lifecycle. The visual timeline clearly displays each stage - from initial upload through processing, review, approval, and archiving. Real-time updates with timestamps and responsible parties provide accountability, while configurable alerts notify you of status changes. This end-to-end visibility eliminates guesswork and helps teams coordinate document workflows seamlessly.`
    },
    {
      title: "Data View",
      image: "src/assets/data view.png", // Dummy logo
      description: `This page represents all documents in a powerful, filterable matrix designed for rapid information retrieval. Advanced sorting options let you organize files by status, modification date, document type, or custom tags for maximum efficiency. Bulk action capabilities enable simultaneous processing of multiple documents, while hover previews and keyboard shortcuts accelerate navigation. This versatile interface adapts to your workflow with saved view presets and customizable display options.`
    }
  ];

  return (
    <div className="home-component-container">
      <header><Header /></header>
      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-text">
            <h1>Automate & save companies significant amounts of money!</h1>
            <p>
              DocQmentor is an AI-powered document intelligence tool that extracts structured, meaningful data from uploaded PDF documents using Microsoft Azure’s AI Document Intelligence (Form Recognizer). It features a secure, React-based frontend with Microsoft Single Sign-On (SSO) via Azure Active Directory, streamlining document processing workflows for businesses by improving efficiency, accuracy, and reducing manual effort.
            </p>
            <a href="http://localhost:5173/Dashboard"><button className="demo-btn" >Upload</button></a>
          </div>
          <div className="hero-img">
            <img src="src\assets\img-features (1).png" alt="" />
          </div>
        </section>

        {/* Features Title */}
        <section className="features-heading">
          <h2>Features</h2>
        </section>

        {/* Features Grid */}
        <section className="features-grid">
          {features.map((feature, i) => (
            <div key={i} className="feature-card">
              <img src={feature.image} alt={`${feature.title} logo`} className="feature-logo" />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </section>
      </main>
      <footer><Footer /></footer>
    </div>
  );
}

export default Home;
