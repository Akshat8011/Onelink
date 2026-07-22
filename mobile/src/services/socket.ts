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
  /** When true, we intentionally closed the socket — do not auto-reconnect (saves Render hours). */
  private intentionallyDisconnected = true;

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

  private ensureSocket(): Socket {
    if (this.socket) return this.socket;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      // Finite retries — infinite reconnect wakes a sleeping Render free tier forever.
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });

    this.socket.on('connect', () => {
      console.log('📡 Socket connected:', this.socket?.id);
      this.setStatus('connected');
      if (this.boundUserId) {
        this.socket?.emit('join', this.boundUserId);
      }
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      if (this.intentionallyDisconnected) return;
      console.log('📡 Socket reconnecting, attempt', attempt);
      this.setStatus('reconnecting');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('📡 Socket disconnected:', reason);
      if (this.intentionallyDisconnected || !this.socket) {
        this.setStatus('disconnected');
        return;
      }
      this.setStatus('reconnecting');
    });

    this.socket.on('connect_error', (error) => {
      if (this.intentionallyDisconnected) return;
      console.error('📡 Socket connection error:', error.message);
      this.setStatus('reconnecting');
    });

    return this.socket;
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
    this.intentionallyDisconnected = false;

    const socket = this.ensureSocket();
    socket.io.reconnection(true);

    if (socket.connected) {
      socket.emit('join', userId);
      this.setStatus('connected');
      return socket;
    }

    this.setStatus('connecting');
    socket.connect();
    return socket;
  }

  /**
   * Get the current socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Pause the socket (app background). Keeps handlers; stops reconnect until connect() again.
   */
  pause(): void {
    this.intentionallyDisconnected = true;
    if (!this.socket) {
      this.setStatus('disconnected');
      return;
    }
    this.socket.io.reconnection(false);
    this.socket.disconnect();
    this.setStatus('disconnected');
  }

  /**
   * Fully disconnect (logout). Clears user binding; event handlers stay on the instance
   * until the next connect creates/reuses the socket via ensureSocket.
   */
  disconnect(): void {
    this.intentionallyDisconnected = true;
    this.boundUserId = null;
    if (this.socket) {
      this.socket.io.reconnection(false);
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  /**
   * Listen for a specific event
   */
  on(event: string, callback: (...args: any[]) => void): void {
    this.ensureSocket().on(event, callback);
  }

  /**
   * Remove listener for a specific event
   */
  off(event: string): void {
    this.socket?.off(event);
  }
}

export const socketService = new SocketService();
