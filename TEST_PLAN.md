# Test Plan for DocQmentorNew

## 1. Introduction
**Project Name:** DocQmentor (Frontend)
**Version:** 0.0.0
**Tech Stack:** React, Vite, Azure AD B2C (MSAL), Azure Functions, Lucide React, Recharts/Charts (implied).

This document outlines the test strategy and scenarios for the DocQmentor application. The application is a document processing portal allowing Super Admins to manage clients, and Admins to manage their specific document workflows (Invoices, Bank Statements, Mortgage Forms).

## 2. User Roles
*   **Super Admin**: System-wide administrator. Manages clients (companies), global settings, and user access requests.
*   **Admin**: Client-level administrator. Manages company users, views statistics, and configurations.
*   **User/Reviewer**: Standard user who uploads and reviews documents (functionality implied from role checks).

## 3. Test Scenarios

### 3.1 Authentication & Navigation
| ID | Scenario | Expected Result |
|----|----------|-----------------|
| AN01 | Login with valid Credentials | User is redirected to `/select` or `/home` based on role. |
| AN02 | Login with invalid Credentials | MSAL Error / Login failure message. |
| AN03 | Access Protected Route (`/superadmin`) without login | Redirected to Login page (`/`). |
| AN04 | Logout | Session cleared, redirected to public page. |
| AN05 | Token Refresh | User session persists silently on refresh. |

### 3.2 Super Admin Module (`/superadmin`)
**Pre-requisites:** Logged in as a user with Super Admin privileges.

#### A. Dashboard & Summary
| ID | Scenario | Expected Result |
|----|----------|-----------------|
| SA01 | View Summary Cards | Cards for 'Active Clients', 'Invoice', 'Bank', 'Mortgage', 'Access Requests' display correct counts. |
| SA02 | Click Access Requests Card | Opens the Permissions/Access Request modal/section. |

#### B. Client Management (Master Data)
| ID | Scenario | Expected Result |
|----|----------|-----------------|
| SA03 | View Client List | Table displays Name, Plan, Dates, and status for Invoice/Bank/Mortgage. |
| SA04 | Filter Clients by Name | List updates to show only matching client names. |
| SA05 | Filter by Date Range | List shows clients with Start/End dates within range. |
| SA06 | **Create New Client** (Valid) | Form submits, new client appears in list. Counts must be integers. |
| SA07 | Create Client (Duplicate Name) | Error message: "Client Name already exists." |
| SA08 | Edit Client Details | Changes to Plan, Dates, or Limits are saved and reflected in the table. |
| SA09 | Delete Client | Confirmation prompt appears. On confirmation, client is removed. |
| SA10 | Click "View" on Client | Navigates to `/admin` page with state set for that specific client. |

#### C. Access Request Management
| ID | Scenario | Expected Result |
|----|----------|-----------------|
| SA11 | View Pending Requests | Users with `Permission="InProcess"` are listed, grouped by Company. |
| SA12 | Approve Single User | User permission updates to "Approve". User removed from pending list. |
| SA13 | Reject Single User | User removed from system (or status updated to Rejected). |
| SA14 | **Bulk Approve** | Select multiple users -> Click Proceed. All selected users are approved interactively. |
| SA15 | Bulk Reject | Select multiple users -> Click Proceed. All selected users are rejected. |
| SA16 | Expand/Collapse Company | Toggle view of users within a specific company card. |

### 3.3 Admin Module (`/admin`)
**Pre-requisites:** Logged in as Admin OR navigated from SuperAdmin View.

#### A. Dashboard Configuration
| ID | Scenario | Expected Result |
|----|----------|-----------------|
| AD01 | View Client Specific Details | Title reflects Client Name. Active user count is displayed. |
| AD02 | Service Configuration | Update confidence thresholds. "Save" persists changes to Context/Backend. |

#### B. Statistics (Date-wise & Vendor-wise)
| ID | Scenario | Expected Result |
|----|----------|-----------------|
| AD03 | Select Document Type | Toggle between Invoice, Bank Statement, Mortgage Forms. Data refreshes. |
| AD04 | View Date-wise Stats | Table shows Date, Total Docs, Completed, Manual Review, Completion %. |
| AD05 | Filter Date Statistics | 'From Date' and 'To Date' filters correctly limit the displayed rows. |
| AD06 | View Vendor-wise Stats | Table shows Vendor/Lender, Total, Completed, Manual Review. |
| AD07 | Search Vendor | Search bar filters the vendor list dynamically. |
| AD08 | Sorting | Clicking headers (Date, Total, etc.) sorts the table ascending/descending. |
| AD09 | **Export CSV** | Downloads a `.csv` file with the current filtered data from the active table. |

### 3.4 User Management (`/users`)
**Pre-requisites:** Navigated via Admin Dashboard -> Users.

#### A. User List
| ID | Scenario | Expected Result |
|----|----------|-----------------|
| UM01 | View Users | List displays ID, Email, Role, Permission status. |
| UM02 | View Metrics | Cards show Total, Active, InProcess, and Limit usage. |
| UM03 | Search Users | Filter by ID, Email, or Role works correctly. |

#### B. Add User & Validation
| ID | Scenario | Expected Result |
|----|----------|-----------------|
| UM04 | **Add User - Valid** | Inputs: Email `user@client.com`, Role `Member`. Success message, list refreshes. |
| UM05 | Validation - Spaces in Email | Error: "Email cannot contain spaces". |
| UM06 | Validation - Invalid Format | Error if no username (e.g., `@domain.com`) or missing `@`. |
| UM07 | **Validation - Domain Match** | Error if email domain (`@gmail.com`) does not match Client Name (e.g., `ClientA`). |
| UM08 | Validation - Duplicate | Error if email already exists in the list. |
| UM09 | Check User Limit | If adding user exceeds `UserLimits`, 'Additional Users' count increases (visual check). |

### 3.5 Manual Review (`/manualreview`)
**Pre-requisites:** Documents exist with low confidence scores.

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| MR01 | View Queue | Displays docs with Confidence < Threshold or missing mandatory fields. |
| MR02 | Filter Queue | By Date, Vendor/Lender, or Search text. List updates immediately. |
| MR03 | **Edit Document** | Click "Edit" -> Opens Modal. User can modify extracted fields. |
| MR04 | Save Changes | On Save in Modal, document status becomes "Reviewed" (or similar) and leaves the queue. |
| MR05 | Export Review List | Downloads CSV of documents currently in the review queue. |

## 4. API & Integration Checks
*   **MasterDataFunc**: Verify CRUD operations for Clients.
*   **DynamicTableFunc**: Verify Table creation, User CRUD, and Permission updates.
*   **DocQmentorFunc**: Verify fetching of document metadata and stats from CosmosDB/SQL.
*   **Cold Start Handling**: UI should show "Service starting up..." or auto-retry if Azure Functions return 503/HTML error.

## 5. UI/UX Checks
*   **Responsiveness**: Layout adapts to different screen sizes (Sidebar, Tables).
*   **Loading States**: Spinners/Loaders appear during API calls.
*   **Error Handling**: Toasts or Alerts appear for API failures (e.g., "Network Error").
*   **Pagination**: Tables with >10 rows show pagination controls that work.

## 6. Edge Cases
*   **No Data**: Tables should show "No data found" or empty states gracefully.
*   **Special Characters**: Inputs (Client Name, Emails) should handle or reject special chars as per validation rules.
*   **Large Datasets**: Verify performance with >1000 users or documents (Pagination check).
