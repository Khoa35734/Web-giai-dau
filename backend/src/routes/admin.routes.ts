import { Router } from 'express';
import * as adminController from '../controllers/admin.ts';
import { verifyAdmin, verifyToken } from '../middleware/auth.ts';

const router = Router();

// Toàn bộ route admin đều yêu cầu admin
router.use(verifyToken, verifyAdmin);

router.get('/dashboard', adminController.dashboard);
router.get('/stats', adminController.stats);

// CTV management
router.get('/ctvs', adminController.listCtvs);
router.get('/ctvs/:id', adminController.getCtv);
router.post('/ctvs', adminController.createCtv);
router.put('/ctvs/:id', adminController.updateCtv);
router.patch('/ctvs/:id/status', adminController.updateCtvStatus);
router.delete('/ctvs/:id', adminController.deleteCtv);

// User management (Internal: Admin/CTV)
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// Participant management (Thí sinh / Người dùng đăng ký giải đấu)
router.get('/participants', adminController.listParticipants);
router.get('/participants/:id', adminController.getParticipant);
router.post('/participants', adminController.createParticipant);
router.put('/participants/:id', adminController.updateParticipant);
router.delete('/participants/:id', adminController.deleteParticipant);

export default router;

