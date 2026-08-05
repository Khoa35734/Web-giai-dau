import { Router } from 'express';
import * as authController from '../controllers/auth.ts';
import { verifyToken } from '../middleware/auth.ts';

const router = Router();

// Admin/CTV
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getMe);

// Sinh viên (public)
router.post('/student/register', authController.studentRegister);
router.post('/student/login', authController.studentLogin);

export default router;
