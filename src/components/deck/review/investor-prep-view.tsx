"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Eye,
  EyeOff,
  CheckCircle2,
  FileText,
  CornerDownRight,
  ListFilter,
  PlayCircle,
} from "lucide-react";
import {
  InvestorSimulatorResult,
  InvestorQuestion,
  QuestionPriority,
  AnswerabilityStatus,
} from "@/types/simulator";

interface InvestorPrepViewProps {
  simulatorResult: InvestorSimulatorResult;
  onNavigateToSlide?: (slideNumber: number) => void;
}

export function InvestorPrepView({
  simulatorResult,
  onNavigateToSlide,
}: InvestorPrepViewProps) {
  const [viewMode, setViewMode] = useState<"overview" | "practice">("overview");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | QuestionPriority>("ALL");
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({});

  const toggleShowAnswer = (id: string) => {
    setShowAnswer((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const { questions, summary } = simulatorResult;

  const filteredQuestions = questions.filter((q) => {
    if (priorityFilter === "ALL") return true;
    return q.priority === priorityFilter;
  });

  const activeQuestion: InvestorQuestion | undefined =
    questions[currentQuestionIndex] || questions[0];

  const handleStartPractice = (index: number) => {
    setCurrentQuestionIndex(index);
    setViewMode("practice");
  };

  const handlePrev = () => {
    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
            Investor Prep
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Anticipate partner questions, identify evidence gaps, and test your readiness.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-lg border border-slate-800 self-start sm:self-auto text-xs">
          <button
            onClick={() => setViewMode("overview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === "overview"
                ? "bg-slate-800 text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Question Overview</span>
          </button>
          <button
            onClick={() => setViewMode("practice")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === "practice"
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Practice Meeting Mode</span>
          </button>
        </div>
      </div>

      {/* MODE 1: OVERVIEW */}
      {viewMode === "overview" && (
        <div className="space-y-6">
          {/* Answerability Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5">
              <span className="text-[11px] text-emerald-400 font-medium">Well Supported</span>
              <div className="text-xl font-bold text-slate-100 mt-0.5">
                {summary.wellSupportedCount}
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5">
              <span className="text-[11px] text-blue-400 font-medium">Partially Supported</span>
              <div className="text-xl font-bold text-slate-100 mt-0.5">
                {summary.partiallySupportedCount}
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5">
              <span className="text-[11px] text-amber-400 font-medium">Weakly Supported</span>
              <div className="text-xl font-bold text-slate-100 mt-0.5">
                {summary.weaklySupportedCount}
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5">
              <span className="text-[11px] text-rose-400 font-medium">Unanswered</span>
              <div className="text-xl font-bold text-slate-100 mt-0.5">
                {summary.unansweredCount}
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/70 rounded-lg p-3.5 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-purple-400 font-medium">Data Conflict</span>
              <div className="text-xl font-bold text-slate-100 mt-0.5">
                {summary.contradictoryCount}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-3">
            {(["ALL", "CRITICAL", "HIGH", "MEDIUM"] as const).map((pri) => (
              <button
                key={pri}
                onClick={() => setPriorityFilter(pri)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  priorityFilter === pri
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                    : "text-slate-400 hover:text-slate-200 bg-slate-900/30 border border-slate-800"
                }`}
              >
                {pri === "ALL"
                  ? `All Questions (${questions.length})`
                  : `${pri.charAt(0) + pri.slice(1).toLowerCase()} (${
                      questions.filter((q) => q.priority === pri).length
                    })`}
              </button>
            ))}
          </div>

          {/* Question List */}
          <div className="space-y-3">
            {filteredQuestions.map((q, idx) => {
              const originalIndex = questions.findIndex((item) => item.id === q.id);

              return (
                <div
                  key={q.id}
                  className="bg-slate-900/40 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          q.priority === "CRITICAL"
                            ? "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                            : q.priority === "HIGH"
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                            : "bg-slate-800 text-slate-300 border border-slate-700/60"
                        }`}
                      >
                        {q.priority}
                      </span>

                      <span className="text-xs text-slate-400 capitalize">
                        {q.category.replace(/_/g, " ")}
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          q.currentAnswerability === "WELL_SUPPORTED"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : q.currentAnswerability === "CONTRADICTORY"
                            ? "bg-rose-500/10 text-rose-300"
                            : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {q.currentAnswerability.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                      {q.question}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-1">
                      {q.whyInvestorAsks}
                    </p>
                  </div>

                  <button
                    onClick={() => handleStartPractice(originalIndex >= 0 ? originalIndex : idx)}
                    className="self-end sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 text-xs font-medium whitespace-nowrap transition-colors"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Practice Question</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 2: PRACTICE (Meeting Mode) */}
      {viewMode === "practice" && activeQuestion && (
        <div className="space-y-6">
          {/* Practice Stepper Header */}
          <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-slate-400">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="text-slate-600">•</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  activeQuestion.priority === "CRITICAL"
                    ? "bg-rose-500/15 text-rose-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {activeQuestion.priority}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrev}
                disabled={currentQuestionIndex <= 0}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition-colors"
                title="Previous question"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentQuestionIndex >= questions.length - 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition-colors"
                title="Next question"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Core Question Screen: The QUESTION Dominates */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Investor Inquires
            </span>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-100 leading-snug tracking-tight">
              &ldquo;{activeQuestion.question}&rdquo;
            </h1>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
              <span className="capitalize">{activeQuestion.category.replace(/_/g, " ")} Focus</span>
              <span className="text-slate-600">•</span>
              <span>Answerability: {activeQuestion.currentAnswerability.replace(/_/g, " ")}</span>
            </div>
          </div>

          {/* Structured Guidance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Why this comes up */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-1.5 text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400 text-[10px]">
                Why the Investor Asks This
              </span>
              <p className="text-slate-300 leading-relaxed text-xs">
                {activeQuestion.whyInvestorAsks}
              </p>
            </div>

            {/* How to prepare */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-1.5 text-xs">
              <span className="font-semibold uppercase tracking-wider text-blue-400 text-[10px]">
                Preparation Guidance
              </span>
              <p className="text-slate-300 leading-relaxed text-xs">
                {activeQuestion.preparationGuidance}
              </p>
            </div>
          </div>

          {/* What your deck already proves vs. What is missing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deck Proof */}
            <div className="bg-slate-900/20 border border-slate-800/60 rounded-xl p-4 space-y-2 text-xs">
              <span className="font-semibold text-emerald-400 text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>What Your Deck Proves Today</span>
              </span>

              {activeQuestion.availableEvidence?.length > 0 ? (
                <ul className="space-y-1 text-slate-300 text-xs">
                  {activeQuestion.availableEvidence.map((ev, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-slate-500 font-mono text-[10px]">Slide {ev.slideNumber}:</span>
                      <span>{ev.statement}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 italic text-xs">
                  No verified factual evidence for this question found in the deck.
                </p>
              )}
            </div>

            {/* What is still missing */}
            <div className="bg-slate-900/20 border border-slate-800/60 rounded-xl p-4 space-y-2 text-xs">
              <span className="font-semibold text-rose-400 text-[11px] flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>What Is Still Missing</span>
              </span>

              {activeQuestion.missingInformation?.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                  {activeQuestion.missingInformation.map((info, idx) => (
                    <li key={idx}>{info}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 italic text-xs">
                  No obvious informational gaps identified.
                </p>
              )}
            </div>
          </div>

          {/* Grounded Model Answer (Strictly Grounded, Toggleable) */}
          {activeQuestion.groundedAnswer && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Model Answer Using Current Deck Evidence
                </span>
                <button
                  onClick={() => toggleShowAnswer(activeQuestion.id)}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  {showAnswer[activeQuestion.id] ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide Answer</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Reveal Answer</span>
                    </>
                  )}
                </button>
              </div>

              {showAnswer[activeQuestion.id] && (
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-200 leading-relaxed font-sans bg-slate-950/50 p-3.5 rounded-lg">
                  {activeQuestion.groundedAnswer}
                </div>
              )}
            </div>
          )}

          {/* Likely Follow-Up Questions */}
          {activeQuestion.likelyFollowUps?.length > 0 && (
            <div className="p-4 bg-slate-900/20 border border-slate-800/60 rounded-xl space-y-2 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Likely Follow-Up Probing
              </span>
              <ul className="space-y-1 text-slate-300">
                {activeQuestion.likelyFollowUps.map((fu, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CornerDownRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span>&ldquo;{fu}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

