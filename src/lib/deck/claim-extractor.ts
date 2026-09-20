import { HybridDeckResult } from '@/types/deck';
import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap, MaterialClaim, ClaimMapSummary } from '@/types/claim';

/**
 * Result of Claim & Evidence Map extraction.
 */
export interface ClaimExtractionResult {
  status: 'success' | 'skipped' | 'error';
  map: ClaimEvidenceMap | null;
  errorMessage?: string;
}

/**
 * Deterministically validate, filter, and normalize raw claims returned by the model.
 */
function postProcessClaims(rawClaims: MaterialClaim[], totalPages: number): MaterialClaim[] {
  if (!Array.isArray(rawClaims)) return [];

  const validClaims: MaterialClaim[] = [];
  const seenClaimKeys = new Set<string>();

  for (const claim of rawClaims) {
    if (!claim.claimText || !claim.slideNumber) continue;

    // 1. Ensure slideNumber is within valid range
    const slideNumber = Math.max(1, Math.min(totalPages, Number(claim.slideNumber)));

    // 2. Prevent duplicate claims
    const claimKey = `${slideNumber}:${claim.claimText.trim().toLowerCase()}`;
    if (seenClaimKeys.has(claimKey)) continue;
    seenClaimKeys.add(claimKey);

    // 3. Filter and validate evidence items
    const validEvidence = Array.isArray(claim.evidence)
      ? claim.evidence.filter((ev) => {
          if (!ev || !ev.exactText) return false;
          const evSlide = Number(ev.slideNumber);
          return evSlide >= 1 && evSlide <= totalPages;
        }).map((ev, idx) => ({
          ...ev,
          id: ev.id || `${claim.id}-ev-${idx + 1}`,
          slideNumber: Math.max(1, Math.min(totalPages, Number(ev.slideNumber))),
        }))
      : [];

    // 4. Validate supportStatus consistency
    let supportStatus = claim.supportStatus;
    if (supportStatus === 'unsupported' && validEvidence.length > 0) {
      // If evidence exists, cannot be strictly unsupported
      supportStatus = 'partially_supported';
    } else if (supportStatus === 'supported' && validEvidence.length === 0) {
      supportStatus = 'unsupported';
    }

    validClaims.push({
      ...claim,
      slideNumber,
      evidence: validEvidence,
      supportStatus,
    });
  }

  return validClaims;
}

/**
 * Compute factual ClaimMapSummary metrics.
 */
function computeSummary(claims: MaterialClaim[]): ClaimMapSummary {
  return {
    totalClaims: claims.length,
    supportedCount: claims.filter((c) => c.supportStatus === 'supported').length,
    partiallySupportedCount: claims.filter((c) => c.supportStatus === 'partially_supported').length,
    unsupportedCount: claims.filter((c) => c.supportStatus === 'unsupported').length,
    conflictingCount: claims.filter((c) => c.supportStatus === 'conflicting').length,
    coreCount: claims.filter((c) => c.importance === 'core').length,
  };
}

/**
 * Extracts and maps material pitch deck claims to underlying slide evidence.
 * 
 * @param hybridResult Completed deck ingestion result
 * @param profile Completed startup profile (if available)
 * @returns Promise<ClaimExtractionResult>
 */
export async function extractClaimEvidenceMap(
  hybridResult: HybridDeckResult,
  profile: StartupProfile | null
): Promise<ClaimExtractionResult> {
  try {
    const response = await fetch('/api/deck/extract-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slides: hybridResult.slides,
        profile,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return {
        status: 'error',
        map: null,
        errorMessage: errJson.message || `Claim API HTTP Error (${response.status})`,
      };
    }

    const result = await response.json();

    if (result.status === 'skipped') {
      return {
        status: 'skipped',
        map: null,
        errorMessage: result.message,
      };
    }

    if (result.status === 'success' && result.data && Array.isArray(result.data.claims)) {
      const processedClaims = postProcessClaims(result.data.claims, hybridResult.summary.totalPages);
      const summary = computeSummary(processedClaims);

      const map: ClaimEvidenceMap = {
        claims: processedClaims,
        summary,
        extractedAt: new Date(),
      };

      return {
        status: 'success',
        map,
      };
    }

    return {
      status: 'error',
      map: null,
      errorMessage: result.message || 'Unknown error during claim extraction.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      map: null,
      errorMessage: message,
    };
  }
}

