import dynamic from "next/dynamic"

const ShopClient = dynamic(() => import("@/components/shop/ShopClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
      Loading supermarket…
    </div>
  ),
})

export default function ShopPage() {
  return <ShopClient />
}
