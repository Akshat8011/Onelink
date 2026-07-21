"use client"

import React, { useState } from "react"
import { openStore } from "@/utils/deepLinks"

export interface PlatformEntry {
  platform:      string
  price:         number | null
  mrp:           number | null
  delivery_mins: number | null
  image_url:     string
  weight:        string
  deep_link:     string
  source_url:    string
  discount_pct?: number
}

export interface ComparisonRow {
  canonical_name:   string
  canonical_weight: string
  best_price:       number | null
  best_platform:    string
  platforms:        PlatformEntry[]
}

export interface CompareResponse {
  query:         string
  pincode:       string
  elapsed_ms:    number
  total_results: number
  demo_mode?:    boolean
  groups:        ComparisonRow[]
}

// ── Platform brand config ─────────────────────────────────────────────────────

const BRANDS: Record<string, {
  bg: string; text: string; light: string; border: string; ring: string; emoji: string; name: string
}> = {
  Blinkit: {
    bg:     "bg-[#F8CB2E]",
    text:   "text-[#1a1a1a]",
    light:  "bg-[#FFF9E6]",
    border: "border-[#F8CB2E]",
    ring:   "ring-[#F8CB2E]/40",
    emoji:  "⚡",
    name:   "Blinkit",
  },
  Zepto: {
    bg:     "bg-[#6B21A8]",
    text:   "text-white",
    light:  "bg-purple-50",
    border: "border-[#6B21A8]",
    ring:   "ring-[#6B21A8]/40",
    emoji:  "🚀",
    name:   "Zepto",
  },
  Instamart: {
    bg:     "bg-[#FC8019]",
    text:   "text-white",
    light:  "bg-orange-50",
    border: "border-[#FC8019]",
    ring:   "ring-[#FC8019]/40",
    emoji:  "🛍",
    name:   "Instamart",
  },
}

const D = (p: string) => BRANDS[p] ?? {
  bg: "bg-slate-600", text: "text-white", light: "bg-slate-100",
  border: "border-slate-400", ring: "ring-slate-400/40", emoji: "🛒", name: p,
}

// ── Platform badge ─────────────────────────────────────────────────────────────

function Badge({ platform }: { platform: string }) {
  const b = D(platform)
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${b.bg} ${b.text}`}>
      {b.emoji} {platform.toUpperCase()}
    </span>
  )
}

// ── Product card (per platform) ───────────────────────────────────────────────

function ProductCard({
  entry, query, isBest, onAdd,
}: {
  entry: PlatformEntry
  query: string
  isBest: boolean
  onAdd?: (entry: PlatformEntry) => void
}) {
  const b = D(entry.platform)
  const disc = entry.mrp && entry.price && entry.mrp > entry.price
    ? Math.round((1 - entry.price / entry.mrp) * 100)
    : (entry.discount_pct || 0)

  return (
    <div className={`relative flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm
                     border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
                     ${isBest ? `${b.border} shadow-md ring-2 ${b.ring}` : "border-slate-200"}`}>
      {/* Best price ribbon */}
      {isBest && (
        <div className={`absolute top-0 left-0 right-0 text-[10px] font-bold text-center py-0.5 ${b.bg} ${b.text}`}>
          BEST PRICE
        </div>
      )}

      {/* Discount badge */}
      {disc > 0 && (
        <div className="absolute top-2 left-2 z-10 bg-emerald-500 text-white text-[10px] font-bold
                        px-1.5 py-0.5 rounded-full shadow">
          {disc}% OFF
        </div>
      )}

      {/* Product image */}
      <div className={`flex items-center justify-center ${isBest ? "pt-5" : "pt-2"} pb-2 px-4 bg-slate-50 min-h-[110px]`}>
        {entry.image_url ? (
          <img
            src={entry.image_url}
            alt={entry.platform}
            className="h-24 w-24 object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        ) : (
          <span className="text-5xl opacity-30">{b.emoji}</span>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 gap-2">
        {/* Platform tag */}
        <Badge platform={entry.platform} />

        {/* Weight */}
        {entry.weight && (
          <p className="text-xs text-slate-500 font-medium">{entry.weight}</p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-1.5">
          {entry.price != null ? (
            <>
              <span className="text-xl font-black text-slate-900">₹{entry.price.toFixed(0)}</span>
              {entry.mrp && entry.mrp > entry.price && (
                <span className="text-xs text-slate-400 line-through">₹{entry.mrp.toFixed(0)}</span>
              )}
            </>
          ) : (
            <span className="text-sm text-slate-400">Not available</span>
          )}
        </div>

        {/* Delivery time */}
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>🕐</span>
          <span>{entry.delivery_mins ?? 10} min delivery</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={() => openStore(entry.platform, query, entry.source_url)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                        border-2 ${b.border} text-slate-700 hover:${b.bg} hover:${b.text}
                        active:scale-95`}
          >
            View
          </button>
          {onAdd && entry.price != null && (
            <button
              onClick={() => onAdd(entry)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                          ${b.bg} ${b.text} active:scale-95 hover:opacity-90`}
            >
              + Cart
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Per-product group row ─────────────────────────────────────────────────────

function ProductGroup({
  row, query, onAddToCart, defaultOpen,
}: {
  row: ComparisonRow
  query: string
  onAddToCart?: (name: string, platform: string, price: number) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const savings = (() => {
    const prices = row.platforms.map(p => p.price).filter(Boolean) as number[]
    if (prices.length < 2) return null
    return Math.round(Math.max(...prices) - Math.min(...prices))
  })()

  function handleAdd(entry: PlatformEntry) {
    if (entry.price != null && onAddToCart) {
      onAddToCart(row.canonical_name, entry.platform, entry.price)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm
                    hover:shadow-md transition-shadow">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        {/* Thumbnail from best platform */}
        {row.platforms[0]?.image_url && (
          <img
            src={row.platforms[0].image_url}
            alt=""
            className="w-12 h-12 object-contain rounded-xl bg-slate-100 flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-sm truncate leading-tight">
            {row.canonical_name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {row.canonical_weight && (
              <span className="text-xs text-slate-500">{row.canonical_weight}</span>
            )}
            {row.best_price != null && (
              <span className="text-xs font-bold text-emerald-600">
                Best ₹{row.best_price.toFixed(0)} on {row.best_platform}
              </span>
            )}
            {savings != null && savings > 0 && (
              <span className="text-xs text-slate-500">· Save up to ₹{savings}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {row.platforms.slice(0, 3).map(p => <Badge key={p.platform} platform={p.platform} />)}
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Cards */}
      {open && (
        <div className="px-5 pb-5 border-t border-slate-100">
          <div className={`grid gap-4 mt-4 ${
            row.platforms.length === 1 ? "grid-cols-1 max-w-xs" :
            row.platforms.length === 2 ? "grid-cols-2" :
            "grid-cols-2 sm:grid-cols-3"
          }`}>
            {row.platforms.map(entry => (
              <ProductCard
                key={entry.platform}
                entry={entry}
                query={query}
                isBest={entry.platform === row.best_platform}
                onAdd={onAddToCart ? handleAdd : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Platform summary strip ────────────────────────────────────────────────────

function PlatformStrip({ groups }: { groups: ComparisonRow[] }) {
  const summary: Record<string, { count: number; minPrice: number | null }> = {}

  for (const g of groups) {
    for (const p of g.platforms) {
      if (!summary[p.platform]) summary[p.platform] = { count: 0, minPrice: null }
      summary[p.platform].count++
      if (p.price != null && (summary[p.platform].minPrice === null || p.price < summary[p.platform].minPrice!)) {
        summary[p.platform].minPrice = p.price
      }
    }
  }

  const platforms = Object.entries(summary)
  if (!platforms.length) return null

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {platforms.map(([platform, { count, minPrice }]) => {
        const b = D(platform)
        return (
          <div key={platform}
               className={`${b.light} border ${b.border} rounded-2xl p-4 text-center`}>
            <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${b.bg} ${b.text} mb-2`}>
              {b.emoji} {platform}
            </div>
            <div className="text-2xl font-black text-slate-900">
              {minPrice != null ? `₹${minPrice.toFixed(0)}` : "—"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">from · {count} items</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function ComparisonGrid({
  data,
  query,
  onAddToCart,
}: {
  data:        CompareResponse
  query:       string
  onAddToCart?: (name: string, platform: string, price: number) => void
}) {
  if (!data.groups.length) {
    return (
      <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-semibold text-slate-600">No products found</p>
        <p className="text-sm mt-1 text-slate-400">Try a more specific product name or different PIN code.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-800">{data.groups.length}</span> products ·{" "}
          <span className="font-semibold text-slate-800">{data.total_results}</span> listings ·{" "}
          {(data.elapsed_ms / 1000).toFixed(1)}s
          {data.demo_mode && (
            <span className="ml-2 text-xs bg-amber-100 text-amber-700 border border-amber-200
                             font-semibold px-2 py-0.5 rounded-full">
              ⚠ demo prices · start API for live data
            </span>
          )}
        </p>
        <span className="text-xs text-slate-400">📍 {data.pincode}</span>
      </div>

      {/* Platform summary cards */}
      <PlatformStrip groups={data.groups} />

      {/* Product groups */}
      {data.groups.map((row, i) => (
        <ProductGroup
          key={`${row.canonical_name}-${i}`}
          row={row}
          query={query}
          onAddToCart={onAddToCart}
          defaultOpen={i < 3}
        />
      ))}
    </div>
  )
}
