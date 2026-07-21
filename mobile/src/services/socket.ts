import { io, Socket } from 'socket.io-client';

const SOCKET_URL = __DEV__
  ? 'http://localhost:5000'
  : 'https://onelink-fkqd.onrender.com';

export type SocketConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type StatusListener = (status: SocketConnectionStatus) => void;

class SocketService {
  private socket: Socket | null = null;
  private status: SocketConnectionStatus = 'disconnected';
  private listeners = new Set<StatusListener>();
  private boundUserId: string | null = null;

  private setStatus(next: SocketConnectionStatus) {
    if (this.status === next) return;
    this.status = next;
    this.listeners.forEach((fn) => {
      try {
        fn(next);
      } catch (e) {
        console.warn('[socket] status listener error', e);
      }
    });
  }

  /** Current connection state for stores/screens (no UI changes required to consume). */
  getConnectionStatus(): SocketConnectionStatus {
    return this.status;
  }

  /** Subscribe to connection state changes; returns unsubscribe function. */
  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /**
   * Connect to Socket.IO server and join user's room
   */
  connect(userId: string): Socket {
    this.boundUserId = userId;

    if (this.socket?.connected) {
      return this.socket;
    }

    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
      });

      this.socket.on('connect', () => {
        console.log('📡 Socket connected:', this.socket?.id);
        this.setStatus('connected');
        if (this.boundUserId) {
          this.socket?.emit('join', this.boundUserId);
        }
      });

      this.socket.io.on('reconnect_attempt', (attempt) => {
        console.log('📡 Socket reconnecting, attempt', attempt);
        this.setStatus('reconnecting');
      });

      this.socket.on('disconnect', (reason) => {
        console.log('📡 Socket disconnected:', reason);
        // If socket still exists and we did not call disconnect(), Socket.IO will retry.
        this.setStatus(this.socket ? 'reconnecting' : 'disconnected');
      });

      this.socket.on('connect_error', (error) => {
        console.error('📡 Socket connection error:', error.message);
        this.setStatus('reconnecting');
      });
    }

    this.setStatus('connecting');
    if (!this.socket.connected) {
      this.socket.connect();
    }

    return this.socket;
  }

  /**
   * Get the current socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.boundUserId = null;
    this.setStatus('disconnected');
  }

  /**
   * Listen for a specific event
   */
  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  /**
   * Remove listener for a specific event
   */
  off(event: string): void {
    this.socket?.off(event);
  }
}

export const socketService = new SocketService();
