import { Router } from 'express';
import * as authController from '../controllers/auth.ts';
import { verifyParticipantToken, verifyToken } from '../middleware/auth.ts';

const router = Router();

// =============================================================================
// ADMIN & CTV AUTH
// =============================================================================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getMe);

// =============================================================================
// STUDENT & PARTICIPANT AUTH [SV-01, SV-02, SV-03, SV-04]
// =============================================================================
router.post('/student/register', authController.studentRegister);
router.post('/student/login', authController.studentLogin);

// DUT & Free Aliases (backward compatibility)
router.post('/dut/register', authController.dutRegister);
router.post('/dut/login', authController.dutLogin);
router.post('/free/register', authController.freeRegister);
router.post('/free/login', authController.freeLogin);

// Participant Profile & KYC Resubmit
router.get('/participant/me', verifyParticipantToken, authController.getParticipantMe);
router.put('/participant/profile', verifyParticipantToken, authController.updateParticipantProfile);
router.post('/participant/resubmit', authController.resubmitParticipant);

export default router;
