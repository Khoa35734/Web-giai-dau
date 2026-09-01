import { Router } from 'express';
import * as uploadController from '../controllers/upload.ts';
import { bannerUpload, documentUpload, imageUpload } from '../middleware/upload.ts';
import { verifyToken, verifyAnyToken } from '../middleware/auth.ts';

const router = Router();

/** Upload banner giải đấu — chỉ admin/CTV [SRS 5.1] */
router.post('/banner', verifyToken, bannerUpload.single('banner'), uploadController.uploadBanner);

/** Upload tài liệu / Thẻ sinh viên & Selfie KYC [SV-01, SV-04, SRS 5.1] — cần đăng nhập (admin/CTV/participant) */
router.post('/document', verifyAnyToken, documentUpload.single('file'), uploadController.uploadDocument);

/** Upload hình ảnh thông dụng — cần đăng nhập [SRS 5.1] */
router.post('/image', verifyAnyToken, imageUpload.single('file'), uploadController.uploadImage);

export default router;
