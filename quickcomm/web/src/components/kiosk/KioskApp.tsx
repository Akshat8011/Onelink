'use client';

import { useCallback, useEffect } from 'react';
import { useKioskStore } from '../../store/kioskStore';
import { checkCard, pairCard, processPayment } from '../../lib/kioskApi';

const WS_URL = process.env.NEXT_PUBLIC_KIOSK_WS_URL || 'ws://127.0.0.1:8765';

function StatusBar() {
  const wsConnected = useKioskStore((s) => s.wsConnected);
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
      <span className="font-bold text-indigo-300">OneLink POS</span>
      <span className={wsConnected ? 'text-emerald-400' : 'text-amber-400'}>
        {wsConnected ? '● Reader online' : '○ Reader offline'}
      </span>
    </div>
  );
}

function IdleScreen() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4 text-center">
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-indigo-400 flex items-center justify-center animate-pulse">
        <span className="text-2xl">📡</span>
      </div>
      <h1 className="text-xl font-bold text-white">Tap Card to Start</h1>
      <p className="text-xs text-slate-400">Hold your OneLink card near the reader</p>
    </div>
  );
}

function CheckingScreen() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3">
      <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-300">Verifying card…</p>
    </div>
  );
}

function PairingScreen() {
  const cardUid = useKioskStore((s) => s.cardUid);
  const digits = useKioskStore((s) => s.pairingDigits);
  const error = useKioskStore((s) => s.error);
  const append = useKioskStore((s) => s.appendPairingDigit);
  const backspace = useKioskStore((s) => s.backspacePairingDigit);
  const clear = useKioskStore((s) => s.clearPairingDigits);
  const reset = useKioskStore((s) => s.reset);

  const submit = useCallback(async () => {
    if (!cardUid || digits.length !== 10) return;
    const { ok, data } = await pairCard(digits, cardUid);
    if (ok && data.success) {
      useKioskStore.getState().setPairingSuccess(data.name, data.balance);
    } else {
      useKioskStore.getState().setPairingError(data.error || 'Pairing failed');
    }
  }, [cardUid, digits]);

  useEffect(() => {
    if (digits.length === 10) submit();
  }, [digits, submit]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  return (
    <div className="flex flex-col flex-1 px-3 py-2 gap-2 min-h-0">
      <div className="text-center">
        <h2 className="text-base font-bold text-white">Link Your Card</h2>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Card {cardUid} · Enter 10-digit code from app
        </p>
      </div>

      <div className="flex justify-center gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`w-5 h-7 rounded border flex items-center justify-center text-xs font-mono ${
              i < digits.length ? 'border-indigo-400 bg-indigo-950 text-white' : 'border-slate-600 text-slate-600'
            }`}
          >
            {digits[i] ? '•' : ''}
          </div>
        ))}
      </div>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}

      <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === 'C') clear();
              else if (key === '⌫') backspace();
              else append(key);
            }}
            className="rounded-lg bg-slate-800 active:bg-slate-700 text-white text-lg font-semibold min-h-[44px] touch-manipulation"
          >
            {key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={reset}
        className="text-xs text-slate-500 py-1 touch-manipulation"
      >
        Cancel
      </button>
    </div>
  );
}

function HomeScreen() {
  const userName = useKioskStore((s) => s.userName);
  const balance = useKioskStore((s) => s.balance);
  const services = useKioskStore((s) => s.services);
  const selectService = useKioskStore((s) => s.selectService);
  const reset = useKioskStore((s) => s.reset);

  const serviceStyles: Record<string, string> = {
    metro_entry: 'from-blue-600 to-blue-800',
    main_kiosk: 'from-emerald-600 to-emerald-800',
  };

  return (
    <div className="flex flex-col flex-1 px-3 py-2 gap-2 min-h-0">
      <div className="rounded-xl bg-slate-800/80 px-3 py-2">
        <p className="text-[10px] text-slate-400 uppercase">Welcome</p>
        <p className="text-sm font-bold text-white truncate">{userName}</p>
        <p className="text-lg font-bold text-emerald-400">₹{balance.toLocaleString('en-IN')}</p>
      </div>

      <p className="text-xs text-slate-400 text-center">Select a service</p>

      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        {services.map((svc) => (
          <button
            key={svc.id}
            type="button"
            onClick={() => selectService(svc)}
            className={`rounded-xl bg-gradient-to-br ${serviceStyles[svc.id] || 'from-slate-600 to-slate-800'} p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform touch-manipulation min-h-[72px]`}
          >
            <span className="text-sm font-bold text-white">{svc.label}</span>
            <span className="text-xs text-white/80">₹{svc.amount}</span>
          </button>
        ))}
      </div>

      <button type="button" onClick={reset} className="text-xs text-slate-500 py-1 touch-manipulation">
        Done · Tap next card
      </button>
    </div>
  );
}

function ConfirmScreen() {
  const selected = useKioskStore((s) => s.selectedService);
  const balance = useKioskStore((s) => s.balance);
  const cardUid = useKioskStore((s) => s.cardUid);
  const setProcessing = useKioskStore((s) => s.setProcessing);
  const setPaymentResult = useKioskStore((s) => s.setPaymentResult);
  const reset = useKioskStore((s) => s.reset);

  if (!selected || !cardUid) return null;

  const confirm = async () => {
    setProcessing();
    const { ok, data } = await processPayment(cardUid, selected.id);
    if (ok && data.success) {
      setPaymentResult(true, `Paid ₹${data.amount}`, data.balanceAfter);
    } else {
      setPaymentResult(false, data.error || 'Payment failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4">
      <h2 className="text-lg font-bold text-white">Confirm Payment</h2>
      <div className="rounded-xl bg-slate-800 w-full p-4 text-center space-y-1">
        <p className="text-sm text-slate-300">{selected.label}</p>
        <p className="text-3xl font-bold text-white">₹{selected.amount}</p>
        <p className="text-xs text-slate-400">Balance: ₹{balance.toLocaleString('en-IN')}</p>
      </div>
      <div className="flex gap-2 w-full">
        <button
          type="button"
          onClick={reset}
          className="flex-1 py-3 rounded-xl bg-slate-700 text-white text-sm font-semibold touch-manipulation"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold touch-manipulation active:bg-indigo-500"
        >
          Pay ₹{selected.amount}
        </button>
      </div>
    </div>
  );
}

function ProcessingScreen() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3">
      <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-300">Processing payment…</p>
    </div>
  );
}

function ResultScreen() {
  const resultMessage = useKioskStore((s) => s.resultMessage);
  const error = useKioskStore((s) => s.error);
  const balance = useKioskStore((s) => s.balance);
  const reset = useKioskStore((s) => s.reset);
  const success = !error;

  useEffect(() => {
    const timer = setTimeout(reset, 4000);
    return () => clearTimeout(timer);
  }, [reset]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4 text-center">
      <span className="text-4xl">{success ? '✅' : '❌'}</span>
      <h2 className={`text-lg font-bold ${success ? 'text-emerald-400' : 'text-red-400'}`}>
        {resultMessage}
      </h2>
      {success && <p className="text-sm text-slate-300">New balance: ₹{balance.toLocaleString('en-IN')}</p>}
      <button
        type="button"
        onClick={reset}
        className="mt-2 px-6 py-2 rounded-xl bg-slate-700 text-white text-sm touch-manipulation"
      >
        Continue
      </button>
    </div>
  );
}

export default function KioskApp() {
  const step = useKioskStore((s) => s.step);
  const cardUid = useKioskStore((s) => s.cardUid);
  const terminalId = useKioskStore((s) => s.terminalId);
  const handleCardTap = useKioskStore((s) => s.handleCardTap);
  const setChecking = useKioskStore((s) => s.setChecking);
  const setCheckResult = useKioskStore((s) => s.setCheckResult);
  const setWsConnected = useKioskStore((s) => s.setWsConnected);

  const onCardTap = useCallback(
    async (cardUid: string, terminalId?: string) => {
      handleCardTap(cardUid, terminalId);
      setChecking();
      const { data } = await checkCard(cardUid, terminalId);
      if (data.success !== false) {
        setCheckResult(data as Parameters<typeof setCheckResult>[0]);
      } else {
        useKioskStore.getState().setPaymentResult(false, data.error || 'Could not verify card');
      }
    },
    [handleCardTap, setChecking, setCheckResult],
  );

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => setWsConnected(true);

        ws.onclose = () => {
          setWsConnected(false);
          retryTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws?.close();

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'card_tap' && msg.cardUid) {
              onCardTap(msg.cardUid, msg.terminalId || msg.node);
            }
          } catch {
            /* ignore malformed messages */
          }
        };
      } catch {
        retryTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [onCardTap, setWsConnected]);

  // While a card is active on the home screen, keep the balance in sync with the
  // shared wallet so changes made in the mobile webapp (spends, top-ups,
  // investments, bill payments) are reflected here without a re-tap.
  useEffect(() => {
    if (step !== 'home' || !cardUid) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await checkCard(cardUid, terminalId);
        if (cancelled) return;
        if (data && data.success !== false && data.registered && !data.blocked) {
          useKioskStore.getState().syncBalance(data.balance ?? 0, data.services);
        }
      } catch {
        /* transient network error — try again on the next tick */
      }
    };
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, cardUid, terminalId]);

  return (
    <div className="h-dvh w-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      <StatusBar />
      {step === 'idle' && <IdleScreen />}
      {step === 'checking' && <CheckingScreen />}
      {step === 'pairing' && <PairingScreen />}
      {step === 'home' && <HomeScreen />}
      {step === 'confirm' && <ConfirmScreen />}
      {step === 'processing' && <ProcessingScreen />}
      {step === 'result' && <ResultScreen />}
    </div>
  );
}
