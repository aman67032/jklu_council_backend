import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database.js';
import initDatabase from './config/initDatabase.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import eventRoutes from './routes/events.js';
import councilRoutes from './routes/councils.js';
import clubRoutes from './routes/clubs.js';
import certificateRoutes from './routes/certificates.js';
import analyticsRoutes from './routes/analytics.js';
import coordinatorRoutes from './routes/coordinators.js';
import notificationRoutes from './routes/notifications.js';
// Import reminder scheduler
import { startReminderScheduler } from './utils/reminderScheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'JKLU Council API is running',
    health: '/health',
    api: '/api'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/councils', councilRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/coordinators', coordinatorRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database
let dbInitialized = false;
const initialize = async () => {
  if (dbInitialized) return;
  try {
    await initDatabase();
    startReminderScheduler();
    dbInitialized = true;
    console.log('✅ Database initialized and scheduler started');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
};

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  await initialize();
  next();
});

// Start server locally
if (process.env.NODE_ENV !== 'production') {
  const startServer = async () => {
    try {
      await initialize();
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🌐 API available at http://localhost:${PORT}/api`);
      });
    } catch (error) {
      console.error('Failed to start local server:', error);
    }
  };
  startServer();
}

export default app;

