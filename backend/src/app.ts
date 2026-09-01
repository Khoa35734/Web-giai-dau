import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { errorHandler, notFoundHandler } from './middleware/error.ts';
import adminRoutes from './routes/admin.routes.ts';
import authRoutes from './routes/auth.routes.ts';
import registrationRoutes from './routes/registration.routes.ts';
import systemRoutes from './routes/system.routes.ts';
import tournamentRoutes from './routes/tournament.routes.ts';
import uploadRoutes from './routes/upload.routes.ts';

import { verifyAnyToken } from './middleware/auth.ts';
import { serveDocument } from './controllers/upload.ts';

export const app = express();

app.use(cors());
app.use(express.json());

// ===========================
// STATIC FILES & PUBLIC ASSETS
// ===========================
// Game logos (phải đặt trước các route khác)
app.use(
  '/api/logos',
  express.static(path.join(process.cwd(), 'logo'), {
    maxAge: '1h',
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=3600'),
  }),
);

// Banner uploads (Public assets)
app.use(
  '/api/banners',
  express.static(path.join(process.cwd(), 'uploads', 'banners'), { maxAge: '7d' }),
);

// General image uploads (Public assets)
app.use(
  '/api/images',
  express.static(path.join(process.cwd(), 'uploads', 'images'), { maxAge: '7d' }),
);

// ===========================
// PROTECTED DOCUMENTS [SRS 5.1, 5.2]
// Tuyệt đối không public static folder documents/ chứa thẻ SV & ảnh selfie KYC
// ===========================
app.get('/api/documents/:filename', verifyAnyToken, serveDocument);


// ===========================
// API ROUTES
// ===========================
app.use('/api', systemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// ===========================
// ERROR HANDLING
// ===========================
app.use(notFoundHandler);
app.use(errorHandler);
