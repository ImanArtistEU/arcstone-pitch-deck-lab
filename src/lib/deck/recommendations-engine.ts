import { StartupProfile } from '../../types/startup';
import { ClaimEvidenceMap } from '../../types/claim';
import { DeckDiagnostics } from '../../types/diagnostics';
import { FundraisingEvaluation } from '../../types/evaluation';
import { InvestorSimulatorResult } from '../../types/simulator';
import { HybridDeckResult } from '../../types/deck';
import {
  FounderRecommendation,
  ActionPlanResult,
  ActionPlanSummary,
  FounderInputItem,
  RecommendationPriority,
  RecommendationActionType,
  ProblemClass,
} from '../../types/recommendations';
import { getOrBuildEvaluationContextAndExpectations } from './evaluation-context';

/**
 * Result returned by the orchestrator
 */
export interface RecommendationsRunResult {
  result: ActionPlanResult;
  usedFallback: boolean;
  error?: string;
}

/**
 * Select key deterministic signals to guide recommendation generation.
 */
export function selectDeterministicRecommendationSignals(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  evaluation: FundraisingEvaluation | null,
  simulatorResult: InvestorSimulatorResult | null
): Record<string, unknown> {
  return {
    contradictionCount: diagnostics?.summary.contradictionCount || 0,
    evidenceGapCount: diagnostics?.summary.evidenceGapCount || 0,
    missingInfoCount: diagnostics?.summary.missingInfoCount || 0,
    unsupportedClaimsCount: (claimMap?.claims || []).filter((c) => c.supportStatus === 'unsupported').length,
    underdevelopedDimensions: (evaluation?.dimensions || [])
      .filter((d) => d.status === 'UNDERDEVELOPED' || d.status === 'MISSING')
      .map((d) => d.dimensionName),
    criticalQuestionsCount: (simulatorResult?.questions || []).filter((q) => q.priority === 'CRITICAL').length,
  };
}

/**
 * Post-process recommendations from Gemini or fallback to guarantee schema safety.
 */
export function postProcessRecommendations(
  rawRecommendations: FounderRecommendation[],
  totalPages: number,
  validClaimIds: Set<string>,
  validDiagnosticIds: Set<string>,
  validQuestionIds: Set<string>,
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null
): FounderRecommendation[] {
  const processed = rawRecommendations.map((rec) => {
    const sanitizedSlides = (rec.targetSlides || [])
      .map((s) => Number(s))
      .filter((s) => !isNaN(s) && s >= 1 && s <= totalPages);

    const sanitizedClaims = (rec.relatedClaims || []).filter((id) => validClaimIds.has(id));
    const sanitizedDiagnostics = (rec.relatedDiagnostics || []).filter((id) => validDiagnosticIds.has(id));
    const sanitizedQuestions = (rec.relatedInvestorQuestions || []).filter((id) => validQuestionIds.has(id));

    const sanitizedEvidence = (rec.existingEvidence || [])
      .map((ev) => ({
        slideNumber: typeof ev.slideNumber === 'number' && ev.slideNumber >= 1 && ev.slideNumber <= totalPages ? ev.slideNumber : 0,
        statement: ev.statement || '',
        source: ev.source || 'native_pdf',
      }))
      .filter((ev) => ev.statement.length > 0);

    const sanitizedStructure = rec.suggestedStructure
      ? {
          ...rec.suggestedStructure,
          targetSlideNumber:
            rec.suggestedStructure.targetSlideNumber &&
            rec.suggestedStructure.targetSlideNumber >= 1 &&
            rec.suggestedStructure.targetSlideNumber <= totalPages
              ? rec.suggestedStructure.targetSlideNumber
              : undefined,
          evidenceSlideReferences: (rec.suggestedStructure.evidenceSlideReferences || []).filter(
            (s) => typeof s === 'number' && s >= 1 && s <= totalPages
          ),
        }
      : undefined;

    const sanitizedCopy = rec.suggestedCopy
      ? {
          currentText: rec.suggestedCopy.currentText || '',
          suggestedText: rec.suggestedCopy.suggestedText || '',
          explanation: rec.suggestedCopy.explanation || '',
        }
      : undefined;

    const quickWinActionTypes: RecommendationActionType[] = [
      'CLARIFY_EXISTING_INFORMATION',
      'ADD_EXISTING_EVIDENCE',
      'RESTRUCTURE_NARRATIVE',
      'IMPROVE_SLIDE_STRUCTURE',
      'CONNECT_LOGIC',
    ];
    const isQuickWin = !rec.founderInputRequired && quickWinActionTypes.includes(rec.actionType);

    const validProblemClasses: ProblemClass[] = [
      'FACTUAL_GAP',
      'EVIDENCE_GAP',
      'COMMUNICATION_GAP',
      'LOGIC_GAP',
      'INVESTMENT_CASE_RISK',
    ];
    const problemClass = validProblemClasses.includes(rec.problemClass)
      ? rec.problemClass
      : 'EVIDENCE_GAP';

    return {
      ...rec,
      problemClass,
      investorInterpretation: rec.investorInterpretation || rec.whyItMatters,
      whyNow: rec.whyNow || 'Addressing this gap prevents investor due diligence friction.',
      resolutionCriteria: rec.resolutionCriteria && rec.resolutionCriteria.length > 0 ? rec.resolutionCriteria : [rec.recommendedAction],
      targetSlides: sanitizedSlides,
      relatedClaims: sanitizedClaims,
      relatedDiagnostics: sanitizedDiagnostics,
      relatedInvestorQuestions: sanitizedQuestions,
      existingEvidence: sanitizedEvidence,
      suggestedCopy: sanitizedCopy,
      suggestedStructure: sanitizedStructure,
      isQuickWin,
    };
  });

  return deduplicateRecommendations(processed);
}

/**
 * Deduplicate similar recommendations.
 */
function deduplicateRecommendations(recs: FounderRecommendation[]): FounderRecommendation[] {
  const seenTitles = new Set<string>();
  return recs.filter((rec) => {
    const norm = rec.title.toLowerCase().trim();
    if (seenTitles.has(norm)) return false;
    seenTitles.add(norm);
    return true;
  });
}

/**
 * Chronologically sequence action plan recommendations and establish dependency chains.
 */
export function orderActionPlan(recommendations: FounderRecommendation[]): FounderRecommendation[] {
  const critical = recommendations.filter((r) => r.priority === 'CRITICAL');
  const high = recommendations.filter((r) => r.priority === 'HIGH');
  const polish = recommendations.filter((r) => r.priority === 'POLISH');

  const ordered = [...critical, ...high, ...polish];

  return ordered.map((rec, idx) => ({
    ...rec,
    executionOrder: idx + 1,
  }));
}

/**
 * Build clean founder input checklist for items requiring founder supply.
 */
export function buildFounderInputChecklist(recommendations: FounderRecommendation[]): FounderInputItem[] {
  return recommendations
    .filter((r) => r.founderInputRequired && r.missingInformation.length > 0)
    .map((r, idx) => ({
      id: `input-item-${idx + 1}`,
      recommendationId: r.id,
      recommendationTitle: r.title,
      category: r.category,
      prompt: `Supply missing information for "${r.title}": ${r.missingInformation.join('; ')}`,
      targetSlides: r.targetSlides,
    }));
}

/**
 * Compute summary statistics for action plan.
 */
export function computeActionPlanSummary(recommendations: FounderRecommendation[]): ActionPlanSummary {
  return {
    totalRecommendations: recommendations.length,
    criticalCount: recommendations.filter((r) => r.priority === 'CRITICAL').length,
    highCount: recommendations.filter((r) => r.priority === 'HIGH').length,
    polishCount: recommendations.filter((r) => r.priority === 'POLISH').length,
    quickWinsCount: recommendations.filter((r) => r.isQuickWin).length,
    founderInputsRequiredCount: recommendations.filter((r) => r.founderInputRequired).length,
  };
}

/**
 * Fallback deterministic recommendation generation when Gemini API is unavailable or disabled.
 */
export function generateDeterministicRecommendations(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  evaluation: FundraisingEvaluation | null,
  simulatorResult: InvestorSimulatorResult | null,
  totalPages: number
): ActionPlanResult {
  const recommendations: FounderRecommendation[] = [];
  let recIdCounter = 1;

  // 1. Contradictions (CRITICAL, RESOLVE_CONTRADICTION)
  let contradictionRecId: string | null = null;
  for (const c of diagnostics?.contradictions || []) {
    contradictionRecId = `rec-${recIdCounter++}`;
    const slides = c.conflictingStatements
      .map((s) => s.slideNumber)
      .filter((s): s is number => typeof s === 'number' && s > 0);
    const relatedQ = (simulatorResult?.questions || []).find((q) => q.currentAnswerability === 'CONTRADICTORY');

    const s1 = c.conflictingStatements[0]?.slideNumber ? `Slide ${c.conflictingStatements[0].slideNumber}` : 'One slide';
    const s2 = c.conflictingStatements[1]?.slideNumber ? `Slide ${c.conflictingStatements[1].slideNumber}` : 'another slide';

    recommendations.push({
      id: contradictionRecId,
      priority: 'CRITICAL',
      category: 'traction',
      title: 'Resolve conflicting metrics before rewriting traction narrative',
      problem: `${s1} indicates "${c.conflictingStatements[0]?.text || ''}", whereas ${s2} states "${c.conflictingStatements[1]?.text || ''}".`,
      problemClass: 'FACTUAL_GAP',
      whyItMatters: 'Contradictory metrics immediately halt investor due diligence and undermine reporting credibility.',
      investorInterpretation: 'Direct metric contradictions between slides damage data reporting credibility and trigger immediate due diligence pauses.',
      whyNow: 'Contradictory metrics must be resolved before presenting the deck to institutional investors.',
      resolutionCriteria: [
        'Establish single verified data source for all metric statements',
        'Align figures across all slides in the deck',
      ],
      actionType: 'RESOLVE_CONTRADICTION',
      targetSlides: slides,
      relatedClaims: [],
      relatedDiagnostics: [c.id],
      relatedEvaluationDimensions: ['Traction Credibility'],
      relatedInvestorQuestions: relatedQ ? [relatedQ.id] : [],
      existingEvidence: c.conflictingStatements
        .filter((s) => typeof s.slideNumber === 'number' && s.slideNumber > 0)
        .map((s) => ({
          slideNumber: s.slideNumber!,
          statement: s.text,
          source: s.source,
        })),
      missingInformation: ['Confirmed single source of truth and correct measurement cutoff date.'],
      founderInputRequired: true,
      isQuickWin: false,
      recommendedAction: 'Determine which metric figure is the verified audited number and align all slides accordingly.',
      expectedImpact: 'Eliminates reporting contradiction and preserves data credibility.',
      blockedByRecommendationIds: [],
      executionOrder: 1,
      confidence: 'high',
    });
  }

  // 2. Missing Business Model or Unit Economics (CRITICAL/HIGH, REQUEST_FOUNDER_INFORMATION)
  const bmDim = evaluation?.dimensions.find((d) => d.dimensionName.toLowerCase().includes('business model'));
  const hasMonetization = !!profile?.businessModel?.revenueModel?.rawValue && profile.businessModel.revenueModel.rawValue !== 'not_found';
  const hasPricing = !!profile?.businessModel?.pricingValues?.rawValue && profile.businessModel.pricingValues.rawValue !== 'not_found';
  const missingEconDiag = (diagnostics?.missingInformation || []).find((m) => m.field.toLowerCase().includes('unit') || m.category === 'economics');

  if (!hasMonetization || !hasPricing || !!missingEconDiag || bmDim?.status === 'MISSING' || bmDim?.status === 'UNDERDEVELOPED') {
    const isTotalMissing = !hasMonetization || bmDim?.status === 'MISSING';
    const relatedQ = (simulatorResult?.questions || []).find((q) => q.category === 'business_model');
    const bmSlide = profile?.businessModel?.revenueModel?.evidence?.[0]?.slideNumber;

    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: isTotalMissing ? 'CRITICAL' : 'HIGH',
      category: 'business_model',
      title: isTotalMissing
        ? 'Define commercial monetization model and pricing structure'
        : 'Detail commercial pricing metrics and unit economics',
      problem: isTotalMissing
        ? 'The deck establishes a product and customer ICP but omits how the company generates revenue.'
        : 'The deck indicates a revenue model but omits pricing tiers, average contract value (ACV), and unit economics (CAC, payback).',
      problemClass: isTotalMissing ? 'FACTUAL_GAP' : 'EVIDENCE_GAP',
      whyItMatters: 'Investors cannot evaluate unit economics, scalability, or fundability without knowing who pays and how pricing works.',
      investorInterpretation: isTotalMissing
        ? 'Without monetization details, investors cannot evaluate commercial viability or unit economics.'
        : 'Without pricing tiers and ACV details, investors cannot verify customer contract size or CAC payback duration.',
      whyNow: 'Monetization metrics are fundamental to underwriting commercial risk.',
      resolutionCriteria: isTotalMissing
        ? ['Add explicit revenue model and fee structure', 'Define payment terms and ACV']
        : ['Detail ACV, contract tiers, and CAC payback duration in months'],
      actionType: 'REQUEST_FOUNDER_INFORMATION',
      targetSlides: bmSlide ? [bmSlide] : [],
      relatedClaims: [],
      relatedDiagnostics: missingEconDiag ? [missingEconDiag.id] : [],
      relatedEvaluationDimensions: [bmDim?.dimensionName || 'Business Model'],
      relatedInvestorQuestions: relatedQ ? [relatedQ.id] : [],
      existingEvidence: !isTotalMissing && profile?.businessModel?.revenueModel?.rawValue && bmSlide
        ? [{ slideNumber: bmSlide, statement: profile.businessModel.revenueModel.rawValue, source: 'native_pdf' }]
        : [],
      missingInformation: isTotalMissing
        ? [
            'Revenue model (SaaS subscription, transaction fee, license, or usage)',
            'Pricing tiers and average contract value (ACV)',
            'Payment frequency (monthly, annual upfront)',
          ]
        : [
            'Pricing values and contract tiers (Average Annual Contract Value - ACV)',
            'Customer Acquisition Cost (CAC) and CAC payback period in months',
            'Gross margins and Net Retention Rate (NRR) if applicable',
          ],
      founderInputRequired: true,
      isQuickWin: false,
      recommendedAction: isTotalMissing
        ? 'Add a dedicated monetization section stating the fee structure, contract terms, and ACV expectation.'
        : 'Add pricing tiers and target unit economics (ACV, CAC, payback) to the business model slide to demonstrate commercial rigor.',
      expectedImpact: 'Completes a core missing fundraising pillar and answers primary commercial diligence questions.',
      blockedByRecommendationIds: [],
      executionOrder: 2,
      confidence: 'high',
    });
  }

  // 3. Unsupported TAM / Market Thesis (HIGH, STRENGTHEN_EVIDENCE)
  const marketClaims = (claimMap?.claims || []).filter((c) => c.claimType === 'market');
  const unsupportedMarket = marketClaims.find((c) => c.supportStatus === 'unsupported') || marketClaims[0];
  if (unsupportedMarket || evaluation?.dimensions.find((d) => d.dimensionName === 'Market Thesis')?.status === 'UNDERDEVELOPED') {
    const tamVal = profile?.market?.TAM?.rawValue || unsupportedMarket?.claimText || '€8B';
    const relatedQ = (simulatorResult?.questions || []).find((q) => q.category === 'market');
    const tamSlide = unsupportedMarket?.slideNumber && unsupportedMarket.slideNumber > 0 ? unsupportedMarket.slideNumber : profile?.market?.TAM?.evidence?.[0]?.slideNumber;

    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'HIGH',
      category: 'market',
      title: 'Substantiate the addressable market size thesis',
      problem: `The ${tamVal} market figure appears without a bottom-up derivation or cited industry source.`,
      problemClass: 'EVIDENCE_GAP',
      whyItMatters: 'Top-down multi-billion numbers without bottom-up calculation trigger investor skepticism regarding realism.',
      investorInterpretation: 'Top-down market figures without bottom-up calculation or cited research lead investors to discount market size viability.',
      whyNow: 'Substantiating TAM prevents immediate market sizing objections during initial review.',
      resolutionCriteria: [
        'Provide bottom-up formula: Accounts × ACV = Bottom-Up TAM',
        'Cite reputable third-party industry research source',
      ],
      actionType: 'STRENGTHEN_EVIDENCE',
      targetSlides: tamSlide ? [tamSlide] : [],
      relatedClaims: unsupportedMarket ? [unsupportedMarket.id] : [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Market Thesis'],
      relatedInvestorQuestions: relatedQ ? [relatedQ.id] : [],
      existingEvidence: unsupportedMarket && tamSlide
        ? [{ slideNumber: tamSlide, statement: unsupportedMarket.claimText, source: 'native_pdf' }]
        : [],
      missingInformation: [
        'Bottom-up formula: Number of qualified customer accounts in target geography × Average Annual Spend (ACV)',
        'Name and year of reputable third-party industry research source',
      ],
      founderInputRequired: true,
      isQuickWin: false,
      recommendedAction: `Replace the isolated ${tamVal} metric with the explicit calculation (Accounts × ACV = Bottom-Up TAM) or cite a reputable industry report.`,
      expectedImpact: 'Gives the market opportunity defensible, auditable grounding.',
      blockedByRecommendationIds: [],
      executionOrder: 3,
      confidence: 'high',
    });
  }

  // 4. GTM Logic Mismatch (HIGH, CONNECT_LOGIC)
  const gtmDim = evaluation?.dimensions.find((d) => d.dimensionName === 'Go-to-Market Credibility');
  if (gtmDim?.weaknessType === 'LOGIC_GAP') {
    const relatedQ = (simulatorResult?.questions || []).find((q) => q.category === 'go_to_market');
    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'HIGH',
      category: 'gtm',
      title: 'Reconcile target customer ICP with sales motion and pricing',
      problem: 'There is a mismatch between target customer segment, contract pricing, and the proposed sales motion.',
      problemClass: 'LOGIC_GAP',
      whyItMatters: 'Sophisticated investors closely examine whether the sales motion can sustainably support unit economics and CAC.',
      investorInterpretation: 'A mismatch between customer ICP, pricing, and distribution channel creates doubt about sales motion viability.',
      whyNow: 'Aligning GTM channels with pricing prevents fundamental unit economic objections.',
      resolutionCriteria: [
        'Reconcile contract ACV with acquisition sales channel',
        'Clarify sales team structure vs self-serve distribution',
      ],
      actionType: 'CONNECT_LOGIC',
      targetSlides: gtmDim.slideReferences.filter((s) => typeof s === 'number' && s > 0),
      relatedClaims: [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Go-to-Market Credibility'],
      relatedInvestorQuestions: relatedQ ? [relatedQ.id] : [],
      existingEvidence: [],
      missingInformation: ['Customer acquisition channels and dedicated sales staffing model.'],
      founderInputRequired: true,
      isQuickWin: false,
      recommendedAction: 'Align the customer segment with a viable distribution channel (e.g. inside sales for high ACV vs. self-serve for low ACV).',
      expectedImpact: 'Resolves narrative dissonance between GTM motion and monetization economics.',
      blockedByRecommendationIds: [],
      executionOrder: 4,
      confidence: 'high',
    });
  }

  // 5. Existing Traction Consolidation (HIGH / QUICK WIN if no contradiction)
  const hasArr = !!profile?.traction?.ARR?.rawValue && profile.traction.ARR.rawValue !== 'not_found';
  const hasCust = !!profile?.traction?.customerCount?.rawValue && profile.traction.customerCount.rawValue !== 'not_found';
  const hasGrowth = !!profile?.traction?.growthRates?.rawValue && profile.traction.growthRates.rawValue !== 'not_found';

  if (hasArr || hasCust || hasGrowth) {
    const arrVal = profile?.traction?.ARR?.rawValue || '';
    const custVal = profile?.traction?.customerCount?.rawValue || '';
    const growthVal = profile?.traction?.growthRates?.rawValue || '';

    const slideNum = profile?.traction?.ARR?.evidence?.[0]?.slideNumber;
    const existingSnippet = [arrVal, growthVal, custVal].filter(Boolean).join(' | ');

    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'HIGH',
      category: 'traction',
      title: 'Consolidate verified traction metrics into a coherent headline',
      problem: 'Traction proof points are dispersed or presented without clear narrative momentum.',
      problemClass: 'COMMUNICATION_GAP',
      whyItMatters: 'A tightly framed traction slide immediately establishes strong operational velocity and proof of product-market fit.',
      investorInterpretation: 'Dispersed or unstructured traction metrics obscure growth velocity and product-market fit signals.',
      whyNow: 'Consolidating traction into a clear headline establishes immediate operational momentum.',
      resolutionCriteria: [
        'Combine ARR, customer count, and growth velocity into a single headline statement',
      ],
      actionType: 'RESTRUCTURE_NARRATIVE',
      targetSlides: slideNum ? [slideNum] : [],
      relatedClaims: [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Traction Credibility'],
      relatedInvestorQuestions: [],
      existingEvidence: slideNum
        ? [{ slideNumber: slideNum, statement: existingSnippet, source: 'native_pdf' }]
        : [],
      missingInformation: [],
      founderInputRequired: false,
      isQuickWin: !contradictionRecId,
      recommendedAction: `Unify ${existingSnippet} into a single punchy headline backed by customer adoption proof.`,
      suggestedCopy: {
        currentText: existingSnippet,
        suggestedText: `${arrVal} ARR across ${custVal}, growing ${growthVal}.`.trim(),
        explanation: 'Synthesizes verified figures into an institutional-grade traction statement.',
      },
      suggestedStructure: {
        targetSlideNumber: slideNum,
        slideTitle: 'Traction & Commercial Momentum',
        headline: `${arrVal} ARR with ${growthVal}`,
        supportingMetrics: [arrVal, custVal, growthVal].filter(Boolean),
        supportingContext: ['Customer retention rate', 'Sales cycle velocity'],
        placeholders: ['[Founder input: cohort net retention %]'],
      },
      expectedImpact: 'Converts fragmented metrics into a powerful milestone proof point.',
      blockedByRecommendationIds: contradictionRecId ? [contradictionRecId] : [],
      executionOrder: 5,
      confidence: 'high',
    });
  }

  // 6. Unsupported Superiority Claim Qualification (POLISH, REMOVE_OR_QUALIFY_CLAIM)
  const diffClaim = (claimMap?.claims || []).find((c) => c.claimType === 'competition' && c.supportStatus === 'unsupported');
  if (diffClaim || profile?.competition?.differentiationClaims?.rawValue?.toLowerCase().includes('fastest')) {
    const diffSlide = diffClaim?.slideNumber && diffClaim.slideNumber > 0 ? diffClaim.slideNumber : undefined;

    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'POLISH',
      category: 'competition',
      title: 'Qualify or substantiate competitive superiority assertions',
      problem: 'Aggressive superlative assertions (e.g. fastest/best platform) are stated without comparative benchmarks.',
      problemClass: 'EVIDENCE_GAP',
      whyItMatters: 'Investors discount unsubstantiated superlatives and prefer auditable, specific architectural advantages.',
      investorInterpretation: 'Unsubstantiated superlative claims reduce deck credibility and invite skepticism.',
      whyNow: 'Qualifying claims with specific technical benchmarks increases institutional trust.',
      resolutionCriteria: [
        'Replace generic superlatives with specific, auditable product capabilities',
      ],
      actionType: 'REMOVE_OR_QUALIFY_CLAIM',
      targetSlides: diffSlide ? [diffSlide] : [],
      relatedClaims: diffClaim ? [diffClaim.id] : [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Competitive Positioning', 'Defensibility'],
      relatedInvestorQuestions: [],
      existingEvidence: diffClaim && diffSlide
        ? [{ slideNumber: diffSlide, statement: diffClaim.claimText, source: 'native_pdf' }]
        : [],
      missingInformation: ['Specific benchmark performance metrics or auditable differentiation proof.'],
      founderInputRequired: false,
      isQuickWin: true,
      recommendedAction: 'Replace generic superiority claims with narrow, defensible technical capabilities.',
      expectedImpact: 'Removes puffery and increases institutional credibility.',
      blockedByRecommendationIds: [],
      executionOrder: 6,
      confidence: 'high',
    });
  }

  // 7. Fundraise Ask Milestone Mapping (POLISH, CLARIFY_EXISTING_INFORMATION)
  if (profile?.fundraising?.amountBeingRaised?.rawValue) {
    const askVal = profile.fundraising.amountBeingRaised.rawValue;
    const useVal = profile.fundraising.useOfFunds?.rawValue || 'product development';
    const askSlide = profile.fundraising.amountBeingRaised.evidence?.[0]?.slideNumber;

    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'POLISH',
      category: 'ask',
      title: 'Map capital ask directly to milestone inflection targets',
      problem: `The ${askVal} target raise states broad budget categories (${useVal}) without linking to specific post-round milestones.`,
      problemClass: 'COMMUNICATION_GAP',
      whyItMatters: 'Institutional investors look for round economics that clearly bridge capital raised to concrete operating milestones.',
      investorInterpretation: 'Without milestone allocation, an investor may be unable to determine whether the requested capital provides sufficient runway.',
      whyNow: 'Clearing milestone targets before investor outreach prevents immediate budget due diligence friction.',
      resolutionCriteria: [
        'State target runway length in months',
        'Map capital spend directly to 2-3 concrete operational milestones',
      ],
      actionType: 'CLARIFY_EXISTING_INFORMATION',
      targetSlides: askSlide ? [askSlide] : [],
      relatedClaims: [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Fundraising Ask'],
      relatedInvestorQuestions: [],
      existingEvidence: askSlide
        ? [{ slideNumber: askSlide, statement: `Raising ${askVal} for ${useVal}`, source: 'native_pdf' }]
        : [],
      missingInformation: ['Target milestone at end of runway', 'Projected runway in months (e.g. 18-24 months)'],
      founderInputRequired: true,
      isQuickWin: false,
      recommendedAction: askSlide
        ? `On Slide ${askSlide}, add explicit milestones to the ${askVal} ask: target runway length and key operational metrics.`
        : `Add explicit milestones to the ${askVal} ask: target runway length and key operational metrics.`,
      expectedImpact: 'Proves capital efficiency and explicit milestone planning to prospective investors.',
      blockedByRecommendationIds: [],
      executionOrder: 7,
      confidence: 'medium',
    });
  }

  const ordered = orderActionPlan(recommendations);
  const checklist = buildFounderInputChecklist(ordered);
  const quickWins = ordered.filter((r) => r.isQuickWin);
  const summary = computeActionPlanSummary(ordered);

  return {
    recommendations: ordered,
    founderChecklist: checklist,
    quickWins,
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Top-level orchestrator to execute recommendation generation with API call and fallback.
 */
export async function executeRecommendationGeneration(
  hybridResult: HybridDeckResult,
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  evaluation: FundraisingEvaluation | null,
  simulatorResult: InvestorSimulatorResult | null
): Promise<RecommendationsRunResult> {
  const totalPages = hybridResult.summary.totalPages;
  const validClaimIds = new Set<string>((claimMap?.claims || []).map((c) => c.id));
  const validDiagnosticIds = new Set<string>([
    ...(diagnostics?.contradictions || []).map((c) => c.id),
    ...(diagnostics?.evidenceGaps || []).map((g) => g.id),
    ...(diagnostics?.missingInformation || []).map((m) => m.id),
    ...(diagnostics?.ambiguities || []).map((a) => a.id),
  ]);
  const validQuestionIds = new Set<string>((simulatorResult?.questions || []).map((q) => q.id));

  try {
    const { evaluationContext, evaluationExpectations } = getOrBuildEvaluationContextAndExpectations(
      profile,
      claimMap,
      diagnostics
    );

    const selectedTriggers = selectDeterministicRecommendationSignals(
      profile,
      claimMap,
      diagnostics,
      evaluation,
      simulatorResult
    );

    const res = await fetch('/api/deck/generate-recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        claimMap,
        diagnostics,
        evaluation,
        simulatorResult,
        selectedTriggers,
        totalPages,
        evaluationContext,
        evaluationExpectations,
      }),
    });

    if (!res.ok) {
      console.warn(`[Arcstone Recommendations] API responded with ${res.status}. Switching to fallback.`);
      const fallbackResult = generateDeterministicRecommendations(
        profile,
        claimMap,
        diagnostics,
        evaluation,
        simulatorResult,
        totalPages
      );
      return { result: fallbackResult, usedFallback: true };
    }

    const data = await res.json();
    const rawRecommendations: FounderRecommendation[] = data.recommendations || [];

    if (!rawRecommendations || rawRecommendations.length === 0) {
      console.warn('[Arcstone Recommendations] Empty response from API. Switching to fallback.');
      const fallbackResult = generateDeterministicRecommendations(
        profile,
        claimMap,
        diagnostics,
        evaluation,
        simulatorResult,
        totalPages
      );
      return { result: fallbackResult, usedFallback: true };
    }

    const postProcessed = postProcessRecommendations(
      rawRecommendations,
      totalPages,
      validClaimIds,
      validDiagnosticIds,
      validQuestionIds,
      profile,
      claimMap
    );

    const ordered = orderActionPlan(postProcessed);
    const checklist = buildFounderInputChecklist(ordered);
    const quickWins = ordered.filter((r) => r.isQuickWin);
    const summary = computeActionPlanSummary(ordered);

    return {
      result: {
        recommendations: ordered,
        founderChecklist: checklist,
        quickWins,
        summary,
        generatedAt: new Date(),
      },
      usedFallback: false,
    };
  } catch (err: any) {
    console.error('[Arcstone Recommendations] Failed to execute API call, falling back:', err);
    const fallbackResult = generateDeterministicRecommendations(
      profile,
      claimMap,
      diagnostics,
      evaluation,
      simulatorResult,
      totalPages
    );
    return {
      result: fallbackResult,
      usedFallback: true,
      error: err?.message,
    };
  }
}

export function extractKnownQuantitativeTokens(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null
): Set<string> {
  const tokens = new Set<string>();
  if (profile?.traction?.ARR?.rawValue) {
    for (const match of profile.traction.ARR.rawValue.match(/\d+(?:\.\d+)?/g) || []) {
      tokens.add(match.toLowerCase());
    }
  }
  if (profile?.traction?.customerCount?.rawValue) {
    for (const match of profile.traction.customerCount.rawValue.match(/\d+(?:\.\d+)?/g) || []) {
      tokens.add(match.toLowerCase());
    }
  }
  if (claimMap?.claims) {
    for (const claim of claimMap.claims) {
      if (claim.claimText) {
        for (const match of claim.claimText.match(/\d+(?:\.\d+)?/g) || []) {
          tokens.add(match.toLowerCase());
        }
      }
    }
  }
  return tokens;
}

export function validateGroundedCopy(
  copy: string,
  knownTokens: Set<string>,
  verifiedEvidence: string[] = []
): { isValid: boolean; unverifiedTokens: string[] } {
  const copyNumbers = copy.match(/\b\d+(?:\.\d+)?%?\b/g) || [];
  const unverified: string[] = [];
  const combinedText = verifiedEvidence.join(' ').toLowerCase();

  for (const num of copyNumbers) {
    const rawNum = num.replace('%', '').toLowerCase();
    if (!knownTokens.has(rawNum) && !combinedText.includes(rawNum)) {
      unverified.push(num);
    }
  }

  return {
    isValid: unverified.length === 0,
    unverifiedTokens: unverified,
  };
}
