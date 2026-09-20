"use client";

import React from "react";
import {
  LayoutDashboard,
  Presentation,
  ListChecks,
  HelpCircle,
  Building2,
  Scale,
} from "lucide-react";

export type ReviewTab =
  | "overview"
  | "investment_case"
  | "deck_review"
  | "action_plan"
  | "investor_prep"
  | "company_context"
  | "advanced_evidence";

interface ReviewNavProps {
  activeTab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  criticalIssuesCount?: number;
  investorQuestionsCount?: number;
}

export function ReviewNav({
  activeTab,
  onTabChange,
  criticalIssuesCount = 0,
  investorQuestionsCount = 0,
}: ReviewNavProps) {
  const primaryNavItems: {
    id: ReviewTab;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeType?: "critical" | "neutral";
  }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "investment_case",
      label: "Investment Case",
      icon: Scale,
    },
    {
      id: "deck_review",
      label: "Deck Review",
      icon: Presentation,
    },
    {
      id: "action_plan",
      label: "Action Plan",
      icon: ListChecks,
      badge: criticalIssuesCount > 0 ? criticalIssuesCount : undefined,
      badgeType: "critical",
    },
    {
      id: "investor_prep",
      label: "Investor Prep",
      icon: HelpCircle,
      badge: investorQuestionsCount > 0 ? investorQuestionsCount : undefined,
      badgeType: "neutral",
    },
    {
      id: "company_context",
      label: "Company Context",
      icon: Building2,
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Navigation Sidebar */}
      <nav className="w-60 flex-shrink-0 flex flex-col justify-between py-6 px-3 bg-slate-950/40 border-r border-slate-800/80 min-h-[calc(100vh-65px)] hidden md:flex">
        <div className="space-y-1.5">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Review Modules
          </div>

          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive
                        ? "text-blue-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      item.badgeType === "critical"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Horizontal Navigation Header */}
      <nav className="w-full flex md:hidden overflow-x-auto py-2 px-3 gap-2 bg-slate-950/80 border-b border-slate-800 shrink-0">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:bg-slate-900 border border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
