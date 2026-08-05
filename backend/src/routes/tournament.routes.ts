import { Router } from 'express';
import * as tournamentController from '../controllers/tournament.ts';
import * as registrationController from '../controllers/registration.ts';
import { verifyAdmin, verifyCTV, verifyToken } from '../middleware/auth.ts';

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

export default router;
