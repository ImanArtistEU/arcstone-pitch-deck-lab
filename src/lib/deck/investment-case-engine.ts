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
  RiskSeverity,
  QuestionAnswerability,
  InvestmentEvidenceReference,
  EvidenceSourceType,
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
export function getValidSlideNumbers(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  slideEvidence?: Array<{ slideNumber?: number }> | null
): Set<number> {
  const slides = new Set<number>();

  if (profile) {
    const checkEv = (evList?: Array<{ slideNumber?: number }>) => {
      for (const ev of evList || []) {
        if (typeof ev?.slideNumber === 'number' && ev.slideNumber > 0) {
          slides.add(ev.slideNumber);
        }
      }
    };

    const sections = [
      profile.identity,
      profile.fundraising,
      profile.problemSolution,
      profile.customerICP,
      profile.businessModel,
      profile.traction,
      profile.goToMarket,
      profile.market,
      profile.competition,
      profile.team,
      profile.technology,
    ];

    for (const sec of sections) {
      if (!sec) continue;
      for (const key of Object.keys(sec)) {
        const field = (sec as any)[key];
        if (field && Array.isArray(field.evidence)) {
          checkEv(field.evidence);
        }
      }
    }

    for (const f of profile.team?.founders || []) {
      if (typeof f?.slideNumber === 'number' && f.slideNumber > 0) {
        slides.add(f.slideNumber);
      }
    }

    for (const fact of profile.importantFacts || []) {
      if (typeof fact?.slideNumber === 'number' && fact.slideNumber > 0) {
        slides.add(fact.slideNumber);
      }
    }
  }

  if (claimMap?.claims) {
    for (const c of claimMap.claims) {
      if (typeof c.slideNumber === 'number' && c.slideNumber > 0) {
        slides.add(c.slideNumber);
      }
      for (const ev of c.evidence || []) {
        if (typeof ev?.slideNumber === 'number' && ev.slideNumber > 0) {
          slides.add(ev.slideNumber);
        }
      }
    }
  }

  if (diagnostics) {
    for (const c of diagnostics.contradictions || []) {
      for (const st of c.conflictingStatements || []) {
        if (typeof st.slideNumber === 'number' && st.slideNumber > 0) {
          slides.add(st.slideNumber);
        }
      }
    }
    for (const eg of diagnostics.evidenceGaps || []) {
      for (const sn of eg.slideNumbers || []) {
        if (typeof sn === 'number' && sn > 0) slides.add(sn);
      }
    }
    for (const mi of diagnostics.missingInformation || []) {
      for (const sn of mi.relatedSlideNumbers || []) {
        if (typeof sn === 'number' && sn > 0) slides.add(sn);
      }
    }
    for (const amb of diagnostics.ambiguities || []) {
      if (typeof amb.slideNumber === 'number' && amb.slideNumber > 0) {
        slides.add(amb.slideNumber);
      }
    }
  }

  if (Array.isArray(slideEvidence)) {
    for (const se of slideEvidence) {
      if (typeof se?.slideNumber === 'number' && se.slideNumber > 0) {
        slides.add(se.slideNumber);
      }
    }
  }

  return slides;
}

/**
 * Helper to collect valid claim IDs.
 */
export function getValidClaimIds(claimMap: ClaimEvidenceMap | null): Set<string> {
  const ids = new Set<string>();
  if (claimMap?.claims) {
    for (const c of claimMap.claims) {
      if (c.id) ids.add(c.id);
    }
  }
  return ids;
}

/**
 * Builds canonical evidence references with stable IDs from source deck artifacts.
 */
export function buildCanonicalEvidenceCorpusReferences(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  slideEvidence?: Array<{ slideNumber?: number; textContent?: string; extractedText?: string; exactText?: string }> | null
): InvestmentEvidenceReference[] {
  const refs: InvestmentEvidenceReference[] = [];
  const seenIds = new Set<string>();

  const addRef = (ref: InvestmentEvidenceReference) => {
    if (!ref.id || !ref.statement || ref.statement.trim().length === 0) return;
    if (seenIds.has(ref.id)) return;
    seenIds.add(ref.id);
    refs.push({
      ...ref,
      statement: ref.statement.trim(),
    });
  };

  if (profile) {
    const sections: Array<[string, any]> = [
      ['identity', profile.identity],
      ['fundraising', profile.fundraising],
      ['problemSolution', profile.problemSolution],
      ['customerICP', profile.customerICP],
      ['businessModel', profile.businessModel],
      ['traction', profile.traction],
      ['goToMarket', profile.goToMarket],
      ['market', profile.market],
      ['competition', profile.competition],
      ['team', profile.team],
      ['technology', profile.technology],
    ];

    for (const [secName, sec] of sections) {
      if (!sec) continue;
      for (const key of Object.keys(sec)) {
        const field = sec[key];
        if (field && typeof field.rawValue === 'string' && field.rawValue.trim().length > 0) {
          const slideNo = field.evidence?.[0]?.slideNumber || (sec as any).slideNumber;
          const id = `profile:${secName}.${key}${slideNo ? `:slide:${slideNo}` : ''}`;
          addRef({
            id,
            sourceType: 'profile',
            statement: field.rawValue,
            slideNumber: slideNo,
            profilePath: `${secName}.${key}`,
          });
        }
      }
    }

    if (profile.team?.founders) {
      profile.team.founders.forEach((f, idx) => {
        const stmt = [f.name, f.role, f.background].filter(Boolean).join(' - ');
        if (stmt) {
          addRef({
            id: `profile:team.founder:${idx + 1}${f.slideNumber ? `:slide:${f.slideNumber}` : ''}`,
            sourceType: 'profile',
            statement: stmt,
            slideNumber: f.slideNumber,
            profilePath: `team.founders[${idx}]`,
          });
        }
      });
    }

    if (profile.importantFacts) {
      profile.importantFacts.forEach((fact, idx) => {
        if (fact.fact) {
          addRef({
            id: `profile:fact:${idx + 1}${fact.slideNumber ? `:slide:${fact.slideNumber}` : ''}`,
            sourceType: 'profile',
            statement: fact.fact,
            slideNumber: fact.slideNumber,
            profilePath: `importantFacts[${idx}]`,
          });
        }
      });
    }
  }

  if (claimMap?.claims) {
    for (const c of claimMap.claims) {
      if (c.claimText) {
        addRef({
          id: `claim:${c.id}`,
          sourceType: 'claim',
          statement: c.claimText,
          slideNumber: c.slideNumber,
          claimId: c.id,
        });
      }
      if (c.evidence) {
        c.evidence.forEach((ev, idx) => {
          if (ev.exactText) {
            addRef({
              id: `claim_evidence:${c.id}:${ev.id || idx + 1}`,
              sourceType: 'claim_evidence',
              statement: ev.exactText,
              slideNumber: ev.slideNumber || c.slideNumber,
              claimId: c.id,
            });
          }
        });
      }
    }
  }

  if (diagnostics) {
    if (diagnostics.contradictions) {
      diagnostics.contradictions.forEach((c, idx) => {
        if (c.description) {
          addRef({
            id: `diagnostic:${c.id || 'contradiction_' + (idx + 1)}`,
            sourceType: 'diagnostic',
            statement: c.description,
            diagnosticId: c.id,
          });
        }
      });
    }
    if (diagnostics.evidenceGaps) {
      diagnostics.evidenceGaps.forEach((eg, idx) => {
        const stmt = `${eg.claimText || ''}: ${eg.missingEvidenceDescription || ''}`.trim();
        if (stmt) {
          addRef({
            id: `diagnostic:${eg.id || 'gap_' + (idx + 1)}`,
            sourceType: 'diagnostic',
            statement: stmt,
            diagnosticId: eg.id,
          });
        }
      });
    }
  }

  if (Array.isArray(slideEvidence)) {
    for (const se of slideEvidence) {
      const txt = se.textContent || se.extractedText || se.exactText;
      if (typeof se.slideNumber === 'number' && se.slideNumber > 0 && txt && txt.trim().length > 0) {
        addRef({
          id: `slide:${se.slideNumber}:text`,
          sourceType: 'slide_text',
          statement: txt.trim(),
          slideNumber: se.slideNumber,
        });
      }
    }
  }

  return refs;
}

/**
 * Legacy Set-based corpus builder maintained for backward compatibility.
 */
export function buildCanonicalEvidenceCorpus(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  slideEvidence?: Array<{ textContent?: string; extractedText?: string; exactText?: string }> | null
): Set<string> {
  const refs = buildCanonicalEvidenceCorpusReferences(profile, claimMap, diagnostics, slideEvidence as any);
  const corpus = new Set<string>();
  for (const ref of refs) {
    if (ref.statement) {
      corpus.add(ref.statement.toLowerCase());
    }
  }
  return corpus;
}

/**
 * Strictly validates whether a text or metric string is supported by the canonical evidence corpus.
 * Non-permissive: returns false if corpus is empty or string is not found.
 */
export function isStringSupportedByCorpus(
  text: string,
  corpusInput: Set<string> | InvestmentEvidenceReference[]
): boolean {
  if (!text || typeof text !== 'string') return false;

  const lower = text.trim().toLowerCase();
  if (lower.length === 0) return false;

  let statements: string[] = [];
  if (corpusInput instanceof Set) {
    if (corpusInput.size === 0) return false;
    statements = Array.from(corpusInput);
  } else if (Array.isArray(corpusInput)) {
    if (corpusInput.length === 0) return false;
    statements = corpusInput.map((r) => r.statement.toLowerCase());
  } else {
    return false;
  }

  // Exact or substring match
  for (const item of statements) {
    if (item.includes(lower) || lower.includes(item)) return true;
  }

  // Exact number matching with surrounding unit/context check
  const numbers = lower.match(/\b\d+([.,]\d+)?\b/g);
  if (numbers && numbers.length > 0) {
    for (const num of numbers) {
      let numMatch = false;
      for (const item of statements) {
        if (item.includes(num)) {
          const numIdx = lower.indexOf(num);
          const start = Math.max(0, numIdx - 15);
          const end = Math.min(lower.length, numIdx + num.length + 15);
          const localWindow = lower.slice(start, end);

          const keywords = localWindow.split(/\s+/).filter((w) => w.length > 2 && w !== num);
          if (keywords.length === 0 || keywords.some((kw) => item.includes(kw))) {
            numMatch = true;
            break;
          }
        }
      }
      if (!numMatch) return false;
    }
    return true;
  }

  return false;
}

/**
 * Parses numeric monetary values from pricing or ACV strings (e.g. $50,000, 100k, €60k).
 */
function parseAcvValue(text: string): number | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  const kMatch = lower.match(/[\$€£]?\s*(\d+)\s*k\b/);
  if (kMatch) return parseInt(kMatch[1], 10) * 1000;

  const fullMatch = lower.match(/[\$€£]?\s*(\d{1,3}(?:,\d{3})+|\d{4,})\b/);
  if (fullMatch) return parseInt(fullMatch[1].replace(/,/g, ''), 10);

  return null;
}

/**
 * Maps evidence status directly to canonical founder action types and scopes.
 */
export function deriveSuggestedFounderAction(
  evidenceStatus: EvidenceStatus,
  actionText: string,
  category: MechanismCategory | string
): SuggestedFounderAction {
  switch (evidenceStatus) {
    case 'asserted_only':
      return { type: 'ADD_DECK_EVIDENCE', scope: 'deck_fix', action: actionText };
    case 'unsupported':
      return { type: 'PROVIDE_EXISTING_EVIDENCE', scope: 'founder_input', action: actionText };
    case 'contradictory':
      return { type: 'RESOLVE_CONTRADICTION', scope: 'deck_fix', action: actionText };
    case 'not_yet_testable':
      return { type: 'NO_ACTION_YET', scope: 'diligence_prep', action: actionText };
    case 'supported':
    case 'partially_supported':
    default:
      return { type: 'NO_ACTION_YET', scope: 'diligence_prep', action: actionText };
  }
}

/**
 * Reconstructs the Causal Investment Thesis from deck facts and context without generic defaults.
 */
function reconstructInvestmentThesis(
  profile: StartupProfile | null,
  context: CompanyEvaluationContext | null,
  corpusRefs?: InvestmentEvidenceReference[]
): StructuredInvestmentThesis {
  const prob = profile?.problemSolution?.problemStatement?.rawValue;
  const sol =
    profile?.problemSolution?.productDescription?.rawValue ||
    profile?.problemSolution?.valueProposition?.rawValue;
  const icp = profile?.customerICP?.customerType?.rawValue;
  const acvVal =
    profile?.businessModel?.pricingValues?.rawValue ||
    profile?.businessModel?.revenueModel?.rawValue;
  const gtmVal = profile?.goToMarket?.salesMotion?.rawValue;
  const mktVal = profile?.market?.TAM?.rawValue;
  const arrVal = profile?.traction?.ARR?.rawValue || profile?.traction?.revenue?.rawValue;
  const teamVal = profile?.team?.founders?.[0]?.background;

  const archetype =
    context?.businessModel?.primaryArchetype && context.businessModel.primaryArchetype !== 'unknown'
      ? context.businessModel.primaryArchetype
      : undefined;

  const sourceEvidenceIds: string[] = [];
  const inferredComponents: string[] = [];
  const unresolvedComponents: string[] = [];

  if (corpusRefs) {
    for (const ref of corpusRefs) {
      if (ref.sourceType === 'profile' || ref.sourceType === 'claim') {
        sourceEvidenceIds.push(ref.id);
      }
    }
  }

  if (!prob) unresolvedComponents.push('problem');
  if (!icp) unresolvedComponents.push('targetCustomer');
  if (!sol) unresolvedComponents.push('wedge');
  if (!gtmVal) unresolvedComponents.push('distribution');
  if (!acvVal) unresolvedComponents.push('monetization');

  // Archetype-sensitive causal thesis reconstruction
  let reconstructedThesis = '';
  if (archetype === 'marketplace') {
    reconstructedThesis = prob && icp
      ? `If supply and demand achieve liquidity density for ${icp}, driving repeat transactions and take-rate monetization, then marketplace volume scales sustainably.`
      : 'Causal investment thesis unresolved due to insufficient deck evidence on marketplace supply/demand liquidity.';
  } else if (archetype === 'deeptech' || archetype === 'hardware') {
    reconstructedThesis = sol
      ? `If technical breakthrough is validated under field conditions, enabling reproducible deployment and pilot conversion, then the company establishes technical defensibility.`
      : 'Causal investment thesis unresolved due to insufficient deck evidence on deeptech technical benchmark proof.';
  } else if (archetype === 'consumer') {
    reconstructedThesis = icp
      ? `If user acquisition converts into habituated engagement and cohort retention, sustaining organic referral loops, then consumer monetization density scales.`
      : 'Causal investment thesis unresolved due to insufficient deck evidence on consumer cohort retention.';
  } else if (archetype === 'b2b_saas' || archetype === 'enterprise_software' || archetype === 'smb_software') {
    reconstructedThesis = prob && gtmVal
      ? `If ${icp || 'target customers'} adopt the software to solve ${prob} via ${gtmVal}, demonstrating willingness to pay and cohort retention, then recurring revenue scales predictably.`
      : 'Causal investment thesis unresolved due to insufficient deck evidence on B2B SaaS acquisition and retention.';
  } else {
    if (prob && sol && gtmVal) {
      reconstructedThesis = `If target customers adopt ${sol} to solve ${prob} via ${gtmVal}, demonstrating unit monetization and customer retention, then the proposition scales.`;
      inferredComponents.push('general_chain');
    } else {
      reconstructedThesis = 'Causal investment thesis unresolved due to insufficient deck evidence on business model and operating motion.';
    }
  }

  const statedThesis = prob || icp
    ? sanitizeText(`The deck asserts a proposition solving ${prob || 'core problem'} for ${icp || 'target customers'}.`)
    : 'The current deck evidence is insufficient to state a clear company proposition.';

  const summary = prob || gtmVal
    ? sanitizeText(`Reconstructed thesis: ${reconstructedThesis}`)
    : 'Evidence is insufficient to reconstruct a supported causal investment thesis.';

  const raiseVal = profile?.fundraising?.amountBeingRaised?.rawValue;
  const runwayVal = profile?.fundraising?.runway?.rawValue;
  let capitalPath = 'Capital path not established by current deck evidence.';
  if (raiseVal || runwayVal) {
    capitalPath = sanitizeText(
      `Funding milestone: Raise ${raiseVal || 'capital'} to achieve runway ${runwayVal ? `${runwayVal}` : 'milestones'}.`
    );
  } else {
    unresolvedComponents.push('capitalPath');
  }

  return {
    problem: sanitizeText(prob || 'Not specified in deck'),
    targetCustomer: sanitizeText(icp || 'Not specified in deck'),
    wedge: sanitizeText(sol || 'Not specified in deck'),
    valueCreation: sanitizeText(sol ? `Value creation through solving ${prob || 'problem'} for ${icp || 'target buyers'}` : 'Not established'),
    distribution: sanitizeText(gtmVal || 'Not specified in deck'),
    monetization: sanitizeText(acvVal || 'Not specified in deck'),
    growth: sanitizeText(arrVal || 'Not established'),
    marketExpansion: sanitizeText(mktVal || 'Not specified in deck'),
    defensibility: sanitizeText('Not established by current deck evidence'),
    teamAdvantage: sanitizeText(teamVal || 'Not specified in deck'),
    capitalPath,
    summary,
    statedThesis,
    reconstructedThesis,
    sourceEvidenceIds,
    inferredComponents,
    unresolvedComponents,
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
  validClaimIds: Set<string>,
  corpusRefs: InvestmentEvidenceReference[]
): InvestmentCaseMechanism[] {
  if (!profile && !claimMap?.claims?.length) return [];

  const mechanisms: InvestmentCaseMechanism[] = [];

  const findClaims = (keyword: string): MaterialClaim[] => {
    if (!claimMap?.claims) return [];
    return claimMap.claims.filter(
      (c: MaterialClaim) =>
        c.claimText.toLowerCase().includes(keyword) ||
        c.claimType?.toLowerCase().includes(keyword)
    );
  };

  const matchingRefs = (keyword: string): string[] => {
    return corpusRefs
      .filter((r) => r.statement.toLowerCase().includes(keyword))
      .map((r) => r.id);
  };

  // 1. Value Creation Mechanism
  const valClaims = findClaims('value').concat(findClaims('problem')).concat(findClaims('solution'));
  const valEvIds = matchingRefs('value').concat(matchingRefs('problem')).concat(matchingRefs('solution'));
  const valSlideNums = Array.from(
    new Set(valClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))
  );

  mechanisms.push({
    id: 'mech_value_creation',
    category: 'value_creation',
    statement: sanitizeText(
      `Product delivers measurable ROI/value for ${profile?.customerICP?.customerType?.rawValue || 'target buyers'}`
    ),
    importance: 'critical',
    evidenceStatus: valClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : valClaims.length > 0 || valEvIds.length > 0
      ? 'asserted_only'
      : 'unsupported',
    supportingClaimIds: valClaims.map((c) => c.id).filter((id) => validClaimIds.has(id)),
    supportingSlideNumbers: valSlideNums,
    supportingEvidenceIds: valEvIds,
    supportingFacts: valClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'high',
  });

  // 2. Customer Acquisition Mechanism
  const gtmClaims = findClaims('sales').concat(findClaims('channel')).concat(findClaims('customer'));
  const gtmEvIds = matchingRefs('sales').concat(matchingRefs('channel')).concat(matchingRefs('customer'));
  const gtmSlideNums = Array.from(
    new Set(gtmClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))
  );

  mechanisms.push({
    id: 'mech_customer_acquisition',
    category: 'customer_acquisition',
    statement: sanitizeText(
      `Customer acquisition via ${profile?.goToMarket?.salesMotion?.rawValue || 'acquisition channels'}`
    ),
    importance: 'critical',
    evidenceStatus: gtmClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : gtmClaims.length > 0 || gtmEvIds.length > 0
      ? 'partially_supported'
      : 'asserted_only',
    supportingClaimIds: gtmClaims.map((c) => c.id).filter((id) => validClaimIds.has(id)),
    supportingSlideNumbers: gtmSlideNums,
    supportingEvidenceIds: gtmEvIds,
    supportingFacts: gtmClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'medium',
  });

  // 3. Monetization Mechanism
  const monClaims = findClaims('pricing').concat(findClaims('revenue')).concat(findClaims('monetization'));
  const monEvIds = matchingRefs('pricing').concat(matchingRefs('revenue')).concat(matchingRefs('monetization'));
  const monSlideNums = Array.from(
    new Set(monClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))
  );

  mechanisms.push({
    id: 'mech_monetization',
    category: 'monetization',
    statement: sanitizeText(
      `Unit monetization through ${profile?.businessModel?.pricingValues?.rawValue || profile?.businessModel?.revenueModel?.rawValue || 'pricing model'}`
    ),
    importance: 'critical',
    evidenceStatus: monClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : monClaims.length > 0 || monEvIds.length > 0
      ? 'partially_supported'
      : 'unsupported',
    supportingClaimIds: monClaims.map((c) => c.id).filter((id) => validClaimIds.has(id)),
    supportingSlideNumbers: monSlideNums,
    supportingEvidenceIds: monEvIds,
    supportingFacts: monClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'high',
  });

  // 4. Retention & Durability Mechanism
  const retClaims = findClaims('retention').concat(findClaims('nrr')).concat(findClaims('churn'));
  const retEvIds = matchingRefs('retention').concat(matchingRefs('nrr')).concat(matchingRefs('churn'));
  const retSlideNums = Array.from(
    new Set(retClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))
  );

  mechanisms.push({
    id: 'mech_retention',
    category: 'retention',
    statement: sanitizeText('Customer value retention and cohort durability over time'),
    importance: 'high',
    evidenceStatus: retClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : retEvIds.length > 0
      ? 'partially_supported'
      : context?.declaredStage.normalizedStage === 'pre_seed'
      ? 'not_yet_testable'
      : 'unsupported',
    supportingClaimIds: retClaims.map((c) => c.id).filter((id) => validClaimIds.has(id)),
    supportingSlideNumbers: retSlideNums,
    supportingEvidenceIds: retEvIds,
    supportingFacts: retClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'medium',
  });

  // 5. Defensibility Mechanism
  const diffClaims = findClaims('moat').concat(findClaims('differentiation')).concat(findClaims('patent'));
  const diffEvIds = matchingRefs('moat').concat(matchingRefs('differentiation')).concat(matchingRefs('patent'));
  mechanisms.push({
    id: 'mech_defensibility',
    category: 'defensibility',
    statement: sanitizeText(diffClaims.length > 0 ? diffClaims[0].claimText : 'Defensibility mechanism not established by current deck evidence'),
    importance: 'high',
    evidenceStatus: diffClaims.some((c) => c.supportStatus === 'supported')
      ? 'supported'
      : diffClaims.length > 0 || diffEvIds.length > 0
      ? 'partially_supported'
      : 'unsupported',
    supportingClaimIds: diffClaims.map((c) => c.id).filter((id) => validClaimIds.has(id)),
    supportingSlideNumbers: Array.from(new Set(diffClaims.map((c) => c.slideNumber).filter((s): s is number => typeof s === 'number' && validSlides.has(s)))),
    supportingEvidenceIds: diffEvIds,
    supportingFacts: diffClaims.filter((c) => c.supportStatus === 'supported').map((c) => sanitizeText(c.claimText)),
    contradictingClaimIds: [],
    contradictingSlideNumbers: [],
    confidence: 'medium',
  });

  return mechanisms;
}

/**
 * Deterministically constructs WhatMustBeTrue items adapted to archetype, stage, and expectation policies.
 * Strictly enforces semantic evidence rules for problem urgency, SaaS retention, marketplace liquidity, consumer retention, deeptech proof.
 */
function constructWhatMustBeTrue(
  profile: StartupProfile | null,
  context: CompanyEvaluationContext | null,
  expectations: EvaluationExpectations | null,
  claimMap: ClaimEvidenceMap | null,
  validSlides: Set<number>,
  validClaimIds: Set<string>,
  corpusRefs: InvestmentEvidenceReference[]
): WhatMustBeTrue[] {
  if (!profile && !claimMap?.claims?.length) return [];

  const items: WhatMustBeTrue[] = [];

  const stage = context?.declaredStage.normalizedStage || 'unknown';
  const obsMaturity = context?.observedMaturity.value || 'unknown';
  const isEarlyStage = stage === 'pre_seed' || obsMaturity === 'concept_validation' || obsMaturity === 'product_building';

  const gtmText = profile?.goToMarket?.salesMotion?.rawValue || '';
  const gtmLower = gtmText.toLowerCase();

  const isFounderGtm = gtmLower.includes('founder');
  const isPlg = gtmLower.includes('product-led') || gtmLower.includes('plg') || gtmLower.includes('self-serve');
  const isChannel = gtmLower.includes('channel') || gtmLower.includes('partner');

  const findEvIds = (keyword: string) => corpusRefs.filter((r) => r.statement.toLowerCase().includes(keyword)).map((r) => r.id);

  // 1. Problem Severity & Urgency
  const probRaw = profile?.problemSolution?.problemStatement?.rawValue;
  if (probRaw) {
    const hasQuantifiedPain = Boolean(
      profile?.problemSolution?.problemStatement?.evidence?.some((e) => e.exactText && /\d+/.test(e.exactText)) ||
      profile?.importantFacts?.some((f) => f.fact && f.fact.toLowerCase().includes('problem') && /\d+/.test(f.fact))
    );
    const probEvIds = findEvIds('problem');

    items.push({
      id: 'wmbt_problem_urgency',
      statement: sanitizeText('Target customers experience problem with sufficient severity to justify purchasing budget'),
      category: 'value_creation',
      importance: 'critical',
      assumptionOrigin: 'implicit',
      evidenceStatus: hasQuantifiedPain ? 'partially_supported' : 'asserted_only',
      evidenceQuality: hasQuantifiedPain ? 'customer_quoted' : 'founder_assertion',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: probEvIds.length > 0 ? [probRaw] : [],
      supportingEvidenceIds: probEvIds,
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: false,
      suggestedFounderAction: deriveSuggestedFounderAction(
        hasQuantifiedPain ? 'partially_supported' : 'asserted_only',
        'Document specific customer quotes, quantified pain metrics, and budget allocation evidence',
        'value_creation'
      ),
      confidence: 'high',
    });
  }

  // 2. GTM Scalability
  let gtmStatement = 'Customer acquisition channel achieves repeatable conversion velocity';
  if (isFounderGtm) {
    gtmStatement = 'Customer acquisition can transition from founder-led sales into a repeatable channel motion';
  } else if (isPlg) {
    gtmStatement = 'Product-led self-serve conversion expands into repeatable enterprise upgrade motions';
  } else if (isChannel) {
    gtmStatement = 'Channel partners achieve repeatable deal flow and quota attainment';
  }

  if (expectations?.expectations?.['salesRepeatability']?.status !== 'NOT_APPLICABLE') {
    const gtmEvIds = findEvIds('sales').concat(findEvIds('channel')).concat(findEvIds('acquisition'));
    const gtmStatus =
      context?.functionalMaturity.distributionMaturity === 'repeatable_channels'
        ? 'supported'
        : context?.functionalMaturity.distributionMaturity === 'emerging_channels'
        ? 'partially_supported'
        : isEarlyStage
        ? 'not_yet_testable'
        : 'unsupported';

    items.push({
      id: 'wmbt_gtm_repeatability',
      statement: sanitizeText(gtmStatement),
      category: 'customer_acquisition',
      importance: 'critical',
      assumptionOrigin: isFounderGtm ? 'implicit' : 'explicit',
      evidenceStatus: gtmStatus,
      evidenceQuality: 'operational',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      supportingEvidenceIds: gtmEvIds,
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: false,
      suggestedFounderAction: deriveSuggestedFounderAction(
        gtmStatus,
        'Detail sales-cycle duration, channel partner productivity, or CAC paybacks',
        'customer_acquisition'
      ),
      confidence: 'medium',
    });
  }

  const archetype = context?.businessModel?.primaryArchetype;
  const isSaas = archetype === 'b2b_saas' || archetype === 'enterprise_software' || archetype === 'smb_software' || (profile?.businessModel?.revenueModel?.rawValue || '').toLowerCase().includes('saas');
  const isMarketplace = archetype === 'marketplace' || (profile?.businessModel?.revenueModel?.rawValue || '').toLowerCase().includes('marketplace');
  const isConsumer = archetype === 'consumer' || (profile?.businessModel?.revenueModel?.rawValue || '').toLowerCase().includes('consumer');
  const isDeeptechOrHardware = archetype === 'deeptech' || archetype === 'hardware' || (profile?.problemSolution?.productDescription?.rawValue || '').toLowerCase().includes('deeptech');

  // 3. SaaS Retention Rule
  if (isSaas && expectations?.expectations?.['retention']?.status !== 'NOT_APPLICABLE') {
    const hasExplicitRetention = Boolean(
      profile?.traction?.retentionMetrics?.rawValue ||
      profile?.traction?.churn?.rawValue ||
      corpusRefs.some((r) => /nrr|ndr|retention|churn|cohort/i.test(r.statement))
    );
    const saasEvIds = findEvIds('retention').concat(findEvIds('churn')).concat(findEvIds('nrr'));
    const saasStatus = hasExplicitRetention
      ? 'partially_supported'
      : isEarlyStage
      ? 'not_yet_testable'
      : 'unsupported';

    items.push({
      id: 'wmbt_saas_retention',
      statement: sanitizeText('Customer cohorts retain software subscription value over multi-year contracts'),
      category: 'retention',
      importance: 'high',
      assumptionOrigin: 'implicit',
      evidenceStatus: saasStatus,
      evidenceQuality: 'cohort',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      supportingEvidenceIds: saasEvIds,
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: false,
      suggestedFounderAction: deriveSuggestedFounderAction(
        saasStatus,
        'Provide logo churn rates, Net Revenue Retention (NRR), or renewal cohort metrics',
        'retention'
      ),
      confidence: 'high',
    });
  }

  // 4. Marketplace Liquidity Rule
  if (isMarketplace && expectations?.expectations?.['unitEconomics']?.status !== 'NOT_APPLICABLE') {
    const hasLiquidityMetrics = Boolean(
      corpusRefs.some((r) => /gmv|take rate|liquidity|repeat transaction|fill rate|time-to-match/i.test(r.statement))
    );
    const mktEvIds = findEvIds('liquidity').concat(findEvIds('gmv')).concat(findEvIds('transaction'));
    const mktStatus = hasLiquidityMetrics
      ? 'partially_supported'
      : isEarlyStage
      ? 'not_yet_testable'
      : 'unsupported';

    items.push({
      id: 'wmbt_marketplace_liquidity',
      statement: sanitizeText('Supply and demand achieve localized liquidity and recurring transaction density'),
      category: 'growth',
      importance: 'critical',
      assumptionOrigin: 'implicit',
      evidenceStatus: mktStatus,
      evidenceQuality: 'operational',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      supportingEvidenceIds: mktEvIds,
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: false,
      suggestedFounderAction: deriveSuggestedFounderAction(
        mktStatus,
        'Provide repeat transaction frequency, buyer liquidity, and seller retention metrics',
        'growth'
      ),
      confidence: 'medium',
    });
  }

  // 5. Consumer Retention Rule
  if (isConsumer && expectations?.expectations?.['retention']?.status !== 'NOT_APPLICABLE') {
    const hasConsumerRetention = Boolean(
      corpusRefs.some((r) => /d30|d90|dau\/mau|cohort|repeat engagement/i.test(r.statement))
    );
    const consEvIds = findEvIds('retention').concat(findEvIds('dau')).concat(findEvIds('cohort'));
    const consStatus = hasConsumerRetention
      ? 'partially_supported'
      : isEarlyStage
      ? 'not_yet_testable'
      : 'unsupported';

    items.push({
      id: 'wmbt_consumer_retention',
      statement: sanitizeText('User acquisition converts into durable organic engagement and monetization density'),
      category: 'retention',
      importance: 'critical',
      assumptionOrigin: 'implicit',
      evidenceStatus: consStatus,
      evidenceQuality: 'cohort',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      supportingEvidenceIds: consEvIds,
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: false,
      suggestedFounderAction: deriveSuggestedFounderAction(
        consStatus,
        'Show D30/D90 retention curves and organic vs paid referral ratios',
        'retention'
      ),
      confidence: 'medium',
    });
  }

  // 6. Deeptech Technical Proof Rule
  if (isDeeptechOrHardware) {
    const hasTechnicalProof = Boolean(
      profile?.technology?.proprietaryClaims?.rawValue ||
      corpusRefs.some((r) => /benchmark|patent|lab test|pilot test|field test|validation/i.test(r.statement))
    );
    const techEvIds = findEvIds('patent').concat(findEvIds('benchmark')).concat(findEvIds('technology'));
    const techStatus = hasTechnicalProof ? 'partially_supported' : 'asserted_only';

    items.push({
      id: 'wmbt_deeptech_technical_proof',
      statement: sanitizeText('Core technical breakthrough is reproducible outside controlled laboratory environments'),
      category: 'technical_execution',
      importance: 'critical',
      assumptionOrigin: 'explicit',
      evidenceStatus: techStatus,
      evidenceQuality: 'technical',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      supportingEvidenceIds: techEvIds,
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: false,
      suggestedFounderAction: deriveSuggestedFounderAction(
        techStatus,
        'Share third-party lab verification, IP patent grants, or pilot benchmark test results',
        'technical_execution'
      ),
      confidence: 'high',
    });
  }

  // 7. Market Expansion Rule (TAM alone != expansion logic)
  const hasExplicitAdjacency = Boolean(
    profile?.goToMarket?.expansionStrategy?.rawValue ||
    corpusRefs.some((r) => /expansion|adjacency|adjacent market|wedge/i.test(r.statement))
  );
  if (hasExplicitAdjacency) {
    const expEvIds = findEvIds('expansion').concat(findEvIds('adjacency'));
    items.push({
      id: 'wmbt_market_expansion',
      statement: sanitizeText('Initial customer wedge expands logically into reachable adjacent market budget'),
      category: 'market_expansion',
      importance: 'medium',
      assumptionOrigin: 'explicit',
      evidenceStatus: 'partially_supported',
      evidenceQuality: 'market_research',
      supportingClaimIds: [],
      supportingSlideNumbers: [],
      supportingFacts: [],
      supportingEvidenceIds: expEvIds,
      contradictingClaimIds: [],
      contradictingSlideNumbers: [],
      isThesisBottleneck: false,
      suggestedFounderAction: deriveSuggestedFounderAction(
        'partially_supported',
        'Provide bottom-up expansion derivation showing buyer count multiplied by ACV',
        'market_expansion'
      ),
      confidence: 'medium',
    });
  }

  return items;
}

/**
 * Constructs dependency graph between assumptions and mechanisms.
 * Context-grounded edges only.
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
    if (sourceId === targetId) return;
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return;
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

  if (nodeIds.has('wmbt_problem_urgency') && nodeIds.has('mech_value_creation')) {
    addDep(
      'dep_problem_to_value',
      'wmbt_problem_urgency',
      'mech_value_creation',
      'enables',
      'critical',
      'High problem urgency is required to validate customer ROI and value creation'
    );
  }

  if (nodeIds.has('wmbt_gtm_repeatability') && nodeIds.has('mech_customer_acquisition')) {
    addDep(
      'dep_gtm_to_acq',
      'wmbt_gtm_repeatability',
      'mech_customer_acquisition',
      'enables',
      'critical',
      'Repeatable GTM motion enables predictable customer acquisition channels'
    );
  }

  if (nodeIds.has('wmbt_gtm_repeatability') && nodeIds.has('mech_monetization')) {
    addDep(
      'dep_gtm_to_monetization',
      'wmbt_gtm_repeatability',
      'mech_monetization',
      'enables',
      'critical',
      'Distribution repeatability is required to scale unit monetization'
    );
  }

  if (nodeIds.has('wmbt_gtm_repeatability') && nodeIds.has('mech_retention')) {
    addDep(
      'dep_gtm_to_retention',
      'wmbt_gtm_repeatability',
      'mech_retention',
      'enables',
      'high',
      'Repeatable customer acquisition channels feed retention cohort pipelines'
    );
  }

  if (nodeIds.has('mech_customer_acquisition') && nodeIds.has('mech_monetization')) {
    addDep(
      'dep_acq_to_monetization',
      'mech_customer_acquisition',
      'mech_monetization',
      'enables',
      'critical',
      'Customer acquisition converts accounts into active unit monetization'
    );
  }

  if (nodeIds.has('wmbt_saas_retention') && nodeIds.has('mech_retention')) {
    addDep(
      'dep_saas_retention_mech',
      'wmbt_saas_retention',
      'mech_retention',
      'requires',
      'high',
      'Multi-year cohort retention prevents revenue churn and enables compounding growth'
    );
  }

  if (nodeIds.has('mech_retention') && nodeIds.has('wmbt_market_expansion')) {
    addDep(
      'dep_retention_to_expansion',
      'mech_retention',
      'wmbt_market_expansion',
      'enables',
      'medium',
      'Strong account retention provides the stable customer base required to land-and-expand into adjacent budget'
    );
  }

  if (nodeIds.has('wmbt_marketplace_liquidity') && nodeIds.has('mech_monetization')) {
    addDep(
      'dep_liquidity_to_monetization',
      'wmbt_marketplace_liquidity',
      'mech_monetization',
      'enables',
      'critical',
      'Marketplace transaction density is required to generate sustainable take-rate monetization'
    );
  }

  if (nodeIds.has('wmbt_consumer_retention') && nodeIds.has('mech_monetization')) {
    addDep(
      'dep_consumer_retention_to_monetization',
      'wmbt_consumer_retention',
      'mech_monetization',
      'enables',
      'critical',
      'Durable organic engagement is required to sustain consumer LTV above acquisition cost'
    );
  }

  if (nodeIds.has('wmbt_deeptech_technical_proof') && nodeIds.has('mech_value_creation')) {
    addDep(
      'dep_tech_proof_to_value',
      'wmbt_deeptech_technical_proof',
      'mech_value_creation',
      'enables',
      'critical',
      'Field benchmark proof is required to demonstrate commercial value creation'
    );
  }

  return deps;
}

/**
 * Derives thesis bottlenecks 100% deterministically from dependency graph structure.
 * Requires downstream >= 2 and deficient/unproven status.
 * NOT_YET_TESTABLE items are NOT automatically negative bottlenecks.
 */
function deriveThesisBottlenecks(
  whatMustBeTrue: WhatMustBeTrue[],
  dependencies: InvestmentCaseDependency[],
  mechanisms: InvestmentCaseMechanism[],
  context: CompanyEvaluationContext | null,
  profile: StartupProfile | null
): WhatMustBeTrue[] {
  const downstreamCounts = new Map<string, number>();
  for (const dep of dependencies) {
    if (dep.sourceId && dep.targetId && dep.sourceId !== dep.targetId) {
      downstreamCounts.set(dep.sourceId, (downstreamCounts.get(dep.sourceId) || 0) + 1);
    }
  }

  return whatMustBeTrue.map((w) => {
    const isDeficient =
      w.evidenceStatus === 'unsupported' ||
      w.evidenceStatus === 'asserted_only' ||
      w.evidenceStatus === 'contradictory' ||
      w.evidenceStatus === 'partially_supported';

    const isCritical = w.importance === 'critical' || w.importance === 'high';
    const downstream = downstreamCounts.get(w.id) || 0;

    const isBottleneck = isCritical && isDeficient && downstream >= 2;
    const bottleneckReason = isBottleneck
      ? `Multiple core downstream mechanisms (${downstream} dependent nodes) depend on "${w.statement}", which currently lacks fully supported deck evidence.`
      : undefined;

    return {
      ...w,
      isThesisBottleneck: isBottleneck,
      bottleneckReason,
      suggestedFounderAction: deriveSuggestedFounderAction(
        w.evidenceStatus,
        w.suggestedFounderAction?.action || `Provide evidence for ${w.statement.toLowerCase()}`,
        w.category
      ),
    };
  });
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
  if (!profile && !diagnostics?.contradictions?.length) return [];

  const risks: InvestmentCaseRisk[] = [];

  const stage = context?.declaredStage.normalizedStage || 'unknown';
  const gtmText = (profile?.goToMarket?.salesMotion?.rawValue || '').toLowerCase();
  const acvText = (
    profile?.businessModel?.pricingValues?.rawValue ||
    profile?.businessModel?.revenueModel?.rawValue ||
    ''
  ).toLowerCase();

  const numericAcv = parseAcvValue(acvText);
  const isHighAcv = (numericAcv !== null && numericAcv >= 50000) || acvText.includes('100k') || acvText.includes('$50k');
  const isSelfServe = gtmText.includes('self-serve') || gtmText.includes('smb');

  if (isHighAcv && isSelfServe) {
    risks.push({
      id: 'risk_commercial_model_tension',
      category: 'economics',
      title: sanitizeText('Commercial Model Tension: High Enterprise ACV vs Self-Serve Channel'),
      description: sanitizeText(
        'The investment case assumes high enterprise ACVs but describes a self-serve GTM channel, creating potential friction in sales motion execution.'
      ),
      riskType: 'commercial_tension',
      whyItMatters: sanitizeText(
        'Enterprise buyers typically require dedicated security reviews, procurement cycles, and consultative sales touchpoints.'
      ),
      supportingEvidence: [acvText, gtmText].filter(Boolean),
      contradictingEvidence: [],
      relatedAssumptionIds: ['wmbt_gtm_repeatability'],
      relatedMechanismIds: ['mech_customer_acquisition'],
      severity: 'material',
      confidence: 'high',
    });
  }

  const growthVal = profile?.traction?.growthRates?.rawValue || profile?.traction?.ARR?.rawValue;
  const retVal = profile?.traction?.retentionMetrics?.rawValue || profile?.traction?.churn?.rawValue;
  if (growthVal && !retVal) {
    const archetype = context?.businessModel?.primaryArchetype;
    const targetWmbtId =
      archetype === 'consumer'
        ? 'wmbt_consumer_retention'
        : archetype === 'marketplace'
        ? 'wmbt_marketplace_liquidity'
        : 'wmbt_saas_retention';

    risks.push({
      id: 'risk_unproven_durability',
      category: 'retention',
      title: sanitizeText('Unresolved Revenue Durability'),
      description: sanitizeText(
        'Top-line revenue growth is cited in the deck, but long-term cohort retention or net revenue retention data remains unevidenced.'
      ),
      riskType: 'unproven_durability',
      whyItMatters: sanitizeText(
        'Growth in early periods without cohort retention proof leaves revenue durability and customer lifetime value unverified.'
      ),
      supportingEvidence: [growthVal].filter(Boolean),
      contradictingEvidence: [],
      relatedAssumptionIds: whatMustBeTrue.some((w) => w.id === targetWmbtId) ? [targetWmbtId] : [],
      relatedMechanismIds: ['mech_retention'],
      severity: stage === 'series_a' ? 'critical' : 'material',
      confidence: 'high',
    });
  }

  if (gtmText.includes('founder')) {
    risks.push({
      id: 'risk_founder_sales_concentration',
      category: 'distribution',
      title: sanitizeText('Founder-Led Sales Concentration'),
      description: sanitizeText(
        'Initial GTM execution relies heavily on founder relationships, leaving sales repeatability across hired reps unproven.'
      ),
      riskType: 'founder_concentration',
      whyItMatters: sanitizeText(
        'Venture scalability requires transitioning customer acquisition from founder network into repeatable sales channels.'
      ),
      supportingEvidence: [gtmText].filter(Boolean),
      contradictingEvidence: [],
      relatedAssumptionIds: ['wmbt_gtm_repeatability'],
      relatedMechanismIds: ['mech_customer_acquisition'],
      severity: 'material',
      confidence: 'high',
    });
  }

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
    (w) => w.evidenceStatus === 'unsupported' || w.evidenceStatus === 'asserted_only' || w.evidenceStatus === 'partially_supported'
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
    .filter((w) => w.evidenceStatus === 'unsupported' || w.evidenceStatus === 'asserted_only' || w.evidenceStatus === 'partially_supported')
    .map((w) => w.statement);

  const bottlenecks = whatMustBeTrue.filter((w) => w.isThesisBottleneck).map((w) => w.statement);

  const materialRisks = risks.filter((r) => r.severity === 'critical' || r.severity === 'material').map((r) => r.title);

  const actions = whatMustBeTrue
    .filter((w) => w.evidenceStatus !== 'not_yet_testable' && w.evidenceStatus !== 'supported')
    .map((w) => w.suggestedFounderAction?.action)
    .filter((a): a is string => Boolean(a));

  return {
    thesisSummary: thesis.summary,
    strongestSupportedMechanisms: supportedMechs,
    mostImportantUnprovenAssumptions: unprovenAssumptions,
    thesisBottlenecks: bottlenecks,
    materialRisks: materialRisks,
    highestLeverageFounderActions: actions.length > 0 ? actions : ['Provide core pitch deck evidence for investment case reconstruction'],
  };
}

/**
 * Validates and cleanses an InvestmentCase object to enforce strict graph integrity,
 * valid slide numbers, valid claim IDs, evidence grounding against canonical corpus,
 * no self-loop dependencies, no duplicate edges, and no prohibited scoring language.
 */
export function validateAndCleanseInvestmentCase(
  rawCase: InvestmentCase,
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  slideEvidence?: Array<{ textContent?: string; extractedText?: string; exactText?: string }> | null,
  context?: CompanyEvaluationContext | null
): InvestmentCase {
  const validSlides = getValidSlideNumbers(profile, claimMap, diagnostics, slideEvidence as any);
  const validClaimIds = getValidClaimIds(claimMap);
  const corpusRefs = buildCanonicalEvidenceCorpusReferences(profile, claimMap, diagnostics, slideEvidence);
  const corpusMap = new Map<string, InvestmentEvidenceReference>(corpusRefs.map((r) => [r.id, r]));

  // Cleanse WhatMustBeTrue
  const validWmbtIds = new Set<string>();
  const cleansedWmbt: WhatMustBeTrue[] = rawCase.whatMustBeTrue.map((w) => {
    validWmbtIds.add(w.id);
    const validEvIds = (w.supportingEvidenceIds || []).filter((id) => corpusMap.has(id));
    const validContraEvIds = (w.contradictingEvidenceIds || []).filter((id) => corpusMap.has(id));

    const derivedFacts = validEvIds.map((id) => corpusMap.get(id)?.statement).filter((s): s is string => Boolean(s));

    return {
      ...w,
      statement: sanitizeText(w.statement),
      supportingSlideNumbers: (w.supportingSlideNumbers || []).filter((s) => validSlides.has(s)),
      supportingClaimIds: (w.supportingClaimIds || []).filter((id) => validClaimIds.has(id)),
      supportingEvidenceIds: validEvIds,
      contradictingSlideNumbers: (w.contradictingSlideNumbers || []).filter((s) => validSlides.has(s)),
      contradictingClaimIds: (w.contradictingClaimIds || []).filter((id) => validClaimIds.has(id)),
      contradictingEvidenceIds: validContraEvIds,
      supportingFacts: derivedFacts.length > 0 ? derivedFacts.map(sanitizeText) : (w.supportingFacts || []).map(sanitizeText).filter((f) => isStringSupportedByCorpus(f, corpusRefs)),
      bottleneckReason: w.bottleneckReason ? sanitizeText(w.bottleneckReason) : undefined,
      suggestedFounderAction: deriveSuggestedFounderAction(
        w.evidenceStatus,
        w.suggestedFounderAction?.action || `Provide evidence for ${w.statement.toLowerCase()}`,
        w.category
      ),
    };
  });

  // Cleanse Mechanisms
  const validMechIds = new Set<string>();
  const cleansedMechs: InvestmentCaseMechanism[] = rawCase.mechanisms.map((m) => {
    validMechIds.add(m.id);
    const validEvIds = (m.supportingEvidenceIds || []).filter((id) => corpusMap.has(id));
    const derivedFacts = validEvIds.map((id) => corpusMap.get(id)?.statement).filter((s): s is string => Boolean(s));

    return {
      ...m,
      statement: sanitizeText(m.statement),
      supportingSlideNumbers: (m.supportingSlideNumbers || []).filter((s) => validSlides.has(s)),
      supportingClaimIds: (m.supportingClaimIds || []).filter((id) => validClaimIds.has(id)),
      supportingEvidenceIds: validEvIds,
      contradictingSlideNumbers: (m.contradictingSlideNumbers || []).filter((s) => validSlides.has(s)),
      contradictingClaimIds: (m.contradictingClaimIds || []).filter((id) => validClaimIds.has(id)),
      supportingFacts: derivedFacts.length > 0 ? derivedFacts.map(sanitizeText) : (m.supportingFacts || []).map(sanitizeText).filter((f) => isStringSupportedByCorpus(f, corpusRefs)),
    };
  });

  const validNodes = new Set<string>([...validWmbtIds, ...validMechIds]);

  // Cleanse Dependencies
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

  // Recompute Thesis Bottlenecks 100% deterministically from graph AFTER cleansing
  const finalWmbt = deriveThesisBottlenecks(cleansedWmbt, cleansedDeps, cleansedMechs, context || null, profile);

  // Cleanse Risks
  const cleansedRisks: InvestmentCaseRisk[] = (rawCase.risks || []).map((r) => {
    const validEvIds = (r.supportingEvidenceIds || []).filter((id) => corpusMap.has(id));
    const derivedEv = validEvIds.map((id) => corpusMap.get(id)?.statement).filter((s): s is string => Boolean(s));

    return {
      ...r,
      title: sanitizeText(r.title),
      description: sanitizeText(r.description),
      whyItMatters: sanitizeText(r.whyItMatters),
      supportingEvidenceIds: validEvIds,
      supportingEvidence: derivedEv.length > 0 ? derivedEv.map(sanitizeText) : (r.supportingEvidence || []).map(sanitizeText).filter((ev) => isStringSupportedByCorpus(ev, corpusRefs)),
      contradictingEvidence: (r.contradictingEvidence || []).map(sanitizeText).filter((ev) => isStringSupportedByCorpus(ev, corpusRefs)),
      relatedAssumptionIds: (r.relatedAssumptionIds || []).filter((id) => validWmbtIds.has(id)),
      relatedMechanismIds: (r.relatedMechanismIds || []).filter((id) => validMechIds.has(id)),
    };
  });

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

  // Recompute Case Summary deterministically
  const summary = constructSummary(
    rawCase.investmentThesis,
    cleansedMechs,
    finalWmbt,
    cleansedRisks
  );

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
    whatMustBeTrue: finalWmbt,
    dependencies: cleansedDeps,
    risks: cleansedRisks,
    contradictions: cleansedContras,
    unresolvedQuestions: cleansedQuestions,
    caseSummary: summary,
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
  evaluationExpectations: EvaluationExpectations | null,
  slideEvidence?: Array<{ textContent?: string; extractedText?: string; exactText?: string }> | null
): InvestmentCase {
  const validSlides = getValidSlideNumbers(profile, claimMap, diagnostics, slideEvidence as any);
  const validClaimIds = getValidClaimIds(claimMap);
  const corpusRefs = buildCanonicalEvidenceCorpusReferences(profile, claimMap, diagnostics, slideEvidence);

  const thesis = reconstructInvestmentThesis(profile, evaluationContext, corpusRefs);
  const mechanisms = constructMechanisms(profile, evaluationContext, claimMap, validSlides, validClaimIds, corpusRefs);
  const rawWmbt = constructWhatMustBeTrue(
    profile,
    evaluationContext,
    evaluationExpectations,
    claimMap,
    validSlides,
    validClaimIds,
    corpusRefs
  );
  const dependencies = constructDependencies(rawWmbt, mechanisms);
  const whatMustBeTrue = deriveThesisBottlenecks(rawWmbt, dependencies, mechanisms, evaluationContext, profile);
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

  return validateAndCleanseInvestmentCase(rawCase, profile, claimMap, diagnostics, slideEvidence, evaluationContext);
}
