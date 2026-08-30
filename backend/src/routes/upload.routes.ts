import { Router } from 'express';
import * as uploadController from '../controllers/upload.ts';
import { bannerUpload, documentUpload } from '../middleware/upload.ts';

const router = Router();

router.post('/banner', bannerUpload.single('banner'), uploadController.uploadBanner);
router.post('/document', documentUpload.single('file'), uploadController.uploadDocument);
router.post('/image', documentUpload.single('file'), uploadController.uploadDocument);

export default router;
