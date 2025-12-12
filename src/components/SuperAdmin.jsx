import { useState } from "react";
import "./SuperAdmin.css";
import Footer from "../Layout/Footer";

const SuperAdmin = () => {
  const [clients, setClients] = useState([
    {
      id: 1,
      companyName: "Tech Solutions Inc.",
      plan: "Enterprise",
      startDate: "2024-01-15",
      endDate: "2024-12-15",
      pdfsCount: 24,
      invoiceStatus: "Active",
      bankStatementStatus: "Active",
      mortgageFormsStatus: "inactive",
      adminEmail: "admin@techsolutions.com",
      users: 3
    },
    {
      id: 2,
      companyName: "Johnson & Co.",
      plan: "Standard",
      startDate: "2024-02-01",
      endDate: "2024-08-01",
      pdfsCount: 12,
      invoiceStatus: "Active",
      bankStatementStatus: "inactive",
      mortgageFormsStatus: "Active",
      adminEmail: "admin@johnsonco.com",
      users: 1
    },
    {
      id: 3,
      companyName: "Brown Enterprises",
      plan: "Enterprise",
      startDate: "2024-03-10",
      endDate: "2025-03-10",
      pdfsCount: 56,
      invoiceStatus: "Active",
      bankStatementStatus: "Active",
      mortgageFormsStatus: "Active",
      adminEmail: "admin@brownent.com",
      users: 5
    },
    {
      id: 4,
      companyName: "Wilson Group",
      plan: "Advanced",
      startDate: "2024-01-20",
      endDate: "2024-07-20",
      pdfsCount: 18,
      invoiceStatus: "inactive",
      bankStatementStatus: "Active",
      mortgageFormsStatus: "Active",
      adminEmail: "admin@wilsongroup.com",
      users: 2
    },
    {
      id: 5,
      companyName: "Davis Corporation",
      plan: "Standard",
      startDate: "2024-04-05",
      endDate: "2024-10-05",
      pdfsCount: 8,
      invoiceStatus: "Active",
      bankStatementStatus: "inactive",
      mortgageFormsStatus: "inactive",
      adminEmail: "admin@daviscorp.com",
      users: 1
    },
    {
      id: 6,
      companyName: "Innovation Labs",
      plan: "Advanced",
      startDate: "2024-03-01",
      endDate: "2024-09-01",
      pdfsCount: 32,
      invoiceStatus: "Active",
      bankStatementStatus: "Active",
      mortgageFormsStatus: "inactive",
      adminEmail: "admin@innovationlabs.com",
      users: 4
    },
    {
      id: 7,
      companyName: "Global Finance Ltd",
      plan: "Enterprise",
      startDate: "2024-02-15",
      endDate: "2025-02-15",
      pdfsCount: 42,
      invoiceStatus: "Active",
      bankStatementStatus: "Active",
      mortgageFormsStatus: "Active",
      adminEmail: "admin@globalfinance.com",
      users: 6
    }
  ]);

  const [filters, setFilters] = useState({
    companyName: "",
    clientId: "",
    startDate: "",
    endDate: "",
    plan: ""
  });

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const clearFilters = () => {
    setFilters({
      companyName: "",
      clientId: "",
      startDate: "",
      endDate: "",
      plan: ""
    });
  };

  const planOptions = ["Standard", "Advanced", "Enterprise"];

  const filteredClients = clients.filter(client => {
    return (
      (filters.companyName === "" || client.companyName.toLowerCase().includes(filters.companyName.toLowerCase())) &&
      (filters.clientId === "" || client.id.toString().includes(filters.clientId)) &&
      (filters.startDate === "" || client.startDate >= filters.startDate) &&
      (filters.endDate === "" || client.endDate <= filters.endDate) &&
      (filters.plan === "" || client.plan === filters.plan)
    );
  });

  const handleEditClient = (clientId) => {
    console.log("Edit client:", clientId);
  };

  const handleDeleteClient = (clientId) => {
    if (window.confirm("Are you sure you want to delete this client?")) {
      setClients(clients.filter(client => client.id !== clientId));
    }
  };

  const handleViewClient = (clientId) => {
    console.log("View client:", clientId);
  };

  // Format plan with color class
  const getPlanClass = (plan) => {
    switch(plan) {
      case "Standard": return "plan-standard";
      case "Advanced": return "plan-advanced";
      case "Enterprise": return "plan-enterprise";
      default: return "";
    }
  };

  return (
    <div className="superAdmin-container">
      <main className="superAdmin-main">
        <div className="client-management-header">
          <h2>Client Management</h2>
          <button className="primary-btn">+ Add New Client</button>
        </div>

        <div className="filter-section">
          <div className="filter-group">
            <label>Client ID</label>
            <input
              type="text"
              name="clientId"
              className="filter-input"
              placeholder="Enter ID"
              value={filters.clientId}
              onChange={handleFilterChange}
            />
          </div>
          
          <div className="filter-group">
            <label>Company Name</label>
            <input
              type="text"
              name="companyName"
              className="filter-input"
              placeholder="Enter company name"
              value={filters.companyName}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label>Plan</label>
            <select
              name="plan"
              className="filter-input"
              value={filters.plan}
              onChange={handleFilterChange}
            >
              <option value="">All Plans</option>
              {planOptions.map(plan => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              name="startDate"
              className="filter-input"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>
          
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              name="endDate"
              className="filter-input"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>
          
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>

        <div className="client-table-container">
          <table className="client-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Company Name</th>
                <th>Plan</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>PDFs</th>
                <th>Invoice</th>
                <th>Bank</th>
                <th>Mortgage</th>
                <th>Admin Email</th>
                <th>Users</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td>#{client.id}</td>
                  <td className="company-name">{client.companyName}</td>
                  <td className={getPlanClass(client.plan)}>{client.plan}</td>
                  <td>{client.startDate}</td>
                  <td>{client.endDate}</td>
                  <td>{client.pdfsCount}</td>
                  <td>
                    <span className={`status-badge ${client.invoiceStatus === 'Active' ? 'status-active' : 'status-inactive'}`}>
                      {client.invoiceStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${client.bankStatementStatus === 'Active' ? 'status-active' : 'status-inactive'}`}>
                      {client.bankStatementStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${client.mortgageFormsStatus === 'Active' ? 'status-active' : 'status-inactive'}`}>
                      {client.mortgageFormsStatus}
                    </span>
                  </td>
                  <td className="admin-email">{client.adminEmail}</td>
                  <td>{client.users}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="edit-btn"
                        onClick={() => handleEditClient(client.id)}
                      >
                        Edit
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteClient(client.id)}
                      >
                        Delete
                      </button>
                      <button 
                        className="view-btn"
                        onClick={() => handleViewClient(client.id)}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SuperAdmin;