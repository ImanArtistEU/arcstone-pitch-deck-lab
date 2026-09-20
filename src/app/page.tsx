import { DeckReviewerView } from "@/components/deck/deck-reviewer-view";
import { Layers } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-between bg-[#090D16] text-slate-100">
      {/* Persistent Global Header */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Arcstone Branding Logo Icon */}
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/30">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-slate-100 text-sm sm:text-base font-mono">
                ARCSTONE
              </span>
              <span className="text-slate-600 font-light">|</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                Infrastructure
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 hidden sm:inline-block">
              Fundraising Platform
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <DeckReviewerView />
      </div>

      {/* Subtle B2B Footer */}
      <footer className="w-full border-t border-slate-800/80 py-5 text-center text-xs text-slate-500 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4">
          Arcstone AI-Native Fundraising Infrastructure • Startup Readiness Module
        </div>
      </footer>
    </main>
  );
}
