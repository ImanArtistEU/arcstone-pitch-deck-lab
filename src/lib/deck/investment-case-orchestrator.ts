import { StartupProfile } from '@/types/startup';
import { ClaimEvidenceMap } from '@/types/claim';
import { DeckDiagnostics } from '@/types/diagnostics';
import { FundraisingEvaluation } from '@/types/evaluation';
import { InvestmentCase } from '@/types/investment-case';
import { buildCompanyEvaluationContext } from '@/lib/deck/evaluation-context';
import { buildEvaluationExpectations } from '@/lib/deck/evaluation-expectations';
import {
  reconstructInvestmentCase,
  validateAndCleanseInvestmentCase,
} from '@/lib/deck/investment-case-engine';

export interface InvestmentCaseOrchestrationResult {
  status: 'completed' | 'fallback' | 'error';
  investmentCase: InvestmentCase;
  errorMessage?: string;
}

/**
 * Async runtime orchestrator for Investment Case Reconstruction.
 * Invokes the Gemini API layer when available, falls back to conservative
 * deterministic reconstruction when the API fails or is unconfigured.
 */
export async function executeInvestmentCaseReconstruction(
  profile: StartupProfile | null,
  claimMap: ClaimEvidenceMap | null,
  diagnostics: DeckDiagnostics | null,
  evaluation: FundraisingEvaluation | null,
  slideEvidence?: Array<{ slideNumber: number; textContent?: string }> | null,
  fetchFn: typeof fetch = fetch
): Promise<InvestmentCaseOrchestrationResult> {
  const context = buildCompanyEvaluationContext(profile, claimMap, diagnostics);
  const expectations = buildEvaluationExpectations(context);

  try {
    const slideTextEvidence = (slideEvidence || [])
      .filter((s) => s.textContent && s.textContent.trim().length > 0)
      .map((s) => ({
        slideNumber: s.slideNumber,
        textContent: s.textContent?.trim().slice(0, 500) || '',
      }));

    const response = await fetchFn('/api/deck/reconstruct-investment-case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        claimMap,
        diagnostics,
        evaluationContext: context,
        evaluationExpectations: expectations,
        evaluation,
        slideEvidence: slideTextEvidence,
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data.investmentCase) {
      throw new Error('Invalid or empty response from Investment Case API');
    }

    const cleansed = validateAndCleanseInvestmentCase(
      data.investmentCase,
      profile,
      claimMap,
      diagnostics,
      slideTextEvidence
    );

    return {
      status: 'completed',
      investmentCase: cleansed,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown orchestrator error';
    console.warn(`[InvestmentCase Orchestrator] API execution failed (${errMsg}). Switching to fallback.`);

    const fallbackCase = reconstructInvestmentCase(
      profile,
      claimMap,
      diagnostics,
      context,
      expectations,
      slideEvidence
    );

    return {
      status: 'fallback',
      investmentCase: fallbackCase,
      errorMessage: errMsg,
    };
  }
}
