"use client"

import React, { useState } from "react"
import { openStore } from "@/utils/deepLinks"

interface CartItem    { query: string; qty: number }
interface PlatTotal   { platform: string; subtotal: number; item_count: number; delivery_mins: number }
interface CartResult  {
  pincode: string; elapsed_ms: number; demo_mode: boolean
  platform_totals: PlatTotal[]
  cheapest_platform: string; cheapest_total: number
}

const BRAND_BG: Record<string, string> = {
  Blinkit:   "bg-[#F8CB2E] text-[#1a1a1a]",
  Zepto:     "bg-[#6B21A8] text-white",
  Instamart: "bg-[#FC8019] text-white",
}
const BRAND_LIGHT: Record<string, string> = {
  Blinkit:   "bg-[#FFF9E6] border-[#F8CB2E]",
  Zepto:     "bg-purple-50 border-[#6B21A8]",
  Instamart: "bg-orange-50 border-[#FC8019]",
}
const BRAND_EMOJI: Record<string, string> = {
  Blinkit: "⚡", Zepto: "🚀", Instamart: "🛍",
}

export default function CartPanel({ apiBase }: { apiBase: string }) {
  const [pincode, setPincode] = useState("226001")
  const [items, setItems]     = useState<CartItem[]>([])
  const [draft, setDraft]     = useState("")
  const [draftQty, setDraftQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [result, setResult]   = useState<CartResult | null>(null)
  const [elapsed, setElapsed] = useState(0)

  function addItem() {
    const q = draft.trim()
    if (q.length < 2) return
    setItems(prev => {
      const existing = prev.findIndex(i => i.query.toLowerCase() === q.toLowerCase())
      if (existing >= 0) {
        const next = [...prev]
        next[existing].qty += draftQty
        return next
      }
      return [...prev, { query: q, qty: draftQty }]
    })
    setDraft("")
    setDraftQty(1)
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
    setResult(null)
  }

  async function compareCart() {
    if (!items.length) { setError("Add at least one item to compare"); return }
    if (pincode.length !== 6) { setError("Enter a valid 6-digit PIN code"); return }
    setLoading(true); setError(null); setResult(null); setElapsed(0)
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    try {
      const res = await fetch(`${apiBase}/api/compare/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, pincode, mode: "auto", format: "web", headless: true }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText)
      setResult(await res.json())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      clearInterval(t); setLoading(false)
    }
  }

  const savings = result && result.platform_totals.length >= 2
    ? result.platform_totals[result.platform_totals.length - 1].subtotal - result.platform_totals[0].subtotal
    : null

  return (
    <div className="space-y-4">
      {/* PIN code */}
      <div className="flex items-center gap-2">
        <span className="text-emerald-500 text-lg">📍</span>
        <input
          type="text" inputMode="numeric"
          value={pincode}
          onChange={e => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="PIN code"
          className="w-32 px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl
                     text-slate-800 text-sm font-mono focus:outline-none focus:border-emerald-400"
        />
        <span className="text-xs text-slate-500">Delivery location</span>
      </div>

      {/* Add item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem() }}}
          placeholder='Add item — e.g. "Maggi Noodles 70g"'
          className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl
                     text-slate-800 text-sm focus:outline-none focus:border-emerald-400"
        />
        <input
          type="number" min={1} max={99} value={draftQty}
          onChange={e => setDraftQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-14 px-2 py-3 bg-white border-2 border-slate-200 rounded-xl
                     text-slate-800 text-sm text-center focus:outline-none focus:border-emerald-400"
        />
        <button
          onClick={addItem}
          className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold"
        >
          + Add
        </button>
      </div>

      {/* Cart list */}
      {items.length > 0 && (
        <div className="bg-white border-2 border-slate-200 rounded-2xl divide-y divide-slate-100">
          <div className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            Your Cart · {items.length} item{items.length > 1 ? "s" : ""}
          </div>
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-sm font-medium text-slate-800">{item.query}</span>
                <span className="ml-2 text-xs text-slate-400">×{item.qty}</span>
              </div>
              <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-400 text-sm">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Compare button */}
      <button
        onClick={compareCart}
        disabled={loading || items.length === 0 || pincode.length !== 6}
        className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400
                   text-white font-bold rounded-2xl text-sm transition-all shadow-lg active:scale-98"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Comparing across platforms… {elapsed}s
          </span>
        ) : (
          `⚡ Compare Cart (${items.length} item${items.length !== 1 ? "s" : ""})`
        )}
      </button>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">⚠ {error}</p>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Platform Totals</h3>
            {result.demo_mode && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 font-semibold px-2 py-0.5 rounded-full">
                demo prices
              </span>
            )}
          </div>

          {/* Savings banner */}
          {savings != null && savings > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-center">
              <p className="text-sm font-bold text-emerald-700">
                🏆 Save ₹{savings.toFixed(0)} by choosing {result.cheapest_platform} over the most expensive option
              </p>
            </div>
          )}

          {/* Platform cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {result.platform_totals.map(t => {
              const isCheapest  = t.platform === result.cheapest_platform
              const lightClass  = BRAND_LIGHT[t.platform]  ?? "bg-slate-50 border-slate-300"
              const badgeClass  = BRAND_BG[t.platform]     ?? "bg-slate-600 text-white"
              const emoji       = BRAND_EMOJI[t.platform]  ?? "🛒"

              return (
                <div
                  key={t.platform}
                  onClick={() => openStore(t.platform, "")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.02]
                               ${lightClass} ${isCheapest ? "shadow-lg" : ""}`}
                >
                  {isCheapest && (
                    <div className="text-[10px] font-bold text-emerald-600 mb-2">🏆 CHEAPEST</div>
                  )}
                  <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass} mb-2`}>
                    {emoji} {t.platform.toUpperCase()}
                  </div>
                  <div className="text-3xl font-black text-slate-900">₹{t.subtotal.toFixed(0)}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t.item_count} item{t.item_count !== 1 ? "s" : ""} · {t.delivery_mins} min
                  </div>
                  <div className="mt-3 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                    Open store →
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
