import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import './Users.css';
import Footer from "../Layout/Footer";
import FilePagination from '../Layout/FilePagination';

const METRICS = [
  { key: "totalUsers",    emoji: "👥", label: "TOTAL USERS",      sub: "All registered",    valueColor: "#256695" },
  { key: "activeUsers",   emoji: "✅", label: "ACTIVE USERS",     sub: "Approved access",   valueColor: "#2e9a55" },
  { key: "inProcessUsers",emoji: "⏳", label: "IN PROCESS",       sub: "Pending approval",  valueColor: "#e09800" },
  { key: "usersLimit",    emoji: "🔒", label: "USER LIMIT",       sub: "Max allowed",       valueColor: "#256695" },
  { key: "additionalUsers",emoji:"➕", label: "ADDITIONAL SLOTS", sub: "Extra beyond limit", valueColor: "#e09800" },
];

const getPermClass = (perm) => {
  const p = (perm || "").toLowerCase();
  if (p === "approve")   return "perm-approved";
  if (p === "inprocess") return "perm-inprocess";
  return "perm-default";
};

const getPermLabel = (perm) => {
  const p = (perm || "").toLowerCase();
  if (p === "approve")   return "✅ Approved";
  if (p === "inprocess") return "⏳ In Process";
  return perm || "—";
};

const Users = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [clientName, setClientName] = useState(null);
  const [userLimit, setUserLimit] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [idFilter,    setIdFilter]    = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [roleFilter,  setRoleFilter]  = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole,  setNewUserRole]  = useState('');
  const [modalError,   setModalError]  = useState('');
  const [submitting,   setSubmitting]  = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  useEffect(() => {
    if (location.state) {
      setClientName(location.state.clientName);
      setUserLimit(location.state.userLimit || 0);
    } else {
      setError("No client data provided. Please navigate from Admin page.");
      setLoading(false);
    }
  }, [location.state]);

  const sanitizeTableName = (name) => name.replace(/[^a-zA-Z0-9_]/g, '');

  const fetchUsers = async () => {
    if (!clientName) return;
    setLoading(true);
    setError(null);
    try {
      const tableName = sanitizeTableName(clientName);
      const response = await fetch(
        "https://docqmentorfuncapp.azurewebsites.net/api/dynamictable?code=bbsE1Sshdh2O1GLYzxotgIWeM12JWkZ1bRnYZ-vFkM04AzFuXhibXA==",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableName, operation: "readall" }),
        }
      );
      const text = await response.text();
      let data = [];
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) data = parsed;
        else if (parsed.data && Array.isArray(parsed.data)) data = parsed.data;
        else if (parsed.users && Array.isArray(parsed.users)) data = parsed.users;
      } catch { throw new Error("Invalid response format from server"); }
      setUsers(data);
    } catch (err) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (clientName) fetchUsers(); }, [clientName]);
  useEffect(() => { setCurrentPage(1); }, [idFilter, emailFilter, roleFilter]);

  const metrics = {
    totalUsers:     users.filter(u => u.Permission === "Approve").length,
    activeUsers:    users.filter(u => u.Permission === "Approve").length,
    inProcessUsers: users.filter(u => u.Permission === "InProcess").length,
    usersLimit:     userLimit,
    additionalUsers: Math.max(0, users.filter(u => u.Permission === "Approve").length - userLimit),
  };

  const filteredUsers = users.filter(u => {
    const idMatch    = !idFilter    || (u.Id || u.id || '').toString().includes(idFilter);
    const emailMatch = !emailFilter || (u.Email || u.email || '').toLowerCase().includes(emailFilter.toLowerCase());
    const roleMatch  = !roleFilter  || (u.Role || u.role) === roleFilter;
    return idMatch && emailMatch && roleMatch;
  });

  const totalPages  = Math.ceil(filteredUsers.length / rowsPerPage);
  const currentUsers = filteredUsers.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage);
  const uniqueRoles = [...new Set(users.map(u => u.Role || u.role).filter(Boolean))].sort();

  const validateEmailFormat = (email) => {
    if (email.includes(' ')) return { valid: false, error: 'Email cannot contain spaces' };
    if (email.indexOf('@') <= 0) return { valid: false, error: 'Email must have a username before @' };
    return { valid: true };
  };

  const validateEmailDomain = (email) => {
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1].split('.')[0].toLowerCase();
    return domain === clientName.replace(/\s+/g, '').toLowerCase();
  };

  const emailExists = (email) =>
    users.some(u => (u.Email || u.email || '').toLowerCase() === email.toLowerCase());

  const handleAddUser = async () => {
    setModalError('');
    if (!newUserEmail.trim() || !newUserRole.trim()) { setModalError('Both Email and Role are required'); return; }
    const fmt = validateEmailFormat(newUserEmail);
    if (!fmt.valid) { setModalError(fmt.error); return; }
    if (!validateEmailDomain(newUserEmail)) {
      setModalError(`Email domain must match client name (@${clientName.replace(/\s+/g,'').toLowerCase()}.com)`);
      return;
    }
    if (emailExists(newUserEmail)) { setModalError('Email already exists in this client'); return; }
    setSubmitting(true);
    try {
      const tableName = sanitizeTableName(clientName);
      const res = await fetch(
        "https://docqmentorfuncapp.azurewebsites.net/api/dynamictable?code=bbsE1Sshdh2O1GLYzxotgIWeM12JWkZ1bRnYZ-vFkM04AzFuXhibXA==",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableName, operation: "create", data: { Email: newUserEmail, Role: newUserRole } }),
        }
      );
      if (!res.ok) throw new Error('Failed to add user');
      await fetchUsers();
      setShowAddModal(false);
      setNewUserEmail('');
      setNewUserRole('');
      setModalError('');
    } catch (err) {
      setModalError(err.message || 'Failed to add user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setNewUserEmail('');
    setNewUserRole('');
    setModalError('');
  };

  const clientLabel = clientName || "Client";

  return (
    <div className="usr-page">
      <div className="usr-content">
      {/* Error banner (non-blocking) */}
      {error && (
        <div className="usr-error-banner">
          ⚠️ {error}
          <button className="usr-btn-back" onClick={() => navigate(-1)}>← Back</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="usr-metrics">
        {METRICS.map((m) => (
          <div key={m.key} className="usr-metric-card">
            <span className="usr-metric-emoji">{m.emoji}</span>
            <div className="usr-metric-right">
              <div className="usr-metric-lbl">{m.label}</div>
              <div className="usr-metric-val" style={{ color: m.valueColor }}>{metrics[m.key]}</div>
              <div className="usr-metric-sub">{m.sub}</div>
            </div>
          </div>
        ))}
        {/* Add New User card */}
        <div className="usr-metric-card usr-add-card" onClick={() => setShowAddModal(true)}>
          <span className="usr-add-plus">➕</span>
          <div>
            <div className="usr-add-title">Add New User</div>
            <div className="usr-add-sub">Click to invite a user</div>
            <div className="usr-add-hint">Sends access request</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="usr-filter-card">
        <div className="usr-filter-row">
          <div className="usr-filter-field">
            <label className="usr-filter-lbl">SEARCH BY ID</label>
            <input className="usr-filter-input" type="text" placeholder="🔍 User ID…" value={idFilter} onChange={e => setIdFilter(e.target.value)} />
          </div>
          <div className="usr-filter-field usr-filter-field--grow">
            <label className="usr-filter-lbl">SEARCH BY EMAIL</label>
            <input className="usr-filter-input" type="text" placeholder="🔍 user@domain.com…" value={emailFilter} onChange={e => setEmailFilter(e.target.value)} />
          </div>
          <div className="usr-filter-field">
            <label className="usr-filter-lbl">SEARCH BY ROLE</label>
            <select className="usr-filter-input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">All Roles ▾</option>
              {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="usr-filter-actions">
            <button className="usr-btn-reset" onClick={() => { setIdFilter(''); setEmailFilter(''); setRoleFilter(''); setCurrentPage(1); }}>
              &#8634; Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="usr-table-card">
        <div className="usr-table-info">
          Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="usr-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Permission Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="usr-td-center">Loading users…</td></tr>
              ) : currentUsers.length > 0 ? (
                currentUsers.map((user, i) => (
                  <tr key={i}>
                    <td>{user.Id || user.id || '—'}</td>
                    <td>{user.Email || user.email || '—'}</td>
                    <td>{user.Role || user.role || '—'}</td>
                    <td>
                      <span className={`usr-perm-badge ${getPermClass(user.Permission || user.permission)}`}>
                        {getPermLabel(user.Permission || user.permission)}
                      </span>
                    </td>
                    <td>
                      <button className="usr-action-btn" onClick={() => setShowAddModal(true)}>
                        &#9998; Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="usr-td-center">No users found matching the filters</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredUsers.length > rowsPerPage && (
          <FilePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            rowsPerPage={rowsPerPage}
            totalItems={filteredUsers.length}
          />
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="usr-modal-overlay" onClick={handleCloseModal}>
          <div className="usr-modal" onClick={e => e.stopPropagation()}>
            <div className="usr-modal-accent" />
            <div className="usr-modal-head">
              <span className="usr-modal-title">👤 Add New User</span>
              <button className="usr-modal-close" onClick={handleCloseModal}>✕</button>
            </div>
            <hr className="usr-modal-hr" />

            <div className="usr-modal-body">
              {modalError && <div className="usr-modal-error">⚠️ {modalError}</div>}

              <div className="usr-form-field">
                <label className="usr-form-lbl">EMAIL ADDRESS</label>
                <input
                  className="usr-form-input"
                  type="email"
                  placeholder={`user@${clientLabel.replace(/\s+/g,'').toLowerCase()}.com`}
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="usr-form-field">
                <label className="usr-form-lbl">ROLE</label>
                <input
                  className="usr-form-input"
                  type="text"
                  placeholder="e.g. Reviewer, Viewer, Admin"
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="usr-validation-box">
                <div className="usr-validation-title">Validation rules:</div>
                <div className="usr-validation-rule">• Email domain must match: @{clientLabel.replace(/\s+/g,'').toLowerCase()}.com</div>
                <div className="usr-validation-rule">• No spaces allowed · No duplicate emails</div>
              </div>
            </div>

            <div className="usr-modal-footer">
              <button className="usr-btn-cancel" onClick={handleCloseModal} disabled={submitting}>Cancel</button>
              <button className="usr-btn-add" onClick={handleAddUser} disabled={submitting}>
                {submitting ? "Adding…" : "➕ Add User"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      <Footer />
    </div>
  );
};

export default Users;
