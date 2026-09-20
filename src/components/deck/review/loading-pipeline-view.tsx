"use client";

import React from "react";
import {
  FileText,
  Sparkles,
  Building2,
  CheckCircle2,
  HelpCircle,
  ListChecks,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface LoadingPipelineViewProps {
  currentStage: string;
  progressPercent: number;
  profileStatus: "idle" | "extracting" | "success" | "error";
  claimStatus: "idle" | "extracting" | "success" | "error";
  diagnosticStatus: "idle" | "analyzing" | "success" | "error";
  evaluationStatus: "idle" | "evaluating" | "success" | "error";
  simulatorStatus: "idle" | "simulating" | "success" | "error";
  recommendationsStatus: "idle" | "generating" | "success" | "error";
}

export function LoadingPipelineView({
  currentStage,
  profileStatus,
  claimStatus,
  diagnosticStatus,
  evaluationStatus,
  simulatorStatus,
  recommendationsStatus,
}: LoadingPipelineViewProps) {
  const steps = [
    {
      id: "ingestion",
      label: "Reading deck & understanding slides",
      isComplete: profileStatus !== "idle" || currentStage.includes("Company"),
      isActive: profileStatus === "idle" && !currentStage.includes("Company"),
      icon: FileText,
    },
    {
      id: "profile",
      label: "Building structured company context",
      isComplete: profileStatus === "success",
      isActive: profileStatus === "extracting",
      icon: Building2,
    },
    {
      id: "claims_diag",
      label: "Mapping material claims & diagnostic findings",
      isComplete: diagnosticStatus === "success",
      isActive: claimStatus === "extracting" || diagnosticStatus === "analyzing",
      icon: ShieldCheck,
    },
    {
      id: "evaluation",
      label: "Reviewing fundraising narrative & thesis coherence",
      isComplete: evaluationStatus === "success",
      isActive: evaluationStatus === "evaluating",
      icon: Sparkles,
    },
    {
      id: "simulator",
      label: "Preparing investor due diligence questions",
      isComplete: simulatorStatus === "success",
      isActive: simulatorStatus === "simulating",
      icon: HelpCircle,
    },
    {
      id: "recommendations",
      label: "Synthesizing prioritized action plan",
      isComplete: recommendationsStatus === "success",
      isActive: recommendationsStatus === "generating",
      icon: ListChecks,
    },
  ];

  return (
    <div className="max-w-md mx-auto my-12 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
      <div className="text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        </div>
        <h3 className="text-base font-bold text-slate-100 tracking-tight">
          Analyzing Pitch Deck
        </h3>
        <p className="text-xs text-slate-400">
          {currentStage || "Synthesizing investor perspective..."}
        </p>
      </div>

      {/* Stepped Progress List */}
      <div className="space-y-3 pt-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 text-xs transition-colors ${
                step.isComplete
                  ? "text-slate-300"
                  : step.isActive
                  ? "text-blue-400 font-semibold"
                  : "text-slate-600"
              }`}
            >
              <div className="flex-shrink-0">
                {step.isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : step.isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] text-slate-600">
                    {idx + 1}
                  </div>
                )}
              </div>

              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

