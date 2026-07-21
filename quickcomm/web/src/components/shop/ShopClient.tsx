"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { CartItem, ShopCatalog, ShopOrder, ShopProduct } from "@/lib/shopTypes"
import {
  addToCart, loadCart, loadOrders, placeOrder, saveCart, updateCartQty,
} from "@/lib/shopStorage"

type Tab = "shop" | "cart" | "history"

const PAGE_SIZE = 48

export default function ShopClient() {
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("shop")
  const [category, setCategory] = useState("All")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [payment, setPayment] = useState("UPI")
  const [lastOrder, setLastOrder] = useState<ShopOrder | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch("/shop/catalog.json")
      .then((r) => r.json())
      .then((data: ShopCatalog) => { setCatalog(data); setLoading(false) })
      .catch(() => setLoading(false))
    setCart(loadCart())
    setOrders(loadOrders())
  }, [])

  const categories = useMemo(() => ["All", ...(catalog?.categories ?? [])], [catalog])

  const filtered = useMemo(() => {
    if (!catalog) return []
    const q = search.trim().toLowerCase()
    return catalog.products.filter((p) => {
      if (category !== "All" && p.category !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    })
  }, [catalog, category, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const handleAdd = (p: ShopProduct) => {
    const next = addToCart({
      productId: p.id,
      name: p.name,
      brand: p.brand,
      unit: p.unit,
      price: p.price,
      image: p.image,
    })
    setCart(next)
    showToast(`Added ${p.name}`)
  }

  const handleCheckout = () => {
    if (!cart.length) return
    const order = placeOrder(cart, payment)
    setOrders(loadOrders())
    setCart([])
    setLastOrder(order)
    setTab("history")
    showToast(`Order ${order.orderId} placed!`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading supermarket catalogue…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-slate-400 hover:text-slate-700 text-sm shrink-0">← QuickComm</Link>
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black">S</div>
            <div className="min-w-0">
              <h1 className="font-black text-slate-900 truncate">OneLink Supermarket</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["shop", "cart", "history"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                  tab === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "shop" ? "Browse" : t}
                {t === "cart" && cartCount > 0 && (
                  <span className="ml-1 bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{cartCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl">
          ✓ {toast}
        </div>
      )}

      {tab === "shop" && (
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 sticky top-20 max-h-[70vh] overflow-y-auto">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2 px-2">Categories</p>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); setPage(1) }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm mb-1 ${
                    category === c ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <input
              type="search"
              placeholder="Search Amul milk, Maggi, Lay's…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full mb-4 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-sm text-slate-500 mb-4">
              Showing {pageItems.length} of {filtered.length.toLocaleString()} in {category}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {pageItems.map((p) => (
                <article key={p.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <div className="aspect-square bg-slate-100 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-contain p-2"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/da/cms-assets/cms/product/9a4088cc-db19-4add-b3ce-2edd4d09f4ae.png"
                      }}
                    />
                    {p.mrp > p.price && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {Math.round((1 - p.price / p.mrp) * 100)}% off
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase">{p.brand}</p>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight mt-0.5">{p.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{p.unit}</p>
                    <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                      <div>
                        <span className="text-lg font-black text-slate-900">₹{p.price}</span>
                        {p.mrp > p.price && (
                          <span className="text-xs text-slate-400 line-through ml-1">₹{p.mrp}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAdd(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl"
                      >
                        ADD
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 rounded-xl bg-white border disabled:opacity-40">Prev</button>
                <span className="px-4 py-2 text-sm text-slate-600">Page {page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-xl bg-white border disabled:opacity-40">Next</button>
              </div>
            )}
          </main>
        </div>
      )}

      {tab === "cart" && (
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-black text-slate-900 mb-6">Your cart</h2>
          {!cart.length ? (
            <div className="text-center py-20 text-slate-500">
              <p className="text-lg font-semibold">Cart is empty</p>
              <button onClick={() => setTab("shop")} className="mt-4 text-emerald-600 font-bold">Browse products →</button>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {cart.map((item) => (
                  <div key={item.productId} className="flex gap-3 bg-white rounded-2xl border p-3 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt="" className="w-16 h-16 object-contain bg-slate-50 rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.unit} · ₹{item.price}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCart(updateCartQty(item.productId, item.qty - 1))} className="w-8 h-8 rounded-lg bg-slate-100 font-bold">−</button>
                      <span className="w-6 text-center font-bold">{item.qty}</span>
                      <button onClick={() => setCart(updateCartQty(item.productId, item.qty + 1))} className="w-8 h-8 rounded-lg bg-slate-100 font-bold">+</button>
                    </div>
                    <p className="font-bold w-16 text-right">₹{item.price * item.qty}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border p-5 space-y-4">
                <label className="block text-sm font-bold text-slate-700">Payment method</label>
                <select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full border rounded-xl p-3 text-sm">
                  <option>UPI</option>
                  <option>Card</option>
                  <option>OneLink Wallet</option>
                </select>
                <div className="border-t pt-4 space-y-1 text-sm">
                  <div className="flex justify-between font-black text-lg pt-2">
                    <span>Total</span>
                    <span>₹{cartTotal}</span>
                  </div>
                </div>
                <button onClick={handleCheckout} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl">
                  Pay & place order
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-black text-slate-900 mb-6">Order history</h2>
          {lastOrder && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
              <p className="text-emerald-800 font-bold mb-2">Latest receipt — {lastOrder.orderId}</p>
              <p className="text-sm text-emerald-700">{new Date(lastOrder.placedAt).toLocaleString()} · {lastOrder.paymentMethod}</p>
              <ul className="mt-3 text-sm space-y-1">
                {lastOrder.items.map((i) => (
                  <li key={i.productId} className="flex justify-between">
                    <span>{i.name} × {i.qty}</span>
                    <span>₹{i.price * i.qty}</span>
                  </li>
                ))}
              </ul>
              <p className="font-black text-lg mt-3 text-emerald-900">Total paid: ₹{lastOrder.total}</p>
              <p className="text-xs text-emerald-600 mt-2">Paid via {lastOrder.paymentMethod}</p>
            </div>
          )}
          {!orders.length ? (
            <p className="text-slate-500 text-center py-12">No orders yet</p>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div key={o.orderId} className="bg-white rounded-2xl border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{o.orderId}</p>
                      <p className="text-xs text-slate-500">{new Date(o.placedAt).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded-full capitalize">{o.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">{o.items.length} items · ₹{o.total} · {o.paymentMethod}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
