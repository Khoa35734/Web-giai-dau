# Admin Dashboard - Database Synchronization & Authentication

## 📋 Implementation Summary

Updated admin dashboard with complete database synchronization, JWT authentication, and database-backed management system.

## ✅ Features Implemented

### 1. **Admin Authentication (JWT-Based)**
- User login with email & password
- JWT token generation and storage
- Admin-only access restriction
- Session persistence
- Automatic logout on token expiration

### 2. **Database Integration**
- Backend routes connected to PostgreSQL database
- Proper schema mapping (users, tournaments, registrations)
- CRUD operations for tournaments
- Registration management
- Dashboard statistics from real data

### 3. **Admin Dashboard Components**

#### AdminLogin.jsx
- Modern login form with email & password
- Password visibility toggle
- Error handling & feedback
- Responsive design with gradient background

#### AdminDashboard.jsx
- Authentication check on mount
- Protected dashboard (redirects to login if not authenticated)
- Sidebar navigation
- User profile display
- Logout functionality
- Auto-refresh of authentication status

#### AdminOverview.jsx
- Real-time statistics from database
- 4 stat cards: Total Tournaments, Total Registrations, Approved, Pending
- Progress bar showing approval rate
- System status indicator
- Quick stats summary
- Auto-refresh every 30 seconds
- Error handling with retry button

#### TournamentManager.jsx
- Display all tournaments from database
- Search & filter functionality
- Add new tournament
- Edit existing tournament
- Delete tournament (with confirmation)
- Form validation
- Success/error notifications
- Status tracking (pending, active, completed)

### 4. **Backend API Endpoints**

#### Authentication
```
POST /api/auth/register          - Create admin account
POST /api/auth/login             - Login & get JWT token
GET  /api/auth/me                - Get current user info (requires token)
```

#### Tournaments
```
GET  /api/tournaments            - Get all tournaments
GET  /api/tournaments/:id        - Get single tournament
POST /api/tournaments            - Create tournament (admin only)
PUT  /api/tournaments/:id        - Update tournament (admin only)
DELETE /api/tournaments/:id      - Delete tournament (admin only)
```

#### Registrations
```
GET  /api/registrations          - Get all registrations (admin only)
GET  /api/tournaments/:id/registrations - Get registrations for tournament
PUT  /api/registrations/:id      - Update registration status (admin only)
```

#### Statistics
```
GET  /api/admin/stats            - Get dashboard statistics (admin only)
```

## 🛠️ Tech Stack

### Frontend
- React 18+ with Hooks
- Local Storage for token persistence
- CSS3 with responsive design
- Fetch API for HTTP requests

### Backend
- Node.js/Express
- PostgreSQL
- JWT (jsonwebtoken)
- bcryptjs for password hashing
- CORS enabled

### Database Schema
- **users**: Admin accounts with role-based access
- **tournaments**: Tournament information & metadata
- **registrations**: Team/player registrations for tournaments

## 🚀 Setup Instructions

### 1. Install Dependencies

**Server:**
```bash
cd server
npm install
```

**Client:**
```bash
cd client
npm install
```

### 2. Environment Variables

Create `.env` file in `server` folder:
```
DATABASE_URL=postgresql://user:password@localhost:5432/webgiaidau
JWT_SECRET=your-secret-key-here
PORT=5000
```

### 3. Database Setup

1. Create PostgreSQL database
2. Run database.sql schema:
```bash
psql -U postgres -d webgiaidau -f database.sql
```

3. Create admin account via API:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword",
    "full_name": "Admin User"
  }'
```

### 4. Run Application

**Server:**
```bash
cd server
npm run dev
```

**Client:**
```bash
cd client
npm run dev
```

## 📱 UI Components

### AdminLogin Page
- Professional gradient background
- Centered login card
- Email & password inputs
- Password toggle visibility
- Error messages
- Loading state

### Admin Dashboard
- Collapsible sidebar
- Navigation menu with icons
- User profile section
- Logout button
- Responsive layout
- Top bar with date & status

### Dashboard Overview
- 4 stat cards with icons
- Real-time data from database
- Progress bar for approval rate
- System status indicator
- Quick stats summary
- Refresh button

### Tournament Manager
- Table view of tournaments
- Search functionality
- Status filter buttons
- Add/Edit/Delete operations
- Form modal with validation
- Delete confirmation dialog
- Success/Error notifications

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Protected API routes (admin-only endpoints)
- CORS configuration
- Token expiration (24 hours)
- Role-based access control

## 📊 API Response Format

```json
{
  "success": true,
  "message": "Success message",
  "data": { /* response data */ },
  "token": "jwt_token" // for login endpoint
}
```

## 🎯 Usage Example

### Login to Admin Dashboard
1. Navigate to `/admin` route
2. Enter admin email & password
3. Click login
4. Access dashboard features

### Add Tournament
1. Click "➕ Thêm Giải Đấu" button
2. Fill in tournament details
3. Select status
4. Click "Thêm"
5. Confirm success message

### View Statistics
1. Dashboard overview shows real-time stats
2. Stats auto-refresh every 30 seconds
3. Click refresh button for manual update

## 🐛 Troubleshooting

### Login Fails
- Verify admin account exists in database
- Check email/password combination
- Ensure JWT_SECRET is set

### Dashboard Stats Show 0
- Verify database connection
- Check if tournaments exist in database
- Try refreshing with button

### API Errors
- Check server is running on port 5000
- Verify database is connected
- Check browser console for detailed errors

## 📝 Notes

- Admin login required for all management functions
- All timestamps use server time
- Search is case-insensitive
- Delete actions are permanent and cannot be undone
- Token expires after 24 hours (auto-logout)

## 🔄 Future Enhancements

- [ ] User management interface
- [ ] Registration approval workflow
- [ ] Email notifications
- [ ] Export tournament data
- [ ] Advanced analytics
- [ ] Audit logs
- [ ] Role-based permissions
