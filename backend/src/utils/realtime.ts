import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setRealtimeIO(io: SocketIOServer): void {
  ioInstance = io;
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  ioInstance?.to(userId).emit(event, data);
}

export function emitBroadcast(event: string, data: unknown): void {
  ioInstance?.emit(event, data);
}
