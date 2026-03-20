import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.34.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GENERAL_KNOWLEDGE_NOTE = "Based on general AI knowledge (not from uploaded materials).";

interface Citation {
  title: string;
  uri: string;
  text?: string;
}

interface ChatRequest {
  message: string;
}

interface ChatResponse {
  answer: string;
  citations: Citation[];
  verified: boolean;
  debug: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('LovableRag');
    const FILE_SEARCH_STORE_ID = Deno.env.get('GOOGLE_FILE_SEARCH_STORE_ID');

    if (!GEMINI_API_KEY) {
      console.error('LovableRag API key is not configured');
      return new Response(
        JSON.stringify({ error: 'LovableRag API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!FILE_SEARCH_STORE_ID) {
      console.error('GOOGLE_FILE_SEARCH_STORE_ID is not configured');
      return new Response(
        JSON.stringify({ error: 'GOOGLE_FILE_SEARCH_STORE_ID is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message }: ChatRequest = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing message:', message);
    console.log('Using file search store:', FILE_SEARCH_STORE_ID);

    // Initialize the 2025 SDK
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Generate content with file search tool (JS camelCase)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
      config: {
        systemInstruction: `You are a research assistant using Google File Search. Always query the File Search tool first. Retrieved chunks are optional evidence, not mandatory sources. Use retrieved content ONLY if it directly answers the user's question. If retrieved chunks are loosely related, incomplete, tangential, or do not contain the actual answer, treat this as NO RESULT and ignore the PDFs. In such cases, answer using general knowledge. Do NOT mention, summarize, reference, or quote irrelevant PDF content. Never produce hybrid answers that mix unrelated PDF excerpts with general knowledge. Prioritize correctness and clarity over forced grounding.`,
        temperature: 0,
        topK: 10,
        tools: [{
          fileSearch: {
            fileSearchStoreNames: [FILE_SEARCH_STORE_ID]
          }
        }]
      }
    });

    console.log('Gemini response received');
    console.log('Full response:', JSON.stringify(response, null, 2));

    // Check grounding metadata from response
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks;
    const groundingSupports = groundingMetadata?.groundingSupports;
    
    // Only consider grounded if there are actual supports linking answer to chunks
    const hasActualGrounding = groundingSupports && Array.isArray(groundingSupports) && groundingSupports.length > 0;

    console.log('Grounding check - chunks:', groundingChunks?.length || 0);
    console.log('Grounding check - supports:', groundingSupports?.length || 0);
    console.log('Grounding check - hasActualGrounding:', hasActualGrounding);

    // Extract answer text
    let answer = "";
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      answer = response.candidates[0].content.parts[0].text;
    }

    // Check if the answer indicates PDFs don't contain the requested information
    const answerLower = answer.toLowerCase();
    const noPdfAnswerPatterns = [
      "does not explicitly contain",
      "does not explicitly state",
      "does not explicitly specify",
      "does not contain information",
      "does not mention",
      "does not state",
      "do not explicitly contain",
      "do not explicitly state",
      "do not explicitly specify",
      "do not contain information",
      "do not mention",
      "doesn't explicitly contain",
      "doesn't explicitly state",
      "doesn't explicitly specify",
      "doesn't contain information",
      "doesn't mention",
      "don't explicitly contain",
      "don't explicitly state",
      "don't contain information",
      "don't mention",
      "no specific rule",
      "no rule number",
      "not specified in the provided",
      "not mentioned in the provided",
      "not found in the provided",
      "no information about",
      "no explicit information",
      "cannot find",
      "could not find",
      "unable to find",
      "not available in the provided",
      "not provided in the provided",
      "the pdf does not",
      "the pdfs do not",
      "the document does not contain",
      "the documents do not contain",
      "the materials do not",
      "based on general knowledge",
      "using general knowledge"
    ];
    
    const indicatesNoPdfAnswer = noPdfAnswerPatterns.some(pattern => answerLower.includes(pattern));
    console.log('Answer indicates no PDF answer:', indicatesNoPdfAnswer);

    // Only fall back to general knowledge if BOTH: no grounding supports AND answer text signals no PDF content
    // If Gemini returned real grounding supports, always trust those — don't let text patterns override real grounding
    if (!hasActualGrounding && indicatesNoPdfAnswer) {
      console.log('No grounding supports + answer signals no PDF content - returning general knowledge response');
      const chatResponse: ChatResponse = {
        answer: answer || "I couldn't find relevant information to answer your question.",
        citations: [],
        verified: false,
        debug: 'General Knowledge: No grounding supports and answer indicates PDFs lack info'
      };
      return new Response(
        JSON.stringify(chatResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no grounding at all (and answer doesn't explicitly say PDFs lack info), still return as general knowledge
    if (!hasActualGrounding) {
      console.log('No grounding supports - returning general knowledge response');
      const chatResponse: ChatResponse = {
        answer: answer || "I couldn't find relevant information to answer your question.",
        citations: [],
        verified: false,
        debug: 'General Knowledge: No grounding supports'
      };
      return new Response(
        JSON.stringify(chatResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract citations from grounding_chunks (limit to first 4)
    const citations: Citation[] = [];
    const chunksToProcess = (groundingChunks || []).slice(0, 4);
    for (const chunk of chunksToProcess) {
      if (chunk.retrievedContext) {
        citations.push({
          title: chunk.retrievedContext.title || 'PDF Document',
          uri: chunk.retrievedContext.uri || '',
          text: chunk.retrievedContext.text || undefined,
        });
      }
    }

    console.log('Answer extracted, citations found:', citations.length);

    const chatResponse: ChatResponse = {
      answer,
      citations,
      verified: true,
      debug: `Success: Found ${citations.length} chunks`
    };

    return new Response(
      JSON.stringify(chatResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: `Exception: ${error instanceof Error ? error.message : 'Unknown'}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
