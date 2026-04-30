const { Pool } = require('pg');

// Tạo connection pool để tái sử dụng kết nối hiệu quả
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    // Cấu hình pool
    max: 10,                    // Tối đa 10 kết nối đồng thời
    idleTimeoutMillis: 30000,   // Đóng kết nối nhàn rỗi sau 30 giây
    connectionTimeoutMillis: 2000, // Timeout khi không kết nối được sau 2 giây
});

// Kiểm tra kết nối khi khởi động
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Kết nối PostgreSQL thất bại:', err.message);
    } else {
        console.log('✅ Kết nối PostgreSQL thành công!');
        release(); // Trả kết nối về pool
    }
});

// Xử lý lỗi bất ngờ từ pool
pool.on('error', (err) => {
    console.error('❌ Lỗi PostgreSQL pool:', err.message);
});

module.exports = pool;
