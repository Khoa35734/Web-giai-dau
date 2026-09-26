import { Router } from 'express';
import * as registrationController from '../controllers/registration.ts';
import * as teamRequestController from '../controllers/teamRequest.controller.ts';
import { verifyAdmin, verifyParticipantToken, verifyToken } from '../middleware/auth.ts';

const router = Router();

// Participant — đăng ký tham gia giải đấu
router.post('/', verifyParticipantToken, registrationController.create);
router.post('/team', verifyParticipantToken, registrationController.create);

// Participant — danh sách giải đã đăng ký
router.get('/my-participations', verifyParticipantToken, registrationController.getMyParticipations);

// Participant — hủy & cập nhật đơn đăng ký
router.put('/:id/cancel', verifyParticipantToken, registrationController.cancel);
router.put('/:id/info', verifyParticipantToken, registrationController.updateInfo);

// Participant — tuyển quân & xin vào đội (Chợ đồng đội)
router.get('/my-join-requests', verifyParticipantToken, teamRequestController.getMyJoinRequests);
router.post('/:id/join-requests', verifyParticipantToken, teamRequestController.createJoinRequest);
router.get('/:id/join-requests', verifyParticipantToken, teamRequestController.listJoinRequestsForTeam);
router.put('/:id/join-requests/:requestId', verifyParticipantToken, teamRequestController.processJoinRequest);
router.put('/:id/recruiting', verifyParticipantToken, registrationController.updateRecruitingStatus);

// Auth required (Admin / CTV)
router.get('/', verifyToken, verifyAdmin, registrationController.listAll);
router.put('/:id', verifyToken, verifyAdmin, registrationController.updateStatus);
router.delete('/:id', verifyToken, registrationController.remove);
router.get('/my-registrations', verifyToken, registrationController.myRegistrations);
router.get('/my-tournaments', verifyToken, registrationController.myTournaments);

// Auth required (Admin / CTV) — Phase 9: Quản lý thành viên tham gia & Điểm danh ngày thi đấu & Xuất Excel
router.get('/tournament/:id/participants-management', verifyToken, registrationController.getTournamentParticipants);
router.get('/tournaments/:id/participants-management', verifyToken, registrationController.getTournamentParticipants);
router.post('/tournament/:id/confirm-participation', verifyToken, registrationController.confirmParticipantParticipation);
router.post('/tournaments/:id/confirm-participation', verifyToken, registrationController.confirmParticipantParticipation);
router.get('/tournament/:id/export-participants-excel', verifyToken, registrationController.exportTournamentParticipantsExcel);
router.get('/tournaments/:id/export-participants-excel', verifyToken, registrationController.exportTournamentParticipantsExcel);

export default router;

