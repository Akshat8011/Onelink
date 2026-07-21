import { create } from 'zustand';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';
import { useAuthStore } from './useAuthStore';
import { useNotificationsStore } from './useNotificationsStore';
import api from '../services/api';
import { isDemoMode } from '../services/demoMode';

export interface TicketReceipt {
  receiptId: string;
  ticketId: string;
  type: 'METRO' | 'BUS';
  from: string;
  to: string;
  fare: number;
  mode: string;
  paymentMode: string;
  bookedAt: string;
  validUntil: string;
  qrPayload: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
}

interface TicketsStore {
  tickets: TicketReceipt[];
  load: () => Promise<void>;
  reset: () => void;
  addTicket: (params: {
    type: 'METRO' | 'BUS';
    from: string;
    to: string;
    fare: number;
    mode: string;
  }) => TicketReceipt;
  getActiveTickets: () => TicketReceipt[];
  markUsed: (ticketId: string) => void;
}

const STORAGE_KEY = 'onelink_tickets';

function buildQrPayload(ticket: Omit<TicketReceipt, 'qrPayload' | 'receiptId'>): string {
  return JSON.stringify({
    v: 1,
    app: 'ONELINK',
    type: ticket.type,
    id: ticket.ticketId,
    from: ticket.from,
    to: ticket.to,
    fare: ticket.fare,
    mode: ticket.mode,
    issued: ticket.bookedAt,
    expires: ticket.validUntil,
    sig: ticket.ticketId.split('_').pop(),
  });
}

async function persist(tickets: TicketReceipt[]) {
  const userId = useAuthStore.getState().user?.userId;
  await setUserStorageItem(STORAGE_KEY, userId, JSON.stringify(tickets));
}

export const useTicketsStore = create<TicketsStore>((set, get) => ({
  tickets: [],

  reset: () => {
    set({ tickets: [] });
  },

  load: async () => {
    const userId = useAuthStore.getState().user?.userId;
    if (!isDemoMode()) {
      try {
        const { data } = await api.get('/v1/transit/tickets');
        if (data.success && Array.isArray(data.data)) {
          const tickets: TicketReceipt[] = data.data.map((t: any) => ({
            receiptId: t.ticketId,
            ticketId: t.ticketId,
            type: t.type || 'METRO',
            from: t.from,
            to: t.to,
            fare: t.fare,
            mode: 'METRO',
            paymentMode: 'OneLink Wallet',
            bookedAt: t.bookedAt || new Date().toISOString(),
            validUntil: t.validUntil,
            qrPayload: t.qrPayload,
            status: t.status === 'ENTRY_USED' ? 'ACTIVE' : t.status === 'COMPLETED' ? 'USED' : 'ACTIVE',
          }));
          set({ tickets });
          await persist(tickets);
          return;
        }
      } catch {
        /* local fallback */
      }
    }
    const raw = await getUserStorageItem(STORAGE_KEY, userId);
    if (raw) set({ tickets: JSON.parse(raw) });
    else set({ tickets: [] });
  },

  addTicket: ({ type, from, to, fare, mode }) => {
    const now = new Date();
    const validUntil = new Date(now.getTime() + 3600000);
    const ticketId = `TKT_${type}_${Date.now()}`;
    const base = {
      receiptId: `RCP_${Date.now()}`,
      ticketId,
      type,
      from,
      to,
      fare,
      mode,
      paymentMode: 'OneLink Wallet',
      bookedAt: now.toISOString(),
      validUntil: validUntil.toISOString(),
      status: 'ACTIVE' as const,
      qrPayload: '',
    };
    const ticket: TicketReceipt = { ...base, qrPayload: buildQrPayload(base) };

    const tickets = [ticket, ...get().tickets];
    set({ tickets });
    persist(tickets);

    useNotificationsStore.getState().add({
      title: `${type === 'METRO' ? 'Metro' : 'Bus'} ticket booked`,
      body: `${from} → ${to} · ₹${fare}`,
      type: 'TRANSIT',
      actionRoute: 'TicketDetail',
      actionParams: { ticketId: ticket.ticketId },
    });

    return ticket;
  },

  getActiveTickets: () =>
    get().tickets.filter((t) => t.status === 'ACTIVE' && new Date(t.validUntil) > new Date()),

  markUsed: (ticketId) => {
    const tickets = get().tickets.map((t) =>
      t.ticketId === ticketId ? { ...t, status: 'USED' as const } : t
    );
    set({ tickets });
    persist(tickets);
  },
}));
