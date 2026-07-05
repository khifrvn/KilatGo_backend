import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { singlePhotoUpload } from '../config/upload';
import { UserRole } from '@prisma/client';

const router = Router();

// Driver: absen masuk (selfie + GPS) & riwayat sendiri
router.post('/checkin', authenticateToken, authorizeRoles(UserRole.DRIVER), singlePhotoUpload, attendanceController.checkIn);
router.get('/me', authenticateToken, authorizeRoles(UserRole.DRIVER), attendanceController.myAttendance);

export default router;
