import { useState, useEffect } from "react";
import "./SuperAdmin.css";
import Footer from "../Layout/Footer";
import { UserRound } from "lucide-react";

const API_URL = "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/MasterDataFunc?code=mn5GRLPLF9C0oESZfk3jRtxdJUAwSK6QA1mjsud8IwJlAzFup2u9Sw==";

const SuperAdmin = () => {
  // State Management
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  // Filter State
  const [filters, setFilters] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  // Form Data State
  const [formData, setFormData] = useState({
    Name: "",
    PlanName: "",
    StartDate: "",
    EndDate: "",
    InvoiceCount: 0,
    BankStatementCount: 0,
    MortgageFormsCount: 0,
    Invoice: "Active",
    BankStatement: "Active",
    MortgageForms: "Active",
  });

  // Fetch clients on component mount
  useEffect(() => {
    fetchClients();
  }, []);

  // Fetch all clients from API
  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error("Error fetching clients:", error);

      // Only show alert for persistent errors, not cold start delays
      if (error.message.includes("404") || error.message.includes("401") || error.message.includes("403")) {
        let errorMessage = "Failed to load clients. ";

        if (error.message.includes("404")) {
          errorMessage += "The API endpoint was not found. Please check if the Azure Function is deployed and running.";
        } else if (error.message.includes("401") || error.message.includes("403")) {
          errorMessage += "Authentication error. The API access code may be invalid or expired.";
        }

        alert(errorMessage);
      }
      // For network errors, just log to console - might be temporary
      console.warn("If this persists, check your internet connection and CORS settings.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary - Active Clients Count (excluding Invoice, Bank, Mortgage counts)
  const summary = {
  clients: clients.length, // Total number of clients
  invoice: clients.filter(client => client.Invoice === "Active").length, // Count of clients with active Invoice
  bank: clients.filter(client => client.BankStatement === "Active").length, // Count of clients with active BankStatement
  mortgage: clients.filter(client => client.MortgageForms === "Active").length, // Count of clients with active MortgageForms
};

  // Filter clients based on filter criteria
  const filteredClients = clients.filter((client) => {
    const nameMatch = !filters.name ||
      client.Name?.toLowerCase().includes(filters.name.toLowerCase());

    const startDateMatch = !filters.startDate ||
      new Date(client.StartDate) >= new Date(filters.startDate);

    const endDateMatch = !filters.endDate ||
      new Date(client.EndDate) <= new Date(filters.endDate);

    return nameMatch && startDateMatch && endDateMatch;
  });

  // Handle filter input changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ name: "", startDate: "", endDate: "" });
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      Name: "",
      PlanName: "",
      StartDate: "",
      EndDate: "",
      InvoiceCount: 0,
      BankStatementCount: 0,
      MortgageFormsCount: 0,
      Invoice: "Active",
      BankStatement: "Active",
      MortgageForms: "Active",
    });
  };

  // Cancel form and close modal
  const cancelForm = () => {
    resetForm();
    setEditingClient(null);
    setShowAddClient(false);
  };

  // Create new client
  const createClient = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      // Ensure count fields are integers
      const createData = {
        ...formData,
        InvoiceCount: parseInt(formData.InvoiceCount) || 0,
        BankStatementCount: parseInt(formData.BankStatementCount) || 0,
        MortgageFormsCount: parseInt(formData.MortgageFormsCount) || 0,
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createData),
      });

      if (!response.ok) throw new Error("Failed to create client");

      alert("Client created successfully!");
      await fetchClients(); // Refresh the list
      cancelForm();
    } catch (error) {
      console.error("Error creating client:", error);
      alert("Failed to create client. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Update existing client
  const updateClient = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      // Include the ID in the request body and ensure count fields are integers
      const updateData = {
        ...formData,
        ID: editingClient.ID,
        InvoiceCount: parseInt(formData.InvoiceCount) || 0,
        BankStatementCount: parseInt(formData.BankStatementCount) || 0,
        MortgageFormsCount: parseInt(formData.MortgageFormsCount) || 0,
      };

      const response = await fetch(`${API_URL}&id=${editingClient.ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", errorText);
        throw new Error("Failed to update client");
      }

      alert("Client updated successfully!");
      await fetchClients(); // Refresh the list
      cancelForm();
    } catch (error) {
      console.error("Error updating client:", error);
      alert("Failed to update client. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete client
  const deleteClient = async (id) => {
    if (!confirm("Are you sure you want to delete this client?")) return;

    try {
      const response = await fetch(`${API_URL}&id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete client");

      alert("Client deleted successfully!");
      await fetchClients(); // Refresh the list
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Failed to delete client. Please try again.");
    }
  };

  // Handle edit button click
  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      Name: client.Name || "",
      PlanName: client.PlanName || "",
      StartDate: client.StartDate ? client.StartDate.split('T')[0] : "",
      EndDate: client.EndDate ? client.EndDate.split('T')[0] : "",
      InvoiceCount: client.InvoiceCount || 0,
      BankStatementCount: client.BankStatementCount || 0,
      MortgageFormsCount: client.MortgageFormsCount || 0,
      Invoice: client.Invoice || "Active",
      BankStatement: client.BankStatement || "Active",
      MortgageForms: client.MortgageForms || "Active",
    });
    setShowAddClient(true);
  };

  return (
    <div className="superAdmin-container">
      <main className="superAdmin-main">
        {/* Summary Section */}
        <section className="superAdmin-summary-box">
          <div className="superAdmin-summary">
            <UserRound size={24} />
            <div>
              <p>Active Clients</p>
              <p>{summary.clients}</p>
            </div>
          </div>
          <div className="superAdmin-summary">
            <p>💲</p>
            <div>
              <p>Invoice</p>
              <p>{summary.invoice}</p>
            </div>
          </div>
          <div className="superAdmin-summary">
            <p>🏦</p>
            <div>
              <p>Bank</p>
              <p>{summary.bank}</p>
            </div>
          </div>
          <div className="superAdmin-summary">
            <p>🏠</p>
            <div>
              <p>Mortgage</p>
              <p>{summary.mortgage}</p>
            </div>
          </div>
        </section>

        {/* Filter and Add Section */}
        <section className="superAdmin-table-permission">
          <section className="filter-section">
            <div>
              <label htmlFor="nameFilter">Name</label>
              <input
                type="text"
                id="nameFilter"
                name="name"
                value={filters.name}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label htmlFor="startDateFilter">Start</label>
              <input
                type="date"
                id="startDateFilter"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label htmlFor="endDateFilter">End</label>
              <input
                type="date"
                id="endDateFilter"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>
            <button onClick={clearFilters}>Clear Filter</button>
            <button onClick={() => setShowAddClient(true)}>Add Client</button>
          </section>

          {/* Client Form Modal */}
          {showAddClient && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>{editingClient ? "Edit Client" : "Add New Client"}</h3>
                <form onSubmit={editingClient ? updateClient : createClient}>
                  {editingClient && (
                    <div className="form-group">
                      <label>Client ID</label>
                      <input
                        type="text"
                        value={editingClient.ID}
                        disabled
                        className="disabled-input"
                      />
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label>Name *</label>
                      <input
                        type="text"
                        name="Name"
                        value={formData.Name}
                        onChange={handleInputChange}
                        required
                        disabled={submitting}
                      />
                    </div>
                    <div className="form-group">
                      <label>Plan Name *</label>
                      <select
                        name="PlanName"
                        value={formData.PlanName}
                        onChange={handleInputChange}
                        required
                        disabled={submitting}
                      >
                        <option value="">Select Plan</option>
                        <option value="Basic">Basic</option>
                        <option value="Pro">Pro</option>
                        <option value="Pro+">Pro+</option>
                        <option value="Enterprise">Enterprise</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date *</label>
                      <input
                        type="date"
                        name="StartDate"
                        value={formData.StartDate}
                        onChange={handleInputChange}
                        required
                        disabled={submitting}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date *</label>
                      <input
                        type="date"
                        name="EndDate"
                        value={formData.EndDate}
                        onChange={handleInputChange}
                        required
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Invoice Count</label>
                      <input
                        type="number"
                        name="InvoiceCount"
                        value={formData.InvoiceCount}
                        onChange={handleInputChange}
                        min="0"
                        disabled={submitting}
                      />
                    </div>
                    <div className="form-group">
                      <label>Bank Count</label>
                      <input
                        type="number"
                        name="BankStatementCount"
                        value={formData.BankStatementCount}
                        onChange={handleInputChange}
                        min="0"
                        disabled={submitting}
                      />
                    </div>
                    <div className="form-group">
                      <label>Mortgage Count</label>
                      <input
                        type="number"
                        name="MortgageFormsCount"
                        value={formData.MortgageFormsCount}
                        onChange={handleInputChange}
                        min="0"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Invoice Status</label>
                      <select
                        name="Invoice"
                        value={formData.Invoice}
                        onChange={handleInputChange}
                        disabled={submitting}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Bank Status</label>
                      <select
                        name="BankStatement"
                        value={formData.BankStatement}
                        onChange={handleInputChange}
                        disabled={submitting}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Mortgage Status</label>
                      <select
                        name="MortgageForms"
                        value={formData.MortgageForms}
                        onChange={handleInputChange}
                        disabled={submitting}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn-save"
                      disabled={submitting}
                    >
                      {submitting ? "Processing..." : (editingClient ? "Update" : "Save")}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="btn-clear"
                      disabled={submitting}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={cancelForm}
                      className="btn-cancel"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Clients Table */}
          <table className="clients-table">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>PlanName</th>
                <th>StartDate</th>
                <th>EndDate</th>
                <th>InvoiceCount</th>
                <th>BankCount</th>
                <th>MortgageCount</th>
                <th>Invoice</th>
                <th>Bank</th>
                <th>Mortgage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                      <div className="loading-spinner"></div>
                      <div>Loading clients...</div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>
                        First load may take a few seconds
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: "center" }}>
                    No clients found
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.ID}>
                    <td>{client.ID || 'N/A'}</td>
                    <td>{client.Name || 'N/A'}</td>
                    <td>{client.PlanName || 'N/A'}</td>
                    <td>{client.StartDate ? new Date(client.StartDate).toLocaleDateString() : 'N/A'}</td>
                    <td>{client.EndDate ? new Date(client.EndDate).toLocaleDateString() : 'N/A'}</td>
                    <td>{client.InvoiceCount ?? 0}</td>
                    <td>{client.BankStatementCount ?? 0}</td>
                    <td>{client.MortgageFormsCount ?? 0}</td>
                    <td className={`status-${(client.Invoice || 'inactive').toLowerCase()}`}>
                      {client.Invoice || 'Inactive'}
                    </td>
                    <td className={`status-${(client.BankStatement || 'inactive').toLowerCase()}`}>
                      {client.BankStatement || 'Inactive'}
                    </td>
                    <td className={`status-${(client.MortgageForms || 'inactive').toLowerCase()}`}>
                      {client.MortgageForms || 'Inactive'}
                    </td>
                    <td className="actions">
                      <button onClick={() => handleEdit(client)} className="btn-edit">
                        Edit
                      </button>
                      <button onClick={() => deleteClient(client.ID)} className="btn-delete">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SuperAdmin;