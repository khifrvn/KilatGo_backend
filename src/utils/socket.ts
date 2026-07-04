import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { TokenPayload } from './jwt';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

interface LocationUpdatePayload {
  orderId?: string;
  latitude: number;
  longitude: number;
}

export function setupSocketHandlers(io: SocketIOServer): void {
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as TokenPayload;
    console.log(`Socket connected: ${user.userId} (${user.role})`);

    // Join personal room for targeted notifications
    socket.join(`user:${user.userId}`);

    // Driver specific handlers
    if (user.role === UserRole.DRIVER) {
      setupDriverHandlers(socket, io);
    }

    // Customer specific handlers
    if (user.role === UserRole.CUSTOMER) {
      setupCustomerHandlers(socket);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user.userId}`);
    });
  });
}

function setupDriverHandlers(socket: Socket, io: SocketIOServer): void {
  socket.on('driver:online', async () => {
    await updateDriverStatus(socket.data.user.userId, 'ONLINE');
    socket.emit('driver:status', { status: 'ONLINE' });
  });

  socket.on('driver:offline', async () => {
    await updateDriverStatus(socket.data.user.userId, 'OFFLINE');
    socket.emit('driver:status', { status: 'OFFLINE' });
  });

  socket.on('driver:location', async (payload: LocationUpdatePayload) => {
    try {
      const { orderId, latitude, longitude } = payload;
      const driver = await prisma.driver.findUnique({
        where: { userId: socket.data.user.userId },
      });

      if (!driver) {
        socket.emit('error', { message: 'Driver profile not found' });
        return;
      }

      // Update driver current location
      await prisma.driver.update({
        where: { id: driver.id },
        data: {
          latitude,
          longitude,
          lastLocationAt: new Date(),
        },
      });

      // Save tracking log if orderId provided
      if (orderId) {
        await prisma.tracking.create({
          data: {
            orderId,
            driverId: driver.id,
            latitude,
            longitude,
          },
        });

        // Broadcast to order room
        io.to(`order:${orderId}`).emit('order:location', {
          orderId,
          driverId: driver.id,
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
        });
      }

      socket.emit('driver:location:ack', { received: true });
    } catch (error) {
      console.error('Error handling driver location:', error);
      socket.emit('error', { message: 'Failed to process location update' });
    }
  });
}

function setupCustomerHandlers(socket: Socket): void {
  socket.on('customer:track', (payload: { orderId: string }) => {
    const { orderId } = payload;
    socket.join(`order:${orderId}`);
    socket.emit('customer:tracking', { orderId, status: 'subscribed' });
  });

  socket.on('customer:stop_track', (payload: { orderId: string }) => {
    const { orderId } = payload;
    socket.leave(`order:${orderId}`);
    socket.emit('customer:tracking', { orderId, status: 'unsubscribed' });
  });
}

async function updateDriverStatus(userId: string, status: 'ONLINE' | 'OFFLINE') {
  await prisma.driver.update({
    where: { userId },
    data: { status },
  });
}
