"use client";

import React from "react";
import { Terminal, LogOut } from "lucide-react";

export type NavTab = "home" | "processing" | "note-view" | "library";

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  hasActiveJob: boolean;
  userEmail?: string;
  onSignOut: () => void;
}

export function Navbar({ activeTab, setActiveTab, hasActiveJob, userEmail, onSignOut }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-white font-mono text-sm shadow-sm group-hover:bg-blue-600 transition-colors">
              <Terminal className="w-4 h-4 text-blue-400 group-hover:text-white" />
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight text-slate-900 leading-none">
              Apriora
            </span>
          </div>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-1 ml-4 border-l border-slate-200 pl-4">
            <button
              onClick={() => setActiveTab("home")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "home"
                  ? "bg-blue-50 text-blue-600 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Home
            </button>
            {hasActiveJob && (
              <button
                onClick={() => setActiveTab("processing")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "processing"
                    ? "bg-blue-50 text-blue-600 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Processing
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              </button>
            )}
            <button
              onClick={() => setActiveTab("library")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "library"
                  ? "bg-blue-50 text-blue-600 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Library
            </button>
          </nav>
        </div>

        {/* Account */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSignOut}
            title="Sign out"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{userEmail}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
