"use client";

import React, { useEffect, useState } from "react";
import { Terminal, LogOut, Menu, X, House, Library, Activity } from "lucide-react";

export type NavTab = "home" | "processing" | "note-view" | "library";

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  hasActiveJob: boolean;
  userEmail?: string;
  onSignOut: () => void;
}

export function Navbar({ activeTab, setActiveTab, hasActiveJob, userEmail, onSignOut }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  /* The mobile drawer only exists below md; drop it when the window grows. */
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (query.matches) setMenuOpen(false);
    };
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);

  const go = (tab: NavTab) => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  const desktopTabClass = (tab: NavTab) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
      activeTab === tab
        ? "bg-blue-50 text-blue-600 font-semibold shadow-xs"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
    }`;

  const mobileTabClass = (tab: NavTab) =>
    `w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? "bg-blue-50 text-blue-700 font-semibold"
        : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"
    }`;

  const mobileTabs = [
    { key: "home" as NavTab, label: "Home", icon: House, badge: false },
    ...(hasActiveJob
      ? [{ key: "processing" as NavTab, label: "Processing", icon: Activity, badge: true }]
      : []),
    { key: "library" as NavTab, label: "Library", icon: Library, badge: false },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3">
          {/* Brand / Logo */}
          <div className="flex items-center gap-6 min-w-0">
            <div
              onClick={() => go("home")}
              className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-white font-mono text-sm shadow-sm group-hover:bg-blue-600 transition-colors">
                <Terminal className="w-4 h-4 text-blue-400 group-hover:text-white" />
              </div>
              <span className="font-serif text-lg font-semibold tracking-tight text-slate-900 leading-none">
                Apriora
              </span>
            </div>

            {/* Navigation links — inline from md up */}
            <nav className="hidden md:flex items-center gap-1 ml-4 border-l border-slate-200 pl-4">
              <button onClick={() => go("home")} className={desktopTabClass("home")}>
                Home
              </button>
              {hasActiveJob && (
                <button onClick={() => go("processing")} className={desktopTabClass("processing")}>
                  Processing
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                </button>
              )}
              <button onClick={() => go("library")} className={desktopTabClass("library")}>
                Library
              </button>
            </nav>
          </div>

          {/* Account (desktop) + menu toggle (mobile) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onSignOut}
              title="Sign out"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer max-w-[18rem]"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{userEmail}</span>
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className="md:hidden p-2 -mr-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div id="mobile-nav" className="md:hidden border-t border-slate-200/80 pb-2">
            <nav className="pt-2 space-y-0.5">
              {mobileTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => go(tab.key)}
                    className={mobileTabClass(tab.key)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{tab.label}</span>
                    {tab.badge && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left truncate">
                  {userEmail ? `Sign out · ${userEmail}` : "Sign out"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
