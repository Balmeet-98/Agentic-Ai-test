import Link from "next/link";
import { Shirt, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#13111f]">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-white/10 flex items-center justify-center mx-auto">
          <Shirt size={28} className="text-violet-400" />
        </div>
        <div>
          <p className="text-5xl font-black text-white/10 mb-3">404</p>
          <h2 className="text-xl font-bold text-white/85 mb-2">Page not found</h2>
          <p className="text-sm text-white/45">
            This page doesn&apos;t exist. Head back to the designer.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-violet-900/30"
        >
          <ArrowLeft size={16} />
          Back to Designer
        </Link>
      </div>
    </div>
  );
}
