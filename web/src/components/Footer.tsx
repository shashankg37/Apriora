import React from "react";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 bg-white/60 py-6 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-800">Apriora</span>
          <span className="text-slate-300">·</span>
          <span>Interview-ready notes from any resource</span>
        </div>

        <div className="font-mono text-[11px] text-slate-400">
          © 2026 Apriora
        </div>
      </div>
    </footer>
  );
}
