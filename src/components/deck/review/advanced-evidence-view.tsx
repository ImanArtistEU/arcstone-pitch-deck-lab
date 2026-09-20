"use client";

import React, { useState } from "react";
import {
  Database,
  FileText,
  AlertOctagon,
  Layers,
  Code2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ClaimEvidenceMap, MaterialClaim } from "@/types/claim";
import { DeckDiagnostics } from "@/types/diagnostics";
import { HybridDeckResult, HybridSlideData } from "@/types/deck";

interface AdvancedEvidenceViewProps {
  claimMap: ClaimEvidenceMap | null;
  diagnostics: DeckDiagnostics | null;
  hybridResult: HybridDeckResult | null;
  onNavigateToSlide?: (slideNumber: number) => void;
}

type AdvancedTab = "claims" | "diagnostics" | "raw_slides";

export function AdvancedEvidenceView({
  claimMap,
  diagnostics,
  hybridResult,
  onNavigateToSlide,
}: AdvancedEvidenceViewProps) {
  const [activeTab, setActiveTab] = useState<AdvancedTab>("claims");
  const [claimFilter, setClaimFilter] = useState<
    "all" | "supported" | "unsupported" | "conflicting"
  >("all");
  const [expandedSlideIndex, setExpandedSlideIndex] = useState<number | null>(null);

  const claims = (claimMap?.claims || []).filter((c) => {
    if (claimFilter === "all") return true;
    return c.supportStatus === claimFilter;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
          <Database className="w-4 h-4 text-slate-400" />
          <span>Technical Diligence & Raw Evidence</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
          Advanced Evidence Explorer
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Underlying claim verification, raw diagnostic records, and multimodal slide extractions.
        </p>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 pt-4">
          <button
            onClick={() => setActiveTab("claims")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "claims"
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
            }`}
          >
            Claim & Evidence Map ({claimMap?.claims.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "diagnostics"
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
            }`}
          >
            Diagnostic Findings ({diagnostics?.summary.totalDiagnostics || 0})
          </button>
          <button
            onClick={() => setActiveTab("raw_slides")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "raw_slides"
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
            }`}
          >
            Raw Slide Data ({hybridResult?.slides.length || 0})
          </button>
        </div>
      </div>

      {/* TAB 1: CLAIM & EVIDENCE MAP */}
      {activeTab === "claims" && (
        <div className="space-y-4">
          {/* Claim Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            {(["all", "supported", "unsupported", "conflicting"] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setClaimFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    claimFilter === f
                      ? "bg-slate-800 text-slate-100 border border-slate-700"
                      : "text-slate-400 hover:text-slate-200 bg-slate-900/30 border border-slate-800/60"
                  }`}
                >
                  {f} ({claimMap?.claims.filter((c) => f === "all" || c.supportStatus === f).length})
                </button>
              )
            )}
          </div>

          <div className="space-y-2.5">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 text-[11px]">
                      Slide {claim.slideNumber}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="capitalize font-medium text-slate-300">
                      {claim.claimType}
                    </span>
                    {claim.quantitative && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px]">
                        Metric
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      claim.supportStatus === "supported"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                        : claim.supportStatus === "conflicting"
                        ? "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                        : "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                    }`}
                  >
                    {claim.supportStatus}
                  </span>
                </div>

                <p className="text-slate-100 font-medium leading-relaxed">
                  &ldquo;{claim.claimText}&rdquo;
                </p>

                {claim.evidence && claim.evidence.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                      Verified Evidence Statements:
                    </span>
                    {claim.evidence.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-1.5">
                        <span className="text-slate-500">•</span>
                        <span>{ev.exactText}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: DIAGNOSTICS */}
      {activeTab === "diagnostics" && (
        <div className="space-y-4">
          {/* Contradictions */}
          {diagnostics?.contradictions && diagnostics.contradictions.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                Internal Contradictions ({diagnostics.contradictions.length})
              </span>
              {diagnostics.contradictions.map((c) => (
                <div
                  key={c.id}
                  className="bg-rose-500/10 border border-rose-500/25 rounded-lg p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-200">{c.description}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                      {c.severity}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-rose-200/90 text-[11px]">
                    {c.conflictingStatements.map((stmt, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-950/40 border border-rose-500/20">
                        <span className="font-bold text-rose-300">Slide {stmt.slideNumber}: </span>
                        <span>&ldquo;{stmt.text}&rdquo;</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-rose-300/80 pt-1">
                    <strong>Why conflicting:</strong> {c.whyConflicting}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Evidence Gaps */}
          {diagnostics?.evidenceGaps && diagnostics.evidenceGaps.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Evidence Gaps ({diagnostics.evidenceGaps.length})
              </span>
              {diagnostics.evidenceGaps.map((g) => (
                <div
                  key={g.id}
                  className="bg-slate-900/40 border border-slate-800 rounded-lg p-3.5 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">
                      Slide {g.slideNumbers.join(", ")}: {g.claimText}
                    </span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                      {g.severity}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Missing Evidence:</strong> {g.missingEvidenceDescription}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Missing Information */}
          {diagnostics?.missingInformation && diagnostics.missingInformation.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Missing Information ({diagnostics.missingInformation.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {diagnostics.missingInformation.map((m) => (
                  <div
                    key={m.id}
                    className="bg-slate-900/30 border border-slate-800/80 rounded-lg p-3 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{m.field}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{m.category}</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{m.whyRelevant}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RAW SLIDES & EXTRACTION */}
      {activeTab === "raw_slides" && (
        <div className="space-y-3">
          {hybridResult?.slides.map((s: HybridSlideData, idx: number) => {
            const isExpanded = expandedSlideIndex === idx;

            return (
              <div
                key={s.pageNumber}
                className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden text-xs"
              >
                <div
                  onClick={() => setExpandedSlideIndex(isExpanded ? null : idx)}
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-300">
                      Slide {s.pageNumber}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 truncate max-w-md">
                      {s.visualExtraction?.title || s.nativeExtraction?.rawText?.slice(0, 60) || "Slide content"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onNavigateToSlide && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToSlide(s.pageNumber);
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        Inspect Slide →
                      </button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 font-semibold uppercase">Extracted Native Text:</span>
                      <pre className="mt-1 p-2 bg-slate-950 border border-slate-900 rounded text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto font-sans text-xs">
                        {s.nativeExtraction?.rawText || "No text extracted via native PDF parser."}
                      </pre>
                    </div>

                    {s.visualExtraction && (
                      <div>
                        <span className="text-slate-500 font-semibold uppercase">Visual Understanding Output:</span>
                        <pre className="mt-1 p-2 bg-slate-950 border border-slate-900 rounded text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto text-[11px]">
                          {JSON.stringify(s.visualExtraction, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
