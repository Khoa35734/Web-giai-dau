/**
 * SEED — chèn dữ liệu mẫu để xem giao diện.
 * Chạy:  node src/seed.ts   (từ thư mục backend)
 * Chạy lại an toàn — không trùng lặp (kiểm tra email/tên tồn tại trước).
 */
import bcryptjs from 'bcryptjs';
import pool from './config/db.ts';

const PASSWORD = '123456';

// ===========================
// Helper
// ===========================
async function createUser(email: string, full_name: string, role: 'admin' | 'ctv') {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const hash = await bcryptjs.hash(PASSWORD, 10);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [email, hash, full_name, role],
  );
  console.log(`  ✅ User: ${full_name} (${role})`);
  return result.rows[0].id;
}

async function tournamentExists(code: string) {
  const result = await pool.query('SELECT id FROM tournaments WHERE code = $1', [code]);
  return result.rows[0]?.id ?? null;
}

async function createTournament(data: Record<string, unknown>) {
  const existingId = await tournamentExists(data.code as string);
  if (existingId) return existingId;

  const result = await pool.query(
    `INSERT INTO tournaments (
        code, name, game_name, game_logo_url, banner_url, participation_type,
        max_participants, min_team_size, max_team_size, prize_pool,
        registration_open_at, registration_close_at, start_at, end_at,
        description, use_external_link, external_registration_url, form_schema,
        created_by, approved_by, status, approved_at
     ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
     ) RETURNING id`,
    [
      data.code, data.name, data.game_name, data.game_logo_url, data.banner_url,
      data.participation_type, data.max_participants, data.min_team_size, data.max_team_size,
      data.prize_pool, data.registration_open_at, data.registration_close_at,
      data.start_at, data.end_at, data.description, data.use_external_link,
      data.external_registration_url, JSON.stringify(data.form_schema),
      data.created_by, data.approved_by, data.status, data.approved_at,
    ],
  );
  console.log(`  ✅ Tournament: ${data.name} (${data.code})`);
  return result.rows[0].id;
}

async function createRegistration(tournamentId: string, submittedData: Record<string, unknown>, status: string) {
  const result = await pool.query(
    `INSERT INTO registrations (tournament_id, submitted_data, status)
     VALUES ($1, $2, $3) RETURNING id`,
    [tournamentId, JSON.stringify(submittedData), status],
  );
  console.log(`  ✅ Registration: ${submittedData['Họ và tên'] ?? 'N/A'} (${status})`);
  return result.rows[0].id;
}

// ===========================
// MAIN
// ===========================
async function seed() {
  console.log('\n🌱 BẮT ĐẦU SEED DỮ LIỆU MẪU...\n');

  // ---------- USERS ----------
  console.log('👤 NGƯỜI DÙNG:');
  const adminId = await createUser('admin@dut.udn.vn', 'Admin DUT', 'admin');
  const ctv1Id = await createUser('ctv1@dut.udn.vn', 'Nguyễn Văn An', 'ctv');
  const ctv2Id = await createUser('ctv2@dut.udn.vn', 'Trần Thị Bình', 'ctv');
  const ctv3Id = await createUser('ctv3@dut.udn.vn', 'Lê Văn Cường', 'ctv');

  // ---------- TOURNAMENTS ----------
  console.log('\n🏆 GIẢI ĐẤU:');
  const now = Date.now();
  const day = 86_400_000;

  const formLol = [
    { id: 'team_name', label: 'Tên đội tuyển', type: 'text', required: true },
    { id: 'captain_name', label: 'Tên đội trưởng', type: 'text', required: true },
    { id: 'captain_phone', label: 'Số điện thoại', type: 'number', required: true },
    { id: 'email', label: 'Email liên hệ', type: 'email', required: true },
    { id: 'rank', label: 'Rank cao nhất', type: 'select', required: true, options: 'Sắt,Đồng,Bạc,Vàng,Bạch kim,Kim cương,Thạch anh,Thách đấu' },
    { id: 'note', label: 'Ghi chú', type: 'textarea', required: false },
  ];

  const formVal = [
    { id: 'team_name', label: 'Tên đội', type: 'text', required: true },
    { id: 'captain_name', label: 'Tên đội trưởng', type: 'text', required: true },
    { id: 'riot_id', label: 'Riot ID + Tag', type: 'text', required: true },
    { id: 'phone', label: 'Số điện thoại', type: 'number', required: true },
    { id: 'rank', label: 'Rank hiện tại', type: 'select', required: true, options: 'Sắt,Đồng,Bạc,Vàng,Bạch kim,Kim cương,Thạch anh,Thách đấu' },
  ];

  const formAoV = [
    { id: 'team_name', label: 'Tên đội', type: 'text', required: true },
    { id: 'captain_name', label: 'Tên đội trưởng', type: 'text', required: true },
    { id: 'phone', label: 'Số điện thoại', type: 'number', required: true },
    { id: 'city', label: 'Khu vực', type: 'select', required: true, options: 'Đà Nẵng,Huế,Quảng Nam,Quảng Ngãi,Khác' },
  ];

  const formTft = [
    { id: 'player_name', label: 'Tên nhân vật', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'rank', label: 'Rank', type: 'select', required: true, options: 'Sắt,Đồng,Bạc,Vàng,Bạch kim,Kim cương,Thạch anh,Thách đấu' },
  ];

  const banner = (color: string, text: string) =>
    `https://via.placeholder.com/1200x400/${color}/FFFFFF?text=${text}`;
  const logo = (name: string) => `http://localhost:5000/api/logos/${name}`;

  // Giải đã duyệt — hiển thị trên trang chủ
  const t1 = await createTournament({
    code: 'LOL082026001',
    name: 'DUT Esports Championship 2026 — Liên Minh Huyền Thoại',
    game_name: 'League of Legend',
    game_logo_url: logo('LOL.png'),
    banner_url: banner('0D47A1', 'LOL+Championship'),
    participation_type: 'team',
    max_participants: 32,
    min_team_size: 5,
    max_team_size: 6,
    prize_pool: 15_000_000,
    registration_open_at: new Date(now - 5 * day).toISOString(),
    registration_close_at: new Date(now + 10 * day).toISOString(),
    start_at: new Date(now + 15 * day).toISOString(),
    end_at: new Date(now + 25 * day).toISOString(),
    description:
      'Giải đấu Liên Minh Huyền Thoại quy mô lớn nhất Đà Nẵng. Cơ hội tranh tài cùng các đội tuyển hàng đầu khu vực miền Trung với tổng giải thưởng lên đến 15 triệu đồng.',
    use_external_link: false,
    external_registration_url: null,
    form_schema: formLol,
    created_by: adminId,
    approved_by: adminId,
    status: 'approved',
    approved_at: new Date().toISOString(),
  });

  const t2 = await createTournament({
    code: 'VAL082026001',
    name: 'Valorant DUT Open Cup 2026',
    game_name: 'Valorant',
    game_logo_url: logo('Valorant.png'),
    banner_url: banner('FF4655', 'VALORANT+Cup'),
    participation_type: 'team',
    max_participants: 16,
    min_team_size: 5,
    max_team_size: 5,
    prize_pool: 8_000_000,
    registration_open_at: new Date(now - 2 * day).toISOString(),
    registration_close_at: new Date(now + 7 * day).toISOString(),
    start_at: new Date(now + 12 * day).toISOString(),
    end_at: new Date(now + 18 * day).toISOString(),
    description:
      'Đấu trường FPS dành cho các game thủ Valorant. Thể thức BO3, vòng bảng + playoff. Giải thưởng hấp dẫn cho top 4 đội.',
    use_external_link: false,
    external_registration_url: null,
    form_schema: formVal,
    created_by: ctv1Id,
    approved_by: adminId,
    status: 'approved',
    approved_at: new Date().toISOString(),
  });

  const t3 = await createTournament({
    code: 'AOV082026001',
    name: 'Liên Quân Mobile — Đà Nẵng Student Cup',
    game_name: 'Liên Quân Mobile',
    game_logo_url: logo('LQ.png'),
    banner_url: banner('C2185B', 'AOV+Student+Cup'),
    participation_type: 'team',
    max_participants: 64,
    min_team_size: 5,
    max_team_size: 5,
    prize_pool: 5_000_000,
    registration_open_at: new Date(now - 1 * day).toISOString(),
    registration_close_at: new Date(now + 5 * day).toISOString(),
    start_at: new Date(now + 8 * day).toISOString(),
    end_at: new Date(now + 15 * day).toISOString(),
    description:
      'Sân chơi Liên Quân Mobile dành riêng cho sinh viên. Tham gia ngay để nhận quà tặng hấp dẫn từ nhà tài trợ.',
    use_external_link: false,
    external_registration_url: null,
    form_schema: formAoV,
    created_by: ctv2Id,
    approved_by: adminId,
    status: 'approved',
    approved_at: new Date().toISOString(),
  });

  const t4 = await createTournament({
    code: 'TFT082026001',
    name: 'TFT Đấu Trường Chiến Thuật — Solo Ranked',
    game_name: 'TFT',
    game_logo_url: logo('TFT.jpg'),
    banner_url: banner('8E24AA', 'TFT+Solo'),
    participation_type: 'individual',
    max_participants: 128,
    min_team_size: null,
    max_team_size: null,
    prize_pool: 3_000_000,
    registration_open_at: new Date(now - 3 * day).toISOString(),
    registration_close_at: new Date(now + 4 * day).toISOString(),
    start_at: new Date(now + 6 * day).toISOString(),
    end_at: new Date(now + 7 * day).toISOString(),
    description:
      'Giải đấu cá nhân TFT với thể thức 8 người/trận. Top 1 mỗi trận tích điểm, tổng kết sau 3 vòng.',
    use_external_link: false,
    external_registration_url: null,
    form_schema: formTft,
    created_by: ctv3Id,
    approved_by: adminId,
    status: 'approved',
    approved_at: new Date().toISOString(),
  });

  // Giải chờ duyệt — hiển thị ở tab "Chờ duyệt" của admin
  await createTournament({
    code: 'LOL082026002',
    name: 'LOL Ranked Clash — Thử thách tháng 8',
    game_name: 'League of Legend',
    game_logo_url: logo('LOL.png'),
    banner_url: banner('00695C', 'Ranked+Clash'),
    participation_type: 'team',
    max_participants: 16,
    min_team_size: 5,
    max_team_size: 5,
    prize_pool: 2_000_000,
    registration_open_at: new Date(now + 2 * day).toISOString(),
    registration_close_at: new Date(now + 12 * day).toISOString(),
    start_at: new Date(now + 18 * day).toISOString(),
    end_at: new Date(now + 20 * day).toISOString(),
    description: 'Giải đấu nhanh dành cho các đội muốn thử sức. Vòng loại BO1, bán kết BO3.',
    use_external_link: false,
    external_registration_url: null,
    form_schema: formLol,
    created_by: ctv1Id,
    approved_by: null,
    status: 'pending',
    approved_at: null,
  });

  // ---------- REGISTRATIONS ----------
  console.log('\n📝 ĐĂNG KÝ:');
  await createRegistration(t1, {
    team_name: 'DUT Dynasty',
    captain_name: 'Nguyễn Hoàng Long',
    captain_phone: '0905123456',
    email: 'long.nguyen@gmail.com',
    rank: 'Kim cương',
    note: 'Đội đến từ trường ĐH Bách Khoa',
  }, 'approved');

  await createRegistration(t1, {
    team_name: 'Phoenix Gaming',
    captain_name: 'Phạm Minh Quân',
    captain_phone: '0918234567',
    email: 'quan.pham@gmail.com',
    rank: 'Bạch kim',
    note: '',
  }, 'pending');

  await createRegistration(t2, {
    team_name: 'VN Stars',
    captain_name: 'Hoàng Đức Anh',
    riot_id: 'VNStars#DUKE',
    phone: '0934567890',
    rank: 'Thạch anh',
  }, 'pending');

  await createRegistration(t2, {
    team_name: 'Sea Wolves',
    captain_name: 'Võ Thị Mai',
    riot_id: 'SeaWolves#MAI',
    phone: '0987654321',
    rank: 'Kim cương',
  }, 'rejected');

  await createRegistration(t3, {
    team_name: 'AOV Legends',
    captain_name: 'Trần Quốc Bảo',
    phone: '0901111222',
    city: 'Đà Nẵng',
  }, 'pending');

  await createRegistration(t4, {
    player_name: 'MinhTFT',
    email: 'minh.tft@gmail.com',
    rank: 'Bạch kim',
  }, 'approved');

  console.log('\n🎉 SEED HOÀN TẤT!');
  console.log('────────────────────────────────────────────');
  console.log('   👤 Admin:  admin@dut.udn.vn / 123456');
  console.log('   👤 CTV:    ctv1@dut.udn.vn / 123456');
  console.log('   👤 CTV:    ctv2@dut.udn.vn / 123456');
  console.log('   👤 CTV:    ctv3@dut.udn.vn / 123456');
  console.log('   🏆 4 giải đã duyệt + 1 giải chờ duyệt');
  console.log('   📝 6 đăng ký (approved/pending/rejected)');
  console.log('────────────────────────────────────────────\n');

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ SEED LỖI:', err);
  process.exit(1);
});
