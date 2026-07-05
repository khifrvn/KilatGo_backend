import { Request, Response, NextFunction } from 'express';
import * as attendanceService from '../services/attendance.service';
import { successResponse, errorResponse } from '../utils/response';

export async function checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lat = Number(req.body.latitude);
    const lng = Number(req.body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      errorResponse(res, 'latitude & longitude wajib', 400);
      return;
    }
    const selfiePhoto = (req.file as Express.Multer.File | undefined)?.filename;
    const record = await attendanceService.checkIn(req.user!.userId, {
      latitude: lat,
      longitude: lng,
      selfiePhoto,
      faceDescriptor: req.body.faceDescriptor,
    });
    successResponse(res, 'Absen tercatat', record, 201);
  } catch (error) {
    next(error);
  }
}

export async function enrollFace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.body?.faceDescriptor) {
      errorResponse(res, 'faceDescriptor wajib', 400);
      return;
    }
    const result = await attendanceService.enrollFace(req.user!.userId, req.body.faceDescriptor);
    successResponse(res, 'Wajah referensi tersimpan', result);
  } catch (error) {
    next(error);
  }
}

export async function myAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await attendanceService.listMyAttendance(req.user!.userId);
    successResponse(res, 'Riwayat absen', data);
  } catch (error) {
    next(error);
  }
}

export async function adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await attendanceService.listAllAttendance({ date: req.query.date as string | undefined });
    successResponse(res, 'Log absen', data);
  } catch (error) {
    next(error);
  }
}
