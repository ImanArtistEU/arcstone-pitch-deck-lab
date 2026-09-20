"use client";

import React, { useState } from "react";
import {
  Building2,
  DollarSign,
  Target,
  Users,
  Briefcase,
  TrendingUp,
  Share2,
  Compass,
  Cpu,
  Layers,
  FileText,
  AlertCircle,
} from "lucide-react";
import { StartupProfile, ProfileField } from "@/types/startup";

interface CompanyContextViewProps {
  profile: StartupProfile;
  onNavigateToSlide?: (slideNumber: number) => void;
}

export function CompanyContextView({
  profile,
  onNavigateToSlide,
}: CompanyContextViewProps) {
  const [activeSection, setActiveSection] = useState<string>("all");

  const sections = [
    { id: "all", label: "All Context", icon: Layers },
    { id: "identity", label: "Company", icon: Building2 },
    { id: "fundraising", label: "Raise", icon: DollarSign },
    { id: "problemSolution", label: "Problem & Solution", icon: Target },
    { id: "customerICP", label: "Customer & ICP", icon: Users },
    { id: "businessModel", label: "Business Model", icon: Briefcase },
    { id: "traction", label: "Traction", icon: TrendingUp },
    { id: "goToMarket", label: "GTM", icon: Share2 },
    { id: "market", label: "Market", icon: Compass },
    { id: "competition", label: "Competition", icon: Users },
    { id: "team", label: "Team", icon: Users },
    { id: "technology", label: "Technology", icon: Cpu },
  ];

  // Render a clean field row
  const renderField = (
    label: string,
    field?: ProfileField<any> | null,
    isMaterial: boolean = false
  ) => {
    if (!field || field.status === "not_found") {
      if (!isMaterial) return null; // Hide empty non-material fields
      return (
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-slate-800/60 text-xs">
          <span className="text-slate-400 font-medium sm:w-1/3">{label}</span>
          <span className="text-amber-400/80 italic sm:w-2/3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span>Not stated in deck</span>
          </span>
        </div>
      );
    }

    const value = field.rawValue;
    const slides = Array.from(new Set(field.evidence?.map((e) => e.slideNumber) || []));

    return (
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-slate-800/60 text-xs gap-1 sm:gap-4">
        <span className="text-slate-400 font-medium sm:w-1/3">{label}</span>
        <div className="sm:w-2/3 flex items-center justify-between gap-2">
          <span className="text-slate-100 font-medium">{String(value)}</span>
          {slides.length > 0 && (
            <span
              onClick={() => onNavigateToSlide && onNavigateToSlide(slides[0])}
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 flex-shrink-0 ${
                onNavigateToSlide ? "cursor-pointer hover:bg-slate-700 hover:text-white" : ""
              }`}
              title={`View on Slide ${slides.join(", ")}`}
            >
              Slide {slides.join(", ")}
            </span>
          )}
        </div>
      </div>
    );
  };

  const showSection = (id: string) => activeSection === "all" || activeSection === id;

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-4">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
          Company Context
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Structured startup information extracted and validated directly from slide evidence.
        </p>

        {/* Section Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-4 no-scrollbar">
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeSection === sec.id
                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-slate-800"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Structured Sections */}
      <div className="space-y-6">
        {/* Company Identity */}
        {showSection("identity") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Company Identity</span>
            </h3>
            {renderField("Company Name", profile.identity?.companyName, true)}
            {renderField("Tagline / Mission", profile.identity?.tagline)}
            {renderField("Website", profile.identity?.website)}
            {renderField("Headquarters", profile.identity?.headquarters)}
            {renderField("Founding Year", profile.identity?.foundingYear)}
          </div>
        )}

        {/* Raise / Fundraising */}
        {showSection("fundraising") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Fundraising Terms</span>
            </h3>
            {renderField("Target Amount", profile.fundraising?.amountBeingRaised, true)}
            {renderField("Round / Stage", profile.fundraising?.roundBeingRaised, true)}
            {renderField("Use of Funds", profile.fundraising?.useOfFunds, true)}
            {renderField("Target Runway", profile.fundraising?.runway)}
            {renderField("Previous Funding", profile.fundraising?.previousFunding)}
          </div>
        )}

        {/* Problem & Solution */}
        {showSection("problemSolution") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-rose-400" />
              <span>Problem & Value Proposition</span>
            </h3>
            {renderField("Problem Statement", profile.problemSolution?.problemStatement, true)}
            {renderField("Product Description", profile.problemSolution?.productDescription, true)}
            {renderField("Core Value Proposition", profile.problemSolution?.valueProposition, true)}
            {renderField("Target User Pain", profile.problemSolution?.targetUserPain)}
            {renderField("Current Alternatives", profile.problemSolution?.currentAlternatives)}
          </div>
        )}

        {/* Customer & ICP */}
        {showSection("customerICP") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Customer ICP</span>
            </h3>
            {renderField("Customer Type", profile.customerICP?.customerType, true)}
            {renderField("Target Segments", profile.customerICP?.targetSegments)}
            {renderField("Buyer Persona", profile.customerICP?.buyerPersona)}
            {renderField("Target Geography", profile.customerICP?.geography)}
          </div>
        )}

        {/* Business Model */}
        {showSection("businessModel") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Briefcase className="w-4 h-4 text-amber-400" />
              <span>Business Model & Economics</span>
            </h3>
            {renderField("Revenue Model", profile.businessModel?.revenueModel, true)}
            {renderField("Pricing Structure", profile.businessModel?.pricingModel, true)}
            {renderField("Pricing Tiers / ACV", profile.businessModel?.pricingValues, true)}
            {renderField("Unit Economics (CAC, Payback)", profile.businessModel?.unitEconomics, true)}
          </div>
        )}

        {/* Traction */}
        {showSection("traction") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Traction & Metrics</span>
            </h3>
            {renderField("ARR / Revenue", profile.traction?.ARR || profile.traction?.revenue, true)}
            {renderField("Customer Count", profile.traction?.customerCount, true)}
            {renderField("Growth Rate", profile.traction?.growthRates, true)}
            {renderField("Retention / Churn", profile.traction?.retentionMetrics || profile.traction?.churn, true)}
          </div>
        )}

        {/* Market */}
        {showSection("market") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Compass className="w-4 h-4 text-blue-400" />
              <span>Market Opportunity</span>
            </h3>
            {renderField("TAM (Total Addressable Market)", profile.market?.TAM, true)}
            {renderField("SAM (Serviceable Addressable)", profile.market?.SAM)}
            {renderField("SOM (Serviceable Obtainable)", profile.market?.SOM)}
            {renderField("Market Growth Rate", profile.market?.marketGrowth)}
          </div>
        )}

        {/* Go To Market */}
        {showSection("goToMarket") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>Go-To-Market Strategy</span>
            </h3>
            {renderField("Acquisition Channels", profile.goToMarket?.acquisitionChannels, true)}
            {renderField("Sales Motion", profile.goToMarket?.salesMotion, true)}
            {renderField("Distribution Strategy", profile.goToMarket?.distributionStrategy)}
          </div>
        )}

        {/* Competition */}
        {showSection("competition") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Competitive Landscape</span>
            </h3>
            {renderField("Named Competitors", profile.competition?.namedCompetitors, true)}
            {renderField("Differentiation Claims", profile.competition?.differentiationClaims, true)}
          </div>
        )}

        {/* Technology */}
        {showSection("technology") && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Technology & Defensibility</span>
            </h3>
            {renderField("Core Technology", profile.technology?.coreTechnology)}
            {renderField("Proprietary IP", profile.technology?.proprietaryClaims)}
            {renderField("Integrations", profile.technology?.integrations)}
          </div>
        )}
      </div>
    </div>
  );
}

