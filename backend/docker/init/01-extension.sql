-- Chạy đầu tiên khi container khởi động (theo thứ tự alphabet trong /docker-entrypoint-initdb.d)
-- Tạo extension UUID — bắt buộc vì database.sql dùng uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
