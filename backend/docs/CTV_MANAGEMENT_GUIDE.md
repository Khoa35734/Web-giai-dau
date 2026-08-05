# CTV Management System - Implementation Guide

**Date**: April 30, 2026  
**Status**: ✅ Complete  
**Version**: 1.0

## Overview

The CTV (Content/Contributor) Management system allows Admin accounts to manage all CTV accounts in the WebGiaiDau application with full CRUD (Create, Read, Update, Delete) operations.

## Features Implemented

### 1. Backend API Endpoints (Node.js/Express)

#### **GET /api/admin/ctvs** - List All CTV Accounts
- **Authentication**: Required (Admin only)
- **Query Parameters**:
  - `search` (optional): Search by name or email
  - `status` (optional): Filter by status ('all', 'active', 'inactive')
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 10)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "email": "ctv@example.com",
        "full_name": "CTV Name",
        "is_active": true,
        "created_at": "2026-04-30T...",
        "updated_at": "2026-04-30T..."
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "pages": 10
    }
  }
  ```

#### **GET /api/admin/ctvs/:id** - Get Single CTV Account
- **Authentication**: Required (Admin only)
- **Parameters**: CTV ID (UUID)
- **Response**: Single CTV object

#### **POST /api/admin/ctvs** - Create New CTV Account
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "email": "newctv@example.com",
    "password": "securePassword123",
    "full_name": "CTV Full Name"
  }
  ```
- **Validation**:
  - Email must be unique and valid format
  - Password minimum 6 characters
  - All fields required
- **Response**: Created CTV object with ID and creation timestamp

#### **PUT /api/admin/ctvs/:id** - Update CTV Account
- **Authentication**: Required (Admin only)
- **Request Body** (all optional):
  ```json
  {
    "email": "newemail@example.com",
    "full_name": "Updated Name",
    "password": "newPassword123",
    "is_active": true
  }
  ```
- **Note**: Password field only updates if provided and valid (min 6 chars)

#### **PATCH /api/admin/ctvs/:id/status** - Quick Status Toggle
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "is_active": true
  }
  ```
- **Purpose**: Quick toggle between active/inactive status

#### **DELETE /api/admin/ctvs/:id** - Delete CTV Account
- **Authentication**: Required (Admin only)
- **Note**: Cascade delete handles related data (tournaments created by CTV)

### 2. Frontend Components

#### **CTVManager.jsx** - Main CTV Management Interface
- **Features**:
  - Real-time data loading from backend
  - Search functionality (by name/email)
  - Status filtering (all/active/inactive)
  - Pagination support
  - Loading states
  - Error handling with user-friendly messages
  - Success notifications

#### **UI Elements**:
1. **Toolbar**:
   - Search box for CTV name/email
   - Filter buttons (All, Active, Inactive)
   - "Add CTV" button

2. **Data Table**:
   - CTV name with avatar
   - Email address
   - Creation date (formatted)
   - Status selector (dropdown)
   - Edit and Delete action buttons

3. **Add/Edit Modal**:
   - Full Name input (required)
   - Email input (required, validated)
   - Password input (required for create, optional for update)
   - Status selector (Active/Inactive)
   - Cancel/Save buttons

4. **Delete Confirmation Modal**:
   - Warning icon and message
   - Confirmation required before deletion

5. **Pagination**:
   - Previous/Next navigation
   - Current page indicator
   - Disabled states for first/last page

#### **API Integration** (utils/api.js)

```javascript
// Get all CTVs with filters and pagination
await ctvAPI.getAll(search, status, page, limit);

// Get single CTV
await ctvAPI.getById(id);

// Create new CTV
await ctvAPI.create(email, password, full_name);

// Update CTV (optional password change)
await ctvAPI.update(id, email, full_name, password, is_active);

// Quick status toggle
await ctvAPI.updateStatus(id, is_active);

// Delete CTV
await ctvAPI.delete(id);
```

### 3. User Experience Features

#### **Messages**:
- ✅ Success notifications (green) - Auto-dismiss after 3 seconds
- ❌ Error messages (red) - Stays visible for user acknowledgment
- ⏳ Loading spinners - Indicates data fetching

#### **Validation**:
- Email format validation
- Unique email checking (backend)
- Password minimum length (6 characters)
- Required field validation

#### **Responsiveness**:
- Desktop: Full toolbar layout
- Tablet: Toolbar wraps to columns
- Mobile: 90% width modals, full-width buttons

## Database Schema

### Users Table (CTV accounts)
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name varchar(100) NOT NULL,
  role varchar(20) DEFAULT 'ctv',
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);
```

## Security Measures

1. **Authentication**:
   - JWT token validation for all endpoints
   - Admin-only middleware verification
   - Role-based access control

2. **Password Security**:
   - bcryptjs hashing with 10 salt rounds
   - Minimum 6 character requirement
   - Never returned in API responses

3. **Data Protection**:
   - Email uniqueness constraint (database level)
   - Cascade delete for related data integrity
   - UUID for account IDs (not sequential)

## Usage Guide

### Adding a New CTV
1. Click "➕ Thêm CTV" button
2. Enter CTV information:
   - Full name
   - Email address
   - Password (min 6 chars)
   - Initial status (Active/Inactive)
3. Click "Thêm CTV" to save

### Editing a CTV
1. Click ✏️ edit button on CTV row
2. Update information:
   - Leave password empty to keep current
   - Or enter new password to change
   - Change name/email as needed
3. Click "Cập nhật" to save

### Changing CTV Status
- **Option 1**: Use status dropdown in table row
- **Option 2**: Edit modal status selector

### Deleting a CTV
1. Click 🗑️ delete button
2. Confirm deletion in modal
3. Account and related data removed

### Searching/Filtering
- Type in search box to find by name or email
- Click filter buttons to show by status
- Results update in real-time
- Pagination shown if results > 10

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Email đã tồn tại | Email used by another account | Use different email |
| Email không hợp lệ | Invalid email format | Check email format |
| Mật khẩu phải có ít nhất 6 ký tự | Password too short | Enter 6+ characters |
| Tất cả trường là bắt buộc | Missing required field | Fill all required fields |
| Không có quyền truy cập | Not an admin account | Login with admin account |
| Kết nối database thất bại | Backend connection issue | Check server status |

## Performance Optimizations

1. **Pagination**: Default 10 items per page
2. **Lazy Loading**: Data loads on demand
3. **Search Debouncing**: Implicit filtering (can add debounce if needed)
4. **Image Optimization**: Avatar uses first letter (no image files)

## API Response Status Codes

- `200`: Success (GET, PUT, PATCH)
- `201`: Created (POST)
- `400`: Bad request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found (CTV doesn't exist)
- `500`: Server error

## Testing Checklist

- [ ] Create new CTV account
- [ ] Edit CTV account details
- [ ] Change CTV account status
- [ ] Delete CTV account
- [ ] Search by name
- [ ] Search by email
- [ ] Filter by active status
- [ ] Filter by inactive status
- [ ] Pagination navigation
- [ ] Error handling for invalid inputs
- [ ] Error handling for duplicate email
- [ ] Verify password hashing (never shown)
- [ ] Test with different screen sizes

## Future Enhancements

1. **Bulk Operations**:
   - Bulk status change
   - Bulk delete with confirmation

2. **Advanced Features**:
   - Export CTV list (CSV/Excel)
   - CTV performance metrics
   - Activity log tracking
   - Role assignment (sub-roles)

3. **Improvements**:
   - Drag-and-drop sorting
   - Inline editing
   - Advanced search filters
   - CTV verification badge

## Troubleshooting

### CTVs Not Loading
1. Check browser console for errors
2. Verify admin authentication token
3. Check backend server status
4. Clear browser cache and reload

### Can't Create CTV
1. Verify email format
2. Check email uniqueness
3. Ensure password is 6+ characters
4. Check server logs for detailed error

### Modal Not Closing
1. Refresh page
2. Clear browser cache
3. Check for console errors
4. Verify network connection

## Technical Stack

- **Backend**: Node.js, Express, PostgreSQL, JWT, bcryptjs
- **Frontend**: React, Hooks, Fetch API
- **Database**: PostgreSQL with UUID generation
- **Authentication**: JWT Bearer tokens
- **Password Security**: bcryptjs (10 rounds)
- **Styling**: CSS3 with gradients and animations

## Deployment Notes

1. Ensure `.env` has `JWT_SECRET` configured
2. Database migrations must be applied (`migration.sql`)
3. Node packages installed: `express`, `cors`, `jsonwebtoken`, `bcryptjs`, `pg`, `dotenv`
4. Frontend build required for production
5. HTTPS recommended for production deployment

---

**Last Updated**: April 30, 2026  
**Maintained By**: Admin Dashboard Team
