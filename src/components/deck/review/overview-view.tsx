"use client";

import React from "react";
import {
  ArrowRight,
  CheckCircle,
  AlertOctagon,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { ActionPlanResult, FounderRecommendation } from "@/types/recommendations";
import { FundraisingEvaluation } from "@/types/evaluation";
import { InvestorSimulatorResult } from "@/types/simulator";

interface OverviewViewProps {
  evaluation: FundraisingEvaluation | null;
  recommendations: ActionPlanResult | null;
  simulatorResult: InvestorSimulatorResult | null;
  onNavigateToSlide: (slideNumber: number) => void;
  onNavigateToActionPlan: () => void;
  onNavigateToInvestorPrep: () => void;
}

export function OverviewView({
  evaluation,
  recommendations,
  simulatorResult,
  onNavigateToSlide,
  onNavigateToActionPlan,
  onNavigateToInvestorPrep,
}: OverviewViewProps) {
  // Top 3 highest-priority recommendations
  const topPriorities: FounderRecommendation[] = (
    recommendations?.recommendations || []
  ).slice(0, 3);

  // Strongest elements (2-4 items)
  const strongElements = (evaluation?.strongElements || []).slice(0, 4);

  // Exposed areas
  const exposedAreas = simulatorResult?.summary?.mostExposedAreas || [];

  // Summary counts
  const criticalCount = recommendations?.summary?.criticalCount ?? 0;
  const highCount = recommendations?.summary?.highCount ?? 0;
  const polishCount = recommendations?.summary?.polishCount ?? 0;
  const strongCount = evaluation?.dimensionSummary?.strongCount ?? strongElements.length;
  const questionsCount = simulatorResult?.questions?.length ?? 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* 1. Hero: Fundraising Thesis (Concise Synthesis, Restrained) */}
      <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 sm:p-7 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Fundraising Thesis & Case Synthesis</span>
        </div>

        <p className="text-base sm:text-lg text-slate-200 leading-relaxed font-normal">
          {evaluation?.overallSynthesis ||
            "Analysis complete. Review the structured findings, slide-level assessments, and prioritized action plan below."}
        </p>
      </section>

      {/* 2. Compact Factual Summary Signals (NO fake score) */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5">
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-medium">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Critical Fixes</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-100">
            {criticalCount}
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5">
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>High Priority</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-100">
            {highCount}
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5">
          <div className="flex items-center gap-1.5 text-blue-400 text-xs font-medium">
            <Layers className="w-3.5 h-3.5" />
            <span>Polish Items</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-100">
            {polishCount}
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Strong Areas</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-100">
            {strongCount}
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Diligence Qs</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-100">
            {questionsCount}
          </div>
        </div>
      </section>

      {/* 3. Top Priorities: The 3 highest-priority Action Plan items */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
              Top Priorities
            </h2>
            <p className="text-xs text-slate-400">
              Address these highest-friction items first to protect investor credibility.
            </p>
          </div>

          <button
            onClick={onNavigateToActionPlan}
            className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>View all ({recommendations?.recommendations.length || 0})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {topPriorities.length > 0 ? (
            topPriorities.map((rec, idx) => {
              const primarySlide = rec.targetSlides[0];

              return (
                <div
                  key={rec.id}
                  className="bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="font-mono text-sm font-bold text-slate-500 pt-0.5">
                      0{idx + 1}
                    </span>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">
                          {rec.title}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                            rec.priority === "CRITICAL"
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                          }`}
                        >
                          {rec.priority}
                        </span>

                        {rec.targetSlides.length > 0 && (
                          <span className="text-xs text-slate-400">
                            Slide {rec.targetSlides.join(", ")}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 max-w-2xl leading-relaxed">
                        {rec.problem}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    {primarySlide && (
                      <button
                        onClick={() => onNavigateToSlide(primarySlide)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 text-xs font-medium transition-colors"
                      >
                        Inspect Slide {primarySlide}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/20 border border-slate-800 rounded-lg">
              No critical action items identified. The deck exhibits strong overall narrative cohesion.
            </div>
          )}
        </div>
      </section>

      {/* 4. Two-Column Breakdown: Strongest Elements & Most Exposed Areas */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Strongest Elements */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Strongest Elements</span>
          </div>

          <div className="space-y-2.5">
            {strongElements.length > 0 ? (
              strongElements.map((el) => (
                <div
                  key={el.id}
                  className="bg-slate-900/30 border border-slate-800/80 rounded-lg p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      {el.pillarOrDimension}
                    </span>
                    {el.slideNumbers?.length > 0 && (
                      <span className="text-slate-500 text-[11px]">
                        Slide {el.slideNumbers.join(", ")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {el.highlight}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">
                No explicitly strong dimensions flagged.
              </p>
            )}
          </div>
        </div>

        {/* Most Exposed Areas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Highest Diligence Friction</span>
            </div>

            <button
              onClick={onNavigateToInvestorPrep}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Investor Prep →
            </button>
          </div>

          <div className="space-y-2.5">
            {exposedAreas.length > 0 ? (
              exposedAreas.map((area, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/30 border border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-slate-200 capitalize">
                      {area.replace(/_/g, " ")}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Likely to trigger critical diligence questions.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Friction
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">
                No acute friction areas detected.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

