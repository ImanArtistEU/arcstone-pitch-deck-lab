'use client';

import React from 'react';
import { InvestmentCase } from '@/types/investment-case';

interface InvestmentCaseViewProps {
  investmentCase: InvestmentCase | null;
}

export function InvestmentCaseView({ investmentCase }: InvestmentCaseViewProps) {
  if (!investmentCase) {
    return (
      <div className="p-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
        <p className="text-sm">Investment Case reconstruction not yet generated for this deck.</p>
      </div>
    );
  }

  const { investmentThesis, mechanisms, whatMustBeTrue, risks, unresolvedQuestions, caseSummary } =
    investmentCase;

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'supported':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'partially_supported':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'asserted_only':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'unsupported':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'not_yet_testable':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-8 text-slate-100">
      {/* 1. Header & Thesis Reconstruction */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Reconstructed Investment Case</h2>
            <p className="text-xs text-slate-400 mt-1">
              Underwriting primitives: What an institutional investor implicitly underwrites.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
            No Score • Causal Logic
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-2">
              Deck-Stated Thesis
            </span>
            <p className="text-sm text-slate-300 leading-relaxed">
              {investmentThesis?.statedThesis || 'Deck asserts general solution and market opportunity.'}
            </p>
          </div>

          <div className="bg-blue-950/20 p-4 rounded-lg border border-blue-900/30">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 block mb-2">
              Reconstructed Causal Thesis
            </span>
            <p className="text-sm text-blue-200 leading-relaxed font-medium">
              {investmentThesis?.reconstructedThesis || investmentThesis?.summary}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Bottlenecks & What Must Be True */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-semibold text-white">What Must Be True</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Necessary conditions for this investment case to achieve venture-scale outcome.
          </p>
        </div>

        {caseSummary?.thesisBottlenecks && caseSummary.thesisBottlenecks.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
              Single Point of Failure / Thesis Bottlenecks
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-amber-200/90">
              {caseSummary.thesisBottlenecks.map((b, idx) => (
                <li key={idx}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {whatMustBeTrue?.map((wmbt) => (
            <div
              key={wmbt.id}
              className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${getImportanceBadge(
                        wmbt.importance
                      )}`}
                    >
                      {wmbt.importance}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border border-slate-700 text-slate-400">
                      {wmbt.assumptionOrigin}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${getStatusBadge(
                        wmbt.evidenceStatus
                      )}`}
                    >
                      {wmbt.evidenceStatus.replace('_', ' ')}
                    </span>
                    {wmbt.isThesisBottleneck && (
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
                        Bottleneck
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-200 pt-1">{wmbt.statement}</p>
                </div>
              </div>

              {wmbt.bottleneckReason && (
                <p className="text-xs text-amber-300/90 bg-amber-950/30 p-2 rounded border border-amber-900/30">
                  <span className="font-semibold">Bottleneck Impact: </span>
                  {wmbt.bottleneckReason}
                </p>
              )}

              {wmbt.suggestedFounderAction && (
                <div className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800 flex items-center justify-between">
                  <span>
                    <span className="text-blue-400 font-semibold uppercase text-[10px] mr-2">
                      [{wmbt.suggestedFounderAction.scope.replace('_', ' ')}]
                    </span>
                    {wmbt.suggestedFounderAction.action}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Mechanisms & Key Risks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mechanisms */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-white">Underwritten Mechanisms</h3>
          <div className="space-y-3">
            {mechanisms?.map((m) => (
              <div key={m.id} className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400 uppercase">{m.category.replace('_', ' ')}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getStatusBadge(m.evidenceStatus)}`}>
                    {m.evidenceStatus.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-medium">{m.statement}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Material Risks */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-white">Second-Order Underwriting Risks</h3>
          <div className="space-y-3">
            {risks?.map((r) => (
              <div key={r.id} className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">{r.title}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getImportanceBadge(r.severity)}`}>
                    {r.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{r.description}</p>
                <p className="text-[11px] text-slate-400 italic">Why it matters: {r.whyItMatters}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
