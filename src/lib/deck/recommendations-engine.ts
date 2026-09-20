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
} from '../../types/recommendations';

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
) {
  const contradictions = diagnostics?.contradictions || [];
  const missingDims = (evaluation?.dimensions || []).filter((d) => d.status === 'MISSING');
  const underdevelopedDims = (evaluation?.dimensions || []).filter((d) => d.status === 'UNDERDEVELOPED');
  const unsupportedClaims = (claimMap?.claims || []).filter((c) => c.supportStatus === 'unsupported' && c.importance === 'core');
  const criticalQuestions = (simulatorResult?.questions || []).filter((q) => q.priority === 'CRITICAL' || q.priority === 'HIGH');

  return {
    contradictionCount: contradictions.length,
    missingDimensionNames: missingDims.map((d) => d.dimensionName),
    underdevelopedDimensionNames: underdevelopedDims.map((d) => d.dimensionName),
    unsupportedClaimCount: unsupportedClaims.length,
    criticalQuestionIds: criticalQuestions.map((q) => q.id),
  };
}

/**
 * Extract quantitative facts from profile and claims to validate suggested copy.
 */
export function extractKnownQuantitativeTokens(profile: StartupProfile | null, claimMap: ClaimEvidenceMap | null): Set<string> {
  const tokens = new Set<string>();

  const addText = (text?: string) => {
    if (!text || text === 'not_found') return;
    const matches = text.match(/([€$£¥]?\d+(?:\.\d+)?(?:%|[kKmMbB]|M|B)?)/g);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.toLowerCase().trim();
        tokens.add(cleaned);
        const withoutCurrency = cleaned.replace(/^[€$£¥]/, '');
        if (withoutCurrency) tokens.add(withoutCurrency);
      }
    }
  };

  if (profile) {
    addText(profile.fundraising?.amountBeingRaised?.rawValue);
    addText(profile.traction?.ARR?.rawValue);
    addText(profile.traction?.revenue?.rawValue);
    addText(profile.traction?.customerCount?.rawValue);
    addText(profile.traction?.growthRates?.rawValue);
    addText(profile.businessModel?.pricingValues?.rawValue);
    addText(profile.market?.TAM?.rawValue);
    addText(profile.market?.SAM?.rawValue);
    addText(profile.market?.SOM?.rawValue);
    addText(profile.team?.teamSize?.rawValue);
  }

  for (const c of claimMap?.claims || []) {
    if (c.quantitative) {
      addText(c.claimText);
    }
    for (const ev of c.evidence || []) {
      addText(ev.exactText);
    }
  }

  return tokens;
}

/**
 * Validate and sanitize recommended copy against known facts.
 */
export function validateGroundedCopy(
  suggestedText: string,
  knownTokens: Set<string>,
  existingEvidenceStatements: string[]
): { isValid: boolean; sanitizedText?: string } {
  const numberMatches = suggestedText.match(/([€$£¥]?\d+(?:\.\d+)?(?:%|[kKmMbB]|M|B)?)/g);
  if (!numberMatches) return { isValid: true, sanitizedText: suggestedText };

  const evidenceBlob = existingEvidenceStatements.join(' ').toLowerCase();

  for (const rawNum of numberMatches) {
    const cleanNum = rawNum.toLowerCase().trim();
    if (cleanNum === '1' || cleanNum === '2' || cleanNum === '3') continue; // slide indices or list numbers

    let matched = knownTokens.has(cleanNum) || evidenceBlob.includes(cleanNum);
    if (!matched) {
      for (const token of knownTokens) {
        if (token.includes(cleanNum) || cleanNum.includes(token)) {
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      // Metric is unsupported by deck facts!
      return { isValid: false };
    }
  }

  return { isValid: true, sanitizedText: suggestedText };
}

/**
 * Post-process, clamp, sanitize, and validate recommendations.
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
  const knownTokens = extractKnownQuantitativeTokens(profile, claimMap);

  const processed = rawRecommendations.map((rec) => {
    // 1. Clamp target slides to [1, totalPages]
    const sanitizedSlides = (rec.targetSlides || [])
      .map((n) => Math.max(1, Math.min(totalPages, Math.round(Number(n) || 1))))
      .filter((n, idx, arr) => arr.indexOf(n) === idx);

    // 2. Validate IDs
    const sanitizedClaims = (rec.relatedClaims || []).filter((id) => validClaimIds.has(id));
    const sanitizedDiagnostics = (rec.relatedDiagnostics || []).filter((id) => validDiagnosticIds.has(id));
    const sanitizedQuestions = (rec.relatedInvestorQuestions || []).filter((id) => validQuestionIds.has(id));

    // 3. Evidence clamping
    const sanitizedEvidence = (rec.existingEvidence || []).map((ev) => ({
      ...ev,
      slideNumber: Math.max(1, Math.min(totalPages, Math.round(Number(ev.slideNumber) || 1))),
    }));

    // 4. Grounded copy verification
    let sanitizedCopy = rec.suggestedCopy;
    if (sanitizedCopy && sanitizedCopy.suggestedText) {
      const evidenceStatements = sanitizedEvidence.map((e) => e.statement);
      const copyCheck = validateGroundedCopy(sanitizedCopy.suggestedText, knownTokens, evidenceStatements);
      if (!copyCheck.isValid) {
        sanitizedCopy = undefined; // Drop hallucinated copy block
      }
    }

    // 5. Structure placeholders
    let sanitizedStructure = rec.suggestedStructure;
    if (sanitizedStructure) {
      const structureSlides = (sanitizedStructure.evidenceSlideReferences || []).map((s) =>
        Math.max(1, Math.min(totalPages, Math.round(Number(s) || 1)))
      );
      sanitizedStructure = {
        ...sanitizedStructure,
        evidenceSlideReferences: structureSlides,
      };
    }

    // 6. Quick win determination
    const quickWinActionTypes: RecommendationActionType[] = [
      'CLARIFY_EXISTING_INFORMATION',
      'ADD_EXISTING_EVIDENCE',
      'RESTRUCTURE_NARRATIVE',
      'IMPROVE_SLIDE_STRUCTURE',
      'CONNECT_LOGIC',
    ];
    const isQuickWin = !rec.founderInputRequired && quickWinActionTypes.includes(rec.actionType);

    return {
      ...rec,
      targetSlides: sanitizedSlides.length > 0 ? sanitizedSlides : [1],
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
export function deduplicateRecommendations(recs: FounderRecommendation[]): FounderRecommendation[] {
  const seenTitles = new Map<string, FounderRecommendation>();

  for (const r of recs) {
    const key = r.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .trim();

    if (!seenTitles.has(key)) {
      seenTitles.set(key, r);
    } else {
      const existing = seenTitles.get(key)!;
      // Retain higher priority
      const priorityOrder: Record<RecommendationPriority, number> = { CRITICAL: 3, HIGH: 2, POLISH: 1 };
      if (priorityOrder[r.priority] > priorityOrder[existing.priority]) {
        seenTitles.set(key, r);
      }
    }
  }

  return Array.from(seenTitles.values());
}

/**
 * Order recommendations topologically and assign chronological sequence numbers.
 */
export function orderActionPlan(recommendations: FounderRecommendation[]): FounderRecommendation[] {
  const recMap = new Map<string, FounderRecommendation>(recommendations.map((r) => [r.id, r]));

  // Topological sorting: items without blockers come before items that are blocked
  const visited = new Set<string>();
  const orderedList: FounderRecommendation[] = [];

  const visit = (rec: FounderRecommendation) => {
    if (visited.has(rec.id)) return;

    for (const blockerId of rec.blockedByRecommendationIds || []) {
      const blocker = recMap.get(blockerId);
      if (blocker && !visited.has(blocker.id)) {
        visit(blocker);
      }
    }

    visited.add(rec.id);
    orderedList.push(rec);
  };

  // Sort candidates primarily by priority and foundational action types
  const priorityWeight: Record<RecommendationPriority, number> = {
    CRITICAL: 300,
    HIGH: 200,
    POLISH: 100,
  };

  const actionTypeWeight: Record<RecommendationActionType, number> = {
    RESOLVE_CONTRADICTION: 50,
    REQUEST_FOUNDER_INFORMATION: 40,
    CONNECT_LOGIC: 30,
    STRENGTHEN_EVIDENCE: 25,
    REMOVE_OR_QUALIFY_CLAIM: 20,
    ADD_EXISTING_EVIDENCE: 15,
    RESTRUCTURE_NARRATIVE: 10,
    IMPROVE_SLIDE_STRUCTURE: 8,
    CLARIFY_EXISTING_INFORMATION: 5,
  };

  const sortedCandidates = [...recommendations].sort((a, b) => {
    const weightA = priorityWeight[a.priority] + (actionTypeWeight[a.actionType] || 0);
    const weightB = priorityWeight[b.priority] + (actionTypeWeight[b.actionType] || 0);
    return weightB - weightA;
  });

  for (const candidate of sortedCandidates) {
    visit(candidate);
  }

  // Assign 1-indexed execution order
  return orderedList.map((rec, index) => ({
    ...rec,
    executionOrder: index + 1,
  }));
}

/**
 * Build consolidated checklist of items requiring founder input.
 */
export function buildFounderInputChecklist(recommendations: FounderRecommendation[]): FounderInputItem[] {
  const checklist: FounderInputItem[] = [];
  const seenPrompts = new Set<string>();
  let count = 1;

  for (const rec of recommendations) {
    if (rec.founderInputRequired && rec.missingInformation && rec.missingInformation.length > 0) {
      for (const info of rec.missingInformation) {
        const key = info.toLowerCase().trim();
        if (!seenPrompts.has(key)) {
          seenPrompts.add(key);
          checklist.push({
            id: `input-item-${count++}`,
            recommendationId: rec.id,
            recommendationTitle: rec.title,
            category: rec.category,
            prompt: info,
            targetSlides: rec.targetSlides,
          });
        }
      }
    }
  }

  return checklist;
}

/**
 * Compute high-level action plan summary.
 */
export function computeActionPlanSummary(recommendations: FounderRecommendation[]): ActionPlanSummary {
  let criticalCount = 0;
  let highCount = 0;
  let polishCount = 0;
  let quickWinsCount = 0;
  let founderInputsRequiredCount = 0;

  for (const r of recommendations) {
    if (r.priority === 'CRITICAL') criticalCount++;
    if (r.priority === 'HIGH') highCount++;
    if (r.priority === 'POLISH') polishCount++;
    if (r.isQuickWin) quickWinsCount++;
    if (r.founderInputRequired) founderInputsRequiredCount++;
  }

  return {
    totalRecommendations: recommendations.length,
    criticalCount,
    highCount,
    polishCount,
    quickWinsCount,
    founderInputsRequiredCount,
  };
}

/**
 * Fallback deterministic recommendation generator when Gemini is offline.
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
    const slides = c.conflictingStatements.map((s) => s.slideNumber);
    const relatedQ = (simulatorResult?.questions || []).find((q) => q.currentAnswerability === 'CONTRADICTORY');

    recommendations.push({
      id: contradictionRecId,
      priority: 'CRITICAL',
      category: 'traction',
      title: 'Resolve conflicting metrics before rewriting traction narrative',
      problem: `Slide ${c.conflictingStatements[0]?.slideNumber || 1} indicates "${c.conflictingStatements[0]?.text || ''}", whereas Slide ${c.conflictingStatements[1]?.slideNumber || 2} states "${c.conflictingStatements[1]?.text || ''}".`,
      whyItMatters: 'Contradictory metrics immediately halt investor due diligence and undermine reporting credibility.',
      actionType: 'RESOLVE_CONTRADICTION',
      targetSlides: slides.length > 0 ? slides : [5, 11],
      relatedClaims: [],
      relatedDiagnostics: [c.id],
      relatedEvaluationDimensions: ['Traction Credibility'],
      relatedInvestorQuestions: relatedQ ? [relatedQ.id] : [],
      existingEvidence: c.conflictingStatements.map((s) => ({
        slideNumber: s.slideNumber,
        statement: s.text,
        source: s.source,
      })),
      missingInformation: ['Confirmed single source of truth and correct measurement cutoff date.'],
      founderInputRequired: true,
      isQuickWin: false,
      recommendedAction: `Determine which figure (${c.conflictingStatements[0]?.text} vs. ${c.conflictingStatements[1]?.text}) is the verified audited number, and align both Slide ${c.conflictingStatements[0]?.slideNumber} and Slide ${c.conflictingStatements[1]?.slideNumber}.`,
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
      whyItMatters: 'Investors cannot evaluate unit economics, scalability, or fundability without knowing who pays and how pricing works.',
      actionType: 'REQUEST_FOUNDER_INFORMATION',
      targetSlides: [6],
      relatedClaims: [],
      relatedDiagnostics: missingEconDiag ? [missingEconDiag.id] : [],
      relatedEvaluationDimensions: [bmDim?.dimensionName || 'Business Model'],
      relatedInvestorQuestions: relatedQ ? [relatedQ.id] : [],
      existingEvidence: !isTotalMissing && profile?.businessModel?.revenueModel?.rawValue
        ? [{ slideNumber: 6, statement: profile.businessModel.revenueModel.rawValue, source: 'native_pdf' }]
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
        ? 'Add a dedicated monetization section on Slide 6 stating the fee structure, contract terms, and ACV expectation.'
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
    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'HIGH',
      category: 'market',
      title: 'Substantiate the addressable market size thesis',
      problem: `The ${tamVal} market figure appears without a bottom-up derivation or cited industry source.`,
      whyItMatters: 'Top-down multi-billion numbers without bottom-up calculation trigger investor skepticism regarding realism.',
      actionType: 'STRENGTHEN_EVIDENCE',
      targetSlides: unsupportedMarket ? [unsupportedMarket.slideNumber] : [8],
      relatedClaims: unsupportedMarket ? [unsupportedMarket.id] : [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Market Thesis'],
      relatedInvestorQuestions: relatedQ ? [relatedQ.id] : [],
      existingEvidence: unsupportedMarket
        ? [{ slideNumber: unsupportedMarket.slideNumber, statement: unsupportedMarket.claimText, source: 'native_pdf' }]
        : [],
      missingInformation: [
        'Bottom-up formula: Number of qualified customer accounts in target geography × Average Annual Spend (ACV)',
        'Name and year of reputable third-party industry research source',
      ],
      founderInputRequired: true,
      isQuickWin: false,
      recommendedAction: `On Slide ${unsupportedMarket?.slideNumber || 8}, replace the isolated ${tamVal} metric with the explicit calculation (Accounts × ACV = Bottom-Up TAM) or cite a reputable industry report.`,
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
      whyItMatters: 'Sophisticated investors closely examine whether the sales motion can sustainably support unit economics and CAC.',
      actionType: 'CONNECT_LOGIC',
      targetSlides: gtmDim.slideReferences.length > 0 ? gtmDim.slideReferences : [4, 7],
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

    const slideNum = profile?.traction?.ARR?.evidence?.[0]?.slideNumber || 5;
    const existingSnippet = [arrVal, growthVal, custVal].filter(Boolean).join(' | ');

    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'HIGH',
      category: 'traction',
      title: 'Consolidate verified traction metrics into a coherent headline',
      problem: 'Traction proof points are dispersed or presented without clear narrative momentum.',
      whyItMatters: 'A tightly framed traction slide immediately establishes strong operational velocity and proof of product-market fit.',
      actionType: 'RESTRUCTURE_NARRATIVE',
      targetSlides: [slideNum],
      relatedClaims: [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Traction Credibility'],
      relatedInvestorQuestions: [],
      existingEvidence: [
        { slideNumber: slideNum, statement: existingSnippet, source: 'native_pdf' },
      ],
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
    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'POLISH',
      category: 'competition',
      title: 'Qualify or substantiate competitive superiority assertions',
      problem: 'Aggressive superlative assertions (e.g. fastest/best platform) are stated without comparative benchmarks.',
      whyItMatters: 'Investors discount unsubstantiated superlatives and prefer auditable, specific architectural advantages.',
      actionType: 'REMOVE_OR_QUALIFY_CLAIM',
      targetSlides: diffClaim ? [diffClaim.slideNumber] : [9],
      relatedClaims: diffClaim ? [diffClaim.id] : [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Competitive Positioning', 'Defensibility'],
      relatedInvestorQuestions: [],
      existingEvidence: diffClaim
        ? [{ slideNumber: diffClaim.slideNumber, statement: diffClaim.claimText, source: 'native_pdf' }]
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
    const askSlide = profile.fundraising.amountBeingRaised.evidence?.[0]?.slideNumber || 10;

    recommendations.push({
      id: `rec-${recIdCounter++}`,
      priority: 'POLISH',
      category: 'ask',
      title: 'Map capital ask directly to milestone inflection targets',
      problem: `The ${askVal} target raise states broad budget categories (${useVal}) without linking to specific post-round milestones.`,
      whyItMatters: 'Seed investors look for round economics that clearly bridge the startup to Series A readiness.',
      actionType: 'CLARIFY_EXISTING_INFORMATION',
      targetSlides: [askSlide],
      relatedClaims: [],
      relatedDiagnostics: [],
      relatedEvaluationDimensions: ['Fundraising Ask'],
      relatedInvestorQuestions: [],
      existingEvidence: [
        { slideNumber: askSlide, statement: `Raising ${askVal} for ${useVal}`, source: 'native_pdf' },
      ],
      missingInformation: ['Target ARR milestone at end of runway', 'Projected runway in months (e.g. 18-24 months)'],
      founderInputRequired: true,
      isQuickWin: false,
      recommendedAction: `On Slide ${askSlide}, add explicit milestones to the ${askVal} ask: target runway length and Series A metrics.`,
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
