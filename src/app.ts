import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middleware/error.middleware';
import { maintenanceGate } from './middleware/maintenance.middleware';

dotenv.config();

// Route imports
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import orderRoutes from './routes/order.routes';
import trackingRoutes from './routes/tracking.routes';
import paymentRoutes from './routes/payment.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import merchantRoutes from './routes/merchant.routes';
import attendanceRoutes from './routes/attendance.routes';
import complaintRoutes from './routes/complaint.routes';
import errorRoutes from './routes/error.routes';
import settingRoutes from './routes/setting.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kilatgo-backend', timestamp: new Date().toISOString() });
});

// Admin panel (CMS) — dibuild ke cms/dist saat deploy. __dirname = dist/ setelah tsc.
const cmsDist = path.join(__dirname, '../cms/dist');
app.use(express.static(cmsDist));
// SPA fallback: semua GET non-API kembalikan index.html (react-router). Di ATAS gate
// supaya panel admin tetap bisa dimuat untuk mematikan maintenance mode.
app.get(/^\/(?!api\/|api$|health$).*/, (_req, res) => res.sendFile(path.join(cmsDist, 'index.html')));

// Blokir request non-admin saat maintenance mode aktif
app.use(maintenanceGate);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/settings', settingRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Error handler
app.use(errorHandler);

export default app;
