"use client";

import React from "react";
import {
  FileText,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { StartupProfile } from "@/types/startup";
import { LocalDeckFile } from "@/types/deck";

interface ReviewHeaderProps {
  file: LocalDeckFile | null;
  totalPages: number;
  profile: StartupProfile | null;
  isAiAssisted: boolean;
  onReset: () => void;
}

export function ReviewHeader({
  file,
  totalPages,
  profile,
  isAiAssisted,
  onReset,
}: ReviewHeaderProps) {
  const companyName =
    profile?.identity?.companyName?.rawValue &&
    profile.identity.companyName.rawValue !== "not_found"
      ? profile.identity.companyName.rawValue
      : file?.name.replace(/\.[^/.]+$/, "") || "Pitch Deck";

  const stage =
    profile?.fundraising?.roundBeingRaised?.rawValue &&
    profile.fundraising.roundBeingRaised.rawValue !== "not_found"
      ? profile.fundraising.roundBeingRaised.rawValue
      : profile?.fundraising?.currentStage?.rawValue &&
        profile.fundraising.currentStage.rawValue !== "not_found"
      ? profile.fundraising.currentStage.rawValue
      : null;

  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Deck Identity & Pitch Deck Review Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
            <FileText className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                {companyName}
              </h1>
              {stage && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                  {stage}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Pitch Deck Review</span>
              <span className="text-slate-600">•</span>
              <span>{totalPages} {totalPages === 1 ? "slide" : "slides"}</span>
              {file?.name && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500 truncate max-w-[180px] sm:max-w-[260px]">
                    {file.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Status Indicator & Upload New Deck Button */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Subtle Analysis Status Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-300">
            {isAiAssisted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 font-medium">AI analysis complete</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300 font-medium">Deterministic analysis</span>
              </>
            )}
          </div>

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-colors"
            title="Upload another pitch deck"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload New Deck</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>
    </header>
  );
}

