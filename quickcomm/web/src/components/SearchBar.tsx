"use client"

import React, { useState, useRef, useCallback } from "react"

interface SearchBarProps {
  onSearch: (query: string, pincode: string) => void
  loading:  boolean
}

const POPULAR = [
  "Amul Taaza Milk 500ml",
  "Maggi Noodles 70g",
  "Parle-G Biscuit 800g",
  "Dettol Soap 75g",
  "Surf Excel 1kg",
  "Britannia Marie Gold",
  "Aashirvaad Atta 1kg",
  "Lay's Chips",
]

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query,   setQuery]   = useState("")
  const [pincode, setPincode] = useState("226001")
  const [focused, setFocused] = useState(false)
  const [hint,    setHint]    = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const canSubmit = query.trim().length >= 2 && pincode.length === 6 && !loading

  const submit = useCallback(() => {
    const q = query.trim()
    if (q.length < 2) { setHint("Type at least 2 characters"); return }
    if (pincode.length !== 6) { setHint("Enter a valid 6-digit PIN code"); return }
    setHint("")
    onSearch(q, pincode)
  }, [query, pincode, onSearch])

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* PIN */}
        <div className="relative flex-shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">📍</span>
          <input
            type="text" inputMode="numeric"
            value={pincode}
            onChange={e => { setPincode(e.target.value.replace(/\D/g, "").slice(0, 6)); setHint("") }}
            placeholder="PIN code"
            maxLength={6}
            className="w-36 pl-9 pr-3 py-3.5 bg-white border-2 border-slate-200 rounded-2xl
                       text-slate-900 font-mono text-sm placeholder-slate-400
                       focus:outline-none focus:border-emerald-400 transition-colors shadow-sm"
          />
        </div>

        {/* Query */}
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHint("") }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit() } }}
            placeholder='Search any product — e.g. "Biscuit" or "Amul Milk 500ml"'
            className="w-full pl-10 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl
                       text-slate-900 text-sm placeholder-slate-400
                       focus:outline-none focus:border-emerald-400 transition-colors shadow-sm"
          />

          {/* Suggestions */}
          {focused && !query && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl
                            shadow-xl overflow-hidden z-50">
              <p className="px-4 py-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                Popular searches
              </p>
              {POPULAR.map(s => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => { setQuery(s); setFocused(false); onSearch(s, pincode) }}
                  className="w-full text-left px-4 py-3 text-sm text-slate-700
                             hover:bg-emerald-50 hover:text-emerald-700 transition-colors
                             flex items-center gap-2 border-b border-slate-50 last:border-0"
                >
                  <span className="text-slate-300">🔥</span>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="px-7 py-3.5 bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400
                     text-white font-bold rounded-2xl transition-all text-sm shadow-sm
                     flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Searching…
            </>
          ) : (
            "⚡ Compare"
          )}
        </button>
      </div>

      {hint && (
        <p className="text-xs text-amber-600 flex items-center gap-1 pl-1">
          <span>⚠</span> {hint}
        </p>
      )}
    </div>
  )
}
