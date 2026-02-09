import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Users as UsersIcon, UserPlus, Search, X, RefreshCw, AlertCircle } from 'lucide-react';
import './Users.css';
import Footer from "../Layout/Footer";
import FilePagination from '../Layout/FilePagination';

const Users = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Navigation data
    const [clientName, setClientName] = useState(null);
    const [clientData, setClientData] = useState(null);
    const [userLimit, setUserLimit] = useState(0);

    // Users data
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [idFilter, setIdFilter] = useState('');
    const [emailFilter, setEmailFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    // Add Users Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('');
    const [modalError, setModalError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage] = useState(10);

    // Initialize data from navigation
    useEffect(() => {
        if (location.state) {
            setClientName(location.state.clientName);
            setClientData(location.state.clientData);
            setUserLimit(location.state.userLimit || 0);
        } else {
            setError("No client data provided. Please navigate from Admin page.");
            setLoading(false);
        }
    }, [location.state]);

    // Helper to sanitize table name
    const sanitizeTableName = (name) => {
        return name.replace(/[^a-zA-Z0-9_]/g, '');
    };

    // Fetch users from DynamicTable API
    const fetchUsers = async () => {
        if (!clientName) return;

        setLoading(true);
        setError(null);

        try {
            const tableName = sanitizeTableName(clientName);
            const response = await fetch(
                "https://docqmentorfuncapp.azurewebsites.net/api/dynamictable?code=hti8hivQlsGePwd1jhdOMmm3cy_28hghWbLdWy2BLx1dAzFuchAdrA==",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        tableName: tableName,
                        operation: "readall"
                    })
                }
            );

            const responseText = await response.text();
            let usersData = [];

            try {
                const parsed = JSON.parse(responseText);
                if (Array.isArray(parsed)) {
                    usersData = parsed;
                } else if (parsed.data && Array.isArray(parsed.data)) {
                    usersData = parsed.data;
                } else if (parsed.users && Array.isArray(parsed.users)) {
                    usersData = parsed.users;
                }
            } catch (e) {
                console.error("Error parsing users data:", e);
                throw new Error("Invalid response format from server");
            }

            setUsers(usersData);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError(err.message || "Failed to load users. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Fetch users when clientName is available
    useEffect(() => {
        if (clientName) {
            fetchUsers();
        }
    }, [clientName]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [idFilter, emailFilter, roleFilter]);

    // Calculate metrics
    const calculateMetrics = () => {
        const totalUsers = users.filter(
            u => u.Permission === "Approve" || u.Permission === "InProcess"
        ).length;

        const activeUsers = users.filter(
            u => u.Permission === "Approve"
        ).length;

        const inProcessUsers = users.filter(
            u => u.Permission === "InProcess"
        ).length;

        const additionalUsers = totalUsers > userLimit ? totalUsers - userLimit : 0;

        return {
            totalUsers,
            activeUsers,
            inProcessUsers,
            usersLimit: userLimit,
            additionalUsers
        };
    };

    const metrics = calculateMetrics();

    // Filter users
    const getFilteredUsers = () => {
        return users.filter(user => {
            const idMatch = !idFilter || (user.Id || user.id || '').toString() === idFilter;
            const emailMatch = !emailFilter ||
                (user.Email || user.email || '').toLowerCase().includes(emailFilter.toLowerCase());
            const roleMatch = !roleFilter || (user.Role || user.role) === roleFilter;

            return idMatch && emailMatch && roleMatch;
        });
    };

    const filteredUsers = getFilteredUsers();

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const currentUsers = filteredUsers.slice(startIndex, startIndex + rowsPerPage);

    // Get unique roles for filter dropdown
    const getUniqueRoles = () => {
        const roles = users.map(u => u.Role || u.role).filter(Boolean);
        return [...new Set(roles)].sort();
    };

    // Reset all filters
    const resetFilters = () => {
        setIdFilter('');
        setEmailFilter('');
        setRoleFilter('');
        setCurrentPage(1);
    };

    // Validate email format (spaces and username)
    const validateEmailFormat = (email) => {
        // Check if email contains spaces
        if (email.includes(' ')) {
            return { valid: false, error: 'Email cannot contain spaces' };
        }

        // Check if email has username before @
        const atIndex = email.indexOf('@');
        if (atIndex <= 0) {
            return { valid: false, error: 'Email must have a username before @' };
        }

        // Check if email has @ symbol
        if (atIndex === -1) {
            return { valid: false, error: 'Email must contain @ symbol' };
        }

        return { valid: true };
    };

    // Validate email domain
    const validateEmailDomain = (email) => {
        const emailParts = email.split('@');
        if (emailParts.length !== 2) return false;

        const emailDomain = emailParts[1];
        if (!emailDomain) return false;

        const domain = emailDomain.split('.')[0].toLowerCase();
        // Normalize client name by removing spaces
        const normalizedClientName = clientName.replace(/\s+/g, '').toLowerCase();

        return domain === normalizedClientName;
    };

    // Check if email already exists
    const emailExists = (email) => {
        return users.some(u =>
            (u.Email || u.email || '').toLowerCase() === email.toLowerCase()
        );
    };

    // Handle Add User submission
    const handleAddUser = async () => {
        setModalError('');

        // Validation
        if (!newUserEmail.trim() || !newUserRole.trim()) {
            setModalError('Both Email and Role are required');
            return;
        }

        // 1. Check email format (spaces and username)
        const formatValidation = validateEmailFormat(newUserEmail);
        if (!formatValidation.valid) {
            setModalError(formatValidation.error);
            return;
        }

        // 2. Check email domain
        if (!validateEmailDomain(newUserEmail)) {
            const normalizedClientName = clientName.replace(/\s+/g, '').toLowerCase();
            setModalError(`Email domain must match client name (@${normalizedClientName}.com)`);
            return;
        }

        // 3. Check for duplicates
        if (emailExists(newUserEmail)) {
            setModalError('Email already exists in this client');
            return;
        }

        setSubmitting(true);

        try {
            const tableName = sanitizeTableName(clientName);
            const response = await fetch(
                "https://docqmentorfuncapp.azurewebsites.net/api/dynamictable?code=hti8hivQlsGePwd1jhdOMmm3cy_28hghWbLdWy2BLx1dAzFuchAdrA==",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        tableName: tableName,
                        operation: "create",
                        data: {
                            Email: newUserEmail,
                            Role: newUserRole
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error('Failed to add user');
            }

            // Refresh users list
            await fetchUsers();

            // Close modal and reset form
            setShowAddModal(false);
            setNewUserEmail('');
            setNewUserRole('');
            setModalError('');
        } catch (err) {
            console.error("Error adding user:", err);
            setModalError(err.message || 'Failed to add user. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle modal close
    const handleCloseModal = () => {
        setShowAddModal(false);
        setNewUserEmail('');
        setNewUserRole('');
        setModalError('');
    };

    if (loading) {
        return (
            <div className="container-users">
                <main className="main-users">
                    <div className="loading-container">
                        <RefreshCw className="loading-spinner" size={48} />
                        <p>Loading users data...</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container-users">
                <main className="main-users">
                    <div className="error-container">
                        <AlertCircle size={48} color="#dc3545" />
                        <h3>Error Loading Users</h3>
                        <p>{error}</p>
                        <button onClick={() => navigate(-1)} className="btn-back">
                            Go Back
                        </button>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="container-users">
            <main className="main-users">
                {/* Header */}
                <section className="users-header">
                    <h2>{clientName} - Users Management</h2>
                    <button onClick={fetchUsers} className="Users-btn-refresh">
                        <RefreshCw className="RefreshCw-Users" size={16} /> Refresh
                    </button>
                </section>

                {/* Metrics Cards */}
                <section className="metrics-section">
                    <div className="metric-card total-users">
                        <div className="metric-icon">
                            <UsersIcon className="UsersIcon-Users" size={24} />
                        </div>
                        <div className="metric-content">
                            <span className="metric-label">Total Users</span>
                            <span className="metric-value">{metrics.totalUsers}</span>
                        </div>
                    </div>

                    <div className="metric-card active-users">
                        <div className="metric-icon">
                            <UsersIcon className="UsersIcon-Users" size={24} />
                        </div>
                        <div className="metric-content">
                            <span className="metric-label">Active Users</span>
                            <span className="metric-value">{metrics.activeUsers}</span>
                        </div>
                    </div>

                    <div className="metric-card inprocess-users">
                        <div className="metric-icon">
                            <UsersIcon className="UsersIcon-Users" size={24} />
                        </div>
                        <div className="metric-content">
                            <span className="metric-label">InProcess Users</span>
                            <span className="metric-value">{metrics.inProcessUsers}</span>
                        </div>
                    </div>

                    <div className="metric-card users-limit">
                        <div className="metric-icon">
                            <UsersIcon className="UsersIcon-Users" size={24} />
                        </div>
                        <div className="metric-content">
                            <span className="metric-label">User Limits</span>
                            <span className="metric-value">{metrics.usersLimit}</span>
                        </div>
                    </div>

                    <div className="metric-card additional-users">
                        <div className="metric-icon">
                            <UsersIcon className="UsersIcon-Users" size={24} />
                        </div>
                        <div className="metric-content">
                            <span className="metric-label">Additional Users</span>
                            <span className="metric-value">{metrics.additionalUsers}</span>
                        </div>
                    </div>

                    <div className="metric-card add-users-card" onClick={() => setShowAddModal(true)}>
                        <div className="metric-icon">
                            <UserPlus className="UsersIcon-Users" size={24} />
                        </div>
                        <div className="metric-content">
                            <span className="metric-label">Add Users</span>
                            <span className="metric-value">+</span>
                        </div>
                    </div>
                </section>

                {/* Filters */}
                <section className="filters-section">
                    <div className="filter-group">
                        <label htmlFor="id-filter">
                            <Search size={16} /> Search by Id
                        </label>
                        <input
                            id="id-filter"
                            type="text"
                            placeholder="Enter ID"
                            value={idFilter}
                            onChange={(e) => setIdFilter(e.target.value)}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="email-filter">
                            <Search size={16} /> Search by Email
                        </label>
                        <input
                            id="email-filter"
                            type="text"
                            placeholder="Enter email"
                            value={emailFilter}
                            onChange={(e) => setEmailFilter(e.target.value)}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="role-filter">
                            <Search size={16} /> Search by Role
                        </label>
                        <select
                            id="role-filter"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="">All Roles</option>
                            {getUniqueRoles().map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>

                    <button onClick={resetFilters} className="btn-reset">
                        Reset Filter
                    </button>
                </section>

                {/* Users Table */}
                <section className="table-section">
                    <div className="table-wrapper">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Id</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Permission</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentUsers.length > 0 ? (
                                    currentUsers.map((user, index) => (
                                        <tr key={index}>
                                            <td>{user.Id || user.id || '-'}</td>
                                            <td>{user.Email || user.email || '-'}</td>
                                            <td>{user.Role || user.role || '-'}</td>
                                            <td>
                                                <span className={`permission-badge ${(user.Permission || user.permission || '').toLowerCase()}`}>
                                                    {user.Permission || user.permission || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="no-data">
                                            No users found matching the filters
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredUsers.length > 0 && (
                        <FilePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            rowsPerPage={rowsPerPage}
                            totalItems={filteredUsers.length}
                        />
                    )}
                </section>
            </main>

            {/* Add Users Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add New User</h3>
                            <button className="btn-close" onClick={handleCloseModal}>
                                <X className="Users-X" size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {modalError && (
                                <div className="modal-error">
                                    <AlertCircle size={16} />
                                    {modalError}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="new-email">Email *</label>
                                <input
                                    id="new-email"
                                    type="email"
                                    placeholder={`user@${clientName}.com`}
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="new-role">Role *</label>
                                <input
                                    id="new-role"
                                    type="text"
                                    placeholder="Enter role"
                                    value={newUserRole}
                                    onChange={(e) => setNewUserRole(e.target.value)}
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={handleCloseModal}
                                className="btn-cancel"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddUser}
                                className="btn-submit"
                                disabled={submitting}
                            >
                                {submitting ? 'Adding...' : 'Add User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default Users;