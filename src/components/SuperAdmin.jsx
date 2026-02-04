import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SuperAdmin.css";
import Footer from "../Layout/Footer";
import FilePagination from "../Layout/FilePagination";
import { UserRound, Receipt, AlertCircle, Landmark, Home, RefreshCw, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

const MASTER_API_URL = "https://docqmentorfuncapp.azurewebsites.net/api/MasterDataFunc?code=-naL4WUo1IvQ0tFNiOvKYNQVpFrlEOKr6XoAzDWRIS6HAzFuwFqgTA==";
const DYNAMIC_TABLE_API = "https://docqmentorfuncapp.azurewebsites.net/api/dynamictable?code=hti8hivQlsGePwd1jhdOMmm3cy_28hghWbLdWy2BLx1dAzFuchAdrA==";

// Smart fetch function that handles Azure HTML errors
const smartFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
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

// Call DynamicTable API for client tables only
const callDynamicTableAPI = async (tableName, operation, id = null, data = null) => {
  const requestBody = {
    tableName,
    operation
  };

  if (id !== null) {
    requestBody.id = id;
  }

  if (data !== null) {
    requestBody.data = data;
  }

  console.log(`Calling DynamicTable API for ${tableName}:`, {
    operation,
    id,
    hasData: data !== null
  });

  try {
    const response = await fetch(DYNAMIC_TABLE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`API Error for ${tableName}.${operation}:`, {
        status: response.status,
        responseText
      });
      throw new Error(`API Error ${response.status}: ${responseText.substring(0, 200)}`);
    }

    if (!responseText.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(responseText);
      return parsed;
    } catch (jsonError) {
      console.error("JSON Parse Error:", jsonError);
      return { error: responseText };
    }
  } catch (error) {
    console.error(`API Call Error for ${tableName}.${operation}:`, error);
    throw error;
  }
};

const SuperAdmin = () => {
  // State Management
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState({});

  // NEW: Separate state for permissions data and loading
  const [permissionData, setPermissionData] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [selectedBulkActions, setSelectedBulkActions] = useState({}); // { [userId]: { type: 'grant'|'reject', company, user } }
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

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
    UserLimits: 0,
    Invoice: "Active",
    BankStatement: "Active",
    MortgageForms: "Active",
  });

  // Load permissions from API - can be called from anywhere
  const loadPermissions = async () => {
    setLoadingPermissions(true);

    try {
      console.log("Starting to load permissions...");

      // 1. Fetch master table to get client table names using MasterDataFunc
      const masterResponse = await fetchWithRetry(MASTER_API_URL, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      console.log("Master table response:", masterResponse);

      if (!masterResponse) {
        console.error("No response from master table");
        return;
      }

      // MasterResponse should be an array of master records
      if (!Array.isArray(masterResponse)) {
        console.error("Invalid master response format:", masterResponse);
        return;
      }

      // Get list of valid client tables from MASTER table (using Name column)
      const validTables = masterResponse
        .filter(client => client && typeof client === 'object')
        .map(client => client.Name) // Use Name field from master table
        .filter(name => name && typeof name === 'string' && name.trim() !== '')
        .map(name => name.trim());

      console.log("Valid client tables found:", validTables);

      if (validTables.length === 0) {
        console.log("No valid client tables found in MASTER table");
        setPermissionData([]);
        setPermissionsLoaded(true);
        return;
      }

      // 2. Fetch users from each client table using DynamicTableFunc
      const allPermissions = [];

      for (const tableName of validTables) {
        try {
          console.log(`Fetching users from client table: ${tableName}`);
          const tableResponse = await callDynamicTableAPI(tableName, "readall");

          if (tableResponse && !tableResponse.error) {
            // Handle response format from DynamicTableFunc
            let tableData = [];
            if (tableResponse.success && tableResponse.data) {
              tableData = tableResponse.data;
            } else if (Array.isArray(tableResponse)) {
              tableData = tableResponse;
            }

            if (Array.isArray(tableData)) {
              // Filter only users with Permission = "InProcess" (case-insensitive)
              const pendingUsers = tableData.filter(user => {
                if (!user || typeof user !== 'object') return false;

                // Try different property name variations
                const permission = user.Permission || user.permission;
                return permission && permission.toString().toLowerCase() === "inprocess";
              });

              console.log(`Found ${pendingUsers.length} pending users in ${tableName}`);

              if (pendingUsers.length > 0) {
                allPermissions.push({
                  company: tableName,
                  users: pendingUsers.map(user => ({
                    id: user.Id || user.id,
                    email: user.Email || user.email || '',
                    role: user.Role || user.role || '',
                    permission: user.Permission || user.permission || ''
                  }))
                });
              }
            } else {
              console.warn(`Invalid data format for table ${tableName}:`, tableResponse);
            }
          } else {
            console.warn(`Error or no data for table ${tableName}:`, tableResponse);
          }
        } catch (tableError) {
          console.error(`Error fetching data for table ${tableName}:`, tableError);
          // Continue with other tables
        }
      }

      console.log("Final permission data:", allPermissions);
      setPermissionData(allPermissions);
      setPermissionsLoaded(true);

      // Initialize expanded state for companies (all collapsed by default)
      setExpandedCompanies({});

    } catch (error) {
      console.error("Error loading permissions:", error);
      setError(`Failed to load permissions data: ${error.message}`);
    } finally {
      setLoadingPermissions(false);
    }
  };

  // Load permissions immediately when component mounts
  useEffect(() => {
    loadPermissions();
  }, []);

  // Handle individual toggle for bulk action
  const handleToggleBulkAction = (company, user, type) => {
    setSelectedBulkActions(prev => {
      const userId = user.id || user.Id;
      const existingAction = prev[userId];

      // If clicking already selected action, unselect it
      if (existingAction && existingAction.type === type) {
        const next = { ...prev };
        delete next[userId];
        return next;
      }

      // Otherwise set the new type
      return {
        ...prev,
        [userId]: { type, company, user }
      };
    });
  };

  // Calculate bulk counts
  const bulkCounts = {
    grant: Object.values(selectedBulkActions).filter(a => a.type === 'grant').length,
    reject: Object.values(selectedBulkActions).filter(a => a.type === 'reject').length,
    total: Object.keys(selectedBulkActions).length
  };

  // Bulk action execution
  const handleBulkProceed = async (targetCompany = null) => {
    const actionItems = targetCompany
      ? Object.values(selectedBulkActions).filter(a => a.company === targetCompany)
      : Object.values(selectedBulkActions);

    const totalToProcess = actionItems.length;
    if (totalToProcess === 0) return;

    // if (!confirm(`Are you sure you want to proceed with ${totalToProcess} bulk actions?`)) return;

    setIsBulkProcessing(true);
    setLoadingPermissions(true);

    try {
      const results = [];

      for (const item of actionItems) {
        const { type, company, user } = item;
        const userId = user.id || user.Id;

        try {
          if (type === 'grant') {
            const updateData = {
              Email: user.email,
              Role: user.role,
              Permission: "Approve"
            };
            const response = await callDynamicTableAPI(company, "update", userId, updateData);
            results.push({ id: userId, success: response?.success });
          } else {
            const response = await callDynamicTableAPI(company, "delete", userId);
            results.push({ id: userId, success: response?.success });
          }
        } catch (err) {
          console.error(`Error processing bulk action for ${userId}:`, err);
          results.push({ id: userId, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      // alert(`Successfully processed ${successCount} of ${totalToProcess} actions.`);

      // Cleanup
      if (targetCompany) {
        setSelectedBulkActions(prev => {
          const next = { ...prev };
          actionItems.forEach(item => delete next[item.user.id || item.user.Id]);
          return next;
        });
      } else {
        setSelectedBulkActions({});
      }
      await loadPermissions();

    } catch (error) {
      console.error("Bulk action error:", error);
      // alert("An error occurred during bulk processing.");
    } finally {
      setIsBulkProcessing(false);
      setLoadingPermissions(false);
    }
  };

  // Handle approve action
  const handleApprove = async (tableName, user) => {
    // if (!confirm(`Are you sure you want to approve ${user.email}?`)) return;

    try {
      console.log(`Approving user ${user.id} in table ${tableName}`);

      // Prepare update data - keep all fields as they are, only change permission
      const updateData = {
        Email: user.email,
        Role: user.role,
        Permission: "Approve"
      };

      const response = await callDynamicTableAPI(tableName, "update", user.id, updateData);

      console.log("Approve response:", response);

      if (response && response.success) {
        // alert("User approved successfully!");
        // Refresh permissions data
        loadPermissions();
      } else {
        throw new Error(response?.error || "Failed to approve user");
      }
    } catch (error) {
      console.error("Error approving user:", error);
      // alert(`Failed to approve user: ${error.message}`);
    }
  };

  // Handle cancel action
  const handleCancel = async (tableName, user) => {
    // if (!confirm(`Are you sure you want to cancel ${user.email}'s request?`)) return;

    try {
      console.log(`Cancelling user ${user.id} from table ${tableName}`);

      const response = await callDynamicTableAPI(tableName, "delete", user.id);

      console.log("Cancel response:", response);

      if (response && response.success) {
        // alert("User request cancelled successfully!");
        // Refresh permissions data
        loadPermissions();
      } else {
        throw new Error(response?.error || "Failed to cancel user");
      }
    } catch (error) {
      console.error("Error cancelling user:", error);
      // alert(`Failed to cancel user: ${error.message}`);
    }
  };

  // Main data loading function (for master table)
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchWithRetry(MASTER_API_URL, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      setClients(data);

    } catch (err) {
      console.error("SuperAdmin load data error:", err);
      setError(err.message || "Failed to load data");
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

  // Calculate total pending users for summary
  const totalPendingUsers = permissionData.reduce((total, company) => total + company.users.length, 0);

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

  // Pagination calculations
  const totalPages = Math.ceil(filteredClients.length / rowsPerPage);
  const currentRows = filteredClients.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.name, filters.startDate, filters.endDate]);

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
      UserLimits: 0,
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
        UserLimits: parseInt(formData.UserLimits) || 0,
        InvoiceCount: parseInt(formData.InvoiceCount) || 0,
        BankStatementCount: parseInt(formData.BankStatementCount) || 0,
        MortgageFormsCount: parseInt(formData.MortgageFormsCount) || 0,
      };

      const data = await fetchWithRetry(MASTER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createData),
      });

      // alert("Client created successfully!");
      await loadData();
      cancelForm();
    } catch (error) {
      console.error("Error creating client:", error);

      let errorMsg = "Failed to create client. ";
      if (error.type === 'AZURE_COLD_START') {
        errorMsg = "Service is starting up. Please wait and try again.";
      }

      setError(errorMsg);
      // alert(errorMsg);
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
        UserLimits: parseInt(formData.UserLimits) || 0,
        InvoiceCount: parseInt(formData.InvoiceCount) || 0,
        BankStatementCount: parseInt(formData.BankStatementCount) || 0,
        MortgageFormsCount: parseInt(formData.MortgageFormsCount) || 0,
      };

      const data = await fetchWithRetry(`${MASTER_API_URL}&id=${editingClient.ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      // alert("Client updated successfully!");
      await loadData();
      cancelForm();
    } catch (error) {
      console.error("Error updating client:", error);

      let errorMsg = "Failed to update client. ";
      if (error.type === 'AZURE_COLD_START') {
        errorMsg = "Service is starting up. Please wait and try again.";
      }

      setError(errorMsg);
      // alert(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete client
  const deleteClient = async (id) => {
    if (!confirm("Are you sure you want to delete this client?")) return;

    try {
      setError(null);

      const data = await fetchWithRetry(`${MASTER_API_URL}&id=${id}`, {
        method: "DELETE",
      });

      // alert("Client deleted successfully!");
      await loadData();
    } catch (error) {
      console.error("Error deleting client:", error);

      let errorMsg = "Failed to delete client. ";
      if (error.type === 'AZURE_COLD_START') {
        errorMsg = "Service is starting up. Please wait and try again.";
      }

      setError(errorMsg);
      // alert(errorMsg);
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
      UserLimits: client.UserLimits || 0,
      InvoiceCount: client.InvoiceCount || 0,
      BankStatementCount: client.BankStatementCount || 0,
      MortgageFormsCount: client.MortgageFormsCount || 0,
      Invoice: client.Invoice || "Active",
      BankStatement: client.BankStatement || "Active",
      MortgageForms: client.MortgageForms || "Active",
    });
    setShowAddClient(true);
  };

  // Toggle company expansion
  const toggleCompany = (company) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [company]: !prev[company]
    }));
  };

  const navigate = useNavigate();

  // Navigate to Admin page with client details
  const handleView = (client) => {
    navigate('/admin', { state: { clientName: client.Name } });
  };

  return (
    <div className="superAdmin-container">
      <main className="superAdmin-main">
        {/* Summary Section */}
        <section className="superAdmin-summary-box">
          <div className="superAdmin-summary activeclient-superadmin">
            <UserRound className="icon-summary-superadmin UserRound-superadmin" size={35} />
            <div>
              <p>Active Clients</p>
              <p>{summary.clients}</p>
            </div>
          </div>
          <div className="superAdmin-summary invoice-superadmin">
            <p><Receipt className="icon-summary-superadmin Receipt-superadmin" size={35} /></p>
            <div>
              <p>Invoice</p>
              <p>{summary.invoice}</p>
            </div>
          </div>
          <div className="superAdmin-summary bank-superadmin">
            <p><Landmark className="icon-summary-superadmin Landmark--superadmin" size={35} /></p>
            <div>
              <p>Bank</p>
              <p>{summary.bank}</p>
            </div>
          </div>
          <div className="superAdmin-summary Mortgage-superadmin">
            <p><Home className="icon-summary-superadmin Home-superadmin" size={35} /></p>
            <div>
              <p>Mortgage</p>
              <p>{summary.mortgage}</p>
            </div>
          </div>
          <div
            className="superAdmin-summary Mortgage-superadmin"
            onClick={() => setShowPermissions(true)}
            style={{ cursor: "pointer" }}
            title={`${totalPendingUsers} pending user approvals`}
          >
            <p><ShieldCheck className="icon-summary-superadmin Home-superadmin" size={35} /></p>
            <div>
              <p>Access Requests</p>
              <p>
                {loadingPermissions ? "..." : totalPendingUsers}
              </p>
            </div>
          </div>
        </section>

        {/* Filter and Add Section */}
        <div className="superAdmin-table-permission">
          <section className="filter-section-superadmin">
            <div>
              <label htmlFor="nameFilter">Client Name</label>
              <input
                type="text"
                id="nameFilter"
                name="name"
                value={filters.name}
                onChange={handleFilterChange}
                placeholder="Search by Client Name"
              />
            </div>
            <div>
              <label htmlFor="startDateFilter">Subscription Start Date</label>
              <input
                type="date"
                id="startDateFilter"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label htmlFor="endDateFilter">Subscription End Date</label>
              <input
                type="date"
                id="endDateFilter"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>
            <button onClick={clearFilters}>Reset Filter</button>
            <button onClick={() => setShowAddClient(true)}>Register Client</button>
          </section>

          {/* Loading State */}
          {loading && !error && (
            <p className="loading-text">Loading clients...</p>
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
                            disabled={submitting || editingClient}
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
                            <option value="Standard">Standard</option>
                            <option value="Pro">Pro</option>
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
                          <label>User Limits</label>
                          <input
                            type="number"
                            name="UserLimits"
                            value={formData.UserLimits}
                            onChange={handleInputChange}
                            min="0"
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

              {/* Permission Modal */}
              {showPermissions && (
                <div className="modal-overlay">
                  <div className="modal-content permission-modal-content">
                    <h3>Pending User Approvals</h3>
                    

                    {loadingPermissions ? (
                      <p className="loading-text">Loading permissions...</p>
                    ) : permissionData.length === 0 ? (
                      <p className="no-data-text">No pending user approvals found</p>
                    ) : (
                      <div className="permission-accordion-container">
                        {permissionData.map((item) => (
                          <div key={item.company} className="permission-accordion-item">
                            <div
                              className="permission-accordion-header"
                              onClick={() => toggleCompany(item.company)}
                            >
                              <div className="company-header-left">
                                <span className="permission-accordion-header-company-name">{item.company}</span>
                              </div>

                              <div className="company-header-actions" onClick={(e) => e.stopPropagation()}>
                                <div className="bulk-selection-summary">
                                <span className="permission-accordion-header-user-count-badge"><strong>{item.users.length}</strong> pending</span>
                                  <span className="summary-item">Grant Selected: <strong>{Object.values(selectedBulkActions).filter(a => a.company === item.company && a.type === 'grant').length}</strong></span>
                                  <span className="summary-item">Reject Selected: <strong>{Object.values(selectedBulkActions).filter(a => a.company === item.company && a.type === 'reject').length}</strong></span>
                                </div>
                                <button
                                  className="btn-proceed"
                                  onClick={() => handleBulkProceed(item.company)}
                                  disabled={Object.values(selectedBulkActions).filter(a => a.company === item.company).length === 0 || isBulkProcessing}
                                >
                                  {isBulkProcessing ? "Processing..." : "Proceed"}
                                </button>
                              </div>

                              {expandedCompanies[item.company] ? <ChevronUp className="useradmin-Chevronup" size={20} /> : <ChevronDown className="useradmin-Chevrondown" size={20} />}
                            </div>
                            {expandedCompanies[item.company] && (
                              <div className="permission-accordion-content">
                                <ul className="permission-user-list">
                                  {item.users.map((user, idx) => {
                                    const userId = user.id || user.Id;
                                    const currentAction = selectedBulkActions[userId]?.type;

                                    return (
                                      <li key={`${item.company}-${userId || idx}`} className="permission-user-row">
                                        <div className="user-info">
                                          <span className="user-email">{user.email}</span>
                                          {/* <span className="user-status">Status: {user.permission}</span> */}
                                        </div>
                                        <div className="user-actions-row">
                                          <span className="user-role">{user.role}</span>
                                          <label className="action-checkbox-item grant-access">
                                            <input
                                              type="checkbox"
                                              checked={currentAction === 'grant'}
                                              onChange={() => handleToggleBulkAction(item.company, user, 'grant')}
                                            />
                                            <span className="grant-access-text">Grant Access</span>
                                          </label>
                                          <label className="action-checkbox-item reject-access">
                                            <input
                                              type="checkbox"
                                              checked={currentAction === 'reject'}
                                              onChange={() => handleToggleBulkAction(item.company, user, 'reject')}
                                            />
                                            <span className="reject-access-text">Reject Access</span>
                                          </label>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => setShowPermissions(false)}
                        className="btn-cancel"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={loadPermissions}
                        className="btn-refresh"
                        disabled={loadingPermissions}
                      >
                        {loadingPermissions ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>
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
                    <th>Active-Users</th>
                    <th>User-Limits</th>
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
                  {currentRows.length === 0 ? (
                    <tr>
                      <td colSpan="12" style={{ textAlign: "center" }}>
                        No clients found
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((client) => (
                      <tr key={client.ID}>
                        <td>{client.ID || 'N/A'}</td>
                        <td>{client.Name || 'N/A'}</td>
                        <td>{client.PlanName || 'N/A'}</td>
                        <td>{client.StartDate ? new Date(client.StartDate).toLocaleDateString() : 'N/A'}</td>
                        <td>{client.EndDate ? new Date(client.EndDate).toLocaleDateString() : 'N/A'}</td>
                        <td>{client.ActiveUsers ?? 0}</td>
                        <td>{client.UserLimits ?? 0}</td>
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
                          <button className="btn-edit" onClick={() => handleView(client)}>
                            View
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

              {/* Pagination */}
              <FilePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                rowsPerPage={rowsPerPage}
                totalItems={filteredClients.length}
              />
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SuperAdmin;