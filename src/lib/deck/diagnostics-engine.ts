import { HybridDeckResult } from '@/types/deck';
import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap, MaterialClaim } from '@/types/claim';
import {
  DeckDiagnostics,
  ContradictionDiagnostic,
  EvidenceGapDiagnostic,
  MissingInfoDiagnostic,
  AmbiguityDiagnostic,
  DiagnosticSummary,
  DiagnosticSeverity,
} from '@/types/diagnostics';

/**
 * Result of diagnostic engine execution.
 */
export interface DiagnosticRunResult {
  status: 'success' | 'skipped' | 'partial' | 'error';
  diagnostics: DeckDiagnostics | null;
  errorMessage?: string;
}

/**
 * Helper to classify field category and default severity for missing profile fields.
 */
function classifyMissingField(fieldStr: string): { category: string; severity: DiagnosticSeverity; context: string } {
  const lower = fieldStr.toLowerCase();

  if (lower.includes('amountbeingraised') || lower.includes('useoffunds') || lower.includes('roundbeingraised')) {
    return {
      category: 'fundraising',
      severity: 'material',
      context: 'Core fundraising parameters and proposed allocation of proceeds.',
    };
  }
  if (lower.includes('runway') || lower.includes('previousfunding')) {
    return {
      category: 'fundraising',
      severity: 'minor',
      context: 'Historical capital raised and financial runway context.',
    };
  }
  if (lower.includes('arr') || lower.includes('revenue') || lower.includes('customercount')) {
    return {
      category: 'traction',
      severity: 'material',
      context: 'Core quantitative traction metrics.',
    };
  }
  if (lower.includes('churn') || lower.includes('retention') || lower.includes('growthrates') || lower.includes('pipeline')) {
    return {
      category: 'traction',
      severity: 'minor',
      context: 'Secondary operational velocity or cohort retention metrics.',
    };
  }
  if (lower.includes('tam') || lower.includes('marketgrowth') || lower.includes('marketsource')) {
    return {
      category: 'market',
      severity: 'material',
      context: 'Overall market sizing and addressable opportunity definition.',
    };
  }
  if (lower.includes('sam') || lower.includes('som') || lower.includes('marketdefinition')) {
    return {
      category: 'market',
      severity: 'minor',
      context: 'Granular serviceable market segmentation.',
    };
  }
  if (lower.includes('uniteconomics') || lower.includes('pricingvalues')) {
    return {
      category: 'economics',
      severity: 'material',
      context: 'Unit-level economics and monetization mechanics.',
    };
  }
  if (lower.includes('namedcompetitors') || lower.includes('differentiationclaims')) {
    return {
      category: 'competition',
      severity: 'material',
      context: 'Competitive landscape mapping and primary points of difference.',
    };
  }
  if (lower.includes('founders') || lower.includes('teamsize')) {
    return {
      category: 'team',
      severity: 'material',
      context: 'Key leadership and execution capacity.',
    };
  }
  if (lower.includes('coretechnology') || lower.includes('proprietaryclaims')) {
    return {
      category: 'technology',
      severity: 'minor',
      context: 'Technical architecture, defensibility, or proprietary IP.',
    };
  }
  if (lower.includes('salesmotion') || lower.includes('distributionstrategy') || lower.includes('acquisitionchannels')) {
    return {
      category: 'gtm',
      severity: 'material',
      context: 'Go-to-market distribution and customer acquisition strategy.',
    };
  }

  return {
    category: 'other',
    severity: 'minor',
    context: 'Additional factual context.',
  };
}

/**
 * Generate deterministic diagnostics from StartupProfile and ClaimEvidenceMap.
 */
export function generateDeterministicDiagnostics(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  totalPages: number
): {
  contradictions: ContradictionDiagnostic[];
  evidenceGaps: EvidenceGapDiagnostic[];
  missingInfo: MissingInfoDiagnostic[];
} {
  const contradictions: ContradictionDiagnostic[] = [];
  const evidenceGaps: EvidenceGapDiagnostic[] = [];
  const missingInfo: MissingInfoDiagnostic[] = [];

  // 1. Contradictions from Claims
  if (claimMap?.claims) {
    for (const claim of claimMap.claims) {
      if (claim.supportStatus === 'conflicting' && claim.conflict) {
        contradictions.push({
          id: `contra-${claim.id}`,
          category: claim.claimType,
          severity: claim.importance === 'core' ? 'critical' : 'material',
          description: claim.conflict.description || `Contradictory values detected for "${claim.claimText}"`,
          conflictingStatements: claim.conflict.competingValues.map((cv) => ({
            text: cv.value,
            slideNumber: Math.max(1, Math.min(totalPages, cv.slideNumber)),
            source: cv.source,
          })),
          whyConflicting: `Incompatible data points stated across slides without establishing reconciliation.`,
          chronologyExplained: false,
          confidence: 'high',
        });
      }
    }
  }

  // 2. Evidence Gaps from Claims
  if (claimMap?.claims) {
    for (const claim of claimMap.claims) {
      if (claim.supportStatus === 'unsupported') {
        const isCore = claim.importance === 'core';
        let missingDescription = 'No substantive supporting evidence was located inside the deck.';
        if (claim.claimType === 'market') {
          missingDescription = 'Market size derivation or external source citation was not found in the deck.';
        } else if (claim.claimType === 'differentiation' || claim.claimType === 'competition') {
          missingDescription = 'Comparative assertion lacks verifiable supporting evidence inside the deck.';
        }

        evidenceGaps.push({
          id: `gap-${claim.id}`,
          claimId: claim.id,
          claimText: claim.claimText,
          claimType: claim.claimType,
          severity: isCore ? 'critical' : 'material',
          supportStatus: 'unsupported',
          importance: claim.importance,
          slideNumbers: [claim.slideNumber],
          currentEvidenceSummary: 'None (Assertion only)',
          missingEvidenceDescription: missingDescription,
          confidence: 'high',
        });
      } else if (claim.supportStatus === 'partially_supported') {
        const evidenceSummary = claim.evidence.map((e) => `Slide ${e.slideNumber}: ${e.exactText}`).join('; ');
        let missingDesc = 'Supporting evidence is present but does not fully substantiate the stated magnitude or scope.';

        if (claim.claimType === 'customer' && claim.quantitative) {
          missingDesc = 'Customer logos or references demonstrate relationships but do not substantiate the total count or paid status.';
        }

        evidenceGaps.push({
          id: `gap-${claim.id}`,
          claimId: claim.id,
          claimText: claim.claimText,
          claimType: claim.claimType,
          severity: claim.importance === 'core' ? 'material' : 'minor',
          supportStatus: 'partially_supported',
          importance: claim.importance,
          slideNumbers: [claim.slideNumber, ...claim.evidence.map((e) => e.slideNumber)],
          currentEvidenceSummary: evidenceSummary || 'Partial evidence present',
          missingEvidenceDescription: missingDesc,
          confidence: 'high',
        });
      }
    }
  }

  // 3. Missing Information from Profile
  if (profile?.missingFields) {
    for (let i = 0; i < profile.missingFields.length; i++) {
      const fieldStr = profile.missingFields[i];
      const classification = classifyMissingField(fieldStr);

      missingInfo.push({
        id: `missing-${i + 1}`,
        field: fieldStr,
        category: classification.category,
        severity: classification.severity,
        context: classification.context,
      });
    }
  }

  return { contradictions, evidenceGaps, missingInfo };
}

/**
 * Filter, validate, and defend against model hallucinations.
 */
function postProcessSemanticDiagnostics(
  rawContradictions: ContradictionDiagnostic[],
  rawAmbiguities: AmbiguityDiagnostic[],
  totalPages: number
): {
  validContradictions: ContradictionDiagnostic[];
  validAmbiguities: AmbiguityDiagnostic[];
} {
  const validContradictions: ContradictionDiagnostic[] = [];
  const validAmbiguities: AmbiguityDiagnostic[] = [];

  // Process contradictions
  if (Array.isArray(rawContradictions)) {
    for (const contra of rawContradictions) {
      if (!contra.conflictingStatements || !Array.isArray(contra.conflictingStatements)) continue;

      // Filter out if chronology explains it
      if (contra.chronologyExplained) {
        continue; // Chronological progression is not a contradiction
      }

      // Validate referenced slide numbers
      const validStatements = contra.conflictingStatements.filter((stmt) => {
        const sNum = Number(stmt.slideNumber);
        return sNum >= 1 && sNum <= totalPages;
      });

      if (validStatements.length < 2) continue; // Need at least 2 valid statements to conflict

      validContradictions.push({
        ...contra,
        conflictingStatements: validStatements,
      });
    }
  }

  // Process ambiguities
  if (Array.isArray(rawAmbiguities)) {
    for (const amb of rawAmbiguities) {
      if (!amb.statement || !amb.slideNumber) continue;

      const sNum = Number(amb.slideNumber);
      if (sNum < 1 || sNum > totalPages) continue; // Invalid slide bounds

      validAmbiguities.push({
        ...amb,
        slideNumber: sNum,
      });
    }
  }

  return { validContradictions, validAmbiguities };
}

/**
 * Compute aggregate diagnostic summary.
 */
function computeSummary(
  contradictions: ContradictionDiagnostic[],
  evidenceGaps: EvidenceGapDiagnostic[],
  missingInfo: MissingInfoDiagnostic[],
  ambiguities: AmbiguityDiagnostic[]
): DiagnosticSummary {
  const allSeverities: DiagnosticSeverity[] = [
    ...contradictions.map((c) => c.severity),
    ...evidenceGaps.map((e) => e.severity),
    ...missingInfo.map((m) => m.severity),
    ...ambiguities.map((a) => a.severity),
  ];

  return {
    totalDiagnostics: allSeverities.length,
    contradictionCount: contradictions.length,
    evidenceGapCount: evidenceGaps.length,
    missingInfoCount: missingInfo.length,
    ambiguityCount: ambiguities.length,
    criticalCount: allSeverities.filter((s) => s === 'critical').length,
    materialCount: allSeverities.filter((s) => s === 'material').length,
    minorCount: allSeverities.filter((s) => s === 'minor').length,
  };
}

/**
 * Execute full diagnostic engine: Deterministic Rules + Gemini Semantic Detection.
 */
export async function executeDeckDiagnostics(
  hybridResult: HybridDeckResult,
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null
): Promise<DiagnosticRunResult> {
  const totalPages = hybridResult.summary.totalPages;

  // 1. Generate Deterministic Findings
  const deterministic = generateDeterministicDiagnostics(profile, claimMap, totalPages);

  let semanticContradictions: ContradictionDiagnostic[] = [];
  let semanticAmbiguities: AmbiguityDiagnostic[] = [];
  let semanticStatus: 'success' | 'skipped' | 'error' = 'skipped';
  let semanticErrorMessage: string | undefined;

  // 2. Call Server-Side Semantic Diagnostics Route
  try {
    const slideEvidence = hybridResult.slides.map((s) => ({
      pageNumber: s.pageNumber,
      text: s.nativeExtraction?.rawText?.slice(0, 500) || s.visualExtraction?.summary || '',
    }));

    const response = await fetch('/api/deck/diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        claims: claimMap?.claims || [],
        slideEvidence,
      }),
    });

    if (response.ok) {
      const resJson = await response.json();
      if (resJson.status === 'success' && resJson.data) {
        semanticStatus = 'success';
        const rawContras = resJson.data.semanticContradictions || [];
        const rawAmbs = resJson.data.ambiguities || [];

        const validated = postProcessSemanticDiagnostics(rawContras, rawAmbs, totalPages);
        semanticContradictions = validated.validContradictions;
        semanticAmbiguities = validated.validAmbiguities;
      } else if (resJson.status === 'skipped') {
        semanticStatus = 'skipped';
      } else {
        semanticStatus = 'error';
        semanticErrorMessage = resJson.message;
      }
    } else {
      semanticStatus = 'error';
      semanticErrorMessage = `Diagnostics server error: ${response.statusText}`;
    }
  } catch (err: unknown) {
    semanticStatus = 'error';
    semanticErrorMessage = err instanceof Error ? err.message : String(err);
  }

  // 3. Combine Deterministic & Semantic Findings (avoiding exact duplicates)
  const allContradictions = [...deterministic.contradictions];
  for (const sContra of semanticContradictions) {
    const isDup = allContradictions.some(
      (c) =>
        c.category === sContra.category &&
        c.conflictingStatements.some((st) => sContra.conflictingStatements.some((sst) => sst.slideNumber === st.slideNumber))
    );
    if (!isDup) {
      allContradictions.push(sContra);
    }
  }

  const allEvidenceGaps = deterministic.evidenceGaps;
  const allMissingInfo = deterministic.missingInfo;
  const allAmbiguities = semanticAmbiguities;

  const summary = computeSummary(allContradictions, allEvidenceGaps, allMissingInfo, allAmbiguities);

  const diagnostics: DeckDiagnostics = {
    contradictions: allContradictions,
    evidenceGaps: allEvidenceGaps,
    missingInformation: allMissingInfo,
    ambiguities: allAmbiguities,
    summary,
    extractedAt: new Date(),
  };

  return {
    status: semanticStatus === 'error' ? 'partial' : 'success',
    diagnostics,
    errorMessage: semanticErrorMessage,
  };
}

