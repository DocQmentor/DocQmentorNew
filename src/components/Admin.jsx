// Admin.jsx
import React, { useState, useEffect } from 'react';
import { FileText, BarChart2, Users, Database, X, Shield, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import './Admin.css';
import Footer from "../Layout/Footer";
import FilePagination from '../Layout/FilePagination';
import useSortableData from "../utils/useSortableData";

const Admin = () => {
  // Client Admin Data States
  const [dateWiseData, setDateWiseData] = useState([]);
  const [vendorWiseData, setVendorWiseData] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]); // Store original data
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
 
  // Add selected document type state
  const [selectedDocumentType, setSelectedDocumentType] = useState('');

  // Filter states for date-wise table
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [dateCompletionRateFilter, setDateCompletionRateFilter] = useState('');

  // Filter states for vendor-wise table
  const [vendorSelectFilter, setVendorSelectFilter] = useState('');
  const [vendorSearchFilter, setVendorSearchFilter] = useState('');
  const [vendorCompletionRateFilter, setVendorCompletionRateFilter] = useState('');

  // Pagination states for date-wise table
  const [currentDatePage, setCurrentDatePage] = useState(1);
  const [dateRowsPerPage] = useState(6);

  // Pagination states for vendor-wise table
  const [currentVendorPage, setCurrentVendorPage] = useState(1);
  const [vendorRowsPerPage] = useState(6);

  // Table Navigation State
  const [currentTableIndex, setCurrentTableIndex] = useState(0);
  const [selectedTable, setSelectedTable] = useState('dateWise');

  // Table Configuration
  const tableConfig = [
    {
      id: 'dateWise',
      name: 'Date-wise Statistics',
      component: 'dateWise'
    },
    {
      id: 'vendorWise',
      name: 'Vendor-wise Statistics',
      component: 'vendorWise'
    }
  ];

  // User Management States
  const [users, setUsers] = useState([
    { id: 1, email: "admin@example.com", role: "Admin" },
    { id: 2, email: "reviewer@example.com", role: "Contributor" },
    { id: 3, email: "user1@example.com", role: "Member" },
    { id: 4, email: "user2@example.com", role: "Member" }
  ]);
 
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [filteredUsers, setFilteredUsers] = useState(users);
  const [activeUserId, setActiveUserId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');

  // Table Navigation Functions
  const handleTableSelect = (tableId) => {
    const index = tableConfig.findIndex(table => table.id === tableId);
    if (index !== -1) {
      setSelectedTable(tableId);
      setCurrentTableIndex(index);
    }
  };

  const goToPreviousTable = () => {
    setCurrentTableIndex(prev => {
      const newIndex = prev > 0 ? prev - 1 : tableConfig.length - 1;
      setSelectedTable(tableConfig[newIndex].id);
      return newIndex;
    });
  };

  const goToNextTable = () => {
    setCurrentTableIndex(prev => {
      const newIndex = prev < tableConfig.length - 1 ? prev + 1 : 0;
      setSelectedTable(tableConfig[newIndex].id);
      return newIndex;
    });
  };

  // Load selected document type from localStorage on component mount
  useEffect(() => {
    const storedDocumentType = localStorage.getItem('selectedModelType');
    if (storedDocumentType) {
      setSelectedDocumentType(storedDocumentType);
    } else {
      // Default to Invoice if no selection exists
      setSelectedDocumentType('Invoice');
    }
  }, []);

  // Fetch data from API
  const fetchData = async () => {
    try {
      setDataLoading(true);
      const response = await fetch(
        "https://docqmentorfuncapp20250915180927.azurewebsites.net/api/DocQmentorFunc?code=KCnfysSwv2U9NKAlRNi0sizWXQGIj_cP6-IY0T_7As9FAzFu35U8qA=="
      );
     
      if (!response.ok) throw new Error('Failed to fetch data');
     
      const allDocumentsData = await response.json();
      setAllDocuments(allDocumentsData);
     
      // Process data for date-wise statistics (filtered by document type)
      const dateStats = processDateWiseData(allDocumentsData);
      setDateWiseData(dateStats);
     
      // Process data for vendor-wise statistics (filtered by document type)
      const vendorStats = processVendorWiseData(allDocumentsData);
      setVendorWiseData(vendorStats);
     
    } catch (err) {
      setDataError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  // Filter documents by selected document type
  const filterDocumentsByType = (documents) => {
    if (!selectedDocumentType) return documents;
   
    return documents.filter(doc => {
      const docModelType = doc.modelType || '';
      return docModelType.toLowerCase() === selectedDocumentType.toLowerCase();
    });
  };

  // Determine document status (same logic as other components)
  const determineStatus = (doc) => {
    if (doc.status === "Reviewed" || doc.reviewStatus === "Reviewed" || doc.reviewedBy) {
      return "Reviewed";
    }
    if (!doc || !doc.extractedData || !doc.confidenceScores) {
      return "Manual Review";
    }
   
    const hasAllMandatoryFields = (doc) => {
      if (!doc || !doc.extractedData) return false;
      const requiredFields = [
        "VendorName",
        "InvoiceId",
        "InvoiceDate",
        "LPO NO",
        "SubTotal",
        "VAT",
        "InvoiceTotal",
      ];
      return requiredFields.every((field) => {
        const value = doc.extractedData[field];
        return value !== undefined && value !== null && String(value).trim() !== "";
      });
    };

    const scoreStr = String(doc.totalConfidenceScore || "").toLowerCase();
    if (scoreStr.includes("reviewed")) return "Reviewed";
    if (!hasAllMandatoryFields(doc)) return "Manual Review";
   
    const scores = Object.values(doc.confidenceScores || {});
    if (scores.length === 0) return "Manual Review";
   
    const avg = scores.reduce((sum, val) => sum + Number(val), 0) / scores.length;
    return avg >= 0.85 ? "Completed" : "Manual Review";
  };

  // Process data for date-wise statistics (filtered by document type)
  const processDateWiseData = (documents) => {
    // Filter documents by selected type first
    const filteredDocs = filterDocumentsByType(documents);
   
    const dateMap = {};
   
    filteredDocs.forEach(doc => {
      const uploadDate = doc.timestamp ? new Date(doc.timestamp).toISOString().split('T')[0] :
                        new Date().toISOString().split('T')[0];
     
      if (!dateMap[uploadDate]) {
        dateMap[uploadDate] = {
          date: uploadDate,
          total: 0,
          completed: 0,
          manualReview: 0,
          rawDate: new Date(uploadDate),
          completionRate: 0
        };
      }
     
      dateMap[uploadDate].total++;
      const status = determineStatus(doc);
     
      if (status === "Completed" || status === "Reviewed") {
        dateMap[uploadDate].completed++;
      } else if (status === "Manual Review") {
        dateMap[uploadDate].manualReview++;
      }

      // Calculate completion rate
      dateMap[uploadDate].completionRate = dateMap[uploadDate].total > 0 ?
        (dateMap[uploadDate].completed / dateMap[uploadDate].total) * 100 : 0;
    });
   
    // Convert to array and sort by date (newest first)
    return Object.values(dateMap)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, getPeriodLimit());
  };

  // Process data for vendor-wise statistics (filtered by document type)
  const processVendorWiseData = (documents) => {
    // Filter documents by selected type first
    const filteredDocs = filterDocumentsByType(documents);
   
    const vendorMap = {};
   
    filteredDocs.forEach(doc => {
      const vendorName = doc.extractedData?.VendorName || doc.vendorName || 'Unknown Vendor';
     
      if (!vendorMap[vendorName]) {
        vendorMap[vendorName] = {
          vendor: vendorName,
          total: 0,
          completed: 0,
          manualReview: 0,
          completionRate: 0
        };
      }
     
      vendorMap[vendorName].total++;
      const status = determineStatus(doc);
     
      if (status === "Completed" || status === "Reviewed") {
        vendorMap[vendorName].completed++;
      } else if (status === "Manual Review") {
        vendorMap[vendorName].manualReview++;
      }

      // Calculate completion rate
      vendorMap[vendorName].completionRate = vendorMap[vendorName].total > 0 ?
        (vendorMap[vendorName].completed / vendorMap[vendorName].total) * 100 : 0;
    });
   
    // Convert to array and sort by total documents (descending)
    return Object.values(vendorMap)
      .sort((a, b) => b.total - a.total);
  };

  const getPeriodLimit = () => {
    switch (selectedPeriod) {
      case '7days': return 7;
      case '30days': return 30;
      default: return 100; // Show more records for "all"
    }
  };

  // Filter date-wise data
  const filterDateWiseData = () => {
    let filtered = processDateWiseData(allDocuments);
   
    // Apply date range filter
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter);
      filtered = filtered.filter(item => new Date(item.date) >= fromDate);
    }
   
    if (dateToFilter) {
      const toDate = new Date(dateToFilter);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter(item => new Date(item.date) <= toDate);
    }
   
    // Apply completion rate filter
    if (dateCompletionRateFilter) {
      filtered = filtered.filter(item => {
        const completionRate = item.completionRate;
       
        switch (dateCompletionRateFilter) {
          case '0-10': return completionRate >= 0 && completionRate <= 10;
          case '10-20': return completionRate > 10 && completionRate <= 20;
          case '20-30': return completionRate > 20 && completionRate <= 30;
          case '30-40': return completionRate > 30 && completionRate <= 40;
          case '40-50': return completionRate > 40 && completionRate <= 50;
          case '50-60': return completionRate > 50 && completionRate <= 60;
          case '60-70': return completionRate > 60 && completionRate <= 70;
          case '70-80': return completionRate > 70 && completionRate <= 80;
          case '80-90': return completionRate > 80 && completionRate <= 90;
          case '90-100': return completionRate > 90 && completionRate <= 100;
          default: return true;
        }
      });
    }
   
    return filtered;
  };

  // Filter vendor-wise data
  const filterVendorWiseData = () => {
    let filtered = processVendorWiseData(allDocuments);
   
    // Apply vendor select filter (dropdown)
    if (vendorSelectFilter) {
      filtered = filtered.filter(item =>
        item.vendor === vendorSelectFilter
      );
    }

    // Apply vendor search filter
    if (vendorSearchFilter) {
      filtered = filtered.filter(item =>
        item.vendor.toLowerCase().includes(vendorSearchFilter.toLowerCase())
      );
    }
   
    // Apply completion rate filter
    if (vendorCompletionRateFilter) {
      filtered = filtered.filter(item => {
        const completionRate = item.completionRate;
       
        switch (vendorCompletionRateFilter) {
          case '0-10': return completionRate >= 0 && completionRate <= 10;
          case '10-20': return completionRate > 10 && completionRate <= 20;
          case '20-30': return completionRate > 20 && completionRate <= 30;
          case '30-40': return completionRate > 30 && completionRate <= 40;
          case '40-50': return completionRate > 40 && completionRate <= 50;
          case '50-60': return completionRate > 50 && completionRate <= 60;
          case '60-70': return completionRate > 60 && completionRate <= 70;
          case '70-80': return completionRate > 70 && completionRate <= 80;
          case '80-90': return completionRate > 80 && completionRate <= 90;
          case '90-100': return completionRate > 90 && completionRate <= 100;
          default: return true;
        }
      });
    }
   
    return filtered;
  };

  // Get unique vendor names for the dropdown (filtered by document type)
  const getUniqueVendors = () => {
    const vendors = processVendorWiseData(allDocuments).map(item => item.vendor);
    return [...new Set(vendors)].sort();
  };
 
  // Get filtered data
  const filteredDateWiseData = filterDateWiseData();
  const filteredVendorWiseData = filterVendorWiseData();

  // Calculate total documents for the selected type (for summary)
  const getTotalDocumentsForSelectedType = () => {
    const filteredDocs = filterDocumentsByType(allDocuments);
    return filteredDocs.length;
  };

  // Calculate average documents per day for selected type
  const calculateAvgDocsPerDay = () => {
    if (filteredDateWiseData.length === 0) return '0';
    const totalDocs = filteredDateWiseData.reduce((sum, day) => sum + day.total, 0);
    const avg = totalDocs / Math.min(filteredDateWiseData.length, 30);
    return avg.toFixed(0);
  };

  // Use sortable data hooks for both tables
  const {
    sortedData: sortedDateData,
    toggleSort: toggleDateSort,
    renderSortIcon: renderDateSortIcon,
    sortColumn: dateSortColumn,
    sortOrder: dateSortOrder
  } = useSortableData(filteredDateWiseData);

  const {
    sortedData: sortedVendorData,
    toggleSort: toggleVendorSort,
    renderSortIcon: renderVendorSortIcon,
    sortColumn: vendorSortColumn,
    sortOrder: vendorSortOrder
  } = useSortableData(filteredVendorWiseData);

  // Paginate date-wise data
  const dateTotalPages = Math.ceil(sortedDateData.length / dateRowsPerPage);
  const dateStartIndex = (currentDatePage - 1) * dateRowsPerPage;
  const currentDateRows = sortedDateData.slice(dateStartIndex, dateStartIndex + dateRowsPerPage);

  // Paginate vendor-wise data
  const vendorTotalPages = Math.ceil(sortedVendorData.length / vendorRowsPerPage);
  const vendorStartIndex = (currentVendorPage - 1) * vendorRowsPerPage;
  const currentVendorRows = sortedVendorData.slice(vendorStartIndex, vendorStartIndex + vendorRowsPerPage);

  // Reset all filters
  const resetDateFilters = () => {
    setDateFromFilter('');
    setDateToFilter('');
    setDateCompletionRateFilter('');
    setCurrentDatePage(1);
  };

  const resetVendorFilters = () => {
    setVendorSelectFilter('');
    setVendorSearchFilter('');
    setVendorCompletionRateFilter('');
    setCurrentVendorPage(1);
  };

  // Export to CSV function
  const exportToCSV = (data, filename) => {
    if (data.length === 0) return;
   
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csvContent = [headers, ...rows].join('\n');
   
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${selectedDocumentType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter users when filters change
  useEffect(() => {
    const filtered = users.filter(user => {
      const roleMatch = !roleFilter || user.role === roleFilter;
      const nameMatch = !nameFilter || user.email.toLowerCase().includes(nameFilter.toLowerCase());
      return roleMatch && nameMatch;
    });
    setFilteredUsers(filtered);
  }, [users, roleFilter, nameFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentDatePage(1);
  }, [dateFromFilter, dateToFilter, dateCompletionRateFilter, selectedDocumentType]);

  useEffect(() => {
    setCurrentVendorPage(1);
  }, [vendorSelectFilter, vendorSearchFilter, vendorCompletionRateFilter, selectedDocumentType]);

  // Fetch data when selected document type changes
  useEffect(() => {
    if (selectedDocumentType) {
      fetchData();
    }
  }, [selectedDocumentType, selectedPeriod]);

  // User Management Functions
  const openUserPopup = () => {
    setShowUserPopup(true);
    setFilteredUsers(users);
  };

  // Close user popup and reset states
  const closeUserPopup = () => {
    setShowUserPopup(false);
    setShowAddUserForm(false);
    setRoleFilter('');
    setNameFilter('');
    setNewUserEmail('');
    setNewUserRole('');
    setActiveUserId(null);
    setEditingUserId(null);
  };

  // Reset filters
  const resetFilters = () => {
    setRoleFilter('');
    setNameFilter('');
  };

  // Toggle add user form
  const toggleAddUserForm = () => {
    setShowAddUserForm(!showAddUserForm);
    setNewUserEmail('');
    setNewUserRole('');
  };

  // Add new user
  const addNewUser = () => {
    if (newUserEmail && newUserRole) {
      const newUser = {
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
        email: newUserEmail,
        role: newUserRole
      };
     
      setUsers([...users, newUser]);
      setNewUserEmail('');
      setNewUserRole('');
      setShowAddUserForm(false);
    }
  };

  // Clear add user form
  const clearAddUserForm = () => {
    setNewUserEmail('');
    setNewUserRole('');
  };

  // Toggle user actions (edit/delete)
  const toggleUserActions = (userId) => {
    if (activeUserId === userId) {
      setActiveUserId(null);
      setEditingUserId(null);
    } else {
      setActiveUserId(userId);
      setEditingUserId(null);
    }
  };

  // Start editing a user
  const startEditUser = (userId, e) => {
    e.stopPropagation();
    const user = users.find(u => u.id === userId);
    if (user) {
      setEditingUserId(userId);
      setEditEmail(user.email);
      setEditRole(user.role);
    }
  };

  // Save user edits
  const saveUserEdit = (userId, e) => {
    e.stopPropagation();
    if (editRole) {
      const updatedUsers = users.map(user =>
        user.id === userId ? { ...user, role: editRole } : user
      );
      setUsers(updatedUsers);
      setEditingUserId(null);
    }
  };

  // Clear edit form
  const clearEditForm = (userId, e) => {
    e.stopPropagation();
    const user = users.find(u => u.id === userId);
    if (user) {
      setEditEmail(user.email);
      setEditRole(user.role);
    }
  };

  // Cancel editing
  const cancelEdit = (userId, e) => {
    e.stopPropagation();
    setEditingUserId(null);
  };

  // Open delete confirmation
  const openDeleteConfirmation = (userId, e) => {
    e.stopPropagation();
    setDeleteUserId(userId);
  };

  // Close delete confirmation
  const closeDeleteConfirmation = () => {
    setDeleteUserId(null);
  };

  // Delete user
  const deleteUser = () => {
    if (deleteUserId) {
      const updatedUsers = users.filter(user => user.id !== deleteUserId);
      setUsers(updatedUsers);
      setDeleteUserId(null);
      setActiveUserId(null);
    }
  };

  // Check if add user form is valid
  const isAddUserFormValid = newUserEmail && newUserRole;

  // Render Date-wise Table
  const renderDateWiseTable = () => (
    <div className="admin-table-box">
      <div className="table-section-header">
        {/* Div 1: Document Type Header */}
        <div className="table-header-top">
          <h3 className="table-header-title">{selectedDocumentType} - Date-wise Statistics</h3>
        </div>
        
        {/* Div 2: Filters and Controls */}
        <div className="table-header-bottom">
          <div className="table-filters-container">
            <div className="table-filter-group">
              <label className='date-from-label' htmlFor="date-from">From Date:</label>
              <input
                className='date-from-input'
                type="date"
                id="date-from"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
              />
            </div>
            <div className="table-filter-group">
              <label className='date-to-label' htmlFor="date-to">To Date:</label>
              <input
                className='date-to-input'
                type="date"
                id="date-to"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
              />
            </div>
          </div>
          
          <div className="table-actions-container">
            <button
              onClick={() => exportToCSV(filteredDateWiseData, 'date_wise_stats')}
              className="export-btn"
              disabled={filteredDateWiseData.length === 0}
            >
              <Download className="export-btn-icon" size={16} />
              Export CSV
            </button>
            <button onClick={resetDateFilters} className="reset-filters-btn">
              Reset Filters
            </button>
          </div>
        </div>
      </div>
      
      <div className="table-scroll-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleDateSort("date")}>
                <span className="sortable-header">
                  Date {renderDateSortIcon("date")}
                </span>
              </th>
              <th onClick={() => toggleDateSort("total")}>
                <span className="sortable-header">
                  Total Docs Uploaded {renderDateSortIcon("total")}
                </span>
              </th>
              <th onClick={() => toggleDateSort("completed")}>
                <span className="sortable-header">
                  Completed {renderDateSortIcon("completed")}
                </span>
              </th>
              <th onClick={() => toggleDateSort("manualReview")}>
                <span className="sortable-header">
                  Manual Review {renderDateSortIcon("manualReview")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentDateRows.length > 0 ? (
              currentDateRows.map((day, index) => (
                <tr key={index}>
                  <td>{new Date(day.date).toLocaleDateString()}</td>
                  <td>{day.total}</td>
                  <td>{day.completed}</td>
                  <td>{day.manualReview}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{textAlign: 'center', padding: '20px'}}>
                  No {selectedDocumentType} data available for selected filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Date-wise Pagination */}
      <FilePagination
        currentPage={currentDatePage}
        totalPages={dateTotalPages}
        onPageChange={setCurrentDatePage}
        rowsPerPage={dateRowsPerPage}
        totalItems={sortedDateData.length}
      />
    </div>
  );

  // Render Vendor-wise Table
  const renderVendorWiseTable = () => (
    <div className="admin-table-box">
      <div className="table-section-header">
        {/* Div 1: Document Type Header */}
        <div className="table-header-top">
          <h3 className="table-header-title">{selectedDocumentType} - Vendor-wise Statistics</h3>
        </div>
        
        {/* Div 2: Filters and Controls */}
        <div className="table-header-bottom">
          <div className="table-filters-container">
            <div className="table-filter-group">
              <label className='vendor-select-label' htmlFor="vendor-select">Select by Vendor:</label>
              <select
                className='vendor-select-input'
                id="vendor-select"
                value={vendorSelectFilter}
                onChange={(e) => setVendorSelectFilter(e.target.value)}
              >
                <option value="">All Vendors</option>
                {getUniqueVendors().map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            </div>
            <div className="table-filter-group">
              <label className='vendor-search-label' htmlFor="vendor-search">Search by Vendor:</label>
              <input
                className='vendor-search-input'
                type="text"
                id="vendor-search"
                placeholder="Enter vendor name"
                value={vendorSearchFilter}
                onChange={(e) => setVendorSearchFilter(e.target.value)}
              />
            </div>
          </div>
          
          <div className="table-actions-container">
            <button
              onClick={() => exportToCSV(filteredVendorWiseData, 'vendor_wise_stats')}
              className="export-btn"
              disabled={filteredVendorWiseData.length === 0}
            >
              <Download className="export-btn-icon" size={16} />
              Export CSV
            </button>
            <button onClick={resetVendorFilters} className="reset-filters-btn">
              Reset Filters
            </button>
          </div>
        </div>
      </div>
      
      <div className="table-scroll-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleVendorSort("vendor")}>
                <span className="sortable-header">
                  Vendor Name {renderVendorSortIcon("vendor")}
                </span>
              </th>
              <th onClick={() => toggleVendorSort("total")}>
                <span className="sortable-header">
                  Total Docs Uploaded {renderVendorSortIcon("total")}
                </span>
              </th>
              <th onClick={() => toggleVendorSort("completed")}>
                <span className="sortable-header">
                  Completed {renderVendorSortIcon("completed")}
                </span>
              </th>
              <th onClick={() => toggleVendorSort("manualReview")}>
                <span className="sortable-header">
                  Manual Review {renderVendorSortIcon("manualReview")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentVendorRows.length > 0 ? (
              currentVendorRows.map((vendor, index) => (
                <tr key={index}>
                  <td>{vendor.vendor}</td>
                  <td>{vendor.total}</td>
                  <td>{vendor.completed}</td>
                  <td>{vendor.manualReview}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{textAlign: 'center', padding: '20px'}}>
                  No {selectedDocumentType} data available for selected filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vendor-wise Pagination */}
      <FilePagination
        currentPage={currentVendorPage}
        totalPages={vendorTotalPages}
        onPageChange={setCurrentVendorPage}
        rowsPerPage={vendorRowsPerPage}
        totalItems={sortedVendorData.length}
      />
    </div>
  );

  // Render current table based on selection
  const renderCurrentTable = () => {
    switch (selectedTable) {
      case 'dateWise':
        return renderDateWiseTable();
      case 'vendorWise':
        return renderVendorWiseTable();
      default:
        return renderDateWiseTable();
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  if (dataLoading) return <div className="loading">Loading admin data...</div>;
  if (dataError) return <div className="error">Error: {dataError}</div>;

  return (
    <div className="admin-container">
      <main className="admin-main">
        <section className="admin-heading-section">
          <h1><Shield className="header-icon" size={32} /> Client Dashboard</h1>
          <button onClick={fetchData} className="refresh-data-btn">
            <RefreshCw size={16} className='refresh-data-btn-icon' />
            Refresh Data
          </button>
        </section>
       
        <section className="admin-section-1">
          <div className="admin-stats-box">
            <ul>
              <li>
                <FileText className="pp iconForCount" size={24}/>
                <p className='textForCout'>Total {selectedDocumentType} Docs</p>
                <p className='numberForCout'>{getTotalDocumentsForSelectedType().toLocaleString()}</p>
              </li>
              <li>
                <BarChart2 className="pp iconForCount" size={24} />
                <p className='textForCout'>Avg {selectedDocumentType} Docs / Day</p>
                <p className='numberForCout'>{calculateAvgDocsPerDay()}</p>
              </li>
              <li>
                <Users className="pp iconForCount" size={24} />
                <p className='textForCout'>No. of Users</p>
                <p className='numberForCout'>{users.length}</p>
              </li>
              <li onClick={openUserPopup} style={{cursor: 'pointer'}}>
                <Users className="pp iconForCount" size={24} />
                <p className='textForCout'>Users Details</p>
                <p className='numberForCout'>View</p>
              </li>
            </ul>
          </div>
          {/* Table Navigation Controls */}
          <div className="table-navigation-controls">
            <div className="table-selector">
              <label htmlFor="table-select">Select Table:</label>
              <select
                id="table-select"
                value={selectedTable}
                onChange={(e) => handleTableSelect(e.target.value)}
                className="table-dropdown"
              >
                {tableConfig.map(table => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="navigation-buttons">
                <ChevronLeft
                 onClick={goToPreviousTable}
                 className="nav-button prev-button"
                 size={20} />
              
              <span className="table-counter">
                {currentTableIndex + 1} / {tableConfig.length}
              </span>
              
                <ChevronRight 
                onClick={goToNextTable}
                className="nav-button next-button" 
                size={20} />
            </div>
          </div>

          {/* Render Current Table */}
          {renderCurrentTable()}
        </section>
       
        <section className="admin-section-2">
            <div className="admin-section-2-header">
              <h3>Plan Details</h3>
            </div>
            <div className="document-type-badge">
              <span><Database className='databaseIcon-admin' size={16} />Document Type: <strong>{selectedDocumentType}</strong></span>
            </div>
            <div className="admin-section-2-pack">
              <ul>
                <li>
                  <span>Plan :</span><span>Pro</span>
                </li>
                <li>
                  <span>From :</span><span>11/12/2025</span>
                </li>
                <li>
                  <span>To :</span><span>11/12/2026</span>
                </li>
              </ul>
            </div>
            <div className="admin-section-2-usage">
              <ul>
                <li>
                  <span>Per Day :</span><span>1,000 PDFs</span>
                </li>
                <li>
                  <span>Available PDFs :</span><span>700</span>
                </li>
                <li>
                  <span>Consumed PDFs :</span><span>300</span>
                </li>
              </ul>
            </div>
        </section>
      </main>

      {/* User Management Popup */}
      {showUserPopup && (
        <div className="popup-overlay user-management-popup">
          <div className="popup-content">
            <div className="popup-header">
              <h2>User Management</h2>
              <button className="close-popup" onClick={closeUserPopup}>
                <X size={24} />
              </button>
            </div>
           
            <div className="filter-section">
              <div className="filter-group">
                <label htmlFor="role-filter">Filter by Role</label>
                <select
                  id="role-filter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Contributor">Contributor</option>
                  <option value="Member">Member</option>
                </select>
              </div>
             
              <div className="filter-group">
                <label htmlFor="name-filter">Filter by Name</label>
                <input
                  type="text"
                  id="name-filter"
                  placeholder="Search by email"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </div>
            </div>
           
            <div className="button-group">
              <button className="reset-btn" onClick={resetFilters}>
                Reset Filters
              </button>
              <button className="add-user-btn" onClick={toggleAddUserForm}>
                + Add User
              </button>
            </div>
           
            {showAddUserForm && (
              <div className="add-user-form">
                <div className="form-group">
                  <label htmlFor="user-email">Email</label>
                  <input
                    type="email"
                    id="user-email"
                    placeholder="Enter email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
               
                <div className="form-group">
                  <label htmlFor="user-role">Role</label>
                  <select
                    id="user-role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                  >
                    <option value="">Select Role</option>
                    <option value="Admin">Admin</option>
                    <option value="Contributor">Contributor</option>
                    <option value="Member">Member</option>
                  </select>
                </div>
               
                <div className="form-buttons">
                  <button
                    className="submit-btn"
                    onClick={addNewUser}
                    disabled={!isAddUserFormValid}
                  >
                    Submit
                  </button>
                  <button
                    className="clear-btn"
                    onClick={clearAddUserForm}
                  >
                    Clear
                  </button>
                  <button className='cancel-btn' onClick={toggleAddUserForm}>Cancel</button>
                </div>
              </div>
            )}
           
            <div className="user-list">
              {filteredUsers.length === 0 ? (
                <p>No users found.</p>
              ) : (
                filteredUsers.map(user => (
                  <div key={user.id} className="user-item">
                    <div
                      className={`user-info ${activeUserId === user.id ? 'active' : ''}`}
                      onClick={() => toggleUserActions(user.id)}
                    >
                      <span>Email: {user.email}</span>
                      <span>Role: {user.role}</span>
                    </div>
                   
                    {activeUserId === user.id && (
                      <div className="user-actions">
                        <button
                          className="edit-btn"
                          onClick={(e) => startEditUser(user.id, e)}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={(e) => openDeleteConfirmation(user.id, e)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                   
                    {editingUserId === user.id && (
                    <div className="edit-form">
                      <div className="form-group">
                        <label htmlFor={`edit-role-${user.id}`}>Role</label>
                        <select
                          id={`edit-role-${user.id}`}
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Contributor">Contributor</option>
                          <option value="Member">Member</option>
                        </select>
                      </div>
                     
                      <div className="form-buttons">
                        <button
                          className="submit-btn save-edit"
                          onClick={(e) => saveUserEdit(user.id, e)}
                        >
                          Save
                        </button>
                        <button
                          className="cancel-btn"
                          onClick={(e) => cancelEdit(user.id, e)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      {deleteUserId && (
        <div className="delete-confirmation">
          <p>Are you sure you want to delete this user?</p>
          <div className="confirmation-buttons">
            <button className="confirm-delete" onClick={deleteUser}>
              Delete
            </button>
            <button className="cancel-delete" onClick={closeDeleteConfirmation}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer>
        <Footer/>
      </footer>
    </div>
  );
};

export default Admin;