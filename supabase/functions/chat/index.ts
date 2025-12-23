import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.34.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GENERAL_KNOWLEDGE_NOTE = "Based on general AI knowledge (not from uploaded materials).";
const FILE_SEARCH_STORE = "fileSearchStores/scmknowledgebase-nijx1msnlqzm";

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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
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
    console.log('Using file search store:', FILE_SEARCH_STORE);

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
            fileSearchStoreNames: [FILE_SEARCH_STORE]
          }
        }]
      }
    });

    console.log('Gemini response received');
    console.log('Full response:', JSON.stringify(response, null, 2));

    // Check grounding_chunks from response
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks;
    const hasGrounding = groundingChunks && Array.isArray(groundingChunks) && groundingChunks.length > 0;

    console.log('Grounding check - hasGrounding:', hasGrounding);
    console.log('Grounding chunks count:', groundingChunks?.length || 0);

    // Extract answer text
    let answer = "";
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      answer = response.candidates[0].content.parts[0].text;
    }

    // If no grounding, return general knowledge response
    if (!hasGrounding) {
      console.log('NO GROUNDING FOUND - returning general knowledge response');
      const chatResponse: ChatResponse = {
        answer: answer || "I couldn't find relevant information to answer your question.",
        citations: [],
        verified: false,
        debug: `General Knowledge: 0 chunks retrieved for Store ID ${FILE_SEARCH_STORE}`
      };
      return new Response(
        JSON.stringify(chatResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract citations from grounding_chunks (limit to first 4)
    const citations: Citation[] = [];
    const chunksToProcess = groundingChunks.slice(0, 4);
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
