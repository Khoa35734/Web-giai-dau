# CTV Management - Quick Start Guide

## 🎯 Overview
The Admin Dashboard now includes a complete **CTV Account Management** system that allows admins to create, read, update, and delete (CRUD) CTV accounts.

---

## 🚀 Quick Start

### Step 1: Access the CTV Manager
1. Log in as Admin
2. Navigate to Admin Dashboard
3. Click on **"CTVManager"** tab (if available in navigation)
4. Or access directly from the management panel

### Step 2: Browse CTVs
The interface shows:
- **Search Bar**: Find CTVs by name or email
- **Status Filters**: All / Active / Inactive
- **Data Table**: List of all CTV accounts
- **Pagination**: Navigate between pages

---

## 📝 Common Tasks

### ➕ Add a New CTV Account

**Steps:**
1. Click **"+ Thêm CTV"** button (top right)
2. Fill in the form:
   - **Họ và tên** (Name): Full name of CTV
   - **Email**: Unique email address
   - **Mật khẩu** (Password): Minimum 6 characters
   - **Trạng thái** (Status): Active or Inactive
3. Click **"Thêm CTV"** button

**Validation Rules:**
- ❌ Email must be unique
- ❌ Email must be valid format (user@domain.com)
- ❌ Password minimum 6 characters
- ❌ All fields required

**Success:** Green notification appears "Tài khoản CTV được tạo thành công"

---

### ✏️ Edit Existing CTV Account

**Steps:**
1. Find the CTV in the table
2. Click **✏️** (pencil icon) in the "Thao tác" column
3. Update information:
   - Name: ✅ Can change
   - Email: ✅ Can change (must be unique)
   - Password: ✅ Optional (leave empty to keep current)
   - Status: ✅ Can change
4. Click **"Cập nhật"** button

**Note:** Changing password is optional - leave blank to keep current password

---

### 🔄 Change CTV Status

**Option 1: Via Table Dropdown**
1. Find CTV in table
2. Click status selector dropdown
3. Choose "Hoạt động" (Active) or "Dừng hoạt động" (Inactive)
4. Status updates immediately

**Option 2: Via Edit Modal**
1. Click ✏️ to edit CTV
2. Change status selector
3. Click "Cập nhật"

**Status Meanings:**
- 🟢 **Hoạt động (Active)**: CTV account is active
- 🔴 **Dừng hoạt động (Inactive)**: CTV account is disabled

---

### 🗑️ Delete CTV Account

**Steps:**
1. Find the CTV in the table
2. Click **🗑️** (trash icon)
3. **CONFIRMATION MODAL** appears with warning ⚠️
4. Click **"Xóa"** to confirm deletion
5. Click **"Hủy"** to cancel

**Important:**
- ⚠️ **This action cannot be undone**
- ⚠️ All tournaments created by this CTV are also deleted
- Confirmation required to prevent accidental deletion

---

## 🔍 Search & Filter

### 🔎 Search by Name or Email
1. Type in the **"Tìm kiếm CTV..."** search box
2. Results filter in real-time
3. Clear search box to reset

### 📊 Filter by Status
Click status buttons to filter:
- **Tất cả** (All): Show all CTVs
- **Hoạt động** (Active): Show only active CTVs
- **Dừng hoạt động** (Inactive): Show only inactive CTVs

### 📄 Pagination
- If more than 10 CTVs, pagination shows at bottom
- Use **"← Trước"** (Previous) and **"Sau →"** (Next) buttons
- Current page shown: "Trang 1/5"

---

## 💡 Tips & Tricks

### Combine Search + Filter
- Search for specific CTV
- Then filter by status
- Great for finding inactive accounts with specific email domain

### Quick Status Toggle
- Use dropdown in table for quick status changes
- No need to open edit modal
- Changes apply immediately

### Verification
- Check email format carefully (typos cause issues)
- Use strong passwords (6+ characters)
- Remember emails are case-insensitive but unique

---

## ⚠️ Common Issues

### ❌ Error: "Email đã tồn tại"
**Meaning:** Email is already used by another CTV
**Solution:** Use a different email address

### ❌ Error: "Email không hợp lệ"
**Meaning:** Email format is incorrect
**Solution:** Use format: `user@example.com`

### ❌ Error: "Mật khẩu phải có ít nhất 6 ký tự"
**Meaning:** Password is too short
**Solution:** Use password with 6 or more characters

### ❌ Error: "Tất cả trường là bắt buộc"
**Meaning:** Some required fields are empty
**Solution:** Fill all required fields (marked with *)

### ❌ Error: "Không có quyền truy cập"
**Meaning:** You're not logged in as admin
**Solution:** Log out and log back in with admin account

### ❌ Data Not Loading
**Troubleshooting:**
1. Refresh the page
2. Check internet connection
3. Verify admin authentication
4. Check browser console for errors
5. Try clearing cache and reloading

---

## 📊 Table Information

### Column Details

| Column | Information |
|--------|-------------|
| **Tên CTV** | CTV full name with avatar (first letter) |
| **Email** | CTV email address |
| **Ngày tạo** | Account creation date (formatted) |
| **Trạng thái** | Active/Inactive status selector |
| **Thao tác** | Edit (✏️) and Delete (🗑️) buttons |

### Footer Statistics
"Hiển thị X / Y CTV" - Shows current page count / total count

---

## 🎨 UI Elements

### Buttons

| Button | Action | Color |
|--------|--------|-------|
| **+ Thêm CTV** | Open add modal | Orange |
| **✏️** | Edit CTV | Gray |
| **🗑️** | Delete CTV | Gray/Red |
| **Hủy** | Close modal | Gray |
| **Cập nhật** | Save changes | Orange |
| **Thêm CTV** | Create new | Orange |
| **Xóa** | Confirm delete | Red |

### Status Indicators

- 🟢 **Active** - Green background
- 🔴 **Inactive** - Red background

---

## 📱 Mobile Tips

- On mobile, layout adjusts automatically
- Search and filters stack vertically
- Modals are full-width (90% with margins)
- Buttons are touch-friendly size
- Table scrolls horizontally if needed

---

## 🔐 Security Reminders

1. **Passwords**: Never share CTV passwords via chat/email
2. **Email**: Verify email addresses are correct
3. **Access**: Only admins should have access to this panel
4. **Deletion**: Be careful with delete operations
5. **Status**: Disable unused accounts instead of deleting

---

## 📞 Support

### When You Need Help

If something doesn't work:
1. Check error message for details
2. Try refreshing the page
3. Clear browser cache
4. Check internet connection
5. Verify you're logged in as admin
6. Review error handling section above
7. Check detailed guide: `CTV_MANAGEMENT_GUIDE.md`

### Contact Admin Team
- Report bugs with screenshot
- Include error message details
- Describe steps to reproduce

---

## ✅ Checklist - First Time Setup

- [ ] Log in as Admin
- [ ] Navigate to CTV Manager
- [ ] See list of existing CTVs
- [ ] Add a test CTV account
- [ ] Edit the test CTV
- [ ] Change CTV status
- [ ] Search for CTV by name
- [ ] Search for CTV by email
- [ ] Filter by active status
- [ ] Filter by inactive status
- [ ] Delete the test CTV
- [ ] Verify operations work smoothly

---

## 🎓 Learning Path

1. **First**: Understand the UI layout
2. **Second**: Try adding a CTV account
3. **Third**: Edit and modify accounts
4. **Fourth**: Practice searching/filtering
5. **Fifth**: Learn about status management
6. **Last**: Understand delete operations

---

## 📖 Additional Resources

- **Full Guide**: `CTV_MANAGEMENT_GUIDE.md`
- **API Documentation**: Check backend endpoints
- **Error Handling**: See detailed error explanations
- **Database Schema**: See Users table structure

---

**Date**: April 30, 2026  
**Version**: 1.0  
**Status**: ✅ Ready to Use

**Happy CTV Managing! 🚀**
