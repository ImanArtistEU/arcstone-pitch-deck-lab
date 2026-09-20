import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap, MaterialClaim } from '@/types/claim';
import { DeckDiagnostics } from '@/types/diagnostics';
import { CompanyEvaluationContext } from '@/types/evaluation-context';
import { EvaluationExpectations } from '@/lib/deck/evaluation-expectations';
import {
  InvestmentCase,
  StructuredInvestmentThesis,
  InvestmentCaseMechanism,
  WhatMustBeTrue,
  InvestmentCaseDependency,
  InvestmentCaseRisk,
  InvestmentCaseContradiction,
  InvestmentCaseQuestion,
  InvestmentCaseSummary,
  MechanismCategory,
  AssumptionImportance,
  AssumptionOrigin,
  EvidenceStatus,
  EvidenceQualityClass,
  SuggestedFounderAction,
  DependencyRelationship,
  RiskCategory,
  RiskType,
} from '@/types/investment-case';

/**
 * Prohibited fundability/scoring vocabulary to strictly sanitize.
 */
const PROHIBITED_TERMS_REGEX =
  /\b(fundable|unfundable|investment ready|not investment ready|funding probability|chance of funding|will fail|will succeed)\b/gi;

/**
 * Sanitizes strings to eliminate prohibited scoring or fundability assertions.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  return text.replace(PROHIBITED_TERMS_REGEX, '[unproven thesis assumption]');
}

/**
 * Helper to collect valid slide numbers from all available deck evidence.
 */
function getValidSlideNumbers(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null
): Set<number> {
  const slides = new Set<number>();

  if (claimMap?.claims) {
    for (const c of claimMap.claims) {
      if (typeof c.slideNumber === 'number' && c.slideNumber > 0) {
        slides.add(c.slideNumber);
      }
    }
  }

  if (diagnostics?.contradictions) {
    for (const c of diagnostics.contradictions) {
      for (const st of c.conflictingStatements || []) {
        if (typeof st.slideNumber === 'number' && st.slideNumber > 0) {
          slides.add(st.slideNumber);
        }
      }
    }
  }

  return slides;
}

/**
 * Helper to collect valid claim IDs.
 */
function getValidClaimIds(claimMap: ClaimEvidenceMap | null): Set<string> {
  const ids = new Set<string>();
  if (claimMap?.claims) {
    for (const c of claimMap.claims) {
      if (c.id) ids.add(c.id);
    }
  }
  return ids;
}

/**
 * Reconstructs the Causal Investment Thesis from deck facts and context.
 */
function reconstructInvestmentThesis(
  profile: StartupProfile | null,
  context: CompanyEvaluationContext | null
): StructuredInvestmentThesis {
  const prob = profile?.problemSolution?.problemStatement?.rawValue || 'Target market problem';
  const sol =
    profile?.problemSolution?.productDescription?.rawValue ||
    profile?.problemSolution?.valueProposition?.rawValue ||
    'Proposed solution approach';
  const icp = profile?.customerICP?.customerType?.rawValue || 'Target customer segment';
  const acvVal =
    profile?.businessModel?.pricingValues?.rawValue ||
    profile?.businessModel?.revenueModel?.rawValue ||
    'Monetization model';
  const gtmVal = profile?.goToMarket?.salesMotion?.rawValue || 'Customer acquisition motion';
  const mktVal = profile?.market?.TAM?.rawValue || 'Market opportunity';
  const arrVal = profile?.traction?.ARR?.rawValue || profile?.traction?.revenue?.rawValue || 'Traction milestone';
  const teamVal = profile?.team?.founders?.[0]?.background || 'Founding team execution capability';

  const category = context?.companyCategory || 'technology startup';
  const archetype = context?.businessModel.primaryArchetype || 'B2B SaaS';
  const stage = context?.declaredStage.normalizedStage || 'seed';

  const statedThesis = sanitizeText(
    `The deck asserts a ${category} solution addressing ${prob} for ${icp} via ${gtmVal}, claiming market opportunity of ${mktVal}.`
  );

  const reconstructedThesis = sanitizeText(
    `If the company can acquire ${icp} via ${gtmVal}, convert initial adoption into recurring value under ${acvVal}, and retain customers through defensible product workflows, then it can scale from ${arrVal} into a persistent venture-scale business in ${mktVal}.`
  );

  const summary = sanitizeText(
    `Reconstructed thesis: Causal expansion relying on ${gtmVal} acquisition, ${acvVal} monetization, and workflow retention.`
  );

  return {
    problem: sanitizeText(prob),
    targetCustomer: sanitizeText(icp),
    wedge: sanitizeText(sol),
    valueCreation: sanitizeText(`Value creation through solving ${prob} for ${icp}`),
    distribution: sanitizeText(gtmVal),
    monetization: sanitizeText(acvVal),
    growth: sanitizeText(arrVal),
    marketExpansion: sanitizeText(mktVal),
    defensibility: sanitizeText('Workflow integration and customer data accumulation'),
    teamAdvantage: sanitizeText(teamVal),
    capitalPath: sanitizeText(`Capital path for ${stage} funding stage`),
    summary,
    statedThesis,
    reconstructedThesis,
  };
}

/**
 * Deterministically constructs core Investment Case Mechanisms based on business model and profile.
 */
function constructMechanisms(
  profile: StartupProfile | null,
  context: CompanyEvaluationContext | null,
  claimMap: ClaimEvidenceMap | null,
  validSlides: Set<number>,
  validClaimIds: Set<string>
): InvestmentCaseMechanism[] {
  const mechanisms: InvestmentCaseMechanism[] = [];
  const archetype = context?.businessModel.primaryArchetype || 'B2B SaaS';
  const techCategory = context?.businessModel.technologyCategory || 'software';

  const findClaims = (keyword: string): MaterialClaim[] => {
    if (!claimMap?.claims) return [];
    return claimMap.claims.filter(
      (c: MaterialClaim) =>
        c.claimText.toLowerCase().includes(keyword) ||
        c.claimType?.toLowerCase().includes(keyword)
    );
  };

  // 1. Value Creation Mechanism
  const valClaims = findClaims('value').concat(findClaims('problem')).concat(findClaims('solution'));
  const valSlideNums = Array.from(
    new Set(valClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))
  );
  const valClaimIds = valClaims.map((c) => c.id).filter((id) => validClaimIds.has(id));

  mechanisms.push({
    id: 'mech_value_creation',
    category: 'value_creation',
    statement: sanitizeText(
      `Product delivers measurable ROI/value for ${profile?.customerICP?.customerType?.rawValue || 'target buyers'}`
    ),
    importance: 'critical',
    evidenceStatus: valClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : valClaims.length > 0
      ? 'asserted_only'
      : 'unsupported',
    supportingClaimIds: valClaimIds,
    supportingSlideNumbers: valSlideNums,
    supportingFacts: valClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'high',
  });

  // 2. Customer Acquisition & Distribution Mechanism
  const gtmClaims = findClaims('sales').concat(findClaims('channel')).concat(findClaims('customer'));
  const gtmSlideNums = Array.from(
    new Set(gtmClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))
  );
  const gtmClaimIds = gtmClaims.map((c) => c.id).filter((id) => validClaimIds.has(id));

  mechanisms.push({
    id: 'mech_customer_acquisition',
    category: 'customer_acquisition',
    statement: sanitizeText(
      `Customer acquisition via ${profile?.goToMarket?.salesMotion?.rawValue || 'direct or outbound sales motion'}`
    ),
    importance: 'critical',
    evidenceStatus: gtmClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : gtmClaims.length > 0
      ? 'partially_supported'
      : 'asserted_only',
    supportingClaimIds: gtmClaimIds,
    supportingSlideNumbers: gtmSlideNums,
    supportingFacts: gtmClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'medium',
  });

  // 3. Monetization Mechanism
  const monClaims = findClaims('pricing').concat(findClaims('revenue')).concat(findClaims('monetization'));
  const monSlideNums = Array.from(
    new Set(monClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))
  );
  const monClaimIds = monClaims.map((c) => c.id).filter((id) => validClaimIds.has(id));

  mechanisms.push({
    id: 'mech_monetization',
    category: 'monetization',
    statement: sanitizeText(
      `Unit monetization through ${profile?.businessModel?.pricingValues?.rawValue || profile?.businessModel?.revenueModel?.rawValue || 'recurring software pricing'}`
    ),
    importance: 'critical',
    evidenceStatus: monClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : monClaims.length > 0
      ? 'partially_supported'
      : 'unsupported',
    supportingClaimIds: monClaimIds,
    supportingSlideNumbers: monSlideNums,
    supportingFacts: monClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'high',
  });

  // 4. Retention & Durability Mechanism
  const retClaims = findClaims('retention').concat(findClaims('nrr')).concat(findClaims('churn'));
  const retSlideNums = Array.from(
    new Set(retClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))
  );
  const retClaimIds = retClaims.map((c) => c.id).filter((id) => validClaimIds.has(id));

  mechanisms.push({
    id: 'mech_retention',
    category: 'retention',
    statement: sanitizeText('Customer value retention and cohort durability over time'),
    importance: 'high',
    evidenceStatus: retClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : retClaims.length > 0
      ? 'partially_supported'
      : context?.declaredStage.normalizedStage === 'pre_seed'
      ? 'not_yet_testable'
      : 'unsupported',
    supportingClaimIds: retClaimIds,
    supportingSlideNumbers: retSlideNums,
    supportingFacts: retClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'medium',
  });

  // 5. Defensibility Mechanism
  mechanisms.push({
    id: 'mech_defensibility',
    category: 'defensibility',
    statement: sanitizeText('Moat creation via workflow integration, switching costs, or network effects'),
    importance: 'high',
    evidenceStatus: techCategory === 'deeptech' || techCategory === 'hardware' ? 'partially_supported' : 'asserted_only',
    supportingClaimIds: [],
    supportingSlideNumbers: [],
    supportingFacts: [],
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'medium',
  });

  return mechanisms;
}

/**
 * Deterministically constructs WhatMustBeTrue items adapted to archetype, stage, and extracted profile.
 */
function constructWhatMustBeTrue(
  profile: StartupProfile | null,
  context: CompanyEvaluationContext | null,
  expectations: EvaluationExpectations | null,
  claimMap: ClaimEvidenceMap | null,
  validSlides: Set<number>,
  validClaimIds: Set<string>
): WhatMustBeTrue[] {
  const items: WhatMustBeTrue[] = [];
  const archetype = context?.businessModel.primaryArchetype || 'B2B SaaS';
  const techCategory = context?.businessModel.technologyCategory || 'software';
  const stage = context?.declaredStage.normalizedStage || 'seed';
  const maturity = context?.observedMaturity.value || 'early_market_evidence';

  const custVal = profile?.traction?.customerCount?.rawValue || '';
  const paidCustVal = profile?.traction?.paidCustomerCount?.rawValue || '';
  const gtmText = profile?.goToMarket?.salesMotion?.rawValue || '';
  const isFounderGtm = gtmText.toLowerCase().includes('founder');

  // Assumption 1: Problem Severity & Urgency
  items.push({
    id: 'wmbt_problem_urgency',
    statement: sanitizeText('Target customers experience problem with sufficient severity to justify purchasing budget'),
    category: 'value_creation',
    importance: 'critical',
    assumptionOrigin: 'implicit',
    evidenceStatus: profile?.problemSolution?.problemStatement?.rawValue ? 'partially_supported' : 'unsupported',
    evidenceQuality: 'customer_quoted',
    supportingClaimIds: [],
    supportingSlideNumbers: [],
    supportingFacts: [],
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    isThesisBottleneck: false,
    suggestedFounderAction: {
      type: 'PREPARE_DILIGENCE_ANSWER',
      scope: 'diligence_prep',
      action: 'Document specific customer quotes and budget allocation evidence',
    },
    confidence: 'high',
  });

  // Assumption 2: GTM Scalability Beyond Founders
  const isGtmBottleneck = isFounderGtm || maturity === 'early_market_evidence' || stage === 'seed';
  items.push({
    id: 'wmbt_gtm_repeatability',
    statement: sanitizeText('Customer acquisition can transition from founder-led sales into a repeatable channel motion'),
    category: 'customer_acquisition',
    importance: 'critical',
    assumptionOrigin: isFounderGtm ? 'implicit' : 'explicit',
    evidenceStatus: context?.functionalMaturity.distributionMaturity === 'repeatable_channels'
      ? 'supported'
      : context?.functionalMaturity.distributionMaturity === 'emerging_channels'
      ? 'partially_supported'
      : stage === 'pre_seed'
      ? 'not_yet_testable'
      : 'unsupported',
    evidenceQuality: 'operational',
    supportingClaimIds: [],
    supportingSlideNumbers: [],
    supportingFacts: [],
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    isThesisBottleneck: isGtmBottleneck,
    bottleneckReason: isGtmBottleneck
      ? 'All customer acquisition and revenue growth depend on founder-led sales without proven channel repeatability'
      : undefined,
    suggestedFounderAction: {
      type: 'ADD_DECK_EVIDENCE',
      scope: 'deck_fix',
      action: 'Detail sales-cycle duration, channel partner leads, or sales hire productivity data',
    },
    confidence: 'medium',
  });

  const rawArchetype = (
    (context?.businessModel.primaryArchetype || '') +
    ' ' +
    (profile?.businessModel?.revenueModel?.rawValue || '')
  ).toLowerCase();

  const rawTech = (
    (context?.businessModel.technologyCategory || '') +
    ' ' +
    (profile?.problemSolution?.productDescription?.rawValue || '') +
    ' ' +
    (profile?.identity?.tagline?.rawValue || '')
  ).toLowerCase();

  const isSaas = rawArchetype.includes('saas') || rawArchetype.includes('b2b');
  const isMarketplace = rawArchetype.includes('marketplace');
  const isConsumer = rawArchetype.includes('consumer') || rawArchetype.includes('b2c');
  const isDeeptechOrHardware =
    rawTech.includes('deeptech') ||
    rawTech.includes('hardware') ||
    rawTech.includes('chip') ||
    rawTech.includes('quantum') ||
    rawTech.includes('semiconductor');

  // Assumption 3: Business Model Specific Assumptions
  if (isSaas) {
    items.push({
      id: 'wmbt_saas_retention',
      statement: sanitizeText('Customer cohorts retain software subscription value over multi-year contracts'),
      category: 'retention',
      importance: 'high',
      assumptionOrigin: 'implicit',
      evidenceStatus: context?.functionalMaturity.revenueMaturity === 'recurring_revenue'
        ? 'partially_supported'
        : stage === 'pre_seed'
        ? 'not_yet_testable'
        : 'unsupported',
      evidenceQuality: 'cohort',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: false,
      suggestedFounderAction: {
        type: 'PROVIDE_EXISTING_EVIDENCE',
        scope: 'founder_input',
        action: 'Provide logo churn rates, Net Revenue Retention (NRR), or expansion metrics',
      },
      confidence: 'high',
    });
  }
  if (isMarketplace) {
    items.push({
      id: 'wmbt_marketplace_liquidity',
      statement: sanitizeText('Supply and demand achieve localized liquidity and recurring transaction density'),
      category: 'growth',
      importance: 'critical',
      assumptionOrigin: 'implicit',
      evidenceStatus: 'partially_supported',
      evidenceQuality: 'operational',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: true,
      bottleneckReason: 'Marketplace take-rate economics fail if transaction frequency and liquidity remain low',
      suggestedFounderAction: {
        type: 'ADD_DECK_EVIDENCE',
        scope: 'deck_fix',
        action: 'Provide repeat transaction frequency, buyer liquidity, and seller retention metrics',
      },
      confidence: 'medium',
    });
  }
  if (isConsumer) {
    items.push({
      id: 'wmbt_consumer_retention',
      statement: sanitizeText('User acquisition converts into durable organic engagement and monetization density'),
      category: 'retention',
      importance: 'critical',
      assumptionOrigin: 'implicit',
      evidenceStatus: 'unsupported',
      evidenceQuality: 'cohort',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: true,
      bottleneckReason: 'High consumer top-of-funnel downloads decay without long-term cohort retention',
      suggestedFounderAction: {
        type: 'PROVIDE_EXISTING_EVIDENCE',
        scope: 'founder_input',
        action: 'Show D30/D90 retention curves and organic vs paid referral ratios',
      },
      confidence: 'medium',
    });
  }
  if (isDeeptechOrHardware) {
    items.push({
      id: 'wmbt_deeptech_technical_proof',
      statement: sanitizeText('Core technical breakthrough is reproducible outside controlled laboratory environments'),
      category: 'technical_execution',
      importance: 'critical',
      assumptionOrigin: 'explicit',
      evidenceStatus: 'partially_supported',
      evidenceQuality: 'technical',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: true,
      bottleneckReason: 'Commercialization is impossible if technical proof cannot be demonstrated under field conditions',
      suggestedFounderAction: {
        type: 'PREPARE_DILIGENCE_ANSWER',
        scope: 'diligence_prep',
        action: 'Share third-party lab verification, IP patent grants, or pilot benchmark tests',
      },
      confidence: 'high',
    });
  }

  // Assumption 4: Market Expansion & Defensibility
  items.push({
    id: 'wmbt_market_expansion',
    statement: sanitizeText('Initial customer wedge expands logically into reachable adjacent market budget'),
    category: 'market_expansion',
    importance: 'medium',
    assumptionOrigin: 'explicit',
    evidenceStatus: profile?.market?.TAM?.rawValue ? 'partially_supported' : 'asserted_only',
    evidenceQuality: 'market_research',
    supportingClaimIds: [],
    supportingSlideNumbers: [],
    supportingFacts: [],
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    isThesisBottleneck: false,
    suggestedFounderAction: {
      type: 'CLARIFY_NARRATIVE',
      scope: 'deck_fix',
      action: 'Provide bottom-up TAM derivation showing buyer count multiplied by ACV',
    },
    confidence: 'medium',
  });

  return items;
}

/**
 * Constructs dependency graph between assumptions and mechanisms.
 */
function constructDependencies(
  whatMustBeTrue: WhatMustBeTrue[],
  mechanisms: InvestmentCaseMechanism[]
): InvestmentCaseDependency[] {
  const deps: InvestmentCaseDependency[] = [];
  const nodeIds = new Set<string>([
    ...whatMustBeTrue.map((w) => w.id),
    ...mechanisms.map((m) => m.id),
  ]);

  const addDep = (
    id: string,
    sourceId: string,
    targetId: string,
    relationship: DependencyRelationship,
    criticality: AssumptionImportance,
    explanation: string
  ) => {
    // Prevent self-loops and missing node references
    if (sourceId === targetId) return;
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return;
    // Prevent duplicate edges
    if (deps.some((d) => d.sourceId === sourceId && d.targetId === targetId)) return;

    deps.push({
      id,
      sourceId,
      targetId,
      relationship,
      criticality,
      explanation: sanitizeText(explanation),
    });
  };

  addDep(
    'dep_gtm_to_revenue',
    'wmbt_gtm_repeatability',
    'mech_monetization',
    'enables',
    'critical',
    'Repeatable sales acquisition motion is required to enable predictable recurring revenue monetization'
  );

  addDep(
    'dep_problem_to_gtm',
    'wmbt_problem_urgency',
    'wmbt_gtm_repeatability',
    'requires',
    'critical',
    'Scalable GTM acquisition depends on problem urgency driving buyer budget prioritization'
  );

  if (nodeIds.has('wmbt_saas_retention')) {
    addDep(
      'dep_retention_to_growth',
      'wmbt_saas_retention',
      'mech_retention',
      'requires',
      'high',
      'Compounding recurring revenue growth relies on cohort retention preventing leaky-bucket churn'
    );
  }

  return deps;
}

/**
 * Identifies second-order risks and cross-dimensional tensions.
 */
function constructRisks(
  profile: StartupProfile | null,
  context: CompanyEvaluationContext | null,
  diagnostics: DeckDiagnostics | null,
  whatMustBeTrue: WhatMustBeTrue[]
): InvestmentCaseRisk[] {
  const risks: InvestmentCaseRisk[] = [];

  const archetype = context?.businessModel.primaryArchetype || 'B2B SaaS';
  const stage = context?.declaredStage.normalizedStage || 'seed';
  const gtmText = (profile?.goToMarket?.salesMotion?.rawValue || '').toLowerCase();
  const acvText = (
    profile?.businessModel?.pricingValues?.rawValue ||
    profile?.businessModel?.revenueModel?.rawValue ||
    ''
  ).toLowerCase();
  const arrVal = profile?.traction?.ARR?.rawValue || profile?.traction?.revenue?.rawValue;

  // Second-Order Risk 1: High ACV + Self-serve SMB mismatch
  if (acvText.includes('100k') || acvText.includes('enterprise')) {
    if (gtmText.includes('self-serve') || gtmText.includes('smb')) {
      risks.push({
        id: 'risk_commercial_model_tension',
        category: 'economics',
        title: sanitizeText('Commercial Model Tension: Enterprise ACV vs Self-Serve Channel'),
        description: sanitizeText(
          'The investment case assumes high enterprise ACVs but describes a self-serve GTM channel, creating potential friction in sales motion execution.'
        ),
        riskType: 'economics',
        whyItMatters: sanitizeText(
          'Enterprise buyers typically require dedicated security reviews, procurement cycles, and consultative sales touchpoints.'
        ),
        supportingEvidence: [acvText, gtmText],
        contradictingEvidence: [],
        relatedAssumptionIds: ['wmbt_gtm_repeatability'],
        relatedMechanismIds: ['mech_customer_acquisition'],
        severity: 'material',
        confidence: 'high',
      });
    }
  }

  // Second-Order Risk 2: Growth without Retention Proof
  const growthVal = profile?.traction?.growthRates?.rawValue;
  const retVal = profile?.traction?.retentionMetrics?.rawValue;
  if (growthVal && !retVal) {
    risks.push({
      id: 'risk_unproven_durability',
      category: 'retention',
      title: sanitizeText('Unresolved Revenue Durability'),
      description: sanitizeText(
        'Top-line revenue growth is cited in the deck, but long-term cohort retention or net revenue retention data remains unevidenced.'
      ),
      riskType: 'evidence_gap',
      whyItMatters: sanitizeText(
        'Growth in early periods without cohort retention proof leaves revenue durability and customer lifetime value unverified.'
      ),
      supportingEvidence: [growthVal],
      contradictingEvidence: [],
      relatedAssumptionIds: ['wmbt_saas_retention'],
      relatedMechanismIds: ['mech_retention'],
      severity: stage === 'series_a' ? 'critical' : 'material',
      confidence: 'high',
    });
  }

  // Second-Order Risk 3: Founder-Led Sales Dependency
  if (gtmText.includes('founder')) {
    risks.push({
      id: 'risk_founder_sales_concentration',
      category: 'distribution',
      title: sanitizeText('Founder-Led Sales Concentration'),
      description: sanitizeText(
        'Initial GTM execution relies heavily on founder relationships, leaving sales repeatability across hired reps unproven.'
      ),
      riskType: 'concentration',
      whyItMatters: sanitizeText(
        'Venture scalability requires transitioning customer acquisition from founder network into repeatable sales channels.'
      ),
      supportingEvidence: [gtmText],
      contradictingEvidence: [],
      relatedAssumptionIds: ['wmbt_gtm_repeatability'],
      relatedMechanismIds: ['mech_customer_acquisition'],
      severity: 'material',
      confidence: 'high',
    });
  }

  // Include known contradictions from diagnostics as risks if present
  if (diagnostics?.contradictions) {
    for (let i = 0; i < diagnostics.contradictions.length; i++) {
      const c = diagnostics.contradictions[i];
      const stA = c.conflictingStatements?.[0]?.text || '';
      const stB = c.conflictingStatements?.[1]?.text || '';
      risks.push({
        id: `risk_contradiction_${i + 1}`,
        category: 'execution',
        title: sanitizeText(`Fact Contradiction: ${c.category}`),
        description: sanitizeText(c.description),
        riskType: 'contradiction',
        whyItMatters: sanitizeText(
          'Conflicting metrics across deck slides undermine underwriting clarity and diligence confidence.'
        ),
        supportingEvidence: [stA, stB].filter(Boolean),
        contradictingEvidence: [],
        relatedAssumptionIds: [],
        relatedMechanismIds: [],
        severity: 'critical',
        confidence: 'high',
      });
    }
  }

  return risks;
}

/**
 * Extracts consolidated deck contradictions.
 */
function constructContradictions(
  diagnostics: DeckDiagnostics | null
): InvestmentCaseContradiction[] {
  const contradictions: InvestmentCaseContradiction[] = [];
  if (!diagnostics?.contradictions) return contradictions;

  for (let i = 0; i < diagnostics.contradictions.length; i++) {
    const c = diagnostics.contradictions[i];
    const stA = c.conflictingStatements?.[0];
    const stB = c.conflictingStatements?.[1];
    contradictions.push({
      id: `contra_${i + 1}`,
      topic: sanitizeText(c.category),
      statementA: sanitizeText(stA?.text || ''),
      statementB: sanitizeText(stB?.text || ''),
      slideA: stA?.slideNumber,
      slideB: stB?.slideNumber,
      impact: sanitizeText(c.description),
    });
  }

  return contradictions;
}

/**
 * Reconstructs investor questions arising from thesis gaps.
 */
function constructUnresolvedQuestions(
  whatMustBeTrue: WhatMustBeTrue[],
  risks: InvestmentCaseRisk[]
): InvestmentCaseQuestion[] {
  const questions: InvestmentCaseQuestion[] = [];

  const unprovenAssumptions = whatMustBeTrue.filter(
    (w) => w.evidenceStatus === 'unsupported' || w.evidenceStatus === 'asserted_only'
  );

  for (let i = 0; i < unprovenAssumptions.length; i++) {
    const w = unprovenAssumptions[i];
    questions.push({
      id: `q_assumption_${i + 1}`,
      question: sanitizeText(`What specific evidence demonstrates that ${w.statement.toLowerCase()}?`),
      whyThisMatters: sanitizeText(
        `This condition is ${w.importance} for the reconstructed investment case but currently remains ${w.evidenceStatus}.`
      ),
      relatedAssumptionIds: [w.id],
      relatedMechanismIds: [],
      relatedRiskIds: risks.filter((r) => r.relatedAssumptionIds.includes(w.id)).map((r) => r.id),
      answerability: w.evidenceStatus === 'supported' ? 'well_supported' : 'unanswered',
    });
  }

  return questions;
}

/**
 * Creates executive case summary.
 */
function constructSummary(
  thesis: StructuredInvestmentThesis,
  mechanisms: InvestmentCaseMechanism[],
  whatMustBeTrue: WhatMustBeTrue[],
  risks: InvestmentCaseRisk[]
): InvestmentCaseSummary {
  const supportedMechs = mechanisms
    .filter((m) => m.evidenceStatus === 'supported' || m.evidenceStatus === 'partially_supported')
    .map((m) => m.statement);

  const unprovenAssumptions = whatMustBeTrue
    .filter((w) => w.evidenceStatus === 'unsupported' || w.evidenceStatus === 'asserted_only')
    .map((w) => w.statement);

  const bottlenecks = whatMustBeTrue.filter((w) => w.isThesisBottleneck).map((w) => w.statement);

  const materialRisks = risks.filter((r) => r.severity === 'critical' || r.severity === 'material').map((r) => r.title);

  const actions = whatMustBeTrue
    .map((w) => w.suggestedFounderAction?.action)
    .filter((a): a is string => Boolean(a));

  return {
    thesisSummary: thesis.summary,
    strongestSupportedMechanisms: supportedMechs,
    mostImportantUnprovenAssumptions: unprovenAssumptions,
    thesisBottlenecks: bottlenecks,
    materialRisks: materialRisks,
    highestLeverageFounderActions: actions,
  };
}

/**
 * Validates and cleanses an InvestmentCase object to enforce strict graph integrity,
 * valid slide numbers, valid claim IDs, no self-loop dependencies, no duplicate edges,
 * and no prohibited scoring language.
 */
export function validateAndCleanseInvestmentCase(
  rawCase: InvestmentCase,
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null
): InvestmentCase {
  const validSlides = getValidSlideNumbers(profile, claimMap, diagnostics);
  const validClaimIds = getValidClaimIds(claimMap);

  // Cleanse WhatMustBeTrue
  const validWmbtIds = new Set<string>();
  const cleansedWmbt: WhatMustBeTrue[] = rawCase.whatMustBeTrue.map((w) => {
    validWmbtIds.add(w.id);
    return {
      ...w,
      statement: sanitizeText(w.statement),
      supportingSlideNumbers: (w.supportingSlideNumbers || []).filter((s) => validSlides.has(s)),
      supportingClaimIds: (w.supportingClaimIds || []).filter((id) => validClaimIds.has(id)),
      contradictingSlideNumbers: (w.contradictingSlideNumbers || []).filter((s) => validSlides.has(s)),
      contradictingClaimIds: (w.contradictingClaimIds || []).filter((id) => validClaimIds.has(id)),
      bottleneckReason: w.bottleneckReason ? sanitizeText(w.bottleneckReason) : undefined,
      suggestedFounderAction: w.suggestedFounderAction
        ? {
            ...w.suggestedFounderAction,
            action: sanitizeText(w.suggestedFounderAction.action),
          }
        : undefined,
    };
  });

  // Cleanse Mechanisms
  const validMechIds = new Set<string>();
  const cleansedMechs: InvestmentCaseMechanism[] = rawCase.mechanisms.map((m) => {
    validMechIds.add(m.id);
    return {
      ...m,
      statement: sanitizeText(m.statement),
      supportingSlideNumbers: (m.supportingSlideNumbers || []).filter((s) => validSlides.has(s)),
      supportingClaimIds: (m.supportingClaimIds || []).filter((id) => validClaimIds.has(id)),
      contradictingSlideNumbers: (m.contradictingSlideNumbers || []).filter((s) => validSlides.has(s)),
      contradictingClaimIds: (m.contradictingClaimIds || []).filter((id) => validClaimIds.has(id)),
      supportingFacts: (m.supportingFacts || []).map(sanitizeText),
    };
  });

  const validNodes = new Set<string>([...validWmbtIds, ...validMechIds]);

  // Cleanse Dependencies (no self loops, valid node refs, no duplicates)
  const cleansedDeps: InvestmentCaseDependency[] = [];
  for (const d of rawCase.dependencies || []) {
    if (d.sourceId === d.targetId) continue;
    if (!validNodes.has(d.sourceId) || !validNodes.has(d.targetId)) continue;
    if (cleansedDeps.some((existing) => existing.sourceId === d.sourceId && existing.targetId === d.targetId)) {
      continue;
    }
    cleansedDeps.push({
      ...d,
      explanation: sanitizeText(d.explanation),
    });
  }

  // Cleanse Risks
  const cleansedRisks: InvestmentCaseRisk[] = (rawCase.risks || []).map((r) => ({
    ...r,
    title: sanitizeText(r.title),
    description: sanitizeText(r.description),
    whyItMatters: sanitizeText(r.whyItMatters),
    relatedAssumptionIds: (r.relatedAssumptionIds || []).filter((id) => validWmbtIds.has(id)),
    relatedMechanismIds: (r.relatedMechanismIds || []).filter((id) => validMechIds.has(id)),
  }));

  // Cleanse Contradictions
  const cleansedContras: InvestmentCaseContradiction[] = (rawCase.contradictions || []).map((c) => ({
    ...c,
    topic: sanitizeText(c.topic),
    statementA: sanitizeText(c.statementA),
    statementB: sanitizeText(c.statementB),
    impact: sanitizeText(c.impact),
    slideA: typeof c.slideA === 'number' && validSlides.has(c.slideA) ? c.slideA : undefined,
    slideB: typeof c.slideB === 'number' && validSlides.has(c.slideB) ? c.slideB : undefined,
    claimIdA: c.claimIdA && validClaimIds.has(c.claimIdA) ? c.claimIdA : undefined,
    claimIdB: c.claimIdB && validClaimIds.has(c.claimIdB) ? c.claimIdB : undefined,
  }));

  // Cleanse Questions
  const cleansedQuestions: InvestmentCaseQuestion[] = (rawCase.unresolvedQuestions || []).map((q) => ({
    ...q,
    question: sanitizeText(q.question),
    whyThisMatters: sanitizeText(q.whyThisMatters),
    relatedAssumptionIds: (q.relatedAssumptionIds || []).filter((id) => validWmbtIds.has(id)),
    relatedMechanismIds: (q.relatedMechanismIds || []).filter((id) => validMechIds.has(id)),
    relatedRiskIds: (q.relatedRiskIds || []).filter((id) => cleansedRisks.some((r) => r.id === id)),
  }));

  return {
    investmentThesis: {
      ...rawCase.investmentThesis,
      problem: sanitizeText(rawCase.investmentThesis.problem),
      targetCustomer: sanitizeText(rawCase.investmentThesis.targetCustomer),
      wedge: sanitizeText(rawCase.investmentThesis.wedge),
      valueCreation: sanitizeText(rawCase.investmentThesis.valueCreation),
      distribution: sanitizeText(rawCase.investmentThesis.distribution),
      monetization: sanitizeText(rawCase.investmentThesis.monetization),
      growth: sanitizeText(rawCase.investmentThesis.growth),
      marketExpansion: sanitizeText(rawCase.investmentThesis.marketExpansion),
      defensibility: sanitizeText(rawCase.investmentThesis.defensibility),
      teamAdvantage: sanitizeText(rawCase.investmentThesis.teamAdvantage),
      capitalPath: sanitizeText(rawCase.investmentThesis.capitalPath),
      summary: sanitizeText(rawCase.investmentThesis.summary),
      statedThesis: sanitizeText(rawCase.investmentThesis.statedThesis),
      reconstructedThesis: sanitizeText(rawCase.investmentThesis.reconstructedThesis),
    },
    mechanisms: cleansedMechs,
    whatMustBeTrue: cleansedWmbt,
    dependencies: cleansedDeps,
    risks: cleansedRisks,
    contradictions: cleansedContras,
    unresolvedQuestions: cleansedQuestions,
    caseSummary: {
      ...rawCase.caseSummary,
      thesisSummary: sanitizeText(rawCase.caseSummary.thesisSummary),
      strongestSupportedMechanisms: (rawCase.caseSummary.strongestSupportedMechanisms || []).map(sanitizeText),
      mostImportantUnprovenAssumptions: (rawCase.caseSummary.mostImportantUnprovenAssumptions || []).map(sanitizeText),
      thesisBottlenecks: (rawCase.caseSummary.thesisBottlenecks || []).map(sanitizeText),
      materialRisks: (rawCase.caseSummary.materialRisks || []).map(sanitizeText),
      highestLeverageFounderActions: (rawCase.caseSummary.highestLeverageFounderActions || []).map(sanitizeText),
    },
  };
}

/**
 * Primary deterministic entrypoint to reconstruct an InvestmentCase.
 */
export function reconstructInvestmentCase(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  evaluationContext: CompanyEvaluationContext | null,
  evaluationExpectations: EvaluationExpectations | null
): InvestmentCase {
  const validSlides = getValidSlideNumbers(profile, claimMap, diagnostics);
  const validClaimIds = getValidClaimIds(claimMap);

  const thesis = reconstructInvestmentThesis(profile, evaluationContext);
  const mechanisms = constructMechanisms(profile, evaluationContext, claimMap, validSlides, validClaimIds);
  const whatMustBeTrue = constructWhatMustBeTrue(
    profile,
    evaluationContext,
    evaluationExpectations,
    claimMap,
    validSlides,
    validClaimIds
  );
  const dependencies = constructDependencies(whatMustBeTrue, mechanisms);
  const risks = constructRisks(profile, evaluationContext, diagnostics, whatMustBeTrue);
  const contradictions = constructContradictions(diagnostics);
  const questions = constructUnresolvedQuestions(whatMustBeTrue, risks);
  const summary = constructSummary(thesis, mechanisms, whatMustBeTrue, risks);

  const rawCase: InvestmentCase = {
    investmentThesis: thesis,
    mechanisms,
    whatMustBeTrue,
    dependencies,
    risks,
    contradictions,
    unresolvedQuestions: questions,
    caseSummary: summary,
  };

  return validateAndCleanseInvestmentCase(rawCase, profile, claimMap, diagnostics);
}
