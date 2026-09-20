import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';

/**
 * Strict JSON schema for Actionable Founder Recommendations.
 */
const recommendationsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recommendations: {
      type: Type.ARRAY,
      description: 'Prioritized founder recommendations ordered by execution necessity.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          priority: {
            type: Type.STRING,
            enum: ['CRITICAL', 'HIGH', 'POLISH'],
          },
          category: {
            type: Type.STRING,
            description: 'Topic category: traction, business_model, market, gtm, competition, narrative, ask, team, or problem.',
          },
          title: {
            type: Type.STRING,
            description: 'Concise, action-oriented title describing what to change.',
          },
          problem: {
            type: Type.STRING,
            description: 'What is currently weak, missing, contradictory, or poorly structured.',
          },
          whyItMatters: {
            type: Type.STRING,
            description: 'Why an investor cares and how it impacts understanding or credibility.',
          },
          actionType: {
            type: Type.STRING,
            enum: [
              'CLARIFY_EXISTING_INFORMATION',
              'ADD_EXISTING_EVIDENCE',
              'REQUEST_FOUNDER_INFORMATION',
              'RESOLVE_CONTRADICTION',
              'RESTRUCTURE_NARRATIVE',
              'STRENGTHEN_EVIDENCE',
              'REMOVE_OR_QUALIFY_CLAIM',
              'IMPROVE_SLIDE_STRUCTURE',
              'CONNECT_LOGIC',
            ],
          },
          targetSlides: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: '1-indexed slide numbers where the changes should be made.',
          },
          isNewSlideOrSection: {
            type: Type.BOOLEAN,
            description: 'True only if a dedicated new slide or section is required because combining creates overload.',
          },
          relatedClaims: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          relatedDiagnostics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          relatedEvaluationDimensions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          relatedInvestorQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'IDs of investor pressure-test questions that this change directly resolves.',
          },
          existingEvidence: {
            type: Type.ARRAY,
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
            items: { type: Type.STRING },
            description: 'Specific factual items needed from the founder if founderInputRequired is true.',
          },
          founderInputRequired: {
            type: Type.BOOLEAN,
            description: 'True if Arcstone cannot solve this solely from existing evidence in the deck.',
          },
          recommendedAction: {
            type: Type.STRING,
            description: 'Concrete, prescriptive steps the founder should take.',
          },
          suggestedStructure: {
            type: Type.OBJECT,
            description: 'Optional structured outline for the slide.',
            properties: {
              targetSlideNumber: { type: Type.INTEGER },
              slideTitle: { type: Type.STRING },
              headline: { type: Type.STRING },
              supportingMetrics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              supportingContext: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              evidenceSlideReferences: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              placeholders: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          suggestedCopy: {
            type: Type.OBJECT,
            description: 'Optional Before/After copy rewrite grounded strictly in existing evidence.',
            properties: {
              currentText: { type: Type.STRING },
              suggestedText: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['currentText', 'suggestedText', 'explanation'],
          },
          expectedImpact: {
            type: Type.STRING,
            description: 'Qualitative narrative and diligence impact (no probability percentages).',
          },
          blockedByRecommendationIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'IDs of preceding recommendations that must be resolved first (e.g. resolve contradiction before slide rewrite).',
          },
          confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
          },
        },
        required: [
          'id',
          'priority',
          'category',
          'title',
          'problem',
          'whyItMatters',
          'actionType',
          'targetSlides',
          'relatedClaims',
          'relatedDiagnostics',
          'relatedEvaluationDimensions',
          'relatedInvestorQuestions',
          'existingEvidence',
          'missingInformation',
          'founderInputRequired',
          'recommendedAction',
          'expectedImpact',
          'blockedByRecommendationIds',
          'confidence',
        ],
      },
    },
  },
  required: ['recommendations'],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      profile,
      claimMap,
      diagnostics,
      evaluation,
      simulatorResult,
      selectedTriggers,
      totalPages = 10,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY missing on server; returning 503 for fallback.');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are the Lead Partner and Presentation Strategist for Arcstone, an institutional-grade pitch deck review platform.
Your objective is to produce ACTIONABLE FOUNDER RECOMMENDATIONS answering:
"If I have limited time before sending this deck to investors, what should I change first, why does it matter, and what specifically should I do?"

CRITICAL OPERATIONAL RULES:
1. NEVER INVENT COMPANY FACTS OR DATA:
   - Do NOT invent numbers, ARR, customer counts, CAC, LTV, retention %, TAM bottom-up numbers, customer names, or founder credentials.
   - If factual details are missing, explicitly set "founderInputRequired": true and enumerate them in "missingInformation".
   - In suggested copy or slide structures, use explicit placeholders like "[Founder input required: X]" instead of fabricating values.
2. DISTINGUISH FIXABLE VS REQUIRES INPUT:
   - If all needed facts exist in the deck evidence, set "founderInputRequired": false.
   - If new founder information is needed, set "founderInputRequired": true.
3. CONSOLIDATE DUPLICATES:
   - Merge related findings into a single unified recommendation (e.g. TAM derivation + source + methodology should be ONE recommendation: "Substantiate the market-size thesis").
4. CONNECT TO INVESTOR PRESSURE:
   - Reference the provided Investor Simulator questions ("relatedInvestorQuestions") and explain in "whyItMatters" how this recommendation neutralizes high-priority diligence pushback.
5. GROUNDED SUGGESTED COPY:
   - Suggested copy must ONLY weave together verified statements from existing deck evidence.
   - If a claim in the deck is an unsupported superiority claim (e.g. "Europe's fastest platform"), recommend either substantiating it with comparative proof or qualifying/removing it. Do NOT preserve aggressive unsupported claims.
6. DEPENDENCIES & ORDERING:
   - Foundational items (e.g. data contradictions) must be resolved BEFORE subsequent copy rewrites. Reference preceding recommendation IDs in "blockedByRecommendationIds".
7. PRIORITIES:
   - Aim for 3-5 CRITICAL, 3-7 HIGH, and 0-5 POLISH recommendations. Do not force minimum counts if the deck is strong.
8. DO NOT PREDICT FUNDRAISING OUTCOMES:
   - Do NOT say "increases funding probability by 20%". Use qualitative narrative/diligence impact descriptions.`;

    const userPrompt = `Synthesize actionable recommendations for this pitch deck based on the full analytical stack:

TOTAL SLIDES IN DECK: ${totalPages}

STARTUP PROFILE SUMMARY:
Company: ${profile?.identity?.companyName?.rawValue || 'Unknown'}
Stage: ${profile?.fundraising?.currentStage?.rawValue || 'Unknown'}
Ask: ${profile?.fundraising?.amountBeingRaised?.rawValue || 'Unknown'}
Use of Funds: ${profile?.fundraising?.useOfFunds?.rawValue || 'Unknown'}
Problem: ${profile?.problemSolution?.problemStatement?.rawValue || 'Unknown'}
Solution: ${profile?.problemSolution?.productDescription?.rawValue || 'Unknown'}
ICP: ${profile?.customerICP?.customerType?.rawValue || 'Unknown'}
Business Model: ${profile?.businessModel?.revenueModel?.rawValue || 'Unknown'}
Pricing: ${profile?.businessModel?.pricingValues?.rawValue || 'Unknown'}
Traction ARR: ${profile?.traction?.ARR?.rawValue || 'Unknown'}
Traction Customers: ${profile?.traction?.customerCount?.rawValue || 'Unknown'}
Traction Growth: ${profile?.traction?.growthRates?.rawValue || 'Unknown'}
Market TAM: ${profile?.market?.TAM?.rawValue || 'Unknown'}
Differentiation: ${profile?.competition?.differentiationClaims?.rawValue || 'Unknown'}

KEY UPSTREAM DIAGNOSTICS:
Contradictions (${diagnostics?.contradictions?.length || 0}):
${(diagnostics?.contradictions || []).map((c: any) => `- [${c.id}] (Slides ${c.conflictingStatements?.map((s: any) => s.slideNumber).join(', ')}): ${c.description}`).join('\n')}

Evidence Gaps:
${(diagnostics?.evidenceGaps || []).slice(0, 5).map((g: any) => `- [${g.id}] (Slides ${g.slideNumbers?.join(', ')}): ${g.claimText} -> Missing: ${g.missingEvidenceDescription}`).join('\n')}

Missing Info:
${(diagnostics?.missingInformation || []).slice(0, 5).map((m: any) => `- [${m.id}]: ${m.field} (${m.context})`).join('\n')}

FUNDRAISING EVALUATION WEAKNESSES:
${(evaluation?.dimensions || [])
  .filter((d: any) => d.status === 'UNDERDEVELOPED' || d.status === 'MISSING' || d.status === 'CONTRADICTORY')
  .map((d: any) => `- [${d.id}] ${d.dimensionName} (${d.status}, ${d.weaknessType}): ${d.finding}`)
  .join('\n')}

INVESTOR SIMULATOR QUESTIONS (BATCH 4B):
${(simulatorResult?.questions || [])
  .slice(0, 10)
  .map((q: any) => `- [${q.id}] (${q.priority}, ${q.category}, ${q.currentAnswerability}): "${q.question}"`)
  .join('\n')}

TARGET TRIGGERS:
${JSON.stringify(selectedTriggers || {}, null, 2)}

Generate the structured JSON recommendations. Ensure all target slide numbers are between 1 and ${totalPages}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: recommendationsSchema,
        temperature: 0.2,
      },
    });

    const responseText = response.text?.trim() || '{}';
    const parsedData = JSON.parse(responseText);

    return NextResponse.json(parsedData);
  } catch (err: any) {
    console.error('Error in /api/deck/generate-recommendations:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate founder recommendations.' },
      { status: 500 }
    );
  }
}

