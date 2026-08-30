import { Router } from 'express';
import * as authController from '../controllers/auth.ts';
import { verifyParticipantToken, verifyToken } from '../middleware/auth.ts';

const router = Router();

// =============================================================================
// ADMIN & CTV AUTH
// =============================================================================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getMe);

// =============================================================================
// SINH VIÊN KYC & AUTH (SV-01, SV-02, SV-03, SV-04)
// =============================================================================
// [SV-01] Đăng ký KYC sinh viên (2 ảnh thẻ SV)
router.post('/student/register', authController.studentRegister);

// [SV-02] Đăng nhập sinh viên (Email / MSSV / Username)
router.post('/student/login', authController.studentLogin);

// [SV-03] Quản lý hồ sơ cá nhân
router.get('/participant/me', verifyParticipantToken, authController.getParticipantMe);
router.put('/participant/profile', verifyParticipantToken, authController.updateParticipantProfile);

// [SV-04] Nộp lại / Cập nhật hồ sơ khi bị từ chối
router.post('/participant/resubmit', authController.participantResubmit);
router.post('/participant/re-submit', authController.participantResubmit);

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES
// =============================================================================
router.post('/dut/register', authController.studentRegister);
router.post('/dut/login', authController.studentLogin);
router.post('/free/register', authController.studentRegister);
router.post('/free/login', authController.studentLogin);

export default router;
