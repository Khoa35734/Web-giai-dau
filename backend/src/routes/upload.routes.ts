import { Router } from 'express';
import * as uploadController from '../controllers/upload.ts';
import { bannerUpload } from '../middleware/upload.ts';

const router = Router();

router.post('/banner', bannerUpload.single('banner'), uploadController.uploadBanner);

export default router;
