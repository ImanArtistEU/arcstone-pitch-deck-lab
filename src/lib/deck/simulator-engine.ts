import { HybridDeckResult } from '@/types/deck';
import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap } from '@/types/claim';
import { DeckDiagnostics } from '@/types/diagnostics';
import { FundraisingEvaluation } from '@/types/evaluation';
import { InvestmentCase } from '@/types/investment-case';
import {
  InvestorQuestion,
  InvestorSimulatorResult,
  PreparationSummary,
  QuestionCategory,
  QuestionPriority,
  QuestionType,
  AnswerabilityStatus,
} from '@/types/simulator';

import { getOrBuildEvaluationContextAndExpectations } from './evaluation-context';

export interface SimulatorRunResult {
  status: 'success' | 'partial' | 'error';
  data: InvestorSimulatorResult;
  source: 'gemini' | 'deterministic_fallback';
  errorMessage?: string;
}

/**
 * Pre-select high-value triggers deterministically from existing analytical stack.
 */
export function selectDeterministicTriggers(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  evaluation: FundraisingEvaluation | null
): Array<{
  category: string;
  triggerType: string;
  summary: string;
  slideNumbers: number[];
  claimId?: string;
  diagnosticId?: string;
}> {
  const triggers: Array<{
    category: string;
    triggerType: string;
    summary: string;
    slideNumbers: number[];
    claimId?: string;
    diagnosticId?: string;
  }> = [];

  // 1. Contradictions (Top priority triggers)
  for (const c of diagnostics?.contradictions || []) {
    triggers.push({
      category: c.category,
      triggerType: 'contradiction',
      summary: c.description,
      slideNumbers: c.conflictingStatements.map((s) => s.slideNumber),
      diagnosticId: c.id,
    });
  }

  // 2. Evidence Gaps for Core Claims
  for (const eg of diagnostics?.evidenceGaps || []) {
    if (eg.importance === 'core' || eg.severity === 'critical' || eg.severity === 'material') {
      triggers.push({
        category: eg.claimType,
        triggerType: 'evidence_gap',
        summary: `Claim "${eg.claimText}" lacks substantiation: ${eg.missingEvidenceDescription}`,
        slideNumbers: eg.slideNumbers,
        claimId: eg.claimId,
        diagnosticId: eg.id,
      });
    }
  }

  // 3. Underdeveloped or Missing Dimensions
  for (const dim of evaluation?.dimensions || []) {
    if (dim.status === 'MISSING' || dim.status === 'UNDERDEVELOPED' || dim.status === 'CONTRADICTORY') {
      triggers.push({
        category: dim.dimensionName,
        triggerType: dim.status.toLowerCase(),
        summary: dim.finding,
        slideNumbers: dim.slideReferences || [],
      });
    }
  }

  // 4. Strong Claims / Proven Proof Points to Diligence (e.g. ARR, Growth)
  for (const c of claimMap?.claims || []) {
    if (c.supportStatus === 'supported' && (c.claimType === 'traction' || c.claimType === 'revenue')) {
      triggers.push({
        category: 'traction',
        triggerType: 'strong_claim_diligence',
        summary: `Verified traction: "${c.claimText}"`,
        slideNumbers: c.evidence.map((e) => e.slideNumber),
        claimId: c.id,
      });
    }
  }

  // 5. Fundraising Ask
  if (profile?.fundraising?.amountBeingRaised?.rawValue) {
    triggers.push({
      category: 'fundraising',
      triggerType: 'fundraising_ask',
      summary: `Seeking ${profile.fundraising.amountBeingRaised.rawValue} for ${profile.fundraising.useOfFunds?.rawValue || 'stated milestones'}`,
      slideNumbers: profile.fundraising.amountBeingRaised.evidence?.map((e) => e.slideNumber) || [],
    });
  }

  return triggers.slice(0, 15);
}

/**
 * Basic semantic normalization for question deduplication.
 */
function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function areQuestionsSemanticallyDuplicate(q1: string, q2: string): boolean {
  const norm1 = normalizeQuestion(q1);
  const norm2 = normalizeQuestion(q2);

  if (norm1 === norm2) return true;

  // Check word overlap for acquisition questions
  const isAcq1 = norm1.includes('acquir') || norm1.includes('acquisition') || norm1.includes('gtm') || norm1.includes('go to market');
  const isAcq2 = norm2.includes('acquir') || norm2.includes('acquisition') || norm2.includes('gtm') || norm2.includes('go to market');
  if (isAcq1 && isAcq2 && (norm1.includes('how') || norm1.includes('strategy')) && (norm2.includes('how') || norm2.includes('strategy'))) {
    return true;
  }

  // Check word overlap for competitive advantage questions
  const isComp1 = norm1.includes('compet') || norm1.includes('differentiat') || norm1.includes('moat') || norm1.includes('defens');
  const isComp2 = norm2.includes('compet') || norm2.includes('differentiat') || norm2.includes('moat') || norm2.includes('defens');
  if (isComp1 && isComp2 && (norm1.includes('advantage') || norm1.includes('why')) && (norm2.includes('advantage') || norm2.includes('why'))) {
    return true;
  }

  return false;
}

/**
 * Deduplicate questions array while preserving highest priority questions.
 */
export function deduplicateQuestions(questions: InvestorQuestion[]): InvestorQuestion[] {
  const priorityOrder: Record<QuestionPriority, number> = {
    CRITICAL: 3,
    HIGH: 2,
    MEDIUM: 1,
  };

  const sorted = [...questions].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  const result: InvestorQuestion[] = [];

  for (const q of sorted) {
    const isDuplicate = result.some((existing) => areQuestionsSemanticallyDuplicate(existing.question, q.question));
    if (!isDuplicate) {
      result.push(q);
    }
  }

  return result;
}

/**
 * Collect all known verified quantitative numbers/strings from profile and claimMap.
 */
function extractKnownQuantitativeTokens(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null
): Set<string> {
  const tokens = new Set<string>();

  const addText = (text?: string) => {
    if (!text) return;
    const matches = text.match(/[€$£]?\d+(?:[.,]\d+)?\s*(?:[kKmMbB]|million|billion|arr|mrr|%|fleets|users|customers|fte)?/gi);
    if (matches) {
      for (const m of matches) {
        tokens.add(m.toLowerCase().replace(/\s+/g, ''));
      }
    }
  };

  if (profile) {
    addText(profile.fundraising?.amountBeingRaised?.rawValue);
    addText(profile.traction?.ARR?.rawValue);
    addText(profile.traction?.revenue?.rawValue);
    addText(profile.traction?.customerCount?.rawValue);
    addText(profile.traction?.growthRates?.rawValue);
    addText(profile.market?.TAM?.rawValue);
  }

  if (claimMap) {
    for (const c of claimMap.claims) {
      addText(c.claimText);
    }
  }

  return tokens;
}

/**
 * Post-process questions, sanitize against hallucinations, clamp slides, and verify grounding.
 */
export function postProcessQuestions(
  rawQuestions: InvestorQuestion[],
  totalPages: number,
  validClaimIds: Set<string>,
  validDiagnosticIds: Set<string>,
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null
): InvestorQuestion[] {
  const knownTokens = extractKnownQuantitativeTokens(profile, claimMap);

  const processed = rawQuestions.map((q) => {
    // 1. Clamp slide numbers
    const sanitizedSlides = (q.trigger?.slideNumbers || [])
      .filter((s) => typeof s === 'number' && s >= 1 && s <= totalPages);

    const sanitizedClaimIds = (q.trigger?.relatedClaimIds || []).filter((id) => validClaimIds.has(id));
    const sanitizedDiagIds = (q.trigger?.relatedDiagnosticIds || []).filter((id) => validDiagnosticIds.has(id));

    // 2. Clamp evidence slides
    const sanitizedEvidence = (q.availableEvidence || [])
      .filter((e) => typeof e.slideNumber === 'number' && e.slideNumber >= 1 && e.slideNumber <= totalPages);

    // 3. Hallucination check on groundedAnswer
    let groundedAnswer = q.groundedAnswer;
    if (groundedAnswer && groundedAnswer !== 'Current deck evidence is insufficient to construct a reliable answer.') {
      // Find numbers/metrics in groundedAnswer
      const answerNumbers = groundedAnswer.match(/[€$£]\d+(?:[.,]\d+)?\s*(?:[kKmMbB]|million|billion)?/gi) || [];
      for (const num of answerNumbers) {
        const cleanNum = num.toLowerCase().replace(/\s+/g, '');
        // If an ungrounded metric like €4M is detected and not in known tokens
        let matchesAnyKnown = false;
        for (const token of knownTokens) {
          if (token.includes(cleanNum) || cleanNum.includes(token)) {
            matchesAnyKnown = true;
            break;
          }
        }
        if (!matchesAnyKnown) {
          // Reject hallucinated factual statement
          groundedAnswer = 'Current deck evidence is insufficient to construct a reliable answer.';
          break;
        }
      }
    }

    // 4. Cap follow-ups to at most 2
    const likelyFollowUps = (q.likelyFollowUps || []).slice(0, 2);

    return {
      ...q,
      trigger: {
        ...q.trigger,
        slideNumbers: sanitizedSlides,
        relatedClaimIds: sanitizedClaimIds,
        relatedDiagnosticIds: sanitizedDiagIds,
      },
      availableEvidence: sanitizedEvidence,
      groundedAnswer,
      likelyFollowUps,
    };
  });

  return deduplicateQuestions(processed);
}

/**
 * Compute Preparation Summary from final questions.
 */
export function computePreparationSummary(questions: InvestorQuestion[]): PreparationSummary {
  const exposedCategoryCounts: Record<string, number> = {};

  let wellSupportedCount = 0;
  let partiallySupportedCount = 0;
  let weaklySupportedCount = 0;
  let unansweredCount = 0;
  let contradictoryCount = 0;

  for (const q of questions) {
    switch (q.currentAnswerability) {
      case 'WELL_SUPPORTED':
        wellSupportedCount++;
        break;
      case 'PARTIALLY_SUPPORTED':
        partiallySupportedCount++;
        exposedCategoryCounts[q.category] = (exposedCategoryCounts[q.category] || 0) + 1;
        break;
      case 'WEAKLY_SUPPORTED':
        weaklySupportedCount++;
        exposedCategoryCounts[q.category] = (exposedCategoryCounts[q.category] || 0) + 2;
        break;
      case 'UNANSWERED':
        unansweredCount++;
        exposedCategoryCounts[q.category] = (exposedCategoryCounts[q.category] || 0) + 3;
        break;
      case 'CONTRADICTORY':
        contradictoryCount++;
        exposedCategoryCounts[q.category] = (exposedCategoryCounts[q.category] || 0) + 4;
        break;
    }
  }

  const mostExposedAreas = Object.entries(exposedCategoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat.replace(/_/g, ' ').toUpperCase());

  return {
    totalQuestions: questions.length,
    wellSupportedCount,
    partiallySupportedCount,
    weaklySupportedCount,
    unansweredCount,
    contradictoryCount,
    mostExposedAreas: mostExposedAreas.length > 0 ? mostExposedAreas : ['GENERAL DILIGENCE'],
  };
}

/**
 * Generate fallback deterministic simulator questions when Gemini is unavailable.
 */
export function generateDeterministicSimulatorQuestions(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  evaluation: FundraisingEvaluation | null,
  totalPages: number
): InvestorSimulatorResult {
  const questions: InvestorQuestion[] = [];
  let qCount = 1;

  // 1. Contradictions (Critical)
  for (const c of diagnostics?.contradictions || []) {
    const s1 = c.conflictingStatements[0]?.slideNumber ? `Slide ${c.conflictingStatements[0].slideNumber}` : 'One deck section';
    const s2 = c.conflictingStatements[1]?.slideNumber ? `Slide ${c.conflictingStatements[1].slideNumber}` : 'another deck section';
    questions.push({
      id: `sim-q-${qCount++}`,
      question: `${s1} indicates "${c.conflictingStatements[0]?.text || ''}", whereas ${s2} states "${c.conflictingStatements[1]?.text || ''}". How do you reconcile this discrepancy?`,
      category: 'traction',
      priority: 'CRITICAL',
      questionType: 'CLARIFICATION',
      whyInvestorAsks: `Direct data contradiction identified between slides ${c.conflictingStatements.map((s) => s.slideNumber).join(' and ')}.`,
      trigger: {
        relatedDimension: 'Traction Credibility',
        relatedClaimIds: [],
        relatedDiagnosticIds: [c.id],
        slideNumbers: c.conflictingStatements.map((s) => s.slideNumber),
        triggerSummary: c.description,
      },
      currentAnswerability: 'CONTRADICTORY',
      availableEvidence: c.conflictingStatements.map((s) => ({
        slideNumber: s.slideNumber,
        statement: s.text,
        source: s.source,
      })),
      missingInformation: ['A reconciled source of truth reconciling both metrics and timeframes.'],
      preparationGuidance: 'Clarify the exact cutoff dates, measurement methodologies, and underlying dataset differences.',
      groundedAnswer: 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'Which number is reflected in your audited financial reports?',
        'Has customer reporting changed recently?',
      ],
      confidence: 'high',
    });
  }

  // 2. Business Model Gap
  const bmDimension = evaluation?.dimensions.find((d) => d.dimensionName === 'Business Model Clarity');
  const hasMonetization = !!profile?.businessModel?.revenueModel?.rawValue && profile.businessModel.revenueModel.rawValue !== 'not_found';
  if (!hasMonetization || bmDimension?.status === 'MISSING') {
    questions.push({
      id: `sim-q-${qCount++}`,
      question: 'Who explicitly pays for the solution, and what is the exact monetization mechanism and contract pricing?',
      category: 'business_model',
      priority: 'CRITICAL',
      questionType: 'ECONOMICS',
      whyInvestorAsks: 'The pitch deck establishes a product and customer ICP but omits the commercial revenue model.',
      trigger: {
        relatedDimension: 'Business Model Clarity',
        relatedClaimIds: [],
        relatedDiagnosticIds: [],
        slideNumbers: [1, 2],
        triggerSummary: 'Monetization model absent from deck.',
      },
      currentAnswerability: 'UNANSWERED',
      availableEvidence: [],
      missingInformation: [
        'Revenue model (subscription, usage fee, commission, or licensing)',
        'Pricing tiers and contract commitment terms',
        'Average contract value (ACV)',
      ],
      preparationGuidance: 'Define the commercial transaction clearly: billing event, pricing tiers, and typical customer commitment.',
      groundedAnswer: 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'What is your target average annual contract value?',
        'How does pricing compare against customer budget thresholds?',
      ],
      confidence: 'high',
    });
  }

  // 3. GTM Logic Mismatch
  const gtmDim = evaluation?.dimensions.find((d) => d.dimensionName === 'Go-to-Market Credibility');
  if (gtmDim?.weaknessType === 'LOGIC_GAP') {
    questions.push({
      id: `sim-q-${qCount++}`,
      question: 'Your pricing reflects high-ticket enterprise contracts while the sales motion targets smaller businesses via self-service. What is your actual customer acquisition and closing engine?',
      category: 'go_to_market',
      priority: 'CRITICAL',
      questionType: 'MECHANISM',
      whyInvestorAsks: 'Fundamental tension between target segment ACV and stated self-service acquisition motion.',
      trigger: {
        relatedDimension: 'Go-to-Market Credibility',
        relatedClaimIds: [],
        relatedDiagnosticIds: [],
        slideNumbers: gtmDim.slideReferences || [],
        triggerSummary: 'Pricing / ICP / sales motion mismatch.',
      },
      currentAnswerability: 'WEAKLY_SUPPORTED',
      availableEvidence: [],
      missingInformation: [
        'Dedicated inside/field sales staffing details',
        'Customer acquisition cost (CAC) economics',
        'Sales cycle velocity from lead to signature',
      ],
      preparationGuidance: 'Demonstrate whether customer signups require human sales touch or if the self-serve funnel actually converts enterprise ACVs.',
      groundedAnswer: 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'What conversion rate do you observe from signup to paid conversion?',
        'Who conducts security and vendor reviews?',
      ],
      confidence: 'high',
    });
  }

  // 4. Unsupported TAM
  const marketDim = evaluation?.dimensions.find((d) => d.dimensionName === 'Market Thesis');
  const marketClaims = (claimMap?.claims || []).filter((c) => c.claimType === 'market');
  if (marketDim?.status === 'UNDERDEVELOPED' || marketClaims.some((c) => c.supportStatus === 'unsupported')) {
    const tamClaim = marketClaims.find((c) => c.supportStatus === 'unsupported') || marketClaims[0];
    const tamVal = profile?.market?.TAM?.rawValue || tamClaim?.claimText || 'stated market size';
    questions.push({
      id: `sim-q-${qCount++}`,
      question: `How was the ${tamVal} addressable market derived from a bottom-up perspective?`,
      category: 'market',
      priority: 'HIGH',
      questionType: 'EVIDENCE',
      whyInvestorAsks: 'Top-down market sizing figures require bottom-up validation (number of potential customers × ACV) to test realistic capture potential.',
      trigger: {
        relatedDimension: 'Market Thesis',
        relatedClaimIds: tamClaim ? [tamClaim.id] : [],
        relatedDiagnosticIds: [],
        slideNumbers: tamClaim?.evidence?.map((e) => e.slideNumber) || [8],
        triggerSummary: `Market figure stated without bottom-up calculation.`,
      },
      currentAnswerability: 'WEAKLY_SUPPORTED',
      availableEvidence: tamClaim
        ? [{ slideNumber: tamClaim.slideNumber, statement: tamClaim.claimText, source: 'native_pdf' }]
        : [],
      missingInformation: [
        'Count of addressable accounts in target geography',
        'Realistic spend per account per year',
        'Serviceable Obtainable Market (SOM) calculation',
      ],
      preparationGuidance: 'Walk through the bottom-up formula: Qualified accounts × average annual spend = Addressable market.',
      groundedAnswer: 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'What percentage of this market is currently using legacy solutions?',
        'What is your immediate geographic wedge?',
      ],
      confidence: 'high',
    });
  }

  // 5. Strong Traction Diligence
  const tractionDim = evaluation?.dimensions.find((d) => d.dimensionName === 'Traction Credibility');
  const revenueClaim = (claimMap?.claims || []).find((c) => c.claimType === 'traction' || c.claimType === 'revenue');
  if (profile?.traction?.ARR?.rawValue || revenueClaim) {
    const arrVal = profile?.traction?.ARR?.rawValue || revenueClaim?.claimText || 'current revenue';
    const growthVal = profile?.traction?.growthRates?.rawValue || 'reported growth';
    questions.push({
      id: `sim-q-${qCount++}`,
      question: `You report ${arrVal} with ${growthVal}. What specific customer acquisition channels and conversion dynamics have driven this growth, and how repeatable is it?`,
      category: 'traction',
      priority: 'HIGH',
      questionType: 'TRACTION',
      whyInvestorAsks: 'Investors interrogate strong proof points to determine whether growth stems from repeatable marketing/sales motions or one-off pilot contracts.',
      trigger: {
        relatedDimension: 'Traction Credibility',
        relatedClaimIds: revenueClaim ? [revenueClaim.id] : [],
        relatedDiagnosticIds: [],
        slideNumbers: revenueClaim?.evidence?.map((e) => e.slideNumber) || [5],
        triggerSummary: 'Substantiated traction proof point requiring growth breakdown.',
      },
      currentAnswerability: 'PARTIALLY_SUPPORTED',
      availableEvidence: revenueClaim
        ? [{ slideNumber: revenueClaim.slideNumber, statement: revenueClaim.claimText, source: 'native_pdf' }]
        : [],
      missingInformation: [
        'Breakdown of inbound vs. outbound pipeline contribution',
        'Net Revenue Retention (NRR) or churn metrics',
        'Sales cycle length per closed customer',
      ],
      preparationGuidance: 'Demonstrate channel attribution, sales cycle velocity, and cohort retention behavior.',
      groundedAnswer: `Answer using current deck evidence: As documented on slide ${revenueClaim?.slideNumber || 5}, the company has achieved ${revenueClaim?.claimText || arrVal}.`,
      likelyFollowUps: [
        'What is your net revenue retention rate across early cohorts?',
        'What has been your customer acquisition cost payback period?',
      ],
      confidence: 'high',
    });
  }

  // 6. Clear Fundraise Ask & Milestones
  if (profile?.fundraising?.amountBeingRaised?.rawValue) {
    const askVal = profile.fundraising.amountBeingRaised.rawValue;
    const useVal = profile.fundraising.useOfFunds?.rawValue || 'scale operations';
    questions.push({
      id: `sim-q-${qCount++}`,
      question: `What specific operational and financial milestones will raising ${askVal} unlock over your projected runway?`,
      category: 'fundraising',
      priority: 'HIGH',
      questionType: 'FUNDRAISING',
      whyInvestorAsks: 'Capital efficiency diligence: investors evaluate whether the requested sum provides sufficient runway to reach the next valuation inflection point.',
      trigger: {
        relatedDimension: 'Fundraising Ask',
        relatedClaimIds: [],
        relatedDiagnosticIds: [],
        slideNumbers: (profile.fundraising.amountBeingRaised.evidence?.map((e) => e.slideNumber).filter((s): s is number => typeof s === 'number' && s > 0)) || [],
        triggerSummary: `Target raise amount of ${askVal} stated in deck.`,
      },
      currentAnswerability: 'WELL_SUPPORTED',
      availableEvidence: profile.fundraising.amountBeingRaised.evidence?.[0]?.slideNumber
        ? [
            {
              slideNumber: profile.fundraising.amountBeingRaised.evidence[0].slideNumber,
              statement: `Raising ${askVal} allocated to: ${useVal}`,
              source: 'native_pdf',
            },
          ]
        : [],
      missingInformation: [
        'Month-by-month burn rate forecast',
        'Target ARR / customer metrics required for Series A round',
      ],
      preparationGuidance: 'State expected runway in months, target milestones (e.g. ARR target, customer count), and headcount plans.',
      groundedAnswer: `Answer using current deck evidence: Seeking ${askVal} with use of funds directed toward ${useVal}.`,
      likelyFollowUps: [
        'What does your post-money valuation expectation look like?',
        'How many months of runway does this capital provide?',
      ],
      confidence: 'high',
    });
  }

  // 7. Defensibility / Competitive Moat
  const compDim = evaluation?.dimensions.find((d) => d.dimensionName === 'Competitive Positioning');
  questions.push({
    id: `sim-q-${qCount++}`,
    question: 'Why cannot established incumbents or well-funded competitors replicate your product capabilities within 6-12 months?',
    category: 'defensibility',
    priority: 'HIGH',
    questionType: 'COMPETITIVE',
    whyInvestorAsks: 'Software features are easily copied unless underpinned by proprietary data, network density, or deep technical moats.',
    trigger: {
      relatedDimension: 'Defensibility',
      relatedClaimIds: [],
      relatedDiagnosticIds: [],
      slideNumbers: compDim?.slideReferences || [9],
      triggerSummary: 'Competitive differentiation analysis.',
    },
    currentAnswerability: 'WEAKLY_SUPPORTED',
    availableEvidence: profile?.competition?.differentiationClaims?.rawValue
      ? [{ slideNumber: 9, statement: profile.competition.differentiationClaims.rawValue, source: 'native_pdf' }]
      : [],
    missingInformation: [
      'Evidence of proprietary IP or data access',
      'Switching costs and workflow lock-in mechanisms',
    ],
    preparationGuidance: 'Highlight structural barriers to entry: compounding data network effects, workflow lock-in, and integration friction for incumbents.',
    groundedAnswer: profile?.competition?.differentiationClaims?.rawValue
      ? `Answer using current deck evidence: The deck asserts differentiation based on: ${profile.competition.differentiationClaims.rawValue}.`
      : 'Current deck evidence is insufficient to construct a reliable answer.',
    likelyFollowUps: [
      'Do you have proprietary patent filings or unique data rights?',
      'What prevents an incumbent from bundling this feature for free?',
    ],
    confidence: 'medium',
  });

  // 8. Stage Adaptation (Pre-Seed discovery vs. Series A metrics)
  const stage = (profile?.fundraising?.currentStage?.rawValue || '').toLowerCase();
  if (stage.includes('pre-seed') || stage.includes('concept')) {
    questions.push({
      id: `sim-q-${qCount++}`,
      question: 'What non-obvious insight did your initial customer interviews reveal that existing market solutions fail to address?',
      category: 'problem',
      priority: 'HIGH',
      questionType: 'MECHANISM',
      whyInvestorAsks: 'For pre-seed startups without mature revenue, founders are judged on proprietary market insight and user discovery depth.',
      trigger: {
        relatedDimension: 'Problem Clarity',
        relatedClaimIds: [],
        relatedDiagnosticIds: [],
        slideNumbers: profile?.problemSolution?.targetUserPain?.evidence?.[0]?.slideNumber ? [profile.problemSolution.targetUserPain.evidence[0].slideNumber] : [],
        triggerSummary: 'Pre-seed customer problem formulation.',
      },
      currentAnswerability: 'PARTIALLY_SUPPORTED',
      availableEvidence: profile?.problemSolution?.targetUserPain?.rawValue && profile.problemSolution.targetUserPain.evidence?.[0]?.slideNumber
        ? [{ slideNumber: profile.problemSolution.targetUserPain.evidence[0].slideNumber, statement: profile.problemSolution.targetUserPain.rawValue, source: 'native_pdf' }]
        : [],
      missingInformation: ['Number of user discovery interviews completed', 'Customer willingness-to-pay validation signals'],
      preparationGuidance: 'Share qualitative discoveries, verbatim user quotes, and specific workflow observations.',
      groundedAnswer: profile?.problemSolution?.targetUserPain?.rawValue
        ? `Answer using current deck evidence: User pain identified in deck: ${profile.problemSolution.targetUserPain.rawValue}.`
        : 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'How many prospective customers have committed to pilot deployments?',
        'What alternative workarounds are they currently using?',
      ],
      confidence: 'high',
    });
  }

  // 9. Customer ICP & Purchasing Decision Unit
  if (questions.length < 12) {
    const icp = profile?.customerICP?.customerType?.rawValue || 'target customer';
    const hasIcp = !!profile?.customerICP?.customerType?.rawValue && profile.customerICP.customerType.rawValue !== 'not_found';
    questions.push({
      id: `sim-q-${qCount++}`,
      question: `Who is your specific economic buyer within ${icp}, and what internal approvals are required to complete a purchase?`,
      category: 'customer_icp',
      priority: 'HIGH',
      questionType: 'MECHANISM',
      whyInvestorAsks: 'Enterprise sales velocity depends on knowing exactly who holds the budget and sign-off authority.',
      trigger: {
        relatedDimension: 'Customer & ICP Clarity',
        relatedClaimIds: [],
        relatedDiagnosticIds: [],
        slideNumbers: profile?.customerICP?.customerType?.evidence?.map((e) => e.slideNumber) || [4],
        triggerSummary: 'Customer ICP qualification and buying center.',
      },
      currentAnswerability: hasIcp ? 'PARTIALLY_SUPPORTED' : 'UNANSWERED',
      availableEvidence: hasIcp
        ? [{ slideNumber: profile!.customerICP.customerType.evidence?.[0]?.slideNumber || 4, statement: icp, source: 'native_pdf' as const }]
        : [],
      missingInformation: ['Title of economic buyer', 'Procurement and security evaluation steps'],
      preparationGuidance: 'Map the decision-making unit: champion, budget owner, legal/security gatekeeper, and signing timeline.',
      groundedAnswer: hasIcp
        ? `Answer using current deck evidence: Stated target customer: ${icp}.`
        : 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'What is your historical sales cycle from demo to signed agreement?',
        'Who is your typical internal champion?',
      ],
      confidence: 'high',
    });
  }

  // 10. Unit Economics & Gross Margins
  if (questions.length < 12) {
    const hasMargin = !!profile?.businessModel?.unitEconomics?.rawValue && profile.businessModel.unitEconomics.rawValue !== 'not_found';
    questions.push({
      id: `sim-q-${qCount++}`,
      question: 'What are your current and projected gross margins, cloud/infrastructure COGS, and customer acquisition payback period?',
      category: 'unit_economics',
      priority: 'HIGH',
      questionType: 'ECONOMICS',
      whyInvestorAsks: 'Assessing long-term profitability and unit-level capital efficiency before scaling marketing spend.',
      trigger: {
        relatedDimension: 'Business Model Clarity',
        relatedClaimIds: [],
        relatedDiagnosticIds: [],
        slideNumbers: [6],
        triggerSummary: 'Unit economics and margin sustainability.',
      },
      currentAnswerability: hasMargin ? 'WELL_SUPPORTED' : 'UNANSWERED',
      availableEvidence: hasMargin
        ? [{ slideNumber: 6, statement: profile!.businessModel.unitEconomics.rawValue!, source: 'native_pdf' as const }]
        : [],
      missingInformation: ['Gross margin %', 'CAC payback in months', 'Hosting/API inference costs per customer'],
      preparationGuidance: 'Break down gross margin components: hosting, data feeds, customer support, and target long-term profile (e.g. 75-80%).',
      groundedAnswer: hasMargin
        ? `Answer using current deck evidence: Unit economics noted in deck: ${profile!.businessModel.unitEconomics.rawValue}.`
        : 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'How do third-party API or model inference costs scale with customer usage?',
        'What is your target blended CAC payback period?',
      ],
      confidence: 'high',
    });
  }

  // 11. Team Capabilities & Key Hiring
  if (questions.length < 12) {
    const founders = profile?.team?.founders || [];
    const founderSummary = founders.map((f) => `${f.name} (${f.role})`).join(', ');
    questions.push({
      id: `sim-q-${qCount++}`,
      question: 'What are the most critical executive or technical hires you need to make in the next 12 months to execute this plan?',
      category: 'team',
      priority: 'MEDIUM',
      questionType: 'EXECUTION',
      whyInvestorAsks: 'Early-stage success is constrained by hiring velocity in engineering, product, and go-to-market.',
      trigger: {
        relatedDimension: 'Team & Execution Capability',
        relatedClaimIds: [],
        relatedDiagnosticIds: [],
        slideNumbers: founders.map((f) => f.slideNumber).filter((s): s is number => typeof s === 'number' && s > 0),
        triggerSummary: 'Team composition and scaling roadmap.',
      },
      currentAnswerability: founders.length > 0 ? 'PARTIALLY_SUPPORTED' : 'UNANSWERED',
      availableEvidence: founders.length > 0 && typeof founders[0]?.slideNumber === 'number' && founders[0].slideNumber > 0
        ? [{ slideNumber: founders[0].slideNumber, statement: founderSummary, source: 'native_pdf' as const }]
        : [],
      missingInformation: ['Specific hiring priority roles', 'Recruiting pipeline or talent network'],
      preparationGuidance: 'Identify top 2-3 key roles needed (e.g. VP Sales, Lead Systems Architect) and timeline to hire.',
      groundedAnswer: founders.length > 0
        ? `Answer using current deck evidence: Foundational team includes ${founderSummary}.`
        : 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'How do you plan to attract senior talent in a competitive market?',
        'What equity pool has been allocated for early executive hires?',
      ],
      confidence: 'medium',
    });
  }

  // 12. Market Expansion & Sequencing
  if (questions.length < 12) {
    questions.push({
      id: `sim-q-${qCount++}`,
      question: 'What is your expansion sequence once you establish dominance in your initial target niche?',
      category: 'market',
      priority: 'MEDIUM',
      questionType: 'SCALABILITY',
      whyInvestorAsks: 'Venture returns require expanding from an initial wedge into adjacent multi-billion-dollar categories.',
      trigger: {
        relatedDimension: 'Market Thesis',
        relatedClaimIds: [],
        relatedDiagnosticIds: [],
        slideNumbers: [8],
        triggerSummary: 'Long-term market expansion and wedge strategy.',
      },
      currentAnswerability: 'WEAKLY_SUPPORTED',
      availableEvidence: [],
      missingInformation: ['Adjacent vertical or geographic expansion roadmap'],
      preparationGuidance: 'Outline concentric expansion: from wedge customer segment -> adjacent customer segment -> international expansion.',
      groundedAnswer: 'Current deck evidence is insufficient to construct a reliable answer.',
      likelyFollowUps: [
        'Does expansion require building new product modules or localized compliance?',
        'Which adjacent category has the highest urgency for your solution?',
      ],
      confidence: 'medium',
    });
  }

  const finalQuestions = questions.slice(0, 12);
  const summary = computePreparationSummary(finalQuestions);

  return {
    questions: finalQuestions,
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Execute Investor Q&A & Due Diligence Simulator.
 */
export async function executeInvestorSimulation(
  hybridResult: HybridDeckResult,
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  evaluation: FundraisingEvaluation | null,
  investmentCase?: InvestmentCase | null
): Promise<SimulatorRunResult> {
  const totalPages = hybridResult.summary.totalPages;
  const validClaimIds = new Set<string>((claimMap?.claims || []).map((c) => c.id));
  const validDiagnosticIds = new Set<string>([
    ...(diagnostics?.contradictions || []).map((c) => c.id),
    ...(diagnostics?.evidenceGaps || []).map((eg) => eg.id),
    ...(diagnostics?.missingInformation || []).map((m) => m.id),
  ]);

  try {
    const { evaluationContext, evaluationExpectations } = getOrBuildEvaluationContextAndExpectations(
      profile,
      claimMap,
      diagnostics
    );
    const selectedTriggers = selectDeterministicTriggers(profile, claimMap, diagnostics, evaluation);
    const stage = evaluationContext.declaredStage.normalizedStage;

    const response = await fetch('/api/deck/simulate-qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        claims: claimMap?.claims || [],
        diagnostics,
        evaluation,
        selectedTriggers,
        stage,
        evaluationContext,
        evaluationExpectations,
        investmentCase: investmentCase || null,
      }),
    });

    if (response.ok) {
      const resJson = await response.json();
      if (resJson.status === 'success' && resJson.data?.questions) {
        const sanitizedQuestions = postProcessQuestions(
          resJson.data.questions,
          totalPages,
          validClaimIds,
          validDiagnosticIds,
          profile,
          claimMap
        );

        const summary = computePreparationSummary(sanitizedQuestions);

        return {
          status: 'success',
          data: {
            questions: sanitizedQuestions,
            summary,
            generatedAt: new Date(),
          },
          source: 'gemini',
        };
      }
    }

    console.warn('Simulation API call failed or returned invalid data; generating deterministic simulation.');
    const fallback = generateDeterministicSimulatorQuestions(profile, claimMap, diagnostics, evaluation, totalPages);
    return {
      status: 'partial',
      data: fallback,
      source: 'deterministic_fallback',
      errorMessage: 'Generated via deterministic engine (Gemini API unavailable or timed out).',
    };
  } catch (err: unknown) {
    console.error('Error in executeInvestorSimulation:', err);
    const fallback = generateDeterministicSimulatorQuestions(profile, claimMap, diagnostics, evaluation, totalPages);
    return {
      status: 'partial',
      data: fallback,
      source: 'deterministic_fallback',
      errorMessage: err instanceof Error ? err.message : 'Unknown simulation error occurred.',
    };
  }
}
