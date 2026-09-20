import { CompanyEvaluationContext } from '@/types/evaluation-context';
import { EvaluationExpectations } from '@/lib/deck/evaluation-expectations';

/**
 * Pure, strongly-typed formatter that converts CompanyEvaluationContext into a clean string for AI prompts.
 * Prevents context contract drift by enforcing compile-time property checks against canonical CompanyEvaluationContext.
 */
export function formatCompanyEvaluationContextForPrompt(
  context: CompanyEvaluationContext | null | undefined
): string {
  if (!context) {
    return 'No evaluation context available.';
  }

  const rawStage = context.declaredStage?.rawDeclaredStage || 'unspecified';
  const normStage = context.declaredStage?.normalizedStage || 'unknown';
  const observedMaturity = context.observedMaturity?.value || 'unknown';
  const maturityConfidence = context.observedMaturity?.confidence || 'low';
  
  const primaryArchetype = context.businessModel?.primaryArchetype || 'unknown';
  const technologyCategory = context.businessModel?.technologyCategory || 'unknown';
  const archetypeConfidence = context.businessModel?.confidence || 'low';

  const customerModel = context.customerSalesMotion?.customerModel || 'unknown';
  const salesMotion = context.customerSalesMotion?.salesMotion || 'unknown';

  const capitalIntensity = context.capitalRegulatory?.capitalIntensity || 'unknown';
  const regulatoryIntensity = context.capitalRegulatory?.regulatoryIntensity || 'unknown';

  const revMaturity = context.functionalMaturity?.revenueMaturity || 'unknown';
  const tracMaturity = context.functionalMaturity?.tractionMaturity || 'unknown';
  const distMaturity = context.functionalMaturity?.distributionMaturity || 'unknown';
  const prodMaturity = context.functionalMaturity?.productMaturity || 'unknown';

  const warningsStr =
    context.contextWarnings && context.contextWarnings.length > 0
      ? context.contextWarnings.map((w) => `[${w.severity.toUpperCase()}] ${w.message}`).join('; ')
      : 'None';

  return [
    `Declared Stage: ${normStage} (raw: "${rawStage}")`,
    `Observed Operating Maturity: ${observedMaturity} (confidence: ${maturityConfidence})`,
    `Economic Business Model Archetype: ${primaryArchetype} (confidence: ${archetypeConfidence})`,
    `Technology Category: ${technologyCategory}`,
    `Customer ICP Model: ${customerModel}`,
    `Sales / Go-To-Market Motion: ${salesMotion}`,
    `Capital Intensity: ${capitalIntensity}`,
    `Regulatory Intensity: ${regulatoryIntensity}`,
    `Functional Maturity: Revenue=${revMaturity}, Traction=${tracMaturity}, Distribution=${distMaturity}, Product=${prodMaturity}`,
    `Context Warnings: ${warningsStr}`,
  ].join('\n');
}

/**
 * Pure, strongly-typed formatter that converts EvaluationExpectations into a clean string for AI prompts.
 * Exposes dimension-level expectation statuses and rationales for downstream analytical reasoning.
 */
export function formatEvaluationExpectationsForPrompt(
  expectations: EvaluationExpectations | null | undefined
): string {
  if (!expectations || !expectations.expectations) {
    return 'No expectation policy provided.';
  }

  const entries = Object.values(expectations.expectations);
  if (entries.length === 0) {
    return 'No dimension expectations defined.';
  }

  const lines = entries.map(
    (exp) => `- ${exp.dimension}: ${exp.status} (${exp.rationale})`
  );

  return lines.join('\n');
}
