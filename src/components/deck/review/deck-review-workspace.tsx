/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  FileText,
  Sparkles,
  Layers,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { HybridSlideData } from "@/types/deck";
import { ActionPlanResult, FounderRecommendation } from "@/types/recommendations";
import { DeckDiagnostics } from "@/types/diagnostics";
import { FundraisingEvaluation } from "@/types/evaluation";
import { ClaimEvidenceMap, MaterialClaim } from "@/types/claim";

interface DeckReviewWorkspaceProps {
  slides: HybridSlideData[];
  recommendations: ActionPlanResult | null;
  diagnostics: DeckDiagnostics | null;
  evaluation: FundraisingEvaluation | null;
  claimMap: ClaimEvidenceMap | null;
  initialSlideNumber?: number;
  onNavigateToActionPlan?: () => void;
  onNavigateToInvestorPrep?: () => void;
}

type InspectorTab = "review" | "actions" | "evidence";

export function DeckReviewWorkspace({
  slides,
  recommendations,
  diagnostics,
  evaluation,
  claimMap,
  initialSlideNumber = 1,
  onNavigateToActionPlan,
  onNavigateToInvestorPrep,
}: DeckReviewWorkspaceProps) {
  const [selectedSlideNumber, setSelectedSlideNumber] = useState<number>(
    Math.max(1, Math.min(initialSlideNumber, slides.length || 1))
  );
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("review");
  const [zoomLevel, setZoomLevel] = useState<"fit" | "actual">("fit");

  const selectedSlide =
    slides.find((s) => s.pageNumber === selectedSlideNumber) || slides[0];

  // Helper to compute slide status and issues
  const getSlideMetadata = (pageNumber: number) => {
    const recs = (recommendations?.recommendations || []).filter((r) =>
      r.targetSlides.includes(pageNumber)
    );
    const hasCriticalRec = recs.some((r) => r.priority === "CRITICAL");
    const hasHighRec = recs.some((r) => r.priority === "HIGH");

    const contras = (diagnostics?.contradictions || []).filter((c) =>
      c.conflictingStatements.some((s) => s.slideNumber === pageNumber)
    );
    const hasCriticalContra = contras.some((c) => c.severity === "critical");

    const gaps = (diagnostics?.evidenceGaps || []).filter((g) =>
      g.slideNumbers.includes(pageNumber)
    );

    let status: "critical" | "warning" | "strong" | "neutral" = "neutral";
    let statusLabel = "Solid";

    if (hasCriticalRec || hasCriticalContra) {
      status = "critical";
      statusLabel = "Critical Issue";
    } else if (hasHighRec || gaps.length > 0) {
      status = "warning";
      statusLabel = "Needs Work";
    } else {
      const strong = (evaluation?.strongElements || []).find((s) =>
        s.slideNumbers.includes(pageNumber)
      );
      if (strong) {
        status = "strong";
        statusLabel = "Strong";
      }
    }

    return {
      status,
      statusLabel,
      recs,
      contras,
      gaps,
    };
  };

  const currentMetadata = getSlideMetadata(selectedSlideNumber);

  // Evaluation dimensions referencing this slide
  const slideDimensions = (evaluation?.dimensions || []).filter((d) =>
    d.slideReferences?.includes(selectedSlideNumber)
  );

  // Strong elements referencing this slide
  const slideStrong = (evaluation?.strongElements || []).filter((s) =>
    s.slideNumbers?.includes(selectedSlideNumber)
  );

  // Claims on this slide
  const slideClaims = (claimMap?.claims || []).filter(
    (c) => c.slideNumber === selectedSlideNumber
  );

  const handlePrev = () => {
    setSelectedSlideNumber((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    setSelectedSlideNumber((prev) => Math.min(slides.length, prev + 1));
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-140px)] min-h-[640px] bg-slate-950/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      {/* Workspace Top Toolbar */}
      <div className="h-12 border-b border-slate-800/80 bg-slate-900/60 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <span className="font-semibold text-slate-200">
            Slide {selectedSlideNumber} of {slides.length}
          </span>
          <span className="text-slate-600">|</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
              currentMetadata.status === "critical"
                ? "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                : currentMetadata.status === "warning"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                : currentMetadata.status === "strong"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                : "bg-slate-800 text-slate-300 border border-slate-700/60"
            }`}
          >
            {currentMetadata.statusLabel}
          </span>
        </div>

        {/* Center/Right Controls: Zoom and Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/60 text-xs">
            <button
              onClick={() => setZoomLevel("fit")}
              className={`px-2 py-1 rounded transition-colors ${
                zoomLevel === "fit"
                  ? "bg-slate-700 text-slate-100 font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Fit to workspace"
            >
              Fit
            </button>
            <button
              onClick={() => setZoomLevel("actual")}
              className={`px-2 py-1 rounded transition-colors ${
                zoomLevel === "actual"
                  ? "bg-slate-700 text-slate-100 font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Original size"
            >
              100%
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={selectedSlideNumber <= 1}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition-colors"
              title="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={selectedSlideNumber >= slides.length}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition-colors"
              title="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Pane Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* PANE 1: Left Slide Navigator */}
        <aside className="w-full md:w-56 lg:w-64 border-b md:border-b-0 md:border-r border-slate-800/80 bg-slate-950/40 flex-shrink-0 flex md:flex-col overflow-x-auto md:overflow-y-auto p-2 sm:p-2.5 gap-2 no-scrollbar">
          <div className="hidden md:block px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Slide Thumbnails
          </div>

          {slides.map((s) => {
            const meta = getSlideMetadata(s.pageNumber);
            const isSelected = s.pageNumber === selectedSlideNumber;

            return (
              <button
                key={s.pageNumber}
                onClick={() => setSelectedSlideNumber(s.pageNumber)}
                className={`flex-shrink-0 md:w-full flex md:flex-col items-start gap-1.5 p-1.5 rounded-lg border transition-all text-left ${
                  isSelected
                    ? "bg-blue-600/15 border-blue-500/50 shadow-sm ring-1 ring-blue-500/20"
                    : "bg-slate-900/40 border-slate-800/60 hover:bg-slate-900 hover:border-slate-700"
                }`}
              >
                {/* Header line: Slide number + status dot */}
                <div className="w-full flex items-center justify-between text-xs px-1">
                  <span
                    className={`font-mono font-medium ${
                      isSelected ? "text-blue-300 font-bold" : "text-slate-400"
                    }`}
                  >
                    Slide {s.pageNumber}
                  </span>

                  {meta.status === "critical" ? (
                    <span className="w-2 h-2 rounded-full bg-rose-500" title="Critical Issue" />
                  ) : meta.status === "warning" ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500" title="Needs Work" />
                  ) : meta.status === "strong" ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Strong Element" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  )}
                </div>

                {/* Rendered Thumbnail */}
                <div className="w-24 md:w-full aspect-[16/9] bg-slate-950 rounded border border-slate-800/60 overflow-hidden flex items-center justify-center relative">
                  {s.slideImageUri ? (
                    <img
                      src={s.slideImageUri}
                      alt={`Slide ${s.pageNumber}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-[10px] text-slate-600">Slide {s.pageNumber}</div>
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        {/* PANE 2: Center Slide Preview */}
        <main className="flex-1 bg-[#090D16] p-4 sm:p-6 flex items-center justify-center overflow-auto relative">
          {selectedSlide?.slideImageUri ? (
            <div
              className={`transition-all duration-200 shadow-2xl rounded-lg border border-slate-800/80 overflow-hidden bg-slate-950 ${
                zoomLevel === "fit"
                  ? "max-w-full max-h-full aspect-[16/9] flex items-center justify-center"
                  : "w-auto h-auto max-w-none"
              }`}
            >
              <img
                src={selectedSlide.slideImageUri}
                alt={`Slide ${selectedSlideNumber}`}
                className="max-w-full max-h-[calc(100vh-240px)] object-contain block mx-auto"
              />
            </div>
          ) : (
            <div className="text-center p-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-slate-700" />
              <p className="text-sm">Slide image preview unavailable.</p>
            </div>
          )}
        </main>

        {/* PANE 3: Right Review Inspector */}
        <aside className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-slate-800/80 bg-slate-950/60 flex-shrink-0 flex flex-col h-72 md:h-auto overflow-hidden">
          {/* Inspector Tab Bar */}
          <div className="border-b border-slate-800/80 bg-slate-900/40 px-3 pt-2 flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setInspectorTab("review")}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                inspectorTab === "review"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setInspectorTab("actions")}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                inspectorTab === "actions"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Actions</span>
              {currentMetadata.recs.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] flex items-center justify-center text-slate-300">
                  {currentMetadata.recs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setInspectorTab("evidence")}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                inspectorTab === "evidence"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Evidence</span>
              {slideClaims.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] flex items-center justify-center text-slate-300">
                  {slideClaims.length}
                </span>
              )}
            </button>
          </div>

          {/* Inspector Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* TAB 1: REVIEW */}
            {inspectorTab === "review" && (
              <div className="space-y-4">
                {/* Contradictions & Critical Issues */}
                {currentMetadata.contras.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Data Conflict</span>
                    </div>

                    {currentMetadata.contras.map((contra) => (
                      <div
                        key={contra.id}
                        className="bg-rose-500/10 border border-rose-500/25 rounded-lg p-3 space-y-1.5 text-xs"
                      >
                        <p className="font-medium text-rose-200">{contra.description}</p>
                        <p className="text-[11px] text-rose-300/80 leading-relaxed">
                          {contra.whyConflicting}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dimension Findings */}
                {slideDimensions.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Evaluated Dimensions
                    </div>

                    {slideDimensions.map((dim) => (
                      <div
                        key={dim.id}
                        className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-3 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">
                            {dim.dimensionName}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              dim.status === "STRONG"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : dim.status === "ADEQUATE"
                                ? "bg-blue-500/15 text-blue-300"
                                : dim.status === "UNDERDEVELOPED"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-rose-500/15 text-rose-300"
                            }`}
                          >
                            {dim.status === "UNDERDEVELOPED"
                              ? "Needs Work"
                              : dim.status === "ADEQUATE"
                              ? "Solid"
                              : dim.status}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{dim.finding}</p>
                        {dim.rationale && (
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {dim.rationale}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-900/20 border border-slate-800/40 rounded-lg">
                    No overarching evaluation dimensions directly bound to this individual slide.
                  </div>
                )}

                {/* Strong Points on this Slide */}
                {slideStrong.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Strong Elements</span>
                    </div>

                    {slideStrong.map((s) => (
                      <div
                        key={s.id}
                        className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-1 text-xs"
                      >
                        <span className="font-medium text-emerald-300">
                          {s.pillarOrDimension}
                        </span>
                        <p className="text-slate-300 leading-relaxed">{s.highlight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ACTIONS */}
            {inspectorTab === "actions" && (
              <div className="space-y-3.5">
                {currentMetadata.recs.length > 0 ? (
                  currentMetadata.recs.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-slate-900/50 border border-slate-800 rounded-lg p-3.5 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            rec.priority === "CRITICAL"
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {rec.priority}
                        </span>

                        {rec.founderInputRequired && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                            Founder input needed
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-slate-100 text-xs">
                        {rec.title}
                      </h4>

                      <p className="text-slate-300 leading-relaxed">
                        {rec.problem}
                      </p>

                      <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                          Recommended Action
                        </span>
                        <p className="text-slate-300 leading-relaxed">
                          {rec.recommendedAction}
                        </p>
                      </div>

                      {/* Suggested structure or copy */}
                      {rec.suggestedCopy && (
                        <div className="pt-2 border-t border-slate-800 space-y-1 bg-slate-950/60 p-2 rounded">
                          <span className="text-[10px] font-semibold text-slate-400">
                            Suggested Copy:
                          </span>
                          <p className="text-[11px] text-slate-200 italic">
                            &ldquo;{rec.suggestedCopy.suggestedText}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Link to Action Plan */}
                      {onNavigateToActionPlan && (
                        <button
                          onClick={onNavigateToActionPlan}
                          className="pt-1 text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
                        >
                          <span>View in full Action Plan</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center p-6 text-xs text-slate-500 bg-slate-900/20 border border-slate-800/40 rounded-lg">
                    No dedicated action plan recommendations targeting this slide directly.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: EVIDENCE */}
            {inspectorTab === "evidence" && (
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Slide Claims & Proof
                </div>

                {slideClaims.length > 0 ? (
                  slideClaims.map((claim) => (
                    <div
                      key={claim.id}
                      className="bg-slate-900/30 border border-slate-800/80 rounded-lg p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-300 capitalize">
                          {claim.claimType} Claim
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            claim.supportStatus === "supported"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : claim.supportStatus === "conflicting"
                              ? "bg-rose-500/10 text-rose-300"
                              : "bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {claim.supportStatus === "supported"
                            ? "Supported"
                            : claim.supportStatus === "conflicting"
                            ? "Conflict"
                            : "Unsupported"}
                        </span>
                      </div>

                      <p className="text-slate-200">&ldquo;{claim.claimText}&rdquo;</p>

                      {claim.evidence?.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                          {claim.evidence.map((ev) => (
                            <div key={ev.id} className="flex items-start gap-1">
                              <span className="text-slate-500">•</span>
                              <span>{ev.exactText}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-900/20 border border-slate-800/40 rounded-lg">
                    No discrete material claims extracted from this slide.
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
