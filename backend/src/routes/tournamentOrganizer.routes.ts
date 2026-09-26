import { Router } from 'express';
import * as organizerController from '../controllers/tournamentOrganizer.controller.ts';
import { verifyAdminOrLeadOrganizer, verifyToken } from '../middleware/auth.ts';

const router = Router();

// Candidate search endpoints (yêu cầu login user)
router.get('/candidates/users', verifyToken, organizerController.getCandidateUsers);
router.get('/candidates/participants', verifyToken, organizerController.getCandidateParticipants);

// Lấy danh sách BTC của giải (Public hoặc auth)
router.get('/tournaments/:id/organizers', organizerController.getOrganizersByTournament);

// Kiểm tra quyền hạn của user đối với giải đấu
router.get('/tournaments/:id/my-role', verifyToken, organizerController.checkUserRole);

// Thêm, sửa, xóa BTC — Bắt buộc phải là Admin hoặc Trưởng BTC (Lead Organizer / Creator)
router.post('/tournaments/:id/organizers', verifyToken, verifyAdminOrLeadOrganizer, organizerController.addOrganizer);
router.put('/tournaments/:id/organizers/:organizerId', verifyToken, verifyAdminOrLeadOrganizer, organizerController.updateOrganizer);
router.delete('/tournaments/:id/organizers/:organizerId', verifyToken, verifyAdminOrLeadOrganizer, organizerController.removeOrganizer);

export default router;
