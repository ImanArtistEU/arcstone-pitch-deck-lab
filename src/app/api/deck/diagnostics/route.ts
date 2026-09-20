import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';

/**
 * Strict JSON schema for semantic diagnostics extraction.
 */
const diagnosticsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    semanticContradictions: {
      type: Type.ARRAY,
      description: 'Cross-slide contradictions or logical incompatibilities between statements or metrics.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { type: Type.STRING, description: 'e.g. business_model, stage, pricing, customer_target' },
          severity: {
            type: Type.STRING,
            enum: ['critical', 'material', 'minor'],
            description: 'Impact on understanding the core fundraising case',
          },
          description: { type: Type.STRING },
          conflictingStatements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                slideNumber: { type: Type.INTEGER },
                source: { type: Type.STRING, enum: ['native_pdf', 'visual_model', 'both'] },
              },
              required: ['text', 'slideNumber', 'source'],
            },
          },
          whyConflicting: { type: Type.STRING },
          chronologyExplained: {
            type: Type.BOOLEAN,
            description: 'True if explicit dates or chronological progression explain the difference.',
          },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: [
          'id',
          'category',
          'severity',
          'description',
          'conflictingStatements',
          'whyConflicting',
          'chronologyExplained',
          'confidence',
        ],
      },
    },
    ambiguities: {
      type: Type.ARRAY,
      description: 'Statements or metrics that cannot be confidently interpreted due to missing context or qualifiers.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          statement: { type: Type.STRING, description: 'Verbatim ambiguous statement or number' },
          slideNumber: { type: Type.INTEGER },
          severity: {
            type: Type.STRING,
            enum: ['critical', 'material', 'minor'],
          },
          whatIsUnclear: { type: Type.STRING, description: 'What exact context, baseline, or qualifier is missing' },
          possibleInterpretations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Grounded possible meanings based strictly on slide context',
          },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: [
          'id',
          'statement',
          'slideNumber',
          'severity',
          'whatIsUnclear',
          'possibleInterpretations',
          'confidence',
        ],
      },
    },
  },
  required: ['semanticContradictions', 'ambiguities'],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json({
        status: 'skipped',
        message: 'GEMINI_API_KEY environment variable is not configured. Semantic diagnostics skipped.',
      });
    }

    const body = await req.json();
    const { profile, claims, slideEvidence } = body;

    const profileContext = profile
      ? `Startup Identity: ${profile.identity?.companyName?.rawValue || 'Unknown'}
Stage: ${profile.fundraising?.currentStage?.rawValue || 'Unknown'}
Raise: ${profile.fundraising?.amountBeingRaised?.rawValue || 'Unknown'}
ARR: ${profile.traction?.ARR?.rawValue || 'Unknown'}
Customers: ${profile.traction?.customerCount?.rawValue || 'Unknown'}
Customer Type: ${profile.customerICP?.customerType?.rawValue || 'Unknown'}
Business Model: ${profile.businessModel?.revenueModel?.rawValue || 'Unknown'}`
      : 'No profile available.';

    const claimsContext = Array.isArray(claims)
      ? claims
          .map(
            (c: { id: string; slideNumber: number; claimText: string; supportStatus: string; importance: string }) =>
              `[${c.id}] Slide ${c.slideNumber} (${c.importance}, ${c.supportStatus}): "${c.claimText}"`
          )
          .join('\n')
      : 'No claims available.';

    const evidenceContext = Array.isArray(slideEvidence)
      ? slideEvidence.map((s: { pageNumber: number; text: string }) => `Slide ${s.pageNumber}: ${s.text}`).join('\n\n')
      : 'No slide evidence available.';

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a strict, forensic startup analyst identifying factual contradictions and semantic ambiguities in pitch deck evidence.

CRITICAL INSTRUCTIONS:
1. IDENTIFY CROSS-SLIDE CONTRADICTIONS:
   - Statements or metrics that logically clash (e.g. Slide 3 states "selling to SMBs", Slide 8 states "average deal size €120k enterprise contracts").
   - CHRONOLOGY CHECK: If differences reflect chronological progression (e.g. Jan 120 customers vs Mar 147 customers), set chronologyExplained to true.
2. IDENTIFY UNRESOLVED AMBIGUITIES:
   - Important statements or metrics lacking vital qualifiers (e.g. "40% growth" without period or baseline; "€2M" without specifying ARR vs GMV vs round; unqualified "500 customers" without stating active vs paying vs signups).
3. ASSIGN SEVERITY:
   - "critical": Touches foundational factual items (raise amount, core ARR/revenue, customer count, company stage, core product identity).
   - "material": Important to understanding the fundraising case but not foundational identity.
   - "minor": Peripheral detail ambiguity.
4. DO NOT CRITIQUE OR SCORE: Do not advise the founder or recommend changes. Report only objective inconsistencies or missing qualifiers.
5. GROUND ALL FINDINGS IN EVIDENCE: Every finding must reference genuine slide numbers and quotes present in the evidence.`;

    const userPrompt = `Startup Profile Context:
${profileContext}

Claims List:
${claimsContext}

Slide Evidence:
${evidenceContext}

Identify genuine semantic contradictions and ambiguities adhering to the JSON schema.`;

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
        responseSchema: diagnosticsSchema,
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini API returned an empty response for diagnostics.');
    }

    const rawDiagnostics = JSON.parse(responseText);

    return NextResponse.json({
      status: 'success',
      data: rawDiagnostics,
    });
  } catch (err: unknown) {
    console.error('[diagnostics API] Error during diagnostics extraction:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        message: `Diagnostics failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

