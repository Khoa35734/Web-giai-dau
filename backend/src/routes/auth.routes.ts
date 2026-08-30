import { Router } from 'express';
import * as authController from '../controllers/auth.ts';
import { verifyParticipantToken, verifyToken } from '../middleware/auth.ts';
import { getParticipantMe } from '../controllers/auth.ts';

const router = Router();
router.get('/participant/me', verifyParticipantToken, getParticipantMe);

// =============================================================================
// ADMIN & CTV AUTH
// =============================================================================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getMe);

// DUT (public)
router.post('/dut/register', authController.dutRegister);
router.post('/dut/login', authController.dutLogin);
router.post('/student/register', authController.studentRegister);

// [SV-02] Đăng nhập sinh viên (Email / MSSV / Username)
router.post('/student/login', authController.studentLogin);

// Luồng tự do (public)
router.post('/free/register', authController.freeRegister);
router.post('/free/login', authController.freeLogin);
router.get('/participant/me', verifyParticipantToken, authController.getParticipantMe);

export default router;
