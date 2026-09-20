import { NextRequest, NextResponse } from 'next/server';
import { formatCompanyEvaluationContextForPrompt, formatEvaluationExpectationsForPrompt } from '@/lib/deck/prompt-formatter';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import {
  reconstructInvestmentCase,
  validateAndCleanseInvestmentCase,
  buildCanonicalEvidenceCorpusReferences,
} from '@/lib/deck/investment-case-engine';
import {
  InvestmentCase,
  MECHANISM_CATEGORIES,
  ASSUMPTION_IMPORTANCES,
  ASSUMPTION_ORIGINS,
  EVIDENCE_STATUSES,
  EVIDENCE_QUALITY_CLASSES,
  DEPENDENCY_RELATIONSHIPS,
  RISK_CATEGORIES,
  RISK_TYPES,
  RISK_SEVERITIES,
  QUESTION_ANSWERABILITIES,
} from '@/types/investment-case';

/**
 * Strict JSON schema for Investment Case Reconstruction & What-Must-Be-True Engine.
 */
const investmentCaseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    investmentThesis: {
      type: Type.OBJECT,
      properties: {
        problem: { type: Type.STRING },
        targetCustomer: { type: Type.STRING },
        wedge: { type: Type.STRING },
        valueCreation: { type: Type.STRING },
        distribution: { type: Type.STRING },
        monetization: { type: Type.STRING },
        growth: { type: Type.STRING },
        marketExpansion: { type: Type.STRING },
        defensibility: { type: Type.STRING },
        teamAdvantage: { type: Type.STRING },
        capitalPath: { type: Type.STRING },
        summary: { type: Type.STRING },
        statedThesis: { type: Type.STRING },
        reconstructedThesis: { type: Type.STRING },
        sourceEvidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        inferredComponents: { type: Type.ARRAY, items: { type: Type.STRING } },
        unresolvedComponents: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        'problem',
        'targetCustomer',
        'wedge',
        'valueCreation',
        'distribution',
        'monetization',
        'growth',
        'marketExpansion',
        'defensibility',
        'teamAdvantage',
        'capitalPath',
        'summary',
        'statedThesis',
        'reconstructedThesis',
      ],
    },
    mechanisms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: [...MECHANISM_CATEGORIES],
          },
          statement: { type: Type.STRING },
          importance: { type: Type.STRING, enum: [...ASSUMPTION_IMPORTANCES] },
          evidenceStatus: {
            type: Type.STRING,
            enum: [...EVIDENCE_STATUSES],
          },
          supportingClaimIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          supportingSlideNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          supportingFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          supportingEvidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingClaimIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingSlideNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          contradictingEvidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['id', 'category', 'statement', 'importance', 'evidenceStatus'],
      },
    },
    whatMustBeTrue: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          statement: { type: Type.STRING },
          category: { type: Type.STRING },
          importance: { type: Type.STRING, enum: [...ASSUMPTION_IMPORTANCES] },
          assumptionOrigin: { type: Type.STRING, enum: [...ASSUMPTION_ORIGINS] },
          evidenceStatus: {
            type: Type.STRING,
            enum: [...EVIDENCE_STATUSES],
          },
          evidenceQuality: {
            type: Type.STRING,
            enum: [...EVIDENCE_QUALITY_CLASSES],
          },
          supportingClaimIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          supportingSlideNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          supportingFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          supportingEvidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingClaimIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingSlideNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          contradictingEvidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          isThesisBottleneck: { type: Type.BOOLEAN },
          bottleneckReason: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['id', 'statement', 'importance', 'evidenceStatus', 'isThesisBottleneck'],
      },
    },
    dependencies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sourceId: { type: Type.STRING },
          targetId: { type: Type.STRING },
          relationship: {
            type: Type.STRING,
            enum: [...DEPENDENCY_RELATIONSHIPS],
          },
          criticality: { type: Type.STRING, enum: [...ASSUMPTION_IMPORTANCES] },
          explanation: { type: Type.STRING },
        },
        required: ['id', 'sourceId', 'targetId', 'relationship', 'criticality', 'explanation'],
      },
    },
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { type: Type.STRING, enum: [...RISK_CATEGORIES] },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          riskType: {
            type: Type.STRING,
            enum: [...RISK_TYPES],
          },
          whyItMatters: { type: Type.STRING },
          supportingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          supportingEvidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingEvidenceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          relatedAssumptionIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          relatedMechanismIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          severity: { type: Type.STRING, enum: [...RISK_SEVERITIES] },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['id', 'title', 'description', 'whyItMatters', 'severity'],
      },
    },
    contradictions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          topic: { type: Type.STRING },
          statementA: { type: Type.STRING },
          statementB: { type: Type.STRING },
          slideA: { type: Type.INTEGER },
          slideB: { type: Type.INTEGER },
          claimIdA: { type: Type.STRING },
          claimIdB: { type: Type.STRING },
          impact: { type: Type.STRING },
        },
        required: ['id', 'topic', 'statementA', 'statementB', 'impact'],
      },
    },
    unresolvedQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          whyThisMatters: { type: Type.STRING },
          relatedAssumptionIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          relatedMechanismIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          relatedRiskIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          answerability: {
            type: Type.STRING,
            enum: [...QUESTION_ANSWERABILITIES],
          },
        },
        required: ['id', 'question', 'whyThisMatters', 'answerability'],
      },
    },
    caseSummary: {
      type: Type.OBJECT,
      properties: {
        thesisSummary: { type: Type.STRING },
        strongestSupportedMechanisms: { type: Type.ARRAY, items: { type: Type.STRING } },
        mostImportantUnprovenAssumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        thesisBottlenecks: { type: Type.ARRAY, items: { type: Type.STRING } },
        materialRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
        highestLeverageFounderActions: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        'thesisSummary',
        'strongestSupportedMechanisms',
        'mostImportantUnprovenAssumptions',
        'thesisBottlenecks',
        'materialRisks',
        'highestLeverageFounderActions',
      ],
    },
  },
  required: [
    'investmentThesis',
    'mechanisms',
    'whatMustBeTrue',
    'dependencies',
    'risks',
    'contradictions',
    'unresolvedQuestions',
    'caseSummary',
  ],
};

export async function POST(req: NextRequest) {
  let requestBody: any = null;
  try {
    requestBody = await req.json();
    const {
      profile,
      claimMap,
      diagnostics,
      evaluationContext,
      evaluationExpectations,
      evaluation,
      slideEvidence,
    } = requestBody;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      const fallbackCase = reconstructInvestmentCase(
        profile || null,
        claimMap || null,
        diagnostics || null,
        evaluationContext || null,
        evaluationExpectations || null,
        slideEvidence || null
      );

      return NextResponse.json({
        status: 'success',
        fallbackUsed: true,
        investmentCase: fallbackCase,
        data: fallbackCase,
      });
    }

    const evidenceCatalog = buildCanonicalEvidenceCorpusReferences(
      profile || null,
      claimMap || null,
      diagnostics || null,
      slideEvidence || null
    );

    const formattedEvidenceCatalog = `Available Evidence ID Catalog (Cite supportingEvidenceIds / contradictingEvidenceIds from this catalog):
${evidenceCatalog.map((e) => `- ${e.id}: "${e.statement}" (${e.sourceType}${e.slideNumber ? `, Slide ${e.slideNumber}` : ''})`).join('\n')}`;

    const formattedContext = formatCompanyEvaluationContextForPrompt(evaluationContext);
    const formattedExpectations = formatEvaluationExpectationsForPrompt(evaluationExpectations);

    const formattedEvaluation = evaluation
      ? `Fundraising Evaluation Context:
Overall Thesis: ${evaluation.thesisEvaluation?.verdictSummary || 'N/A'}
Key Strengths: ${(evaluation.strongElements || []).map((e: any) => e.title).join('; ')}
Objections: ${(evaluation.investorObjections || []).map((o: any) => o.objection).join('; ')}
Narrative Gaps: ${(evaluation.narrativeGaps || []).map((g: any) => g.description).join('; ')}`
      : 'No prior fundraising evaluation available.';

    const formattedSlideEvidence = Array.isArray(slideEvidence) && slideEvidence.length > 0
      ? `Text-Only Slide Evidence:\n${slideEvidence.map((s: any) => `Slide ${s.slideNumber}: ${s.textContent}`).join('\n')}`
      : 'No raw slide text provided.';

    const systemPrompt = `You are an institutional venture capital partner executing an INVESTMENT CASE RECONSTRUCTION & WHAT-MUST-BE-TRUE UNDERWRITING AUDIT.

CORE MISSION:
Reconstruct the causal investment case an institutional investor is implicitly underwriting.
Determine: "FOR THIS STARTUP TO BECOME A SUCCESSFUL VENTURE-SCALE COMPANY, WHAT MUST BE TRUE?"

CRITICAL CONSTRAINTS & RULES:
1. NO NUMERICAL SCORES (no 85/100, no letter grades).
2. NO FUNDABILITY JUDGMENTS ("fundable", "unfundable", "investment ready", "pass", "fail").
3. NO FUNDING PROBABILITIES or predictions.
4. REASON CAUSALLY: Connect Problem -> Wedge -> GTM -> Monetization -> Retention -> Market Expansion -> Defensibility.
5. RESPECT MATURITY & ARCHETYPE: Use provided Evaluation Context and Expectations. Pre-seed/seed companies naturally have more unproven/not-yet-testable assumptions.
6. EXPLICIT VS IMPLICIT: Distinguish claims made explicitly in the deck from necessary implicit assumptions required by the business model.
7. EVIDENCE CITATION: Populate supportingEvidenceIds and contradictingEvidenceIds strictly using valid IDs from the provided Evidence Catalog.
8. SANITIZE PROHIBITED TERMS: Never include "fundable", "unfundable", "investment ready", "funding probability".`;

    const userPrompt = `Company Evaluation Context:
${formattedContext}

Evaluation Expectations:
${formattedExpectations}

${formattedEvaluation}

Evidence ID Catalog:
${formattedEvidenceCatalog}

Profile Summary:
${JSON.stringify(profile || {}, null, 2)}

Claim Evidence Map:
${JSON.stringify(claimMap?.claims || [], null, 2)}

Diagnostics:
${JSON.stringify(diagnostics || {}, null, 2)}

${formattedSlideEvidence}

Reconstruct the Causal Investment Case according to the JSON schema.`;

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt + '\n\n' + userPrompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: investmentCaseSchema,
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini API returned an empty response for investment case reconstruction.');
    }

    const rawCase: InvestmentCase = JSON.parse(responseText);
    const cleansedCase = validateAndCleanseInvestmentCase(
      rawCase,
      profile || null,
      claimMap || null,
      diagnostics || null,
      slideEvidence || null,
      evaluationContext || null
    );

    return NextResponse.json({
      status: 'success',
      fallbackUsed: false,
      investmentCase: cleansedCase,
      data: cleansedCase,
    });
  } catch (err: unknown) {
    console.error('[reconstruct-investment-case API] Error, utilizing fallback:', err);
    const fallbackCase = reconstructInvestmentCase(
      requestBody?.profile || null,
      requestBody?.claimMap || null,
      requestBody?.diagnostics || null,
      requestBody?.evaluationContext || null,
      requestBody?.evaluationExpectations || null,
      requestBody?.slideEvidence || null
    );

    return NextResponse.json({
      status: 'success',
      fallbackUsed: true,
      error: err instanceof Error ? err.message : String(err),
      investmentCase: fallbackCase,
      data: fallbackCase,
    });
  }
}
