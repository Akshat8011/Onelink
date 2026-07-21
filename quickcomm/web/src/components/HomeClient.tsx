"use client"

import React, { useState, useEffect, useRef } from "react"
import SearchBar from "@/components/SearchBar"
import ComparisonGrid, { CompareResponse } from "@/components/ComparisonGrid"
import CartPanel from "@/components/CartPanel"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001"

type Tab = "search" | "cart"

// ── Cart state ─────────────────────────────────────────────────────────────────

interface CartEntry { name: string; platform: string; price: number }

export default function HomeClient() {
  const [tab,        setTab]        = useState<Tab>("search")
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [data,       setData]       = useState<CompareResponse | null>(null)
  const [lastQuery,  setLastQuery]  = useState("")
  const [elapsed,    setElapsed]    = useState(0)
  const [apiOnline,  setApiOnline]  = useState<boolean | null>(null)
  const [cart,       setCart]       = useState<CartEntry[]>([])
  const [cartNotif,  setCartNotif]  = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/health`).then(r => setApiOnline(r.ok)).catch(() => setApiOnline(false))
  }, [])

  function startTimer() {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function addToCart(name: string, platform: string, price: number) {
    setCart(prev => {
      const ex = prev.findIndex(c => c.name === name && c.platform === platform)
      if (ex >= 0) return prev
      return [...prev, { name, platform, price }]
    })
    setCartNotif(`Added ${name} (${platform}) to cart`)
    setTimeout(() => setCartNotif(null), 2500)
  }

  async function handleSearch(query: string, pincode: string) {
    setLoading(true); setError(null); setData(null); setLastQuery(query); startTimer()
    try {
      const res = await fetch(`${API_BASE}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query, pincode,
          max_results_per_platform: 6,
          headless: true, mode: "auto", format: "web",
        }),
      })
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))).detail ?? res.statusText
        throw new Error(detail)
      }
      setData(await res.json())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      stopTimer(); setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>

      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center
                            text-white font-black text-base shadow">Q</div>
            <div>
              <span className="font-black text-slate-900 text-base">QuickComm</span>
              <span className="text-slate-400 text-xs ml-2 hidden sm:inline">
                Blinkit · Zepto · Instamart
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/shop"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white
                         rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              🛒 Supermarket
            </a>
            {/* Cart badge */}
            {cart.length > 0 && (
              <button
                onClick={() => setTab("cart")}
                className="relative flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white
                           rounded-xl text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                🛒 Cart
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px]
                                 font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {cart.length}
                </span>
              </button>
            )}

            {/* API status */}
            {apiOnline !== null && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                apiOnline
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}>
                {apiOnline ? "● Live" : "● Offline"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Cart notification toast */}
      {cartNotif && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl">
          ✓ {cartNotif}
        </div>
      )}

      {/* Hero */}
      <section className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-8">
          <div className="text-center mb-8">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">
              India's Price Comparison Engine
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
              Find the <span className="text-emerald-500">cheapest</span> grocery
              <br className="hidden sm:block" /> across all platforms
            </h1>
            <p className="mt-3 text-slate-500 text-sm max-w-lg mx-auto">
              Search any product or build a cart — we compare Blinkit, Zepto &amp; Instamart
              in real time and show you where to buy.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 justify-center mb-6">
            {([["search", "🔍 Single Item"], ["cart", "🛒 Cart Compare"]] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all border-2 ${
                  tab === t
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {label}
                {t === "cart" && cart.length > 0 && (
                  <span className="ml-1.5 bg-emerald-500 text-white text-[10px] font-black
                                   px-1.5 py-0.5 rounded-full">{cart.length}</span>
                )}
              </button>
            ))}
          </div>

          {tab === "search" && <SearchBar onSearch={handleSearch} loading={loading} />}
          {tab === "cart"   && <CartPanel apiBase={API_BASE} />}
        </div>
      </section>

      {/* Results */}
      {tab === "search" && (
        <main className="max-w-5xl mx-auto px-4 py-8 pb-20">

          {/* API offline banner */}
          {apiOnline === false && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 text-sm mb-6 shadow-sm">
              <p className="font-bold mb-1">⚠ API server not running</p>
              <p className="text-amber-700 text-xs">
                Start it:{" "}
                <code className="bg-amber-100 px-2 py-0.5 rounded font-mono text-xs">
                  cd C:\Users\DELL\Onelink\quickcomm &amp; python -m uvicorn api:app --reload --port 8001
                </code>
              </p>
              <p className="text-amber-600 text-xs mt-1">
                Showing demo prices until API is online.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-sm mb-6 flex items-start gap-2 shadow-sm">
              <span>⚠️</span>
              <div>
                <p className="font-semibold">Something went wrong</p>
                <p className="text-red-600 mt-0.5 text-xs">{error}</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <svg className="animate-spin w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="font-semibold text-slate-700">Searching all platforms for "{lastQuery}"…</span>
                </div>
                <div className="flex justify-center gap-6 text-xs text-slate-400">
                  <span>⚡ Blinkit</span>
                  <span>🚀 Zepto</span>
                  <span>🛍 Instamart</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {elapsed}s · Live scraping takes ~30–60s, then falls back to demo prices
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl h-52 animate-pulse border border-slate-200 shadow-sm" />
                ))}
              </div>
            </div>
          )}

          {data && !loading && (
            <ComparisonGrid data={data} query={lastQuery} onAddToCart={addToCart} />
          )}

          {!data && !loading && !error && (
            <div className="text-center py-24 text-slate-400">
              <div className="grid grid-cols-3 gap-6 max-w-sm mx-auto mb-8 opacity-40">
                {[["⚡", "#F8CB2E", "Blinkit"], ["🚀", "#6B21A8", "Zepto"], ["🛍", "#FC8019", "Instamart"]].map(([e, c, n]) => (
                  <div key={n} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                         style={{ background: c + "22" }}>
                      {e}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{n}</span>
                  </div>
                ))}
              </div>
              <p className="font-semibold text-slate-500">Search any product above to compare prices</p>
              <p className="text-xs mt-1 text-slate-400">e.g. "Biscuit", "Amul Milk 500ml", "Maggi"</p>
            </div>
          )}
        </main>
      )}
    </div>
  )
}
