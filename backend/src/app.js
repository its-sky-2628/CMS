import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.routes.js';
import complaintRoutes from './routes/complaint.routes.js';
import institutionRoutes from './routes/institution.routes.js';
import officerRoutes from './routes/officer.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import aiInsightsRoutes from './routes/ai-insights.routes.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const app = express();

// CORS — restricted to configured origins (no wildcard).
// In development, any localhost/127.0.0.1 port is accepted so the Vite dev
// server works whichever port it picks (5173, 5174, …).
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function isLocalDevOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      // allow same-origin / curl requests (no Origin header)
      if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AICTE Complaint Management API is running',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/officers', officerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai-insights', aiInsightsRoutes);

// Serve the built React frontend from the same Render service.
const frontendDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../dist'
);

app.use(express.static(frontendDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) next(err);
  });
});

// Centralized error handling
app.use(notFound);
app.use(errorHandler);

export default app;
