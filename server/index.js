require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

// ===========================
// STATIC FILES - LOGOS (Phải đặt trước các route khác)
// ===========================
app.use('/api/logos', express.static(path.join(__dirname, 'logo'), {
  maxAge: '1h',
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// Static: Banner uploads
const BANNERS_DIR = path.join(__dirname, 'uploads', 'banners');
if (!fs.existsSync(BANNERS_DIR)) fs.mkdirSync(BANNERS_DIR, { recursive: true });
app.use('/api/banners', express.static(BANNERS_DIR, { maxAge: '7d' }));

// Multer config for banner upload
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BANNERS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `banner_${Date.now()}${ext}`);
  }
});
const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  }
});

// POST /api/upload/banner
app.post('/api/upload/banner', bannerUpload.single('banner'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Không có file được tải lên' });
  const url = `${req.protocol}://${req.get('host')}/api/banners/${req.file.filename}`;
  res.json({ success: true, url });
});

// Error handler for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Chỉ chấp nhận file ảnh') {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

// ===========================
// JWT CONFIGURATION
// ===========================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRE = '24h';

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token not found' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Middleware to verify CTV role
const verifyCTV = (req, res, next) => {
    if (req.user?.role !== 'ctv') {
        return res.status(403).json({ success: false, message: 'Chỉ CTV mới có quyền truy cập' });
    }
    next();
};

// Middleware to verify Admin role
const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền truy cập' });
    }
    next();
};

// Game code mappings
const GAME_CODE_MAP = {
    'Liên Quân Mobile': 'AOV',
    'League of Legend': 'LOL',
    'Valorant': 'VAL',
    'TFT': 'TFT'
};

// Helper function to generate tournament code
// Format: <GameCode><MMYYYY><sequence>
// Example: AOV052026001 (Liên Quân), LOL052026001 (League of Legend)
const generateTournamentCode = async (gameName, startDate) => {
    const gameCode = GAME_CODE_MAP[gameName] || gameName.substring(0, 3).toUpperCase();
    const date = new Date(startDate);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2); // Get last 2 digits of year
    const monthYearCode = `${month}${year}`;
    
    // Get the count of tournaments with same game name in same month
    const result = await pool.query(
        `SELECT COUNT(*) as count FROM tournaments 
         WHERE game_name = $1 AND code LIKE $2`,
        [gameName, `${gameCode}${monthYearCode}%`]
    );
    
    const sequence = (parseInt(result.rows[0].count) + 1).toString().padStart(3, '0');
    return `${gameCode}${monthYearCode}${sequence}`;
};

// ===========================
// TEST ROUTES
// ===========================
app.get('/api/message', (req, res) => {
    res.json({ message: "Xin chào từ Node.js Server!" });
});

app.get('/api/db-test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS current_time');
        res.json({
            success: true,
            message: 'Kết nối database thành công!',
            server_time: result.rows[0].current_time,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Kết nối database thất bại!', error: err.message });
    }
});

// ===========================
// AUTHENTICATION ROUTES
// ===========================

// Register admin (chỉ sử dụng từ backend)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, full_name } = req.body;
        if (!email || !password || !full_name) {
            return res.status(400).json({ success: false, message: 'Tất cả trường là bắt buộc' });
        }

        // Check if email exists
        const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
        }

        // Hash password
        const password_hash = await bcryptjs.hash(password, 10);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role`,
            [email, password_hash, full_name, 'admin', true]
        );

        res.status(201).json({ success: true, message: 'Tài khoản admin được tạo thành công', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email và mật khẩu là bắt buộc' });
        }

        // Find user
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        }

        const user = result.rows[0];

        // Check if user is admin or ctv
        if (!['admin', 'ctv'].includes(user.role)) {
            return res.status(403).json({ success: false, message: 'Chỉ admin và CTV có thể đăng nhập' });
        }

        // Verify password
        const isValidPassword = await bcryptjs.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị vô hiệu hóa' });
        }

        // Generate JWT
        const token = jwt.sign({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role
        }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get current user info
app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, full_name, role, is_active FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===========================
// TOURNAMENT ROUTES
// ===========================

// Get all tournaments (public)
app.get('/api/tournaments', async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = 'SELECT * FROM tournaments WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $${params.length} OR game_name ILIKE $${params.length})`;
        }
        if (status && status !== 'all') {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get single tournament
app.get('/api/tournaments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giải đấu' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create tournament (both admin and CTV)
app.post('/api/tournaments', verifyToken, async (req, res) => {
    try {
        const {
            name, game_name, game_logo_url, banner_url, participation_type,
            max_participants, min_team_size, max_team_size, prize_pool,
            registration_open_at, registration_close_at,
            start_at, end_at, description, use_external_link, external_registration_url, form_schema
        } = req.body;

        // Validate required fields
        if (!name || !game_name || !participation_type || !max_participants || !banner_url) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tên, tên trò chơi, loại tham gia, số người tối đa, và banner là bắt buộc' 
            });
        }

        // Validate team size for team participation
        if (participation_type === 'team') {
            if (!min_team_size || !max_team_size) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Kích thước tối thiểu và tối đa của đội là bắt buộc' 
                });
            }
            if (min_team_size > max_team_size) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Kích thước tối thiểu phải nhỏ hơn hoặc bằng kích thước tối đa' 
                });
            }
        }

        // Auto-generate code
        const code = await generateTournamentCode(game_name, start_at);

        // Determine status based on user role
        const status = req.user.role === 'admin' ? 'approved' : 'pending';
        const approved_by = req.user.role === 'admin' ? req.user.id : null;
        const approved_at = req.user.role === 'admin' ? new Date() : null;

        const result = await pool.query(
            `INSERT INTO tournaments (
                code, name, game_name, game_logo_url, banner_url, participation_type,
                max_participants, min_team_size, max_team_size, prize_pool,
                registration_open_at, registration_close_at,
                start_at, end_at, description, use_external_link, external_registration_url, 
                form_schema, created_by, approved_by, status, approved_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            RETURNING *`,
            [code, name, game_name, game_logo_url, banner_url, participation_type,
             max_participants, min_team_size || null, max_team_size || null, prize_pool || 0,
             registration_open_at, registration_close_at,
             start_at, end_at, description, use_external_link, external_registration_url,
             JSON.stringify(form_schema || []), req.user.id, approved_by, status, approved_at]
        );

        res.status(201).json({ 
            success: true, 
            message: status === 'approved' 
                ? 'Giải đấu được tạo thành công' 
                : 'Giải đấu được gửi để duyệt. Chờ admin duyệt.',
            data: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update tournament (admin for approval, creator for editing)
app.put('/api/tournaments/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, game_name, game_logo_url, banner_url, participation_type,
            max_participants, min_team_size, max_team_size, prize_pool,
            registration_open_at, registration_close_at,
            start_at, end_at, description, use_external_link, external_registration_url, form_schema, status
        } = req.body;

        // Get current tournament
        const tourResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tourResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giải đấu' });
        }

        const tournament = tourResult.rows[0];

        // Check permissions
        const isAdmin = req.user.role === 'admin';
        const isCreator = tournament.created_by === req.user.id;

        // Admin can approve/reject
        if (status && status !== tournament.status) {
            if (!isAdmin) {
                return res.status(403).json({ success: false, message: 'Chỉ admin mới có thể duyệt giải đấu' });
            }
            if (!['pending', 'approved', 'rejected'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
            }
        }

        // Creator or admin can edit other fields
        if (!isCreator && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa giải đấu này' });
        }

        // Validate team size if provided
        if (participation_type === 'team' && (min_team_size || max_team_size)) {
            if (min_team_size > max_team_size) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Kích thước tối thiểu phải nhỏ hơn hoặc bằng kích thước tối đa' 
                });
            }
        }

        // Update tournament
        const updateParams = [
            name || tournament.name,
            game_name || tournament.game_name,
            game_logo_url || tournament.game_logo_url,
            banner_url || tournament.banner_url,
            participation_type || tournament.participation_type,
            max_participants || tournament.max_participants,
            min_team_size !== undefined ? min_team_size : tournament.min_team_size,
            max_team_size !== undefined ? max_team_size : tournament.max_team_size,
            prize_pool !== undefined ? prize_pool : tournament.prize_pool,
            registration_open_at || tournament.registration_open_at,
            registration_close_at || tournament.registration_close_at,
            start_at || tournament.start_at,
            end_at || tournament.end_at,
            description || tournament.description,
            use_external_link !== undefined ? use_external_link : tournament.use_external_link,
            external_registration_url || tournament.external_registration_url,
            form_schema !== undefined ? JSON.stringify(form_schema) : JSON.stringify(tournament.form_schema || []),
            status || tournament.status,
            isAdmin && status ? req.user.id : tournament.approved_by,
            isAdmin && status ? new Date() : tournament.approved_at,
            id
        ];

        const result = await pool.query(
            `UPDATE tournaments SET
                name=$1, game_name=$2, game_logo_url=$3, banner_url=$4, participation_type=$5,
                max_participants=$6, min_team_size=$7, max_team_size=$8, prize_pool=$9,
                registration_open_at=$10, registration_close_at=$11,
                start_at=$12, end_at=$13, description=$14, use_external_link=$15,
                external_registration_url=$16, form_schema=$17, status=$18, 
                approved_by=$19, approved_at=$20, updated_at=NOW()
            WHERE id=$21 RETURNING *`,
            updateParams
        );

        res.json({ success: true, message: 'Giải đấu được cập nhật thành công', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get pending tournaments (admin)
app.get('/api/tournaments/pending', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.*, u.full_name as created_by_name FROM tournaments t 
             JOIN users u ON t.created_by = u.id 
             WHERE t.status = 'pending' 
             ORDER BY t.created_at ASC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get my pending tournaments (CTV)
app.get('/api/tournaments/my-pending', verifyToken, verifyCTV, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM tournaments 
             WHERE created_by = $1 AND status = 'pending'
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete tournament (admin only or creator for pending)
app.delete('/api/tournaments/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giải đấu' });
        }

        const tournament = result.rows[0];
        const isAdmin = req.user.role === 'admin';
        const isCreator = tournament.created_by === req.user.id;
        const isPending = tournament.status === 'pending';

        // Only admin can delete, or creator can delete pending tournaments
        if (!isAdmin && !(isCreator && isPending)) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa giải đấu này' });
        }

        await pool.query('DELETE FROM tournaments WHERE id = $1', [id]);
        res.json({ success: true, message: 'Giải đấu được xóa thành công' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===========================
// REGISTRATION ROUTES
// ===========================

// Get all registrations (admin only)
app.get('/api/registrations', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { tournament_id, status } = req.query;
        let query = 'SELECT r.*, t.name as tournament_name FROM registrations r LEFT JOIN tournaments t ON r.tournament_id = t.id WHERE 1=1';
        const params = [];

        if (tournament_id) {
            params.push(tournament_id);
            query += ` AND r.tournament_id = $${params.length}`;
        }
        if (status && status !== 'all') {
            params.push(status);
            query += ` AND r.status = $${params.length}`;
        }

        query += ' ORDER BY r.registered_at DESC';
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get registrations for a tournament (owner or admin only)
app.get('/api/tournaments/:id/registrations', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Check tournament exists and user is owner or admin
        const tourResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tourResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kh\u00f4ng t\u00ecm th\u1ea5y gi\u1ea3i \u0111\u1ea5u' });
        }
        const tournament = tourResult.rows[0];
        const isAdmin = req.user.role === 'admin';
        const isOwner = tournament.created_by === req.user.id;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, message: 'B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n xem danh s\u00e1ch \u0111\u0103ng k\u00fd' });
        }
        const result = await pool.query(
            'SELECT * FROM registrations WHERE tournament_id = $1 ORDER BY registered_at DESC',
            [id]
        );
        res.json({ success: true, data: result.rows, tournament: { id: tournament.id, name: tournament.name, form_schema: tournament.form_schema } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update registration status (admin only)
app.put('/api/registrations/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        const result = await pool.query(
            `UPDATE registrations SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký' });
        }

        res.json({ success: true, message: 'Cập nhật trạng thái thành công', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===========================
// ADMIN DASHBOARD STATS
// ===========================
app.get('/api/admin/stats', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const [tournamentsCount, pendingTournaments, registrationsCount, activeCount, pendingCount] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM tournaments WHERE status = 'approved'"),
            pool.query("SELECT COUNT(*) FROM tournaments WHERE status = 'pending'"),
            pool.query('SELECT COUNT(*) FROM registrations'),
            pool.query("SELECT COUNT(*) FROM registrations WHERE status = 'approved'"),
            pool.query("SELECT COUNT(*) FROM registrations WHERE status = 'pending'"),
        ]);

        res.json({
            success: true,
            data: {
                total_tournaments: parseInt(tournamentsCount.rows[0].count),
                pending_tournaments: parseInt(pendingTournaments.rows[0].count),
                total_registrations: parseInt(registrationsCount.rows[0].count),
                approved_registrations: parseInt(activeCount.rows[0].count),
                pending_registrations: parseInt(pendingCount.rows[0].count),
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===========================
// CTV MANAGEMENT ROUTES (Admin only)
// ===========================

// Get all CTV accounts (admin only)
app.get('/api/admin/ctvs', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { search, status, page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let query = "SELECT id, email, full_name, is_active, created_at, updated_at FROM users WHERE role = 'ctv'";
        let countQuery = "SELECT COUNT(*) FROM users WHERE role = 'ctv'";
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            const searchParam = `$${params.length}`;
            query += ` AND (full_name ILIKE ${searchParam} OR email ILIKE ${searchParam})`;
            countQuery += ` AND (full_name ILIKE ${searchParam} OR email ILIKE ${searchParam})`;
        }

        if (status) {
            params.push(status === 'active');
            query += ` AND is_active = $${params.length}`;
            countQuery += ` AND is_active = $${params.length}`;
        }

        // Get total count
        const countResult = await pool.query(countQuery, params.slice(0, params.length - (search ? 2 : 0) - (status ? 1 : 0)));
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        
        res.json({ 
            success: true, 
            data: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get single CTV account (admin only)
app.get('/api/admin/ctvs/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            "SELECT id, email, full_name, is_active, created_at, updated_at FROM users WHERE id = $1 AND role = 'ctv'",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản CTV' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create CTV account (admin only)
app.post('/api/admin/ctvs', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ success: false, message: 'Email, mật khẩu và tên đầy đủ là bắt buộc' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
        }

        // Check if email already exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        // Hash password
        const password_hash = await bcryptjs.hash(password, 10);

        // Create CTV user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, email, full_name, is_active, created_at`,
            [email, password_hash, full_name, 'ctv', true]
        );

        res.status(201).json({ 
            success: true, 
            message: 'Tài khoản CTV được tạo thành công',
            data: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update CTV account (admin only)
app.put('/api/admin/ctvs/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, full_name, password, is_active } = req.body;

        // Check if CTV exists
        const existing = await pool.query(
            "SELECT * FROM users WHERE id = $1 AND role = 'ctv'",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản CTV' });
        }

        const ctv = existing.rows[0];

        // Check if new email is already taken by another user
        if (email && email !== ctv.email) {
            const emailExists = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
            if (emailExists.rows.length > 0) {
                return res.status(400).json({ success: false, message: 'Email đã được sử dụng' });
            }
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
            }
        }

        // Hash new password if provided
        let password_hash = ctv.password_hash;
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
            }
            password_hash = await bcryptjs.hash(password, 10);
        }

        // Update CTV
        const result = await pool.query(
            `UPDATE users SET 
                email = $1, 
                full_name = $2, 
                password_hash = $3, 
                is_active = $4,
                updated_at = NOW()
             WHERE id = $5 AND role = 'ctv'
             RETURNING id, email, full_name, is_active, created_at, updated_at`,
            [
                email || ctv.email,
                full_name || ctv.full_name,
                password_hash,
                is_active !== undefined ? is_active : ctv.is_active,
                id
            ]
        );

        res.json({ 
            success: true, 
            message: 'Tài khoản CTV được cập nhật thành công',
            data: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update CTV status (admin only) - Quick status toggle
app.patch('/api/admin/ctvs/:id/status', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (is_active === undefined) {
            return res.status(400).json({ success: false, message: 'Trạng thái là bắt buộc' });
        }

        // Check if CTV exists
        const existing = await pool.query(
            "SELECT * FROM users WHERE id = $1 AND role = 'ctv'",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản CTV' });
        }

        const result = await pool.query(
            `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 AND role = 'ctv'
             RETURNING id, email, full_name, is_active, created_at, updated_at`,
            [is_active, id]
        );

        res.json({ 
            success: true, 
            message: `Tài khoản CTV đã được ${is_active ? 'kích hoạt' : 'vô hiệu hóa'}`,
            data: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete CTV account (admin only)
app.delete('/api/admin/ctvs/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if CTV exists
        const existing = await pool.query(
            "SELECT * FROM users WHERE id = $1 AND role = 'ctv'",
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản CTV' });
        }

        // Delete CTV (cascade delete will handle related tournaments)
        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ 
            success: true, 
            message: 'Tài khoản CTV được xóa thành công'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===========================
// USER MANAGEMENT ROUTES (Admin only)
// ===========================

// Get all users (admin only) - with role filter
app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { search, role = 'all', page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let query = "SELECT id, email, full_name, role, is_active, created_at, updated_at FROM users WHERE 1=1";
        let countQuery = "SELECT COUNT(*) FROM users WHERE 1=1";
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            const searchParam = `$${params.length}`;
            query += ` AND (full_name ILIKE ${searchParam} OR email ILIKE ${searchParam})`;
            countQuery += ` AND (full_name ILIKE ${searchParam} OR email ILIKE ${searchParam})`;
        }

        if (role && role !== 'all') {
            params.push(role);
            query += ` AND role = $${params.length}`;
            countQuery += ` AND role = $${params.length}`;
        }

        // Get total count
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        
        res.json({ 
            success: true, 
            data: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get single user (admin only)
app.get('/api/admin/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            "SELECT id, email, full_name, role, is_active, created_at, updated_at FROM users WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create new user (admin only) - with role selection
app.post('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { email, password, full_name, role = 'ctv' } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ success: false, message: 'Email, mật khẩu và tên đầy đủ là bắt buộc' });
        }

        if (!['admin', 'ctv'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ (admin/ctv)' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
        }

        // Check if email already exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        // Hash password
        const password_hash = await bcryptjs.hash(password, 10);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, email, full_name, role, is_active, created_at`,
            [email, password_hash, full_name, role, true]
        );

        res.status(201).json({ 
            success: true, 
            message: `Tài khoản ${role === 'admin' ? 'Admin' : 'CTV'} được tạo thành công`,
            data: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update user (admin only)
app.put('/api/admin/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, full_name, password, role, is_active } = req.body;

        // Check if user exists
        const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        const user = existing.rows[0];

        // Check if new email is already taken by another user
        if (email && email !== user.email) {
            const emailExists = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
            if (emailExists.rows.length > 0) {
                return res.status(400).json({ success: false, message: 'Email đã được sử dụng' });
            }
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
            }
        }

        // Validate role if provided
        if (role && !['admin', 'ctv'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ (admin/ctv)' });
        }

        // Hash new password if provided
        let password_hash = user.password_hash;
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
            }
            password_hash = await bcryptjs.hash(password, 10);
        }

        // Update user
        const result = await pool.query(
            `UPDATE users SET 
                email = $1, 
                full_name = $2, 
                password_hash = $3, 
                role = $4,
                is_active = $5,
                updated_at = NOW()
             WHERE id = $6
             RETURNING id, email, full_name, role, is_active, created_at, updated_at`,
            [
                email || user.email,
                full_name || user.full_name,
                password_hash,
                role || user.role,
                is_active !== undefined ? is_active : user.is_active,
                id
            ]
        );

        res.json({ 
            success: true, 
            message: 'Người dùng được cập nhật thành công',
            data: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update user status (admin only)
app.patch('/api/admin/users/:id/status', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (is_active === undefined) {
            return res.status(400).json({ success: false, message: 'Trạng thái là bắt buộc' });
        }

        // Check if user exists
        const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        const result = await pool.query(
            `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2
             RETURNING id, email, full_name, role, is_active, created_at, updated_at`,
            [is_active, id]
        );

        res.json({ 
            success: true, 
            message: `Tài khoản đã được ${is_active ? 'kích hoạt' : 'vô hiệu hóa'}`,
            data: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        // Delete user (cascade delete will handle related tournaments)
        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ 
            success: true, 
            message: 'Người dùng được xóa thành công'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/registrations - Submit a new registration
app.post('/api/registrations', async (req, res) => {
    try {
        const { tournament_id, form_data } = req.body;

        if (!tournament_id || !form_data) {
            return res.status(400).json({ 
                success: false, 
                message: 'Thiếu tournament_id hoặc form_data' 
            });
        }

        // Verify tournament exists
        const tournamentResult = await pool.query(
            'SELECT * FROM tournaments WHERE id = $1',
            [tournament_id]
        );

        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Giải đấu không tồn tại' 
            });
        }

        const tournament = tournamentResult.rows[0];

        // Validate required fields using form_schema
        const formSchema = Array.isArray(tournament.form_schema) 
            ? tournament.form_schema 
            : (typeof tournament.form_schema === 'string' ? JSON.parse(tournament.form_schema) : []);
        const requiredFields = formSchema.filter(f => f.required);
        
        for (const field of requiredFields) {
            const val = form_data[field.id];
            if (!val || String(val).trim() === '') {
                return res.status(400).json({ 
                    success: false, 
                    message: `Truong "${field.label}" la bat buoc`
                });
            }
        }

        // Insert registration
        const result = await pool.query(
            `INSERT INTO registrations (tournament_id, submitted_data, status)
             VALUES ($1, $2, 'pending')
             RETURNING *`,
            [tournament_id, JSON.stringify(form_data)]
        );

        res.status(201).json({
            success: true, 
            message: 'Dang ky thanh cong! Vui long cho xac nhan tu ban to chuc.',
            data: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/registrations/:id - Xóa đăng ký (admin hoặc owner của giải)
app.delete('/api/registrations/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const regResult = await pool.query(
            `SELECT r.*, t.created_by as tournament_owner 
             FROM registrations r 
             JOIN tournaments t ON r.tournament_id = t.id 
             WHERE r.id = $1`,
            [id]
        );
        if (regResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký' });
        }
        const isAdmin = req.user.role === 'admin';
        const isOwner = regResult.rows[0].tournament_owner === req.user.id;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa đăng ký này' });
        }
        await pool.query('DELETE FROM registrations WHERE id = $1', [id]);
        res.json({ success: true, message: 'Xóa đăng ký thành công' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/my-registrations - Tất cả đăng ký của giải do user tạo (hoặc tất cả nếu admin)
app.get('/api/my-registrations', verifyToken, async (req, res) => {
    try {
        const { tournament_id, status } = req.query;
        const isAdmin = req.user.role === 'admin';

        let query = `
            SELECT r.*, t.name as tournament_name, t.game_name, t.form_schema
            FROM registrations r
            JOIN tournaments t ON r.tournament_id = t.id
            WHERE 1=1
        `;
        const params = [];

        if (!isAdmin) {
            params.push(req.user.id);
            query += ` AND t.created_by = $${params.length}`;
        }
        if (tournament_id) {
            params.push(tournament_id);
            query += ` AND r.tournament_id = $${params.length}`;
        }
        if (status && status !== 'all') {
            params.push(status);
            query += ` AND r.status = $${params.length}`;
        }
        query += ' ORDER BY r.registered_at DESC';

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/my-tournaments - Danh sách giải đấu của user (để filter)
app.get('/api/my-tournaments', verifyToken, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        let query = `SELECT * FROM tournaments`;
        const params = [];
        if (!isAdmin) {
            params.push(req.user.id);
            query += ` WHERE created_by = $1`;
        }
        query += ` ORDER BY created_at DESC`;
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server đang chạy tại cổng ${PORT}`));