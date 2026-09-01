import { Router } from 'express';
import * as adminController from '../controllers/admin.ts';
import * as participantController from '../controllers/participant.controller.ts';
import { verifyAdmin, verifyToken } from '../middleware/auth.ts';

const router = Router();

// Toàn bộ route admin đều yêu cầu Token và quyền Admin
router.use(verifyToken, verifyAdmin);

router.get('/dashboard', adminController.dashboard);
router.get('/stats', adminController.stats);

// =============================================================================
// CTV MANAGEMENT
// =============================================================================
router.get('/ctvs', adminController.listCtvs);
router.get('/ctvs/:id', adminController.getCtv);
router.post('/ctvs', adminController.createCtv);
router.put('/ctvs/:id', adminController.updateCtv);
router.patch('/ctvs/:id/status', adminController.updateCtvStatus);
router.delete('/ctvs/:id', adminController.deleteCtv);

// =============================================================================
// USER MANAGEMENT (Internal: Admin/CTV)
// =============================================================================
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// =============================================================================
// PARTICIPANT & KYC MANAGEMENT [AD-01 & AD-02]
// =============================================================================
router.get('/participants', participantController.listParticipants);
router.get('/participants/:id', participantController.getParticipant);
router.post('/participants', participantController.createParticipant);
router.put('/participants/:id', participantController.updateParticipant);
router.delete('/participants/:id', participantController.deleteParticipant);

// KYC Approval & Status Actions
router.post('/participants/:id/approve', participantController.approveParticipant);
router.post('/participants/:id/reject', participantController.rejectParticipant);
router.patch('/participants/:id/status', participantController.updateParticipantStatus);
router.post('/participants/review', participantController.reviewParticipant);

export default router;
