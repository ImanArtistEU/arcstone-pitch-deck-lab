import { HybridDeckResult } from '@/types/deck';
import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap } from '@/types/claim';
import { DeckDiagnostics } from '@/types/diagnostics';
import {
  FundraisingEvaluation,
  DimensionEvaluation,
  ThesisPillar,
  NarrativeChainTransition,
  InvestorObjection,
  StrongElement,
  DimensionSummary,
} from '@/types/evaluation';
import { getOrBuildEvaluationContextAndExpectations } from './evaluation-context';

export interface EvaluationRunResult {
  status: 'success' | 'skipped' | 'partial' | 'error';
  evaluation: FundraisingEvaluation | null;
  errorMessage?: string;
}

/**
 * Filter and validate slide references against actual total deck pages.
 */
function sanitizeSlideNumbers(slides: unknown, totalPages: number): number[] {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((s) => Number(s))
    .filter((s) => !isNaN(s) && s >= 1 && s <= totalPages);
}

/**
 * Post-process and defend against model hallucinations.
 */
export function postProcessEvaluation(
  raw: {
    reconstructedThesis?: ThesisPillar[];
    dimensions?: DimensionEvaluation[];
    narrativeChain?: NarrativeChainTransition[];
    investorObjections?: InvestorObjection[];
    strongElements?: StrongElement[];
    overallSynthesis?: string;
  },
  totalPages: number,
  validClaimIds: Set<string>
): {
  thesis: ThesisPillar[];
  dimensions: DimensionEvaluation[];
  chain: NarrativeChainTransition[];
  objections: InvestorObjection[];
  strong: StrongElement[];
  synthesis: string;
} {
  // 1. Sanitize Thesis Pillars
  const thesis: ThesisPillar[] = (raw.reconstructedThesis || []).map((p) => ({
    ...p,
    slideNumbers: sanitizeSlideNumbers(p.slideNumbers, totalPages),
  }));

  // 2. Sanitize Dimensions
  const dimensions: DimensionEvaluation[] = (raw.dimensions || [])
    .filter((d) => d && d.dimensionName && d.status)
    .map((d) => {
      const sanitizedSlides = sanitizeSlideNumbers(d.slideReferences, totalPages);
      const sanitizedClaims = (d.relatedClaimIds || []).filter((id) => validClaimIds.has(id));

      return {
        ...d,
        slideReferences: sanitizedSlides,
        relatedClaimIds: sanitizedClaims,
      };
    });

  // 3. Sanitize Narrative Chain
  const chain: NarrativeChainTransition[] = (raw.narrativeChain || []).map((t) => ({
    ...t,
    slideNumbers: sanitizeSlideNumbers(t.slideNumbers, totalPages),
  }));

  // 4. Sanitize Investor Objections (reject if referencing invalid slide numbers)
  const objections: InvestorObjection[] = (raw.investorObjections || [])
    .map((obj) => ({
      ...obj,
      relevantSlides: sanitizeSlideNumbers(obj.relevantSlides, totalPages),
    }))
    .filter((obj) => obj.relevantSlides.length > 0 || obj.importance === 'critical');

  // 5. Sanitize Strong Elements
  const strong: StrongElement[] = (raw.strongElements || [])
    .map((el) => ({
      ...el,
      slideNumbers: sanitizeSlideNumbers(el.slideNumbers, totalPages),
    }))
    .filter((el) => el.highlight && el.evidence);

  const synthesis = raw.overallSynthesis || 'Fundraising case evaluation complete.';

  return { thesis, dimensions, chain, objections, strong, synthesis };
}

/**
 * Apply deterministic overrides based on structured data and stage.
 */
export function applyDeterministicOverrides(
  dimensions: DimensionEvaluation[],
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null
): DimensionEvaluation[] {
  const updated = [...dimensions];

  // 1. Business Model Check
  const bModelField = profile?.businessModel?.revenueModel?.rawValue;
  const hasNoBModel = !bModelField || bModelField === 'not_found' || bModelField.toLowerCase().includes('not found');
  const bModelClaims = (claimMap?.claims || []).filter(
    (c) => c.claimType === 'revenue' || c.claimType === 'unit_economics'
  );

  if (hasNoBModel && bModelClaims.length === 0) {
    const idx = updated.findIndex((d) => d.dimensionName.toLowerCase().includes('business model'));
    if (idx !== -1) {
      updated[idx] = {
        ...updated[idx],
        status: 'MISSING',
        finding: 'No monetization, revenue model, or pricing information was identified in the deck.',
        rationale: 'Neither native text nor visual elements communicate how the company earns revenue.',
        weaknessType: 'COMMUNICATION_GAP',
      };
    }
  }

  // 2. Contradictory Traction Check
  const tractionConflicts = (diagnostics?.contradictions || []).filter(
    (c) => c.category === 'traction' || c.category === 'customer' || c.category === 'customer_count'
  );
  if (tractionConflicts.length > 0) {
    const idx = updated.findIndex((d) => d.dimensionName.toLowerCase().includes('traction'));
    if (idx !== -1) {
      const conflict = tractionConflicts[0];
      updated[idx] = {
        ...updated[idx],
        status: 'CONTRADICTORY',
        finding: conflict.description,
        rationale: conflict.whyConflicting,
        weaknessType: 'LOGIC_GAP',
        slideReferences: conflict.conflictingStatements.map((s) => s.slideNumber),
      };
    }
  }

  // 3. Unsupported TAM Check
  const marketClaims = (claimMap?.claims || []).filter(
    (c) => c.claimType === 'market' && c.supportStatus === 'unsupported'
  );
  if (marketClaims.length > 0) {
    const idx = updated.findIndex((d) => d.dimensionName.toLowerCase().includes('market'));
    if (idx !== -1 && updated[idx].status !== 'CONTRADICTORY') {
      const claim = marketClaims[0];
      updated[idx] = {
        ...updated[idx],
        status: 'UNDERDEVELOPED',
        finding: `Market size claim "${claim.claimText}" is stated without underlying derivation or source citation.`,
        rationale: 'The deck asserts an addressable market figure but does not substantiate how it was calculated.',
        weaknessType: 'EVIDENCE_GAP',
        slideReferences: [claim.slideNumber],
        relatedClaimIds: [claim.id],
      };
    }
  }

  // 4. Stage-Adaptive Rule (Pre-Seed)
  const stage = (profile?.fundraising?.currentStage?.rawValue || '').toLowerCase();
  if (stage.includes('pre-seed') || stage.includes('concept') || stage.includes('idea')) {
    const idx = updated.findIndex((d) => d.dimensionName.toLowerCase().includes('traction'));
    if (idx !== -1 && updated[idx].status === 'MISSING') {
      // Check if validation/pilots exist
      const validationClaims = (claimMap?.claims || []).filter((c) => c.claimType === 'traction');
      if (validationClaims.length > 0) {
        updated[idx] = {
          ...updated[idx],
          status: 'ADEQUATE',
          finding: 'Early qualitative user validation and customer interest present appropriate for pre-seed stage.',
        };
      }
    }
  }

  // 5. GTM Logic Gap Check (e.g., SMB ICP with high ACV enterprise pricing and self-serve motion)
  const icpText = (profile?.customerICP?.customerType?.rawValue || '').toLowerCase();
  const pricingText = (profile?.businessModel?.revenueModel?.rawValue || '').toLowerCase() + ' ' + (profile?.businessModel?.pricingValues?.rawValue || '');
  const motionText = (profile?.goToMarket?.salesMotion?.rawValue || '').toLowerCase();

  const isSmallCustomer = icpText.includes('smb') || icpText.includes('small') || icpText.includes('mom-and-pop') || icpText.includes('convenience');
  const isHighPricing = pricingText.includes('100,000') || pricingText.includes('100k') || pricingText.includes('enterprise license') || pricingText.includes('50k');
  const isSelfServe = motionText.includes('self-serve') || motionText.includes('automated online') || motionText.includes('freemium');

  if (isSmallCustomer && isHighPricing && isSelfServe) {
    const idx = updated.findIndex((d) => d.dimensionName.toLowerCase().includes('go-to-market') || d.dimensionName.toLowerCase().includes('gtm'));
    if (idx !== -1) {
      updated[idx] = {
        ...updated[idx],
        status: 'UNDERDEVELOPED',
        finding: 'Severe go-to-market mismatch: Selling high ACV enterprise tier to small business segment via automated self-serve motion without dedicated high-touch sales.',
        rationale: 'Customer segment, contract value, and acquisition motion conflict fundamentally.',
        weaknessType: 'LOGIC_GAP',
      };
    }
  }

  return updated;
}

/**
 * Compute summary statistics across all 14 dimensions.
 */
export function computeDimensionSummary(dimensions: DimensionEvaluation[]): DimensionSummary {
  return {
    strongCount: dimensions.filter((d) => d.status === 'STRONG').length,
    adequateCount: dimensions.filter((d) => d.status === 'ADEQUATE').length,
    underdevelopedCount: dimensions.filter((d) => d.status === 'UNDERDEVELOPED').length,
    missingCount: dimensions.filter((d) => d.status === 'MISSING').length,
    contradictoryCount: dimensions.filter((d) => d.status === 'CONTRADICTORY').length,
  };
}

/**
 * Generate fallback deterministic evaluation if Gemini API is skipped or unavailable.
 */
function getFieldSlides(field?: { evidence?: { slideNumber: number }[] }): number[] {
  if (!field || !Array.isArray(field.evidence)) return [];
  return field.evidence
    .map((e) => e.slideNumber)
    .filter((s) => typeof s === 'number' && s > 0);
}

/**
 * Generate fallback deterministic evaluation if Gemini API is skipped or unavailable.
 */
export function generateDeterministicEvaluation(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  totalPages: number
): FundraisingEvaluation {
  const problemField = profile?.problemSolution?.problemStatement || profile?.problemSolution?.valueProposition;
  const problemText = problemField?.rawValue;
  const problemSlides = getFieldSlides(problemField);

  const solutionField = profile?.problemSolution?.productDescription;
  const solutionText = solutionField?.rawValue;
  const solutionSlides = getFieldSlides(solutionField);

  const customerField = profile?.customerICP?.customerType;
  const customerSlides = getFieldSlides(customerField);

  const foundersCount = profile?.team?.founders?.length || 0;
  const foundersSummary = foundersCount > 0 ? `${foundersCount} founders identified: ${profile!.team.founders.map((f) => f.name).join(', ')}` : 'Founding team details not identified.';
  const foundersSlides = profile?.team?.founders?.map((f) => f.slideNumber).filter((s): s is number => typeof s === 'number' && s > 0) || [];

  const pillars: ThesisPillar[] = [
    {
      pillar: 'Problem',
      communicated: !!problemText,
      summary: problemText || 'Insufficient deck evidence to establish problem context.',
      slideNumbers: problemSlides,
    },
    {
      pillar: 'Customer',
      communicated: !!customerField?.rawValue,
      summary: customerField?.rawValue || 'Insufficient deck evidence to establish target customer ICP.',
      slideNumbers: customerSlides,
    },
    {
      pillar: 'Solution',
      communicated: !!solutionText,
      summary: solutionText || 'Insufficient deck evidence to describe product solution.',
      slideNumbers: solutionSlides,
    },
    {
      pillar: 'Why Now',
      communicated: false,
      summary: 'Insufficient deck evidence to establish market urgency or timing catalyst.',
      slideNumbers: [],
    },
    {
      pillar: 'Market',
      communicated: !!profile?.market?.TAM?.rawValue,
      summary: profile?.market?.TAM?.rawValue ? `TAM: ${profile.market.TAM.rawValue}` : 'Market sizing not identified.',
      slideNumbers: getFieldSlides(profile?.market?.TAM),
    },
    {
      pillar: 'Traction',
      communicated: !!profile?.traction?.ARR?.rawValue || !!profile?.traction?.customerCount?.rawValue,
      summary: profile?.traction?.customerCount?.rawValue ? `${profile.traction.customerCount.rawValue} customers` : 'Traction metrics absent.',
      slideNumbers: getFieldSlides(profile?.traction?.customerCount),
    },
    {
      pillar: 'Business Model',
      communicated: !!profile?.businessModel?.revenueModel?.rawValue,
      summary: profile?.businessModel?.revenueModel?.rawValue || 'Monetization model not stated in deck.',
      slideNumbers: getFieldSlides(profile?.businessModel?.revenueModel),
    },
    {
      pillar: 'GTM',
      communicated: !!profile?.goToMarket?.salesMotion?.rawValue,
      summary: profile?.goToMarket?.salesMotion?.rawValue || 'Go-to-market distribution motion not detailed.',
      slideNumbers: getFieldSlides(profile?.goToMarket?.salesMotion),
    },
    {
      pillar: 'Competitive Advantage',
      communicated: !!profile?.competition?.differentiationClaims?.rawValue,
      summary: profile?.competition?.differentiationClaims?.rawValue || 'Differentiation claims not detailed.',
      slideNumbers: getFieldSlides(profile?.competition?.differentiationClaims),
    },
    {
      pillar: 'Team',
      communicated: foundersCount > 0,
      summary: foundersSummary,
      slideNumbers: foundersSlides,
    },
    {
      pillar: 'Fundraising',
      communicated: !!profile?.fundraising?.amountBeingRaised?.rawValue,
      summary: profile?.fundraising?.amountBeingRaised?.rawValue ? `Raising ${profile.fundraising.amountBeingRaised.rawValue}` : 'Fundraising target not stated.',
      slideNumbers: getFieldSlides(profile?.fundraising?.amountBeingRaised),
    },
  ];

  const defaultDimensions: DimensionEvaluation[] = [
    {
      id: 'dim-1',
      dimensionName: 'Problem Clarity',
      status: problemText ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: problemText ? 'Stated core problem and value proposition.' : 'Problem framing lacks detail.',
      rationale: 'Evaluated based on profile problem statements.',
      slideReferences: problemSlides,
    },
    {
      id: 'dim-2',
      dimensionName: 'Solution Clarity',
      status: solutionText ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: solutionText ? 'Core solution described in deck evidence.' : 'Product capabilities remain vague.',
      rationale: 'Grounded in extracted slide evidence.',
      slideReferences: solutionSlides,
    },
    {
      id: 'dim-3',
      dimensionName: 'Customer / ICP Clarity',
      status: profile?.customerICP?.customerType?.rawValue ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: profile?.customerICP?.customerType?.rawValue || 'Customer segment not clearly defined.',
      rationale: 'Derived from customerICP profile fields.',
      slideReferences: getFieldSlides(profile?.customerICP?.customerType),
    },
    {
      id: 'dim-4',
      dimensionName: 'Problem-Solution Coherence',
      status: 'ADEQUATE',
      finding: 'Solution logically maps to stated customer problem.',
      rationale: 'Core product directly addresses stated workflow friction.',
      slideReferences: [1, 2],
    },
    {
      id: 'dim-5',
      dimensionName: 'Traction Credibility',
      status: profile?.traction?.customerCount?.rawValue ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: profile?.traction?.customerCount?.rawValue ? `Customer progress: ${profile.traction.customerCount.rawValue}` : 'Limited quantitative traction provided.',
      rationale: 'Traction substantiation checked across slides.',
      slideReferences: getFieldSlides(profile?.traction?.customerCount),
    },
    {
      id: 'dim-6',
      dimensionName: 'Business Model Clarity',
      status: profile?.businessModel?.revenueModel?.rawValue ? 'ADEQUATE' : 'MISSING',
      finding: profile?.businessModel?.revenueModel?.rawValue || 'No clear monetization model found.',
      rationale: 'Verified against businessModel profile fields.',
      slideReferences: getFieldSlides(profile?.businessModel?.revenueModel),
    },
    {
      id: 'dim-7',
      dimensionName: 'Go-to-Market Credibility',
      status: profile?.goToMarket?.salesMotion?.rawValue ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: profile?.goToMarket?.salesMotion?.rawValue || 'Sales and acquisition channels lack detail.',
      rationale: 'Go-to-market motion evaluated from deck statements.',
      slideReferences: getFieldSlides(profile?.goToMarket?.salesMotion),
    },
    {
      id: 'dim-8',
      dimensionName: 'Market Thesis',
      status: profile?.market?.TAM?.rawValue ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: profile?.market?.TAM?.rawValue ? `TAM stated as ${profile.market.TAM.rawValue}` : 'Market sizing absent or ungrounded.',
      rationale: 'Addressable market scope and citations reviewed.',
      slideReferences: getFieldSlides(profile?.market?.TAM),
    },
    {
      id: 'dim-9',
      dimensionName: 'Competitive Positioning',
      status: profile?.competition?.differentiationClaims?.rawValue ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: profile?.competition?.differentiationClaims?.rawValue || 'Competitive alternatives not systematically mapped.',
      rationale: 'Alternative solutions and differentiation statements reviewed.',
      slideReferences: getFieldSlides(profile?.competition?.differentiationClaims),
    },
    {
      id: 'dim-10',
      dimensionName: 'Defensibility',
      status: profile?.competition?.differentiationClaims?.rawValue ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: profile?.competition?.differentiationClaims?.rawValue || 'Defensibility or moat mechanisms not explicitly detailed in deck.',
      rationale: 'Evaluated from stated proprietary attributes.',
      slideReferences: getFieldSlides(profile?.competition?.differentiationClaims),
    },
    {
      id: 'dim-11',
      dimensionName: 'Team / Founder-Market Fit Communication',
      status: foundersCount > 0 ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: foundersSummary,
      rationale: 'Founder relevance evaluated strictly from deck text.',
      slideReferences: foundersSlides,
    },
    {
      id: 'dim-12',
      dimensionName: 'Fundraising Ask',
      status: profile?.fundraising?.amountBeingRaised?.rawValue ? 'ADEQUATE' : 'UNDERDEVELOPED',
      finding: profile?.fundraising?.amountBeingRaised?.rawValue ? `Seeking ${profile.fundraising.amountBeingRaised.rawValue}` : 'Target raise amount not specified.',
      rationale: 'Fundraising ask and allocation reviewed.',
      slideReferences: getFieldSlides(profile?.fundraising?.amountBeingRaised),
    },
    {
      id: 'dim-13',
      dimensionName: 'Evidence Quality',
      status: (diagnostics?.summary.evidenceGapCount || 0) > 3 ? 'UNDERDEVELOPED' : 'ADEQUATE',
      finding: `${diagnostics?.summary.evidenceGapCount || 0} material evidence gaps detected in claim map.`,
      rationale: 'Direct aggregate from Claim & Evidence Map.',
      slideReferences: [],
    },
    {
      id: 'dim-14',
      dimensionName: 'Narrative Coherence',
      status: (diagnostics?.summary.contradictionCount || 0) > 0 ? 'CONTRADICTORY' : 'ADEQUATE',
      finding: (diagnostics?.summary.contradictionCount || 0) > 0 ? 'Internal data contradictions create narrative friction.' : 'Narrative flows logically from problem to ask.',
      rationale: 'Story progression evaluated across all slides.',
      slideReferences: [],
    },
  ];

  const dimensions = applyDeterministicOverrides(defaultDimensions, profile, claimMap, diagnostics);
  const dimensionSummary = computeDimensionSummary(dimensions);

  return {
    reconstructedThesis: pillars,
    dimensions,
    narrativeChain: [
      {
        fromPillar: 'Problem',
        toPillar: 'Customer',
        status: problemText && customerField?.rawValue ? 'clear' : 'missing',
        assessment: problemText && customerField?.rawValue ? 'Target customer experiencing the problem is established.' : 'Insufficient deck evidence to link problem to target customer.',
        slideNumbers: problemSlides.length > 0 ? problemSlides : customerSlides,
      },
      {
        fromPillar: 'Customer',
        toPillar: 'Solution',
        status: customerField?.rawValue && solutionText ? 'clear' : 'missing',
        assessment: customerField?.rawValue && solutionText ? 'Solution addresses customer workflow pain.' : 'Insufficient deck evidence to link customer to solution.',
        slideNumbers: solutionSlides,
      },
      {
        fromPillar: 'Solution',
        toPillar: 'Traction',
        status: solutionText && profile?.traction?.ARR?.rawValue ? 'clear' : 'missing',
        assessment: solutionText && profile?.traction?.ARR?.rawValue ? 'Customer adoption demonstrates demand.' : 'Insufficient deck evidence to connect solution to quantitative traction.',
        slideNumbers: getFieldSlides(profile?.traction?.ARR),
      },
      {
        fromPillar: 'Traction',
        toPillar: 'Fundraise',
        status: profile?.fundraising?.amountBeingRaised?.rawValue ? 'clear' : 'missing',
        assessment: profile?.fundraising?.amountBeingRaised?.rawValue ? 'Capital ask stated in deck.' : 'Insufficient deck evidence to link traction to capital ask.',
        slideNumbers: getFieldSlides(profile?.fundraising?.amountBeingRaised),
      },
    ],
    investorObjections: profile?.goToMarket?.salesMotion?.rawValue
      ? []
      : [
          {
            id: 'obj-1',
            objection: 'How repeatable is customer acquisition without dedicated distribution channels?',
            triggeringGap: 'GTM details and acquisition costs are not detailed in the deck.',
            relevantSlides: [],
            importance: 'material',
          },
        ],
    strongElements: problemText
      ? [
          {
            id: 'str-1',
            pillarOrDimension: 'Problem Clarity',
            highlight: 'Clear articulation of operational pain point.',
            evidence: problemText,
            slideNumbers: problemSlides,
          },
        ]
      : [],
    dimensionSummary,
    overallSynthesis: problemText && solutionText
      ? 'The pitch deck communicates a problem and solution. Primary areas for development remain around distribution repeatability and quantitative market sizing.'
      : 'Insufficient deck evidence to establish core thesis parameters. Further factual details required across problem, solution, or traction.',
    evaluatedAt: new Date(),
  };
}

/**
 * Execute Full Fundraising Thesis & Narrative Evaluation.
 */
export async function executeFundraisingEvaluation(
  hybridResult: HybridDeckResult,
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null
): Promise<EvaluationRunResult> {
  const totalPages = hybridResult.summary.totalPages;
  const validClaimIds = new Set<string>((claimMap?.claims || []).map((c) => c.id));

  try {
    const { evaluationContext, evaluationExpectations } = getOrBuildEvaluationContextAndExpectations(
      profile,
      claimMap,
      diagnostics
    );

    const slideEvidence = hybridResult.slides.map((s) => ({
      pageNumber: s.pageNumber,
      text: s.nativeExtraction?.rawText?.slice(0, 500) || s.visualExtraction?.summary || '',
    }));

    const response = await fetch('/api/deck/evaluate-thesis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        claims: claimMap?.claims || [],
        diagnosticsSummary: diagnostics?.summary,
        slideEvidence,
        evaluationContext,
        evaluationExpectations,
      }),
    });

    if (response.ok) {
      const resJson = await response.json();

      if (resJson.status === 'success' && resJson.data) {
        // Post-process, sanitize, and defend against hallucinations
        const sanitized = postProcessEvaluation(resJson.data, totalPages, validClaimIds);

        // Apply deterministic overrides (missing business model, contradictory traction, unsupported TAM, stage)
        const overriddenDimensions = applyDeterministicOverrides(
          sanitized.dimensions,
          profile,
          claimMap,
          diagnostics
        );

        const dimensionSummary = computeDimensionSummary(overriddenDimensions);

        const evaluation: FundraisingEvaluation = {
          reconstructedThesis: sanitized.thesis,
          dimensions: overriddenDimensions,
          narrativeChain: sanitized.chain,
          investorObjections: sanitized.objections,
          strongElements: sanitized.strong,
          dimensionSummary,
          overallSynthesis: sanitized.synthesis,
          evaluatedAt: new Date(),
        };

        return {
          status: 'success',
          evaluation,
        };
      } else if (resJson.status === 'skipped') {
        const fallback = generateDeterministicEvaluation(profile, claimMap, diagnostics, totalPages);
        return {
          status: 'skipped',
          evaluation: fallback,
        };
      } else {
        const fallback = generateDeterministicEvaluation(profile, claimMap, diagnostics, totalPages);
        return {
          status: 'partial',
          evaluation: fallback,
          errorMessage: resJson.message,
        };
      }
    } else {
      const fallback = generateDeterministicEvaluation(profile, claimMap, diagnostics, totalPages);
      return {
        status: 'partial',
        evaluation: fallback,
        errorMessage: `Server evaluation error: ${response.statusText}`,
      };
    }
  } catch (err: unknown) {
    console.error('[thesis-evaluator] Error calling evaluate-thesis API:', err);
    const fallback = generateDeterministicEvaluation(profile, claimMap, diagnostics, totalPages);
    return {
      status: 'partial',
      evaluation: fallback,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
