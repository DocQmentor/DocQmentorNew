import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import "./SuperAdmin.css";
import Footer from "../Layout/Footer";
import FilePagination from "../Layout/FilePagination";

const MASTER_API_URL = "https://docqmentorfuncapp.azurewebsites.net/api/MasterDataFunc?code=Z1XY4-hEifOUkkmGCbvvCbHxnOzQf0QNYxTiRpwOgW3JAzFuQTYLnQ==";
const DYNAMIC_TABLE_API = "https://docqmentorfuncapp.azurewebsites.net/api/dynamictable?code=bbsE1Sshdh2O1GLYzxotgIWeM12JWkZ1bRnYZ-vFkM04AzFuXhibXA==";

const smartFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { "Accept": "application/json", "Content-Type": "application/json", ...options.headers },
  });
  const responseText = await response.text();
  const isAzureHtmlError =
    !response.ok && (
      responseText.includes("<!DOCTYPE") ||
      responseText.includes("<html>") ||
      responseText.trim().startsWith("The service") ||
      (responseText.includes("503") && responseText.includes("Azure"))
    );
  if (isAzureHtmlError) {
    throw { type: "AZURE_COLD_START", message: "Azure Functions is starting up. This can take 30–60 seconds.", status: response.status };
  }
  if (!responseText.trim()) return null;
  try {
    const jsonData = JSON.parse(responseText);
    if (!response.ok) {
      throw { type: "API_ERROR", message: jsonData.error || jsonData.message || `HTTP ${response.status}: ${response.statusText}`, status: response.status };
    }
    return jsonData;
  } catch (jsonError) {
    if (jsonError.type === "API_ERROR") throw jsonError;
    if (response.ok) return responseText;
    throw { type: "INVALID_RESPONSE", message: `Server returned invalid format: ${responseText.substring(0, 100)}`, status: response.status };
  }
};

const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await smartFetch(url, options);
    } catch (error) {
      if (error.type === "AZURE_COLD_START" && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 10000));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Maximum retries (${maxRetries}) exceeded`);
};

const callDynamicTableAPI = async (tableName, operation, id = null, data = null) => {
  const requestBody = { tableName, operation };
  if (id !== null) requestBody.id = id;
  if (data !== null) requestBody.data = data;
  const response = await fetch(DYNAMIC_TABLE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`API Error ${response.status}: ${responseText.substring(0, 200)}`);
  if (!responseText.trim()) return null;
  try { return JSON.parse(responseText); } catch { return { error: responseText }; }
};

const sanitizeTableName = (name) => name.replace(/[^a-zA-Z0-9_]/g, "");

const getClientStatus = (client) => {
  if (!client.EndDate) return "Active";
  return new Date(client.EndDate) >= new Date() ? "Active" : "Inactive";
};

const StatusBadge = ({ value }) => {
  const active = (value || "").toLowerCase() === "active";
  return (
    <span className={`sa-status-badge ${active ? "sa-badge-active" : "sa-badge-inactive"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
};

const SuperAdmin = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab]       = useState("clients");
  const [clients, setClients]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [expandedCompanies, setExpandedCompanies] = useState({});

  const [permissionData, setPermissionData]         = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [selectedBulkActions, setSelectedBulkActions] = useState({});
  const [isBulkProcessing, setIsBulkProcessing]     = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({ name: "", startDate: "", endDate: "" });

  const [formData, setFormData] = useState({
    Name: "", PlanName: "", StartDate: "", EndDate: "",
    InvoiceCount: 0, BankStatementCount: 0, MortgageFormsCount: 0,
    UserLimits: 0, Invoice: "Active", BankStatement: "Active", MortgageForms: "Active",
  });

  // ── Permissions ──────────────────────────────────────────────
  const loadPermissions = async () => {
    setLoadingPermissions(true);
    try {
      const masterResponse = await fetchWithRetry(MASTER_API_URL, { method: "GET" });
      if (!masterResponse || !Array.isArray(masterResponse)) { setPermissionData([]); return; }
      const validTables = masterResponse
        .filter(c => c && typeof c === "object")
        .map(c => c.Name)
        .filter(n => n && typeof n === "string" && n.trim() !== "")
        .map(n => n.trim());

      const allPermissions = [];
      for (const clientName of validTables) {
        try {
          const tableName = sanitizeTableName(clientName);
          const tableResponse = await callDynamicTableAPI(tableName, "readall");
          if (tableResponse && !tableResponse.error) {
            let tableData = [];
            if (tableResponse.success && tableResponse.data) tableData = tableResponse.data;
            else if (Array.isArray(tableResponse)) tableData = tableResponse;
            const pendingUsers = tableData.filter(u => {
              if (!u || typeof u !== "object") return false;
              const perm = u.Permission || u.permission;
              return perm && perm.toString().toLowerCase() === "inprocess";
            });
            if (pendingUsers.length > 0) {
              allPermissions.push({
                company: clientName,
                users: pendingUsers.map(u => ({
                  id: u.Id || u.id,
                  email: u.Email || u.email || "",
                  role: u.Role || u.role || "",
                  permission: u.Permission || u.permission || "",
                })),
              });
            }
          }
        } catch { /* skip failing tables */ }
      }
      setPermissionData(allPermissions);
      setExpandedCompanies({});
    } catch (err) {
      setError(`Failed to load permissions: ${err.message}`);
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => { loadPermissions(); }, []);

  const totalPendingUsers = permissionData.reduce((t, c) => t + c.users.length, 0);

  const toggleCompany = (company) =>
    setExpandedCompanies(prev => ({ ...prev, [company]: !prev[company] }));

  const handleToggleBulkAction = (company, user, type) => {
    setSelectedBulkActions(prev => {
      const key = `${company}-${user.id}`;
      const existing = prev[key];
      if (existing && existing.type === type) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { type, company, user } };
    });
  };

  const isSelected = (company, user) => {
    const key = `${company}-${user.id}`;
    return !!selectedBulkActions[key];
  };

  const handleSelectAllInGroup = (company, users, checked) => {
    setSelectedBulkActions(prev => {
      const next = { ...prev };
      users.forEach(user => {
        const key = `${company}-${user.id}`;
        if (checked) next[key] = { type: "grant", company, user };
        else delete next[key];
      });
      return next;
    });
  };

  const bulkCounts = {
    grant: Object.values(selectedBulkActions).filter(a => a.type === "grant").length,
    reject: Object.values(selectedBulkActions).filter(a => a.type === "reject").length,
    total: Object.keys(selectedBulkActions).length,
  };

  const handleBulkProceed = async (actionType, targetCompany = null) => {
    const actionItems = Object.values(selectedBulkActions).filter(a =>
      (!targetCompany || a.company === targetCompany)
    );
    if (actionItems.length === 0) return;
    setIsBulkProcessing(true);
    setLoadingPermissions(true);
    try {
      for (const item of actionItems) {
        const { company, user } = item;
        const tableName = sanitizeTableName(company);
        try {
          if (actionType === "grant") {
            await callDynamicTableAPI(tableName, "update", user.id, { Email: user.email, Role: user.role, Permission: "Approve" });
          } else {
            await callDynamicTableAPI(tableName, "delete", user.id);
          }
        } catch { /* continue */ }
      }
      setSelectedBulkActions({});
      await loadPermissions();
    } catch { /* ignore */ } finally {
      setIsBulkProcessing(false);
      setLoadingPermissions(false);
    }
  };

  const handleApprove = async (clientName, user) => {
    const tableName = sanitizeTableName(clientName);
    try {
      await callDynamicTableAPI(tableName, "update", user.id, { Email: user.email, Role: user.role, Permission: "Approve" });
      loadPermissions();
    } catch { /* ignore */ }
  };

  const handleDeny = async (clientName, user) => {
    const tableName = sanitizeTableName(clientName);
    try {
      await callDynamicTableAPI(tableName, "delete", user.id);
      loadPermissions();
    } catch { /* ignore */ }
  };

  // ── Clients ──────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithRetry(MASTER_API_URL, { method: "GET" });
      setClients(data || []);
    } catch (err) {
      setError(err.message || "Failed to load data");
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [filters.name, filters.startDate, filters.endDate]);

  const filteredClients = clients.filter(c => {
    const nameMatch = !filters.name || (c.Name || "").toLowerCase().includes(filters.name.toLowerCase());
    const startMatch = !filters.startDate || new Date(c.StartDate) >= new Date(filters.startDate);
    const endMatch = !filters.endDate || new Date(c.EndDate) <= new Date(filters.endDate);
    return nameMatch && startMatch && endMatch;
  });

  const totalPages = Math.ceil(filteredClients.length / rowsPerPage);
  const currentRows = filteredClients.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  const clearFilters = () => setFilters({ name: "", startDate: "", endDate: "" });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => setFormData({
    Name: "", PlanName: "", StartDate: "", EndDate: "",
    InvoiceCount: 0, BankStatementCount: 0, MortgageFormsCount: 0,
    UserLimits: 0, Invoice: "Active", BankStatement: "Active", MortgageForms: "Active",
  });

  const cancelForm = () => { resetForm(); setEditingClient(null); setShowAddClient(false); };

  const createClient = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const createData = {
        ...formData,
        UserLimits: parseInt(formData.UserLimits) || 0,
        InvoiceCount: parseInt(formData.InvoiceCount) || 0,
        BankStatementCount: parseInt(formData.BankStatementCount) || 0,
        MortgageFormsCount: parseInt(formData.MortgageFormsCount) || 0,
      };
      await fetchWithRetry(MASTER_API_URL, { method: "POST", body: JSON.stringify(createData) });
      await loadData();
      cancelForm();
    } catch (err) {
      let msg = "Failed to create client.";
      if (err.type === "AZURE_COLD_START") msg = "Service is starting up. Please wait and try again.";
      else if (err.message?.includes("Client Name already exists")) msg = "Client Name already exists.";
      else if (err.message) msg = err.message;
      setError(msg);
    } finally { setSubmitting(false); }
  };

  const updateClient = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updateData = {
        ...formData,
        ID: editingClient.ID,
        UserLimits: parseInt(formData.UserLimits) || 0,
        InvoiceCount: parseInt(formData.InvoiceCount) || 0,
        BankStatementCount: parseInt(formData.BankStatementCount) || 0,
        MortgageFormsCount: parseInt(formData.MortgageFormsCount) || 0,
      };
      await fetchWithRetry(`${MASTER_API_URL}&id=${editingClient.ID}`, { method: "PUT", body: JSON.stringify(updateData) });
      await loadData();
      cancelForm();
    } catch (err) {
      setError(err.type === "AZURE_COLD_START" ? "Service is starting up. Please wait and try again." : (err.message || "Failed to update client."));
    } finally { setSubmitting(false); }
  };

  const deleteClient = async (id) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    setError(null);
    try {
      await fetchWithRetry(`${MASTER_API_URL}&id=${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err.type === "AZURE_COLD_START" ? "Service is starting up. Please wait and try again." : "Failed to delete client.");
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      Name: client.Name || "", PlanName: client.PlanName || "",
      StartDate: client.StartDate ? client.StartDate.split("T")[0] : "",
      EndDate: client.EndDate ? client.EndDate.split("T")[0] : "",
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

  const handleView = (client) => navigate("/admin", { state: { clientName: client.Name } });

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="sa-page">
      <div className="sa-content">

      {/* Error Banner */}
      {error && (
        <div className="sa-error-banner">
          <span>⚠️ {error}</span>
          <button className="sa-btn-retry" onClick={() => { setError(null); loadData(); }}>
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="sa-tabs-bar">
        <button
          className={`sa-tab${activeTab === "clients" ? " active" : ""}`}
          onClick={() => setActiveTab("clients")}
        >
          🏢 Client Management
        </button>
        <button
          className={`sa-tab${activeTab === "access" ? " active" : ""}`}
          onClick={() => setActiveTab("access")}
        >
          🔐 Access Requests
          {totalPendingUsers > 0 && (
            <span className="sa-tab-badge">{totalPendingUsers}</span>
          )}
        </button>
        <button className="sa-add-client-btn" onClick={() => setShowAddClient(true)}>
          ➕ Add New Client
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="sa-summary-row">
        <div className="sa-summary-card">
          <div className="sa-summary-icon sa-summary-icon--clients">🏢</div>
          <div>
            <div className="sa-summary-label">Active Clients</div>
            <div className="sa-summary-value">{clients.length}</div>
          </div>
        </div>
        <div className="sa-summary-card">
          <div className="sa-summary-icon sa-summary-icon--invoice">💲</div>
          <div>
            <div className="sa-summary-label">Invoice</div>
            <div className="sa-summary-value">{clients.filter(c => (c.Invoice || "").toLowerCase() === "active").length}</div>
          </div>
        </div>
        <div className="sa-summary-card">
          <div className="sa-summary-icon sa-summary-icon--bank">🏦</div>
          <div>
            <div className="sa-summary-label">Bank Statement</div>
            <div className="sa-summary-value">{clients.filter(c => (c.BankStatement || "").toLowerCase() === "active").length}</div>
          </div>
        </div>
        <div className="sa-summary-card">
          <div className="sa-summary-icon sa-summary-icon--mortgage">🏠</div>
          <div>
            <div className="sa-summary-label">Mortgage Forms</div>
            <div className="sa-summary-value">{clients.filter(c => (c.MortgageForms || "").toLowerCase() === "active").length}</div>
          </div>
        </div>
      </div>

      {/* ── CLIENT MANAGEMENT TAB ── */}
      {activeTab === "clients" && (
        <div className="sa-section-card">
          {/* Filter Row */}
          <div className="sa-filter-row">
            <div className="sa-filter-field">
              <label className="sa-filter-lbl">CLIENT NAME</label>
              <input className="sa-filter-input" type="text" name="name" placeholder="🔍 Search name…" value={filters.name} onChange={handleFilterChange} />
            </div>
            <div className="sa-filter-field">
              <label className="sa-filter-lbl">START DATE FROM</label>
              <input className="sa-filter-input" type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
            </div>
            <div className="sa-filter-field">
              <label className="sa-filter-lbl">END DATE TO</label>
              <input className="sa-filter-input" type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
            </div>
            <div className="sa-filter-actions">
              <button className="sa-btn-reset" onClick={clearFilters}>&#8634; Reset</button>
            </div>
          </div>

          <div className="sa-table-info">
            Showing <strong>{filteredClients.length}</strong> of <strong>{clients.length}</strong> clients
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Plan</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Invoice</th>
                  <th>Bank Stmt</th>
                  <th>Mortgage</th>
                  <th>User Limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="10" className="sa-td-center">Loading clients…</td></tr>
                ) : currentRows.length === 0 ? (
                  <tr><td colSpan="10" className="sa-td-center">No clients found</td></tr>
                ) : (
                  currentRows.map((client) => (
                    <tr key={client.ID}>
                      <td className="sa-td-name">{client.Name || "—"}</td>
                      <td>{client.PlanName || "—"}</td>
                      <td>{client.StartDate ? new Date(client.StartDate).toLocaleDateString() : "—"}</td>
                      <td>{client.EndDate ? new Date(client.EndDate).toLocaleDateString() : "—"}</td>
                      <td><StatusBadge value={client.Invoice} /></td>
                      <td><StatusBadge value={client.BankStatement} /></td>
                      <td><StatusBadge value={client.MortgageForms} /></td>
                      <td>{client.UserLimits ?? 0}</td>
                      <td><StatusBadge value={getClientStatus(client)} /></td>
                      <td>
                        <div className="sa-action-btns">
                          <button className="sa-btn-edit" onClick={() => handleEdit(client)} title="Edit">✏</button>
                          <button className="sa-btn-view" onClick={() => handleView(client)} title="View Admin">👁</button>
                          <button className="sa-btn-delete" onClick={() => deleteClient(client.ID)} title="Delete">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredClients.length > rowsPerPage && (
            <FilePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              rowsPerPage={rowsPerPage}
              totalItems={filteredClients.length}
            />
          )}
        </div>
      )}

      {/* ── ACCESS REQUESTS TAB ── */}
      {activeTab === "access" && (
        <div className="sa-requests-card">
          <div className="sa-requests-accent" />

          <div className="sa-requests-head">
            <div>
              <div className="sa-requests-title">🔐 Pending Access Requests</div>
              <div className="sa-requests-sub">Review and approve or deny user access requests per client</div>
            </div>
          </div>

          {loadingPermissions ? (
            <div className="sa-requests-loading">Loading access requests…</div>
          ) : permissionData.length === 0 ? (
            <div className="sa-requests-empty">✅ No pending access requests</div>
          ) : (
            <div className="sa-accordion">
              {permissionData.map((group) => {
                const expanded = !!expandedCompanies[group.company];
                const groupSelected = group.users.filter(u => isSelected(group.company, u)).length;
                const allGroupSelected = groupSelected === group.users.length;
                return (
                  <div key={group.company} className="sa-accordion-item">
                    {/* Group header */}
                    <div className="sa-accordion-header" onClick={() => toggleCompany(group.company)}>
                      <span className="sa-accordion-arrow">{expanded ? "▼" : "▶"}</span>
                      <span className="sa-accordion-company">{group.company}</span>
                      <span className="sa-accordion-badge">{group.users.length}</span>
                      {!expanded && (
                        <span className="sa-accordion-hint">Click to expand {group.users.length} pending request{group.users.length !== 1 ? "s" : ""}</span>
                      )}
                      {expanded && (
                        <label className="sa-select-all" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={allGroupSelected}
                            onChange={e => handleSelectAllInGroup(group.company, group.users, e.target.checked)}
                          />
                          Select all in group
                        </label>
                      )}
                    </div>

                    {/* Expanded rows */}
                    {expanded && (
                      <div className="sa-accordion-body">
                        {group.users.map((user) => (
                          <div key={`${group.company}-${user.id}`} className="sa-user-row">
                            <input
                              type="checkbox"
                              className="sa-user-checkbox"
                              checked={isSelected(group.company, user)}
                              onChange={e => handleToggleBulkAction(group.company, user, e.target.checked ? "grant" : "reject")}
                            />
                            <span className="sa-user-email">{user.email}</span>
                            <span className="sa-user-role">{user.role || "—"}</span>
                            <span className="sa-user-date">Requested: {user.id}</span>
                            <button
                              className="sa-btn-approve"
                              onClick={() => handleApprove(group.company, user)}
                              disabled={isBulkProcessing}
                            >
                              ✅ Approve
                            </button>
                            <button
                              className="sa-btn-deny"
                              onClick={() => handleDeny(group.company, user)}
                              disabled={isBulkProcessing}
                            >
                              ✕ Deny
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bulk action bar */}
          {bulkCounts.total > 0 && (
            <div className="sa-bulk-bar">
              <span className="sa-bulk-count">{bulkCounts.total} user{bulkCounts.total !== 1 ? "s" : ""} selected</span>
              <div className="sa-bulk-actions">
                <button
                  className="sa-bulk-approve"
                  onClick={() => handleBulkProceed("grant")}
                  disabled={isBulkProcessing}
                >
                  {isBulkProcessing ? "Processing…" : "✅ Approve Selected"}
                </button>
                <button
                  className="sa-bulk-deny"
                  onClick={() => handleBulkProceed("reject")}
                  disabled={isBulkProcessing}
                >
                  ✕ Deny Selected
                </button>
              </div>
            </div>
          )}

          {/* Azure cold start note */}
          <div className="sa-coldstart-note">
            <strong>⚠️ Azure Cold Start Handling:</strong> If the backend returns 503, a banner is shown with automatic retry (10s → 20s → 30s backoff). The UI shows a "Retrying…" indicator while waiting for Azure Functions to warm up.
          </div>
        </div>
      )}

      {/* ── ADD / EDIT CLIENT MODAL ── */}
      {showAddClient && (
        <div className="sa-modal-overlay" onClick={cancelForm}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-accent" />
            <div className="sa-modal-head">
              <span className="sa-modal-title">{editingClient ? "✏ Edit Client" : "➕ Add New Client"}</span>
              <button className="sa-modal-close" onClick={cancelForm}>✕</button>
            </div>
            <hr className="sa-modal-hr" />

            <form className="sa-modal-form" onSubmit={editingClient ? updateClient : createClient}>
              {editingClient && (
                <div className="sa-form-row">
                  <div className="sa-form-field">
                    <label className="sa-form-lbl">CLIENT ID</label>
                    <input className="sa-form-input" type="text" value={editingClient.ID} disabled />
                  </div>
                </div>
              )}

              <div className="sa-form-row">
                <div className="sa-form-field">
                  <label className="sa-form-lbl">NAME *</label>
                  <input className="sa-form-input" type="text" name="Name" value={formData.Name} onChange={handleInputChange} required disabled={submitting || !!editingClient} placeholder="Client name" />
                </div>
                <div className="sa-form-field">
                  <label className="sa-form-lbl">PLAN *</label>
                  <select className="sa-form-input" name="PlanName" value={formData.PlanName} onChange={handleInputChange} required disabled={submitting}>
                    <option value="">Select Plan…</option>
                    <option value="Starter">Starter</option>
                    <option value="Professional">Professional</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="sa-form-row">
                <div className="sa-form-field">
                  <label className="sa-form-lbl">START DATE *</label>
                  <input className="sa-form-input" type="date" name="StartDate" value={formData.StartDate} onChange={handleInputChange} required disabled={submitting} />
                </div>
                <div className="sa-form-field">
                  <label className="sa-form-lbl">END DATE *</label>
                  <input className="sa-form-input" type="date" name="EndDate" value={formData.EndDate} onChange={handleInputChange} required disabled={submitting} />
                </div>
              </div>

              <div className="sa-form-row">
                <div className="sa-form-field">
                  <label className="sa-form-lbl">USER LIMIT</label>
                  <input className="sa-form-input" type="number" name="UserLimits" value={formData.UserLimits} onChange={handleInputChange} min="0" disabled={submitting} />
                </div>
                <div className="sa-form-field">
                  <label className="sa-form-lbl">INVOICE COUNT</label>
                  <input className="sa-form-input" type="number" name="InvoiceCount" value={formData.InvoiceCount} onChange={handleInputChange} min="0" disabled={submitting} />
                </div>
              </div>

              <div className="sa-form-row">
                <div className="sa-form-field">
                  <label className="sa-form-lbl">BANK COUNT</label>
                  <input className="sa-form-input" type="number" name="BankStatementCount" value={formData.BankStatementCount} onChange={handleInputChange} min="0" disabled={submitting} />
                </div>
                <div className="sa-form-field">
                  <label className="sa-form-lbl">MORTGAGE COUNT</label>
                  <input className="sa-form-input" type="number" name="MortgageFormsCount" value={formData.MortgageFormsCount} onChange={handleInputChange} min="0" disabled={submitting} />
                </div>
              </div>

              <div className="sa-form-row">
                <div className="sa-form-field">
                  <label className="sa-form-lbl">INVOICE STATUS</label>
                  <select className="sa-form-input" name="Invoice" value={formData.Invoice} onChange={handleInputChange} disabled={submitting}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="sa-form-field">
                  <label className="sa-form-lbl">BANK STATUS</label>
                  <select className="sa-form-input" name="BankStatement" value={formData.BankStatement} onChange={handleInputChange} disabled={submitting}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="sa-form-field">
                  <label className="sa-form-lbl">MORTGAGE STATUS</label>
                  <select className="sa-form-input" name="MortgageForms" value={formData.MortgageForms} onChange={handleInputChange} disabled={submitting}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="sa-modal-footer">
                <button type="button" className="sa-btn-cancel" onClick={cancelForm} disabled={submitting}>Cancel</button>
                <button type="button" className="sa-btn-clear" onClick={resetForm} disabled={submitting}>Clear</button>
                <button type="submit" className="sa-btn-save" disabled={submitting}>
                  {submitting ? "Saving…" : (editingClient ? "💾 Update" : "💾 Save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
      <Footer />
    </div>
  );
};

export default SuperAdmin;
