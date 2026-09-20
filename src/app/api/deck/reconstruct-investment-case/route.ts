import { NextRequest, NextResponse } from 'next/server';
import { formatCompanyEvaluationContextForPrompt, formatEvaluationExpectationsForPrompt } from '@/lib/deck/prompt-formatter';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import {
  reconstructInvestmentCase,
  validateAndCleanseInvestmentCase,
} from '@/lib/deck/investment-case-engine';
import { InvestmentCase } from '@/types/investment-case';

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
            enum: [
              'value_creation',
              'customer_acquisition',
              'distribution',
              'monetization',
              'retention',
              'growth',
              'market_expansion',
              'defensibility',
              'capital_efficiency',
              'technical_execution',
              'regulatory',
              'team_execution',
            ],
          },
          statement: { type: Type.STRING },
          importance: { type: Type.STRING, enum: ['critical', 'high', 'medium'] },
          evidenceStatus: {
            type: Type.STRING,
            enum: [
              'supported',
              'partially_supported',
              'asserted_only',
              'unsupported',
              'contradictory',
              'not_yet_testable',
              'not_applicable',
            ],
          },
          supportingClaimIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          supportingSlideNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          supportingFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingClaimIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingSlideNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
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
          importance: { type: Type.STRING, enum: ['critical', 'high', 'medium'] },
          assumptionOrigin: { type: Type.STRING, enum: ['explicit', 'implicit'] },
          evidenceStatus: {
            type: Type.STRING,
            enum: [
              'supported',
              'partially_supported',
              'asserted_only',
              'unsupported',
              'contradictory',
              'not_yet_testable',
              'not_applicable',
            ],
          },
          evidenceQuality: {
            type: Type.STRING,
            enum: [
              'financial_audited',
              'cohort',
              'operational',
              'customer_quoted',
              'technical',
              'market_research',
              'unverified',
            ],
          },
          supportingClaimIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          supportingSlideNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          supportingFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingClaimIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingSlideNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
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
            enum: ['enables', 'requires', 'amplifies', 'conflicts'],
          },
          criticality: { type: Type.STRING, enum: ['critical', 'high', 'medium'] },
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
          category: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          riskType: {
            type: Type.STRING,
            enum: [
              'causal_gap',
              'evidence_gap',
              'contradiction',
              'valuation',
              'concentration',
              'economics',
              'execution',
            ],
          },
          whyItMatters: { type: Type.STRING },
          supportingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          contradictingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          relatedAssumptionIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          relatedMechanismIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          severity: { type: Type.STRING, enum: ['critical', 'material', 'moderate'] },
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
            enum: ['well_supported', 'partially_supported', 'unanswered', 'contradictory'],
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
7. CLAIM STRENGTH != EVIDENCE STRENGTH: Generic assertions ("Huge retention", "$50B TAM") are asserted_only / unsupported. Concrete metrics ("118% NRR across 24 customers") are supported.
8. SANITIZE PROHIBITED TERMS: Never include "fundable", "unfundable", "investment ready", "funding probability".`;

    const userPrompt = `Company Evaluation Context:
${formattedContext}

Evaluation Expectations:
${formattedExpectations}

${formattedEvaluation}

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
      slideEvidence || null
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
