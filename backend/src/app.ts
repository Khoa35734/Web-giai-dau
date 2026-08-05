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

export const app = express();

app.use(cors());
app.use(express.json());

// ===========================
// STATIC FILES
// ===========================
// Game logos (phải đặt trước các route khác)
app.use(
  '/api/logos',
  express.static(path.join(process.cwd(), 'logo'), {
    maxAge: '1h',
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=3600'),
  }),
);

// Banner uploads
app.use(
  '/api/banners',
  express.static(path.join(process.cwd(), 'uploads', 'banners'), { maxAge: '7d' }),
);

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
