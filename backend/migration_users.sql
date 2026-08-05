-- Migration: Thêm thông tin sinh viên vào bảng users
-- Chạy: docker exec -i dut_esports_postgres psql -U postgres -d web_giai_dau < backend/migration_users.sql

-- Mã số sinh viên (duy nhất)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS student_id VARCHAR(20) UNIQUE;

-- Số điện thoại liên hệ
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Khoa/Viện (VD: Công nghệ Thông tin, Điện tử Viễn thông...)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS faculty VARCHAR(100);

-- Lớp (VD: 22T1, 23CLC...)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS class_name VARCHAR(50);

-- Khóa tuyển sinh (VD: K22, K23...)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS course VARCHAR(20);

-- Index tìm kiếm MSSV nhanh hơn
CREATE INDEX IF NOT EXISTS idx_users_student_id ON public.users(student_id);
