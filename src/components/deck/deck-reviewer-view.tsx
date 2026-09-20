/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { LocalDeckFile, DeckProcessingState, HybridSlideData } from '@/types/deck';
import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap } from '@/types/claim';
import { DeckDiagnostics } from '@/types/diagnostics';
import { FundraisingEvaluation } from '@/types/evaluation';
import { InvestmentCase } from '@/types/investment-case';
import { InvestorSimulatorResult, SimulatorStatus } from '@/types/simulator';
import { ActionPlanResult, RecommendationsStatus } from '@/types/recommendations';

import { DeckUploadZone } from './deck-upload-zone';
import { executeHybridIngestionPipeline, PipelineProgressUpdate } from '@/lib/deck/hybrid-pipeline';
import { extractStartupProfile } from '@/lib/deck/startup-extractor';
import { extractClaimEvidenceMap } from '@/lib/deck/claim-extractor';
import { executeDeckDiagnostics } from '@/lib/deck/diagnostics-engine';
import { executeFundraisingEvaluation } from '@/lib/deck/thesis-evaluator';
import { executeInvestmentCaseReconstruction } from '@/lib/deck/investment-case-orchestrator';
import { executeInvestorSimulation } from '@/lib/deck/simulator-engine';
import { executeRecommendationGeneration } from '@/lib/deck/recommendations-engine';

// Modular Product Presentation Components
import { ReviewHeader } from './review/review-header';
import { ReviewNav, ReviewTab } from './review/review-nav';
import { OverviewView } from './review/overview-view';
import { InvestmentCaseView } from './review/investment-case-view';
import { DeckReviewWorkspace } from './review/deck-review-workspace';
import { ActionPlanView } from './review/action-plan-view';
import { InvestorPrepView } from './review/investor-prep-view';
import { CompanyContextView } from './review/company-context-view';
import { AdvancedEvidenceView } from './review/advanced-evidence-view';
import { LoadingPipelineView } from './review/loading-pipeline-view';

import { ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

export function DeckReviewerView() {
  const [selectedFile, setSelectedFile] = useState<LocalDeckFile | null>(null);
  const [processingState, setProcessingState] = useState<DeckProcessingState>({
    status: 'idle',
    progressPercent: 0,
    currentStage: '',
    inspectionResult: null,
    hybridResult: null,
    errorMessage: null,
  });

  // Navigation State
  const [activeNavTab, setActiveNavTab] = useState<ReviewTab>('overview');
  const [targetSlideNumber, setTargetSlideNumber] = useState<number>(1);

  // Analytical Pipeline States
  const [profileStatus, setProfileStatus] = useState<'idle' | 'extracting' | 'success' | 'error'>('idle');
  const [startupProfile, setStartupProfile] = useState<StartupProfile | null>(null);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);

  const [claimStatus, setClaimStatus] = useState<'idle' | 'extracting' | 'success' | 'error'>('idle');
  const [claimMap, setClaimMap] = useState<ClaimEvidenceMap | null>(null);
  const [claimErrorMessage, setClaimErrorMessage] = useState<string | null>(null);

  const [diagnosticStatus, setDiagnosticStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [deckDiagnostics, setDeckDiagnostics] = useState<DeckDiagnostics | null>(null);
  const [diagnosticErrorMessage, setDiagnosticErrorMessage] = useState<string | null>(null);

  const [evaluationStatus, setEvaluationStatus] = useState<'idle' | 'evaluating' | 'success' | 'error'>('idle');
  const [fundraisingEvaluation, setFundraisingEvaluation] = useState<FundraisingEvaluation | null>(null);
  const [evaluationErrorMessage, setEvaluationErrorMessage] = useState<string | null>(null);

  const [investmentCaseStatus, setInvestmentCaseStatus] = useState<'idle' | 'reconstructing' | 'success' | 'error'>('idle');
  const [investmentCase, setInvestmentCase] = useState<InvestmentCase | null>(null);
  const [investmentCaseErrorMessage, setInvestmentCaseErrorMessage] = useState<string | null>(null);

  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus>('idle');
  const [simulatorResult, setSimulatorResult] = useState<InvestorSimulatorResult | null>(null);
  const [simulatorErrorMessage, setSimulatorErrorMessage] = useState<string | null>(null);

  const [recommendationsStatus, setRecommendationsStatus] = useState<RecommendationsStatus>('idle');
  const [recommendationsResult, setRecommendationsResult] = useState<ActionPlanResult | null>(null);
  const [recommendationsErrorMessage, setRecommendationsErrorMessage] = useState<string | null>(null);

  const handleFileSelect = (file: LocalDeckFile | null) => {
    setSelectedFile(file);
    setProcessingState({
      status: 'idle',
      progressPercent: 0,
      currentStage: '',
      inspectionResult: null,
      hybridResult: null,
      errorMessage: null,
    });
    setActiveNavTab('overview');
    setTargetSlideNumber(1);
    setProfileStatus('idle');
    setStartupProfile(null);
    setProfileErrorMessage(null);
    setClaimStatus('idle');
    setClaimMap(null);
    setClaimErrorMessage(null);
    setDiagnosticStatus('idle');
    setDeckDiagnostics(null);
    setDiagnosticErrorMessage(null);
    setEvaluationStatus('idle');
    setFundraisingEvaluation(null);
    setEvaluationErrorMessage(null);
    setInvestmentCaseStatus('idle');
    setInvestmentCase(null);
    setInvestmentCaseErrorMessage(null);
    setSimulatorStatus('idle');
    setSimulatorResult(null);
    setSimulatorErrorMessage(null);
    setRecommendationsStatus('idle');
    setRecommendationsResult(null);
    setRecommendationsErrorMessage(null);
  };

  const runRecommendations = async (
    hybridResult: typeof processingState.hybridResult,
    profile: StartupProfile | null,
    claimMapData: ClaimEvidenceMap | null,
    diagnosticsData: DeckDiagnostics | null,
    evaluationData: FundraisingEvaluation | null,
    simulatorData: InvestorSimulatorResult | null,
    investmentCaseData: InvestmentCase | null
  ) => {
    if (!hybridResult) return;

    setRecommendationsStatus('generating');
    setRecommendationsErrorMessage(null);

    const runRes = await executeRecommendationGeneration(
      hybridResult,
      profile,
      claimMapData,
      diagnosticsData,
      evaluationData,
      simulatorData,
      investmentCaseData
    );

    if (runRes.result) {
      setRecommendationsStatus('success');
      setRecommendationsResult(runRes.result);
      if (runRes.usedFallback) {
        setRecommendationsErrorMessage('Recommendations synthesized via deterministic engine.');
      }
    } else {
      setRecommendationsStatus('error');
      setRecommendationsErrorMessage(runRes.error || 'Failed to generate founder recommendations.');
    }
  };

  const runInvestorSimulation = async (
    hybridResult: typeof processingState.hybridResult,
    profile: StartupProfile | null,
    claimMapData: ClaimEvidenceMap | null,
    diagnosticsData: DeckDiagnostics | null,
    evaluationData: FundraisingEvaluation | null,
    investmentCaseData: InvestmentCase | null
  ) => {
    if (!hybridResult) return;

    setSimulatorStatus('simulating');
    setSimulatorErrorMessage(null);

    const result = await executeInvestorSimulation(
      hybridResult,
      profile,
      claimMapData,
      diagnosticsData,
      evaluationData,
      investmentCaseData
    );

    let simData: InvestorSimulatorResult | null = null;
    if (result.data) {
      setSimulatorStatus('success');
      setSimulatorResult(result.data);
      simData = result.data;
      if (result.status === 'partial') {
        setSimulatorErrorMessage('Simulation generated via deterministic engine.');
      }
    } else {
      setSimulatorStatus('error');
      setSimulatorErrorMessage(result.errorMessage || 'Failed to complete investor simulation.');
    }

    // Automatically trigger Actionable Founder Recommendations
    await runRecommendations(
      hybridResult,
      profile,
      claimMapData,
      diagnosticsData,
      evaluationData,
      simData,
      investmentCaseData
    );
  };

  const runInvestmentCaseReconstruction = async (
    hybridResult: typeof processingState.hybridResult,
    profile: StartupProfile | null,
    claimMapData: ClaimEvidenceMap | null,
    diagnosticsData: DeckDiagnostics | null,
    evaluationData: FundraisingEvaluation | null
  ) => {
    if (!hybridResult) return;

    setInvestmentCaseStatus('reconstructing');
    setInvestmentCaseErrorMessage(null);

    const slideEv = (hybridResult.slides || []).map((s: HybridSlideData) => ({
      slideNumber: s.pageNumber,
      textContent: s.combinedEvidence?.normalizedText || s.nativeExtraction?.rawText || '',
    }));

    const result = await executeInvestmentCaseReconstruction(
      profile,
      claimMapData,
      diagnosticsData,
      evaluationData,
      slideEv
    );

    let generatedCase: InvestmentCase | null = null;
    if (result.investmentCase) {
      setInvestmentCaseStatus('success');
      setInvestmentCase(result.investmentCase);
      generatedCase = result.investmentCase;
      if (result.status === 'fallback') {
        setInvestmentCaseErrorMessage('Reconstructed via conservative deterministic engine.');
      }
    } else {
      setInvestmentCaseStatus('error');
      setInvestmentCaseErrorMessage(result.errorMessage || 'Failed to reconstruct investment case.');
    }

    // Automatically trigger Investor Diligence Simulator
    await runInvestorSimulation(
      hybridResult,
      profile,
      claimMapData,
      diagnosticsData,
      evaluationData,
      generatedCase
    );
  };

  const runFundraisingEvaluation = async (
    hybridResult: typeof processingState.hybridResult,
    profile: StartupProfile | null,
    claimMapData: ClaimEvidenceMap | null,
    diagnosticsData: DeckDiagnostics | null
  ) => {
    if (!hybridResult) return;

    setEvaluationStatus('evaluating');
    setEvaluationErrorMessage(null);

    const result = await executeFundraisingEvaluation(hybridResult, profile, claimMapData, diagnosticsData);

    let generatedEval: FundraisingEvaluation | null = null;
    if (result.evaluation) {
      setEvaluationStatus('success');
      setFundraisingEvaluation(result.evaluation);
      generatedEval = result.evaluation;
      if (result.status === 'partial') {
        setEvaluationErrorMessage('AI evaluation partially degraded; deterministic analysis displayed.');
      }
    } else if (result.status === 'skipped') {
      setEvaluationStatus('idle');
    } else {
      setEvaluationStatus('error');
      setEvaluationErrorMessage(result.errorMessage || 'Failed to complete fundraising evaluation.');
    }

    // Automatically trigger Investment Case Reconstruction
    await runInvestmentCaseReconstruction(hybridResult, profile, claimMapData, diagnosticsData, generatedEval);
  };

  const runDiagnostics = async (
    hybridResult: typeof processingState.hybridResult,
    profile: StartupProfile | null,
    claimMapData: ClaimEvidenceMap | null
  ) => {
    if (!hybridResult) return;

    setDiagnosticStatus('analyzing');
    setDiagnosticErrorMessage(null);

    const result = await executeDeckDiagnostics(hybridResult, profile, claimMapData);

    let generatedDiagnostics: DeckDiagnostics | null = null;
    if (result.diagnostics) {
      setDiagnosticStatus('success');
      setDeckDiagnostics(result.diagnostics);
      generatedDiagnostics = result.diagnostics;
      if (result.status === 'partial') {
        setDiagnosticErrorMessage('Semantic diagnostics unavailable; deterministic diagnostics displayed.');
      }
    } else if (result.status === 'skipped') {
      setDiagnosticStatus('idle');
    } else {
      setDiagnosticStatus('error');
      setDiagnosticErrorMessage(result.errorMessage || 'Failed to complete deck diagnostics.');
    }

    // Automatically trigger Fundraising Narrative Evaluation
    await runFundraisingEvaluation(hybridResult, profile, claimMapData, generatedDiagnostics);
  };

  const runClaimExtraction = async (
    hybridResult: typeof processingState.hybridResult,
    profile: StartupProfile | null
  ) => {
    if (!hybridResult) return;

    setClaimStatus('extracting');
    setClaimErrorMessage(null);

    const result = await extractClaimEvidenceMap(hybridResult, profile);

    let extractedMap: ClaimEvidenceMap | null = null;
    if (result.status === 'success' && result.map) {
      setClaimStatus('success');
      setClaimMap(result.map);
      extractedMap = result.map;
    } else if (result.status === 'skipped') {
      setClaimStatus('idle');
    } else {
      setClaimStatus('error');
      setClaimErrorMessage(result.errorMessage || 'Failed to extract claim and evidence map.');
    }

    // Automatically trigger Deck Diagnostics
    await runDiagnostics(hybridResult, profile, extractedMap);
  };

  const runProfileExtraction = async (hybridResult: typeof processingState.hybridResult) => {
    if (!hybridResult) return;

    setProfileStatus('extracting');
    setProfileErrorMessage(null);

    const result = await extractStartupProfile(hybridResult);

    let extractedProfile: StartupProfile | null = null;
    if (result.status === 'success' && result.profile) {
      setProfileStatus('success');
      setStartupProfile(result.profile);
      extractedProfile = result.profile;
    } else if (result.status === 'skipped') {
      setProfileStatus('idle');
    } else {
      setProfileStatus('error');
      setProfileErrorMessage(result.errorMessage || 'Failed to extract structured company profile.');
    }

    // Automatically trigger Claim & Evidence Map extraction
    await runClaimExtraction(hybridResult, extractedProfile);
  };

  const handleAnalyzeDeck = async () => {
    if (!selectedFile || processingState.status === 'reading' || processingState.status === 'analyzing') return;

    setProcessingState({
      status: 'analyzing',
      progressPercent: 5,
      currentStage: 'Initializing deck ingestion…',
      inspectionResult: null,
      hybridResult: null,
      errorMessage: null,
    });
    setProfileStatus('idle');
    setStartupProfile(null);
    setProfileErrorMessage(null);
    setClaimStatus('idle');
    setClaimMap(null);
    setClaimErrorMessage(null);
    setDiagnosticStatus('idle');
    setDeckDiagnostics(null);
    setDiagnosticErrorMessage(null);
    setEvaluationStatus('idle');
    setFundraisingEvaluation(null);
    setEvaluationErrorMessage(null);
    setInvestmentCaseStatus('idle');
    setInvestmentCase(null);
    setInvestmentCaseErrorMessage(null);
    setSimulatorStatus('idle');
    setSimulatorResult(null);
    setSimulatorErrorMessage(null);
    setRecommendationsStatus('idle');
    setRecommendationsResult(null);
    setRecommendationsErrorMessage(null);

    try {
      const hybridResult = await executeHybridIngestionPipeline(
        selectedFile.file,
        (update: PipelineProgressUpdate) => {
          setProcessingState((prev) => ({
            ...prev,
            progressPercent: update.progressPercent,
            currentStage: update.stage,
          }));
        }
      );

      setProcessingState({
        status: 'success',
        progressPercent: 100,
        currentStage: 'Ingestion Complete',
        inspectionResult: null,
        hybridResult,
        errorMessage: null,
      });

      // Automatically chain downstream extractions
      await runProfileExtraction(hybridResult);
    } catch (err) {
      setProcessingState({
        status: 'error',
        progressPercent: 0,
        currentStage: '',
        inspectionResult: null,
        hybridResult: null,
        errorMessage: err instanceof Error ? err.message : 'Failed to ingest deck.',
      });
    }
  };

  const hybrid = processingState.hybridResult;
  const isPipelineActive =
    processingState.status === 'analyzing' ||
    profileStatus === 'extracting' ||
    claimStatus === 'extracting' ||
    diagnosticStatus === 'analyzing' ||
    evaluationStatus === 'evaluating' ||
    investmentCaseStatus === 'reconstructing' ||
    simulatorStatus === 'simulating' ||
    recommendationsStatus === 'generating';

  // Navigation handlers
  const handleNavigateToSlide = (slideNum: number) => {
    setTargetSlideNumber(slideNum);
    setActiveNavTab('deck_review');
  };

  const handleNavigateToActionPlan = () => {
    setActiveNavTab('action_plan');
  };

  const handleNavigateToInvestorPrep = () => {
    setActiveNavTab('investor_prep');
  };

  return (
    <div className="w-full">
      {/* 1. INITIAL UPLOAD / IDLE STATE */}
      {!hybrid && !isPipelineActive && (
        <div className="max-w-2xl mx-auto space-y-6 pt-4">
          <div className="text-center space-y-3 pb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Startup Readiness</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Pitch Deck Reviewer
            </h1>

            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-lg mx-auto">
              Upload your pitch deck to understand what investors will see, where the story breaks, and what to fix before you send it.
            </p>
          </div>

          <DeckUploadZone
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            disabled={processingState.status === 'reading' || processingState.status === 'analyzing'}
          />

          {selectedFile && processingState.status === 'idle' && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleAnalyzeDeck}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Review Pitch Deck</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          )}

          {processingState.status === 'error' && processingState.errorMessage && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Unable to analyze deck</p>
                <p className="text-rose-300/80 mt-0.5">{processingState.errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. AUTHENTIC STEPPED PIPELINE LOADING STATE */}
      {isPipelineActive && (
        <LoadingPipelineView
          currentStage={processingState.currentStage}
          progressPercent={processingState.progressPercent}
          profileStatus={profileStatus}
          claimStatus={claimStatus}
          diagnosticStatus={diagnosticStatus}
          evaluationStatus={evaluationStatus}
          investmentCaseStatus={investmentCaseStatus}
          simulatorStatus={simulatorStatus}
          recommendationsStatus={recommendationsStatus}
        />
      )}

      {/* 3. COMPLETED DECK REVIEW PRODUCT INTERFACE */}
      {hybrid && !isPipelineActive && (
        <div className="w-full flex flex-col space-y-4">
          {/* Persistent Top Header */}
          <ReviewHeader
            file={selectedFile}
            totalPages={hybrid.slides.length}
            profile={startupProfile}
            isAiAssisted={!recommendationsErrorMessage}
            onReset={() => handleFileSelect(null)}
          />

          {/* Core Product Layout: Sidebar Navigation + Active View Pane */}
          <div className="w-full flex flex-col md:flex-row gap-6 items-start">
            {/* Left Nav */}
            <ReviewNav
              activeTab={activeNavTab}
              onTabChange={setActiveNavTab}
              criticalIssuesCount={recommendationsResult?.summary?.criticalCount}
              investorQuestionsCount={simulatorResult?.questions?.length}
            />

            {/* Active View Container */}
            <main className="flex-1 w-full min-w-0 pb-12">
              {activeNavTab === 'overview' && (
                <OverviewView
                  evaluation={fundraisingEvaluation}
                  recommendations={recommendationsResult}
                  simulatorResult={simulatorResult}
                  onNavigateToSlide={handleNavigateToSlide}
                  onNavigateToActionPlan={handleNavigateToActionPlan}
                  onNavigateToInvestorPrep={handleNavigateToInvestorPrep}
                />
              )}

              {activeNavTab === 'investment_case' && (
                <InvestmentCaseView investmentCase={investmentCase} />
              )}

              {activeNavTab === 'deck_review' && (
                <DeckReviewWorkspace
                  slides={hybrid.slides}
                  recommendations={recommendationsResult}
                  diagnostics={deckDiagnostics}
                  evaluation={fundraisingEvaluation}
                  claimMap={claimMap}
                  initialSlideNumber={targetSlideNumber}
                  onNavigateToActionPlan={handleNavigateToActionPlan}
                  onNavigateToInvestorPrep={handleNavigateToInvestorPrep}
                />
              )}

              {activeNavTab === 'action_plan' && recommendationsResult && (
                <ActionPlanView
                  actionPlan={recommendationsResult}
                  onNavigateToSlide={handleNavigateToSlide}
                  onNavigateToInvestorPrep={handleNavigateToInvestorPrep}
                />
              )}

              {activeNavTab === 'investor_prep' && simulatorResult && (
                <InvestorPrepView
                  simulatorResult={simulatorResult}
                  onNavigateToSlide={handleNavigateToSlide}
                />
              )}

              {activeNavTab === 'company_context' && startupProfile && (
                <CompanyContextView
                  profile={startupProfile}
                  onNavigateToSlide={handleNavigateToSlide}
                />
              )}

              {activeNavTab === 'advanced_evidence' && (
                <AdvancedEvidenceView
                  claimMap={claimMap}
                  diagnostics={deckDiagnostics}
                  hybridResult={hybrid}
                  onNavigateToSlide={handleNavigateToSlide}
                />
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
