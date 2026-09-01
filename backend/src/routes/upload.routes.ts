import { Router } from 'express';
import * as uploadController from '../controllers/upload.ts';
import { bannerUpload, documentUpload, imageUpload } from '../middleware/upload.ts';

const router = Router();

/** Upload banner giải đấu */
router.post('/banner', bannerUpload.single('banner'), uploadController.uploadBanner);

/** Upload tài liệu / Thẻ sinh viên & Selfie KYC [SV-01, SV-04] */
router.post('/document', documentUpload.single('file'), uploadController.uploadDocument);

/** Upload hình ảnh thông dụng */
router.post('/image', imageUpload.single('file'), uploadController.uploadImage);

export default router;
