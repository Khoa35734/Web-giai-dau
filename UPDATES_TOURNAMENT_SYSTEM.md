# 🎯 Admin Dashboard Updates - Tournament System

## 📋 Yêu Cầu Được Cập Nhật

### ✅ 1. Loại Tham Gia
- **Cá nhân**: Người chơi thi đấu riêng lẻ
- **Đội**: Người chơi thi đấu theo nhóm
  - Khi chọn "Đội", phải quy định:
    - 🎯 Số thành viên tối thiểu
    - 🎯 Số thành viên tối đa

### ✅ 2. Banner Truyền Thông
- **Bắt buộc**: Mỗi giải đấu phải có URL banner
- **Mục đích**: Sử dụng cho truyền thông, quảng bá giải đấu
- **Yêu cầu**: Nhập URL hình ảnh banner

### ✅ 3. Mã Giải Đấu Tự Động
**Định dạng**: `<TênGame><THÁNG-NĂM><MãTăng>`

**Ví dụ**:
- LOL052026001 (League of Legends + Tháng 5 2026 + Mã 001)
- DOTA062026001 (DOTA 2 + Tháng 6 2026 + Mã 001)
- LOL052026002 (Giải LOL thứ 2 trong tháng 5/2026)

**Quy tắc**:
- 3 số cuối tăng lên theo đơn vị
- Tự động tạo khi submit (không cần nhập thủ công)
- Unique trong hệ thống

### ✅ 4. Workflow Duyệt Giải

#### Nếu tài khoản là **ADMIN**:
- ✅ Tạo giải → Trạng thái: **APPROVED** (phê duyệt ngay)
- ✅ Có tab "Chờ Duyệt" để xem giải từ CTV
- ✅ Có nút **Duyệt** hoặc **Từ Chối**
- ✅ Có thể chỉnh sửa/xóa bất kỳ giải nào

#### Nếu tài khoản là **CTV**:
- ⏳ Tạo giải → Trạng thái: **PENDING** (chờ admin duyệt)
- 📤 Giải được gửi cho admin
- 🔒 Chỉ có thể chỉnh sửa/xóa giải của chính mình khi còn pending
- ✅ Sau khi admin duyệt → Trạng thái: **APPROVED**

---

## 📂 Files Được Cập Nhật

### Backend
```
server/
├── database.sql ......................... ✏️ Schema cập nhật
│   └── Thêm: min_team_size, max_team_size, approved_by, approved_at
└── index.js ........................... ✏️ API endpoints cập nhật
    ├── generateTournamentCode() - Tạo mã tự động
    ├── POST /api/tournaments - Hỗ trợ team size + auto code
    ├── PUT /api/tournaments/:id - Xử lý approval + permission
    ├── GET /api/tournaments/pending - Admin xem chờ duyệt
    ├── GET /api/tournaments/my-pending - CTV xem của mình
    └── DELETE /api/tournaments/:id - Permission-based delete
```

### Frontend
```
client/src/
├── components/admin/
│   ├── TournamentManager.jsx ........... ✏️ Hoàn toàn viết lại
│   │   ├── Tabs: "Danh Sách" & "Chờ Duyệt"
│   │   ├── Form: Thêm team size fields
│   │   ├── Form: Bắt buộc banner URL
│   │   ├── Form: Ẩn code field (auto-generate)
│   │   ├── Pending cards: Hiển thị giải chờ duyệt
│   │   ├── Approve/Reject buttons: Duyệt/từ chối
│   │   └── Role-based: Show/hide based on admin/ctv
│   └── AdminDashboard.jsx ............. ✏️ Thêm userRole prop
├── utils/
│   └── api.js ......................... ✏️ Thêm methods
│       ├── tournamentAPI.getPending()
│       ├── tournamentAPI.getMyPending()
│       └── tournamentAPI.approveTournament()
└── styles/admin/
    └── TournamentManager.css .......... ✏️ Thêm styles
        ├── .tournament-tabs
        ├── .pending-section & .pending-card
        ├── .btn-approve & .btn-reject
        └── .large-modal
```

---

## 🔄 API Endpoints

### Tournament Management
```
POST /api/tournaments
  Body: {
    name, game_name, participation_type, max_participants,
    min_team_size (if team), max_team_size (if team),
    banner_url (required), game_logo_url,
    registration_open_at, registration_close_at,
    start_at, end_at, description
  }
  Response: { success, message, data }
  Note: code tự động, status dựa trên user role

GET /api/tournaments/pending (Admin only)
  Response: Danh sách giải chờ duyệt

GET /api/tournaments/my-pending (CTV only)
  Response: Danh sách giải của CTV chờ duyệt

PUT /api/tournaments/:id
  Body: { name, game_name, ... status (for approval) }
  Note: Admin có thể thay status, CTV chỉ chỉnh sửa của mình
```

---

## 📊 Database Schema Updates

### tournaments table
```sql
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS min_team_size INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_team_size INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tournaments ALTER COLUMN banner_url SET NOT NULL; -- Bắt buộc
```

---

## 🧪 Test Cases

### Admin User
- [ ] Tạo giải → Trạng thái ngay lập tức là "approved"
- [ ] Tab "Chờ Duyệt" hiển thị giải từ CTV
- [ ] Nút "Duyệt" → Cập nhật status → "approved"
- [ ] Nút "Từ Chối" → Cập nhật status → "rejected"
- [ ] Mã giải đấu đúng format (VD: LOL052026001)

### CTV User
- [ ] Tạo giải → Trạng thái "pending" (chờ duyệt)
- [ ] Không thấy tab "Chờ Duyệt"
- [ ] Chỉ có thể sửa giải của mình
- [ ] Giải có thể xóa khi còn pending
- [ ] Sau admin duyệt → Giải hiển thị trong danh sách chính

### Team Type Validation
- [ ] Khi chọn "Đội" → Hiện form min/max team size
- [ ] Khi chọn "Cá nhân" → Ẩn form min/max team size
- [ ] Validation: min ≤ max

### Banner Validation
- [ ] Không submit form nếu banner URL trống
- [ ] Cảnh báo: "Banner là bắt buộc"

### Auto-Generated Code
- [ ] Mã code không thể chỉnh sửa thủ công
- [ ] Mã tự động theo format đúng
- [ ] Mã unique (không trùng lặp)

---

## 🚀 Deployment Checklist

- [ ] Chạy database.sql để cập nhật schema
- [ ] npm install (dependencies đã cập nhật)
- [ ] Restart backend server
- [ ] Restart frontend dev server
- [ ] Test tất cả test cases
- [ ] Kiểm tra logs không có lỗi

---

## 📝 Ghi Chú Quan Trọng

1. **Backward Compatibility**: Các giải cũ vẫn hoạt động, `min_team_size` và `max_team_size` có thể NULL
2. **Default Role**: Khi tạo CTV mới, role = 'ctv', tự động chờ duyệt
3. **Banner Required**: Từ nay, banner_url là bắt buộc
4. **Code Format**: Format mã không thể thay đổi, là quy định cố định
5. **Mã Duy Nhất**: Hệ thống không cho phép 2 giải có mã giống nhau

---

**Status**: ✅ Ready for Testing  
**Version**: 1.1.0  
**Date**: April 30, 2026
