import { HybridDeckResult } from '@/types/deck';
import { StartupProfile } from '@/types/startup';

/**
 * Result of startup profile extraction.
 */
export interface ProfileExtractionResult {
  status: 'success' | 'skipped' | 'error';
  profile: StartupProfile | null;
  errorMessage?: string;
}

/**
 * Audit and compile missing fields list from a raw extracted profile object.
 */
function compileMissingFields(rawProfile: Record<string, unknown>): string[] {
  const missing: string[] = [];

  const categoryNames: Record<string, string> = {
    identity: 'Identity',
    fundraising: 'Fundraising',
    problemSolution: 'Problem & Solution',
    customerICP: 'Customer & ICP',
    businessModel: 'Business Model',
    traction: 'Traction',
    goToMarket: 'Go-To-Market',
    market: 'Market Opportunity',
    competition: 'Competition',
    team: 'Team',
    technology: 'Technology',
  };

  Object.entries(categoryNames).forEach(([catKey, catLabel]) => {
    const categoryObj = rawProfile[catKey] as Record<string, { status?: string }> | undefined;
    if (categoryObj && typeof categoryObj === 'object') {
      Object.entries(categoryObj).forEach(([fieldKey, fieldObj]) => {
        if (fieldObj && typeof fieldObj === 'object' && fieldObj.status === 'not_found') {
          // Format field key human-readably (e.g. amountBeingRaised -> Amount Being Raised)
          const fieldLabel = fieldKey
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase());
          missing.push(`${catLabel} · ${fieldLabel}`);
        }
      });
    }
  });

  return missing;
}

/**
 * Extracts a structured StartupProfile from a completed HybridDeckResult.
 * Executes server-side profile analysis without resending slide images.
 * 
 * @param hybridResult Canonical deck extraction result from Phase 2
 * @returns Promise<ProfileExtractionResult>
 */
export async function extractStartupProfile(
  hybridResult: HybridDeckResult
): Promise<ProfileExtractionResult> {
  try {
    const response = await fetch('/api/deck/extract-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slides: hybridResult.slides,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return {
        status: 'error',
        profile: null,
        errorMessage: errJson.message || `Profile API HTTP Error (${response.status})`,
      };
    }

    const result = await response.json();

    if (result.status === 'skipped') {
      return {
        status: 'skipped',
        profile: null,
        errorMessage: result.message,
      };
    }

    if (result.status === 'success' && result.data) {
      const missingFields = compileMissingFields(result.data);
      const profile: StartupProfile = {
        ...result.data,
        missingFields,
        extractedAt: new Date(),
      };

      return {
        status: 'success',
        profile,
      };
    }

    return {
      status: 'error',
      profile: null,
      errorMessage: result.message || 'Unknown error during profile extraction.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      profile: null,
      errorMessage: message,
    };
  }
}

