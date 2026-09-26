import { Router } from 'express';
import * as checkinController from '../controllers/checkin.controller.ts';
import { verifyParticipantToken, verifyToken } from '../middleware/auth.ts';

const router = Router();

// Thí sinh điểm danh
router.post('/', verifyParticipantToken, checkinController.checkin);
router.get('/my-status', verifyParticipantToken, checkinController.getMyCheckinStatus);

// Quản trị / Trọng tài xem danh sách check-in
router.get('/', verifyToken, checkinController.listByTournament);

export default router;
