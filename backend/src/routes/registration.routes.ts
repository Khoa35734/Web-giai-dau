import { Router } from 'express';
import * as registrationController from '../controllers/registration.ts';
import { verifyAdmin, verifyParticipantToken, verifyToken } from '../middleware/auth.ts';

const router = Router();

// Participant — đăng ký tham gia giải đấu
router.post('/', verifyParticipantToken, registrationController.create);
router.post('/team', verifyParticipantToken, registrationController.create);

// Auth required
router.get('/', verifyToken, verifyAdmin, registrationController.listAll);
router.put('/:id', verifyToken, verifyAdmin, registrationController.updateStatus);
router.delete('/:id', verifyToken, registrationController.remove);
router.get('/my-registrations', verifyToken, registrationController.myRegistrations);
router.get('/my-tournaments', verifyToken, registrationController.myTournaments);

export default router;
