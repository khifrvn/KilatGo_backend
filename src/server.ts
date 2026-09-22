import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { setupSocketHandlers } from './utils/socket';
import { startSweeper } from './services/dispatch.service';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

setupSocketHandlers(io);
startSweeper(); // auto-dispatch: lempar order ke driver berikutnya saat timeout

server.listen(PORT, () => {
  console.log(`🚀 KilatGo backend running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

export { io };
