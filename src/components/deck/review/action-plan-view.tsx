"use client";

import React, { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Layers,
  Sparkles,
  Zap,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FileText,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import {
  ActionPlanResult,
  FounderRecommendation,
  RecommendationPriority,
} from "@/types/recommendations";

interface ActionPlanViewProps {
  actionPlan: ActionPlanResult;
  onNavigateToSlide?: (slideNumber: number) => void;
  onNavigateToInvestorPrep?: () => void;
}

export function ActionPlanView({
  actionPlan,
  onNavigateToSlide,
  onNavigateToInvestorPrep,
}: ActionPlanViewProps) {
  const [priorityFilter, setPriorityFilter] = useState<
    "ALL" | RecommendationPriority | "QUICK_WINS"
  >("ALL");
  const [expandedRecIds, setExpandedRecIds] = useState<Record<string, boolean>>({});
  const [checkedInputIds, setCheckedInputIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedRecIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleCheck = (id: string) => {
    setCheckedInputIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filter recommendations
  const filteredRecs = (actionPlan.recommendations || []).filter((rec) => {
    if (priorityFilter === "ALL") return true;
    if (priorityFilter === "QUICK_WINS") return rec.isQuickWin;
    return rec.priority === priorityFilter;
  });

  const { criticalCount, highCount, polishCount, quickWinsCount, founderInputsRequiredCount } =
    actionPlan.summary;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* 1. Header & Summary Headline */}
      <div className="border-b border-slate-800/80 pb-5 space-y-2">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
          Your Deck Action Plan
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          The highest-leverage changes to make before sending this deck to investors.
        </p>

        {/* Summary Badges Line */}
        <div className="pt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/25 font-semibold">
            {criticalCount} Critical
          </span>
          <span className="text-slate-600">•</span>
          <span className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25 font-semibold">
            {highCount} High Priority
          </span>
          <span className="text-slate-600">•</span>
          <span className="px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25 font-semibold">
            {polishCount} Polish
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            {quickWinsCount} Quick Wins
          </span>
        </div>
      </div>

      {/* 2. Subsection: Information Needed From You */}
      {actionPlan.founderChecklist && actionPlan.founderChecklist.length > 0 && (
        <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <CheckSquare className="w-4 h-4" />
              <span>Information Needed From You</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Check off items as you gather facts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {actionPlan.founderChecklist.map((item) => {
              const isChecked = !!checkedInputIds[item.id];

              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all text-xs select-none ${
                    isChecked
                      ? "bg-slate-900/30 border-slate-800/50 text-slate-500 opacity-60"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <button className="pt-0.5 text-blue-400 hover:text-blue-300 flex-shrink-0">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  <div className="space-y-0.5">
                    <span className={`font-medium ${isChecked ? "line-through" : "text-slate-200"}`}>
                      {item.prompt}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Required for: {item.recommendationTitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Subsection: Quick Wins */}
      {actionPlan.quickWins && actionPlan.quickWins.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Zap className="w-4 h-4" />
            <span>Quick Wins (No New Information Required)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {actionPlan.quickWins.map((qw) => (
              <div
                key={qw.id}
                className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    {qw.title}
                  </span>
                  {qw.targetSlides.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                      Slide {qw.targetSlides.join(", ")}
                    </span>
                  )}
                </div>

                <p className="text-slate-400 leading-relaxed">{qw.recommendedAction}</p>

                {onNavigateToSlide && qw.targetSlides[0] && (
                  <button
                    onClick={() => onNavigateToSlide(qw.targetSlides[0])}
                    className="pt-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                  >
                    <span>Inspect Slide {qw.targetSlides[0]}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Priority Filter Tabs & Ordered Action List */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(["ALL", "CRITICAL", "HIGH", "POLISH", "QUICK_WINS"] as const).map(
              (filter) => (
                <button
                  key={filter}
                  onClick={() => setPriorityFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    priorityFilter === filter
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 bg-slate-900/30 border border-slate-800"
                  }`}
                >
                  {filter === "ALL"
                    ? `All (${actionPlan.recommendations.length})`
                    : filter === "QUICK_WINS"
                    ? `Quick Wins (${quickWinsCount})`
                    : `${filter.charAt(0) + filter.slice(1).toLowerCase()} (${
                        actionPlan.recommendations.filter((r) => r.priority === filter).length
                      })`}
                </button>
              )
            )}
          </div>
        </div>

        {/* Single Ordered Action List */}
        <div className="space-y-3">
          {filteredRecs.map((rec) => {
            const isExpanded = !!expandedRecIds[rec.id];

            return (
              <div
                key={rec.id}
                className="bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 rounded-xl overflow-hidden transition-all"
              >
                {/* Collapsed Header Bar */}
                <div
                  onClick={() => toggleExpand(rec.id)}
                  className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="font-mono text-sm font-bold text-slate-500 pt-0.5">
                      {String(rec.executionOrder).padStart(2, "0")}
                    </span>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                            rec.priority === "CRITICAL"
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                              : rec.priority === "HIGH"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                              : "bg-blue-500/15 text-blue-300 border border-blue-500/25"
                          }`}
                        >
                          {rec.priority}
                        </span>

                        <h3 className="text-sm font-semibold text-slate-100">
                          {rec.title}
                        </h3>

                        {rec.targetSlides.length > 0 && (
                          <span className="text-xs text-slate-400">
                            Slide {rec.targetSlides.join(", ")}
                          </span>
                        )}

                        {rec.founderInputRequired && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                            Founder input required
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {rec.problem}
                      </p>
                    </div>
                  </div>

                  <button className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded Details with Progressive Disclosure */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-slate-800/80 bg-slate-950/40 space-y-4 text-xs">
                    {/* Why this matters */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Why This Matters
                      </span>
                      <p className="text-slate-300 leading-relaxed">
                        {rec.whyItMatters}
                      </p>
                    </div>

                    {/* What to do */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                        Recommended Action
                      </span>
                      <p className="text-slate-200 leading-relaxed">
                        {rec.recommendedAction}
                      </p>
                    </div>

                    {/* Information needed from you (if required) */}
                    {rec.missingInformation && rec.missingInformation.length > 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg space-y-1.5">
                        <span className="font-semibold text-amber-300">
                          Information Needed From You:
                        </span>
                        <ul className="list-disc list-inside text-amber-200/90 space-y-0.5">
                          {rec.missingInformation.map((info, idx) => (
                            <li key={idx}>{info}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Copy Before / After */}
                    {rec.suggestedCopy && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                        <span className="font-semibold text-slate-300">
                          Suggested Copy Improvement:
                        </span>
                        {rec.suggestedCopy.currentText && (
                          <div className="text-slate-400">
                            <span className="text-[10px] uppercase font-mono text-slate-500">Current: </span>
                            &ldquo;{rec.suggestedCopy.currentText}&rdquo;
                          </div>
                        )}
                        <div className="text-slate-100 font-medium">
                          <span className="text-[10px] uppercase font-mono text-emerald-400">Proposed: </span>
                          &ldquo;{rec.suggestedCopy.suggestedText}&rdquo;
                        </div>
                        {rec.suggestedCopy.explanation && (
                          <p className="text-[11px] text-slate-400 italic">
                            {rec.suggestedCopy.explanation}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Suggested Slide Structure */}
                    {rec.suggestedStructure && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                        <span className="font-semibold text-slate-300">
                          Recommended Slide Structure:
                        </span>
                        {rec.suggestedStructure.headline && (
                          <p className="text-slate-200">
                            <strong>Headline:</strong> {rec.suggestedStructure.headline}
                          </p>
                        )}
                        {rec.suggestedStructure.supportingMetrics && (
                          <div>
                            <span className="text-[11px] text-slate-400 font-medium">Metrics:</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {rec.suggestedStructure.supportingMetrics.map((m, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Investor diligence question resolved */}
                    {rec.relatedInvestorQuestions && rec.relatedInvestorQuestions.length > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                          <span>Preempts simulated investor diligence questions</span>
                        </span>
                        {onNavigateToInvestorPrep && (
                          <button
                            onClick={onNavigateToInvestorPrep}
                            className="text-blue-400 hover:text-blue-300 font-medium"
                          >
                            Review Diligence Qs →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Blockers */}
                    {rec.blockedByRecommendationIds && rec.blockedByRecommendationIds.length > 0 && (
                      <div className="text-[11px] text-rose-300/90 flex items-center gap-1.5 pt-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span>Address foundational blockers earlier in this list first.</span>
                      </div>
                    )}

                    {/* Slide Jump Button */}
                    {onNavigateToSlide && rec.targetSlides[0] && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => onNavigateToSlide(rec.targetSlides[0])}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 text-xs font-medium transition-colors"
                        >
                          Inspect on Slide {rec.targetSlides[0]} →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
