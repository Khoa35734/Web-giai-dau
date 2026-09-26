import { Router } from 'express';
import * as teamRequestController from '../controllers/teamRequest.controller.ts';
import { verifyParticipantToken } from '../middleware/auth.ts';

const router = Router();

// Bắt buộc xác thực quyền sinh viên (Participant Token)
router.use(verifyParticipantToken);

// Sinh viên xem danh sách các yêu cầu gia nhập do chính mình đã gửi đi
router.get('/my-requests', teamRequestController.getMyJoinRequests);

// Sinh viên gửi yêu cầu xin gia nhập một đội đang tuyển quân
router.post('/', teamRequestController.createJoinRequest);
router.post('/registrations/:registrationId', teamRequestController.createJoinRequest);

// Lấy danh sách yêu cầu gia nhập của một đội cụ thể (Đội trưởng xem)
router.get('/registration/:registrationId', teamRequestController.listJoinRequestsForTeam);

// Đội trưởng Duyệt (accepted) hoặc Từ chối (rejected) yêu cầu gia nhập
router.put('/:requestId/process', teamRequestController.processJoinRequest);
router.put('/:requestId', teamRequestController.processJoinRequest);

// Sinh viên tự rút / hủy yêu cầu gia nhập đang chờ duyệt
router.put('/:requestId/cancel', teamRequestController.cancelJoinRequest);

export default router;
