import { useState, useEffect } from "react";
import "./SuperAdmin.css";
import Footer from "../Layout/Footer";
import { UserRound, AlertCircle, RefreshCw } from "lucide-react";

const API_URL = "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/MasterDataFunc?code=mn5GRLPLF9C0oESZfk3jRtxdJUAwSK6QA1mjsud8IwJlAzFup2u9Sw==";

// Smart fetch function that handles Azure HTML errors
const smartFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...options.headers
    }
  });

  // Always read as text first (CRITICAL for Azure errors)
  const responseText = await response.text();
  
  // Check if it's an Azure HTML error page
  const isAzureHtmlError = 
    !response.ok && (
      responseText.includes('<!DOCTYPE') ||
      responseText.includes('<html>') ||
      responseText.trim().startsWith('The service') ||
      responseText.includes('Service Unavailable') ||
      responseText.includes('503') && responseText.includes('Azure')
    );

  if (isAzureHtmlError) {
    throw {
      type: 'AZURE_COLD_START',
      message: 'Azure Functions is starting up. This can take 30-60 seconds.',
      status: response.status
    };
  }

  // Check if response is JSON
  if (!responseText.trim()) {
    return null;
  }

  // Try to parse as JSON
  try {
    return JSON.parse(responseText);
  } catch (jsonError) {
    // If it's not JSON but response was OK, it might be text
    if (response.ok) {
      return responseText;
    }
    
    // If not JSON and not OK, throw error
    throw {
      type: 'INVALID_RESPONSE',
      message: `Server returned invalid format: ${responseText.substring(0, 100)}`,
      status: response.status
    };
  }
};

// Fetch with retry logic for cold starts
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await smartFetch(url, options);
      return result;
      
    } catch (error) {
      // If it's a cold start error, wait and retry
      if (error.type === 'AZURE_COLD_START' && attempt < maxRetries) {
        const delay = attempt * 10000; // 10s, 20s, 30s...
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Re-throw other errors or if max retries reached
      throw error;
    }
  }
  throw new Error(`Maximum retries (${maxRetries}) exceeded`);
};

const SuperAdmin = () => {
  // State Management
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  // Error handling states
  const [error, setError] = useState(null);

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

  // Main data loading function
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchWithRetry(API_URL);
      setClients(data);
      
    } catch (err) {
      console.error("SuperAdmin load data error:", err);
      
      // User-friendly error messages
      let errorMsg = "Failed to load clients. ";
      
      if (err.type === 'AZURE_COLD_START') {
        errorMsg = "Client service is starting up. This can take 30-60 seconds on first use.";
      } else if (err.message.includes('Unexpected token')) {
        errorMsg = "Server returned unexpected response. Azure Functions might be starting up.";
      } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
        errorMsg = "Network connection issue. Please check your internet connection.";
      } else if (err.message.includes('Maximum retries')) {
        errorMsg = "Service is taking longer than expected to start. Please try again in a minute.";
      } else if (err.message.includes('404')) {
        errorMsg = "The API endpoint was not found.";
      } else if (err.message.includes('401') || err.message.includes('403')) {
        errorMsg = "Authentication error. API access code may be invalid.";
      } else {
        errorMsg = err.message || "An unexpected error occurred.";
      }
      
      setError(errorMsg);
      setClients([]);
      
    } finally {
      setLoading(false);
    }
  };

  // Handle retry
  const handleRetry = () => {
    setError(null);
    loadData();
  };

  // Fetch clients on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Calculate summary
  const summary = {
    clients: clients.length,
    invoice: clients.filter(client => client.Invoice === "Active").length,
    bank: clients.filter(client => client.BankStatement === "Active").length,
    mortgage: clients.filter(client => client.MortgageForms === "Active").length,
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
      setError(null);

      // Ensure count fields are integers
      const createData = {
        ...formData,
        InvoiceCount: parseInt(formData.InvoiceCount) || 0,
        BankStatementCount: parseInt(formData.BankStatementCount) || 0,
        MortgageFormsCount: parseInt(formData.MortgageFormsCount) || 0,
      };

      const data = await fetchWithRetry(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createData),
      });

      alert("Client created successfully!");
      await loadData();
      cancelForm();
    } catch (error) {
      console.error("Error creating client:", error);
      
      let errorMsg = "Failed to create client. ";
      if (error.type === 'AZURE_COLD_START') {
        errorMsg = "Service is starting up. Please wait and try again.";
      }
      
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Update existing client
  const updateClient = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      // Include the ID in the request body and ensure count fields are integers
      const updateData = {
        ...formData,
        ID: editingClient.ID,
        InvoiceCount: parseInt(formData.InvoiceCount) || 0,
        BankStatementCount: parseInt(formData.BankStatementCount) || 0,
        MortgageFormsCount: parseInt(formData.MortgageFormsCount) || 0,
      };

      const data = await fetchWithRetry(`${API_URL}&id=${editingClient.ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      alert("Client updated successfully!");
      await loadData();
      cancelForm();
    } catch (error) {
      console.error("Error updating client:", error);
      
      let errorMsg = "Failed to update client. ";
      if (error.type === 'AZURE_COLD_START') {
        errorMsg = "Service is starting up. Please wait and try again.";
      }
      
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete client
  const deleteClient = async (id) => {
    if (!confirm("Are you sure you want to delete this client?")) return;

    try {
      setError(null);
      
      const data = await fetchWithRetry(`${API_URL}&id=${id}`, {
        method: "DELETE",
      });

      alert("Client deleted successfully!");
      await loadData();
    } catch (error) {
      console.error("Error deleting client:", error);
      
      let errorMsg = "Failed to delete client. ";
      if (error.type === 'AZURE_COLD_START') {
        errorMsg = "Service is starting up. Please wait and try again.";
      }
      
      setError(errorMsg);
      alert(errorMsg);
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

          {/* Error Display - SIMPLE VERSION */}
          {error && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              padding: '15px',
              margin: '15px 0',
              color: '#856404'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <AlertCircle size={20} style={{ marginRight: '10px' }} />
                <strong>Connection Issue</strong>
              </div>
              <p style={{ marginBottom: '10px' }}>{error}</p>
              <button
                onClick={handleRetry}
                disabled={loading}
                style={{
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                <RefreshCw size={16} style={{ marginRight: '8px' }} />
                {loading ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          )}

          {/* Loading State - SIMPLE VERSION */}
          {loading && !error && (
            <p style={{ margin: '15px 0', textAlign: 'center', color: '#666' }}>
              Loading clients...
            </p>
          )}

          {/* Client Form Modal and Table */}
          {!loading && !error && (
            <>
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
                  {filteredClients.length === 0 ? (
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
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SuperAdmin;