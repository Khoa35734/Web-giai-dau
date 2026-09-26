import { Router } from 'express';
import * as organizerController from '../controllers/tournamentOrganizer.controller.ts';
import * as registrationController from '../controllers/registration.ts';
import * as tournamentController from '../controllers/tournament.ts';
import {
  verifyAdmin,
  verifyAdminOrLeadOrganizer,
  verifyCTV,
  verifyParticipantToken,
  verifyToken,
} from '../middleware/auth.ts';

const router = Router();

// Public
router.get('/', tournamentController.list);

// Static routes — phải đứng TRƯỚC /:id để không bị shadow bởi param id
router.get('/pending', verifyToken, verifyAdmin, tournamentController.getPending);
router.get('/my-pending', verifyToken, verifyCTV, tournamentController.getMyPending);

router.get('/:id', tournamentController.getById);

// Auth required
router.post('/', verifyToken, tournamentController.create);
router.put('/:id', verifyToken, tournamentController.update);
router.delete('/:id', verifyToken, tournamentController.remove);

// Đăng ký của một giải (chủ giải hoặc admin)
router.get('/:id/registrations', verifyToken, registrationController.listByTournament);

// [SRS 4.3] Chợ tuyển quân của giải đấu (Public)
router.get('/:id/recruiting-teams', registrationController.listRecruitingTeams);

// Thông tin đăng ký của thí sinh hiện tại trong giải
router.get('/:id/my-registration', verifyParticipantToken, registrationController.getMyTournamentRegistration);

// [SRS 4.2, AD-05] Ban Tổ Chức Giải (tournament_organizers)
router.get('/:id/organizers', organizerController.getOrganizersByTournament);
router.get('/:id/my-role', verifyToken, organizerController.checkUserRole);
router.post('/:id/organizers', verifyToken, verifyAdminOrLeadOrganizer, organizerController.addOrganizer);
router.put('/:id/organizers/:organizerId', verifyToken, verifyAdminOrLeadOrganizer, organizerController.updateOrganizer);
router.delete('/:id/organizers/:organizerId', verifyToken, verifyAdminOrLeadOrganizer, organizerController.removeOrganizer);

export default router;
