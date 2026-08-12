# 🎮 DUT Esports — Backend API

Nền tảng quản lý giải đấu Esports của **CLB Thể thao điện tử DUT ESPORTS** (Đại học Bách khoa Đà Nẵng). Backend cung cấp REST API cho hệ thống tổ chức giải đấu: quản lý giải, đăng ký tham gia, tài khoản admin/CTV/sinh viên.

## 🧰 Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js ≥ 24 (chạy TypeScript native, không cần build) |
| Framework | Express 5 |
| Ngôn ngữ | TypeScript (strict) |
| Database | PostgreSQL 16 (Docker) |
| Xác thực | JWT (Bearer token, hết hạn 24h) + bcryptjs |
| Upload | Multer (banner tối đa 10MB) |

## 📁 Cấu trúc

```
backend/src/
├── config/        → env, connection pool
├── controllers/   → xử lý request/response (không chứa SQL)
├── repositories/  → toàn bộ SQL (mỗi file 1 bảng)
├── middleware/    → JWT, phân quyền, upload, error handler
├── routes/        → khai báo endpoint
├── types/         → domain types (User, Tournament, Registration...)
├── utils/         → helper (asyncHandler, response, mã giải đấu...)
├── app.ts         → cấu hình Express
├── index.ts       → entry point
└── seed.ts        → dữ liệu mẫu (npm run seed)
```

## 🚀 Chạy nhanh

```bash
# 1. Khởi động PostgreSQL (cần Docker Desktop)
npm run db

# 2. Cấu hình môi trường
cp backend/.env.example backend/.env   # sửa DB_PASSWORD cho khớp docker-compose

# 3. Chạy backend
npm run dev            # hoặc: cd backend && node src/index.ts

# 4. (Tùy chọn) Seed dữ liệu mẫu
npm run seed
```

Server chạy tại `http://localhost:5000`.

## 🔑 API chính

| Nhóm | Endpoint | Mô tả |
|---|---|---|
| **Auth** | `POST /api/auth/student/register` | Đăng ký sinh viên (mã số SV) |
| | `POST /api/auth/student/login` | Đăng nhập sinh viên (MSSV) |
| | `POST /api/auth/login` · `/me` | Đăng nhập / lấy thông tin admin, CTV |
| **Giải đấu** | `GET/POST /api/tournaments` | Danh sách / tạo giải |
| | `GET/PUT/DELETE /api/tournaments/:id` | Chi tiết / sửa / xóa |
| | `GET /api/tournaments/pending` | Giải chờ duyệt (admin) |
| **Đăng ký** | `POST /api/registrations` | Đăng ký tham gia giải |
| | `GET /api/my-registrations` | Đăng ký của giải do user tạo |
| **Admin** | `GET /api/admin/stats` | Thống kê dashboard |
| | `GET /api/admin/dashboard` | Dữ liệu khởi tạo dashboard sau login |
| | CRUD `/api/admin/users` · `/api/admin/ctvs` | Quản lý user & CTV |
| **Upload** | `POST /api/upload/banner` | Upload banner giải |

## 🗄️ Database

3 bảng chính (schema trong `backend/database.sql` + migrations):

- **users** — admin / CTV / sinh viên (có `student_id`, khoa, lớp, khóa)
- **tournaments** — giải đấu, form đăng ký động (`form_schema` JSONB), trạng thái duyệt
- **registrations** — đơn đăng ký (`submitted_data` JSONB), trạng thái pending/approved/rejected

## 📄 Tài liệu thêm

Xem thêm trong [`docs/`](./docs): hướng dẫn cài đặt admin, quản lý CTV, ghi chú triển khai.
