import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';

/**
 * Strict JSON schema for Investor Q&A & Due Diligence Simulator.
 */
const simulatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: 'The prioritized set of 10-15 deck-specific diligence questions.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: {
            type: Type.STRING,
            description: 'The sharp, deck-specific pressure-testing question.',
          },
          category: {
            type: Type.STRING,
            enum: [
              'problem',
              'customer_icp',
              'solution',
              'product',
              'traction',
              'revenue',
              'growth',
              'retention',
              'business_model',
              'unit_economics',
              'go_to_market',
              'market',
              'competition',
              'differentiation',
              'defensibility',
              'technology',
              'team',
              'fundraising',
              'use_of_funds',
              'risk',
              'execution',
              'other',
            ],
          },
          priority: {
            type: Type.STRING,
            enum: ['CRITICAL', 'HIGH', 'MEDIUM'],
          },
          questionType: {
            type: Type.STRING,
            enum: [
              'CLARIFICATION',
              'EVIDENCE',
              'MECHANISM',
              'ECONOMICS',
              'SCALABILITY',
              'COMPETITIVE',
              'RISK',
              'EXECUTION',
              'TRACTION',
              'FUNDRAISING',
              'FOLLOW_UP',
            ],
          },
          whyInvestorAsks: {
            type: Type.STRING,
            description: 'Specific explanation of why this question arises from this deck.',
          },
          trigger: {
            type: Type.OBJECT,
            properties: {
              relatedDimension: { type: Type.STRING },
              relatedClaimIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              relatedDiagnosticIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              slideNumbers: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              triggerSummary: { type: Type.STRING },
            },
            required: ['relatedClaimIds', 'relatedDiagnosticIds', 'slideNumbers', 'triggerSummary'],
          },
          currentAnswerability: {
            type: Type.STRING,
            enum: [
              'WELL_SUPPORTED',
              'PARTIALLY_SUPPORTED',
              'WEAKLY_SUPPORTED',
              'UNANSWERED',
              'CONTRADICTORY',
            ],
          },
          availableEvidence: {
            type: Type.ARRAY,
            description: 'Specific evidence already present in the deck supporting the answer.',
            items: {
              type: Type.OBJECT,
              properties: {
                slideNumber: { type: Type.INTEGER },
                statement: { type: Type.STRING },
                source: {
                  type: Type.STRING,
                  enum: ['native_pdf', 'visual_model', 'inferred'],
                },
              },
              required: ['slideNumber', 'statement', 'source'],
            },
          },
          missingInformation: {
            type: Type.ARRAY,
            description: 'What key data or facts are missing from the deck to fully answer.',
            items: { type: Type.STRING },
          },
          preparationGuidance: {
            type: Type.STRING,
            description: 'Concise advice on what a strong founder answer needs to establish.',
          },
          groundedAnswer: {
            type: Type.STRING,
            description:
              'A draft answer constructed ONLY from existing deck evidence, or stating "Current deck evidence is insufficient to construct a reliable answer."',
          },
          likelyFollowUps: {
            type: Type.ARRAY,
            description: 'Up to 2 logical follow-up questions an investor would ask next.',
            items: { type: Type.STRING },
          },
          confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
          },
        },
        required: [
          'id',
          'question',
          'category',
          'priority',
          'questionType',
          'whyInvestorAsks',
          'trigger',
          'currentAnswerability',
          'availableEvidence',
          'missingInformation',
          'preparationGuidance',
          'likelyFollowUps',
          'confidence',
        ],
      },
    },
  },
  required: ['questions'],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'GEMINI_API_KEY is not configured on the server.',
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { profile, claims, diagnostics, evaluation, selectedTriggers, stage, evaluationContext } = body;

    const declaredStage = evaluationContext?.declaredStage?.normalizedStage || stage || profile?.fundraising?.currentStage?.rawValue || 'unknown';
    const observedMaturity = evaluationContext?.observedMaturity?.value || 'unknown';
    const archetype = evaluationContext?.businessModel?.primaryArchetype || 'unknown';

    if (!profile && (!claims || claims.length === 0)) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Missing required startup profile or claims data.',
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a Partner at a tier-1 Venture Capital fund preparing for an upcoming partner meeting or due diligence call with a founder.

CORE ROLE:
Generate specific, penetrating due diligence questions tailored directly to this startup's pitch deck context.

STRICT INSTRUCTIONS:
1. GROUNDED SPECIFICITY:
   - Ask questions that reference the exact numbers, claims, and product mechanics from this specific deck.
2. GROUNDED EVIDENCE ONLY:
   - For 'availableEvidence', cite ONLY statements and slide numbers that exist in the provided profile/claims.
   - For 'groundedAnswer', construct a response using ONLY verified deck evidence.
   - If evidence is insufficient, set groundedAnswer to: "Current deck evidence is insufficient to construct a reliable answer." DO NOT invent company metrics, revenue, customers, or technology.
3. CURRENT ANSWERABILITY:
   - WELL_SUPPORTED: Deck contains a clear, backed answer.
   - PARTIALLY_SUPPORTED: Partial evidence exists, but crucial details are omitted.
   - WEAKLY_SUPPORTED: Only ungrounded assertions exist.
   - UNANSWERED: The necessary information is completely missing from the deck.
   - CONTRADICTORY: Conflicting statements exist across slides.
4. CONTEXT & MATURITY ADAPTATION:
   - Declared Stage: "${declaredStage}"
   - Observed Operating Maturity: "${observedMaturity}"
   - Business Model Archetype: "${archetype}"
   - Pre-product / concept validation: Focus on customer pain severity, early pilot proof, founder wedge, and customer validation. Do NOT demand NRR or Series A metrics.
   - Emerging repeatability / scaling: Scrutinize unit economics, sales repeatability, retention cohorts, pipeline conversion, and scalability.
   - Marketplace archetype: Focus on supply/demand liquidity, take rate, and repeat transactions.
   - Developer tools archetype: Focus on developer adoption, API call volume, and SDK conversion.
5. FOLLOW-UP QUESTIONS:
   - Include at most 2 logical, high-impact follow-ups per primary question.
6. QUANTITY:
   - Produce between 10 and 15 prioritized questions (CRITICAL, HIGH, MEDIUM). Do not output low-priority filler questions.`;

    const userPrompt = `Here is the comprehensive analytical stack for the startup deck:

### STARTUP PROFILE SUMMARY:
- Company: ${profile?.identity?.companyName?.rawValue || 'Unknown'}
- Tagline: ${profile?.identity?.tagline?.rawValue || 'None'}
- Stage: ${profile?.fundraising?.currentStage?.rawValue || 'Unspecified'}
- Ask: ${profile?.fundraising?.amountBeingRaised?.rawValue || 'Unstated'}
- Problem: ${profile?.problemSolution?.problemStatement?.rawValue || 'Unstated'}
- Solution: ${profile?.problemSolution?.productDescription?.rawValue || 'Unstated'}
- Customer ICP: ${profile?.customerICP?.customerType?.rawValue || 'Unstated'}
- Business Model: ${profile?.businessModel?.revenueModel?.rawValue || 'Unstated'}
- Traction Metrics: Revenue=${profile?.traction?.revenue?.rawValue || 'None'}, ARR=${profile?.traction?.ARR?.rawValue || 'None'}, Customers=${profile?.traction?.customerCount?.rawValue || 'None'}, Growth=${profile?.traction?.growthRates?.rawValue || 'None'}
- GTM Motion: ${profile?.goToMarket?.salesMotion?.rawValue || 'Unstated'}, Channels=${profile?.goToMarket?.acquisitionChannels?.rawValue || 'Unstated'}
- Market Size (TAM): ${profile?.market?.TAM?.rawValue || 'Unstated'}
- Competitors: ${profile?.competition?.namedCompetitors?.rawValue || 'None'}
- Founders: ${profile?.team?.founders?.map((f: { name: string; role?: string }) => `${f.name} (${f.role || 'Founder'})`).join(', ') || 'Unspecified'}

### HIGH-VALUE TRIGGERS IDENTIFIED FOR THIS DECK:
${JSON.stringify(selectedTriggers || [], null, 2)}

### CONTRADICTIONS & EVIDENCE GAPS (DIAGNOSTICS):
- Contradictions: ${JSON.stringify(diagnostics?.contradictions || [], null, 2)}
- Evidence Gaps: ${JSON.stringify(diagnostics?.evidenceGaps || [], null, 2)}
- Missing Information: ${JSON.stringify(diagnostics?.missingInformation || [], null, 2)}

### EVALUATION DIMENSIONS & GAPS:
${JSON.stringify(
  (evaluation?.dimensions || []).map((d: { dimensionName: string; status: string; finding: string; weaknessType?: string }) => ({
    name: d.dimensionName,
    status: d.status,
    finding: d.finding,
    weakness: d.weaknessType,
  })),
  null,
  2
)}

### TOP RECENT OBJECTIONS:
${JSON.stringify(evaluation?.investorObjections || [], null, 2)}

Produce the 10-15 prioritized, deck-grounded investor diligence questions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: simulatorSchema,
        temperature: 0.2,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini API returned an empty response.');
    }

    const parsedData = JSON.parse(responseText);

    return NextResponse.json({
      status: 'success',
      data: parsedData,
    });
  } catch (error) {
    console.error('Error generating investor simulation questions:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error during question simulation',
      },
      { status: 500 }
    );
  }
}

