import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REFUSAL_MESSAGE = "Information not found in materials.";

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
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use GEMINI_API_KEY as specified, fallback to GOOGLE_API_KEY for compatibility
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
    const GOOGLE_FILE_SEARCH_STORE_ID = Deno.env.get('GOOGLE_FILE_SEARCH_STORE_ID');

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!GOOGLE_FILE_SEARCH_STORE_ID) {
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
    console.log('Using file search store:', GOOGLE_FILE_SEARCH_STORE_ID);

    // Build file_search_store_names as a list per spec
    const fileSearchStoreName = GOOGLE_FILE_SEARCH_STORE_ID.startsWith('fileSearchStores/')
      ? GOOGLE_FILE_SEARCH_STORE_ID
      : `fileSearchStores/${GOOGLE_FILE_SEARCH_STORE_ID}`;

    // Request body with strict RAG settings: temperature=0, top_k=10
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
      tools: [
        {
          file_search: {
            file_search_store_names: [fileSearchStoreName]
          }
        }
      ],
      system_instruction: {
        parts: [
          {
            text: `You are a strict PDF-only learning assistant. You MUST answer questions ONLY based on the PDF documents in your file search store.

CRITICAL RULES:
1. Search the PDF documents to find relevant information before answering.
2. ONLY use information explicitly stated in the PDF documents.
3. Do NOT use any general knowledge or information outside of the PDF documents.
4. If the answer cannot be found in the PDF documents, you must indicate this clearly.
5. When you find relevant information, provide a clear and helpful answer with specific details from the documents.
6. Always be precise and cite specific information from the sources.`
          }
        ]
      },
      generation_config: {
        temperature: 0,
        top_k: 10,
        max_output_tokens: 2048
      }
    };

    console.log('Sending request to Gemini API with strict RAG settings...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Gemini response received');
    console.log('Full response:', JSON.stringify(data, null, 2));

    // STRICT ENFORCEMENT: Check grounding_chunks first
    const groundingChunks = data.candidates?.[0]?.grounding_metadata?.grounding_chunks;
    const hasGrounding = groundingChunks && Array.isArray(groundingChunks) && groundingChunks.length > 0;

    console.log('Grounding check - hasGrounding:', hasGrounding);
    console.log('Grounding chunks count:', groundingChunks?.length || 0);

    // If no grounding, return refusal message - DISCARD model's generated text
    if (!hasGrounding) {
      console.log('NO GROUNDING FOUND - returning refusal message');
      const chatResponse: ChatResponse = {
        answer: REFUSAL_MESSAGE,
        citations: [],
        verified: false,
      };
      return new Response(
        JSON.stringify(chatResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract answer text from candidates[0].content.parts[0].text
    let answer = REFUSAL_MESSAGE;
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      answer = data.candidates[0].content.parts[0].text;
    }

    // Extract citations from grounding_chunks[].retrieved_context
    const citations: Citation[] = [];
    for (const chunk of groundingChunks) {
      if (chunk.retrieved_context) {
        citations.push({
          title: chunk.retrieved_context.title || 'PDF Document',
          uri: chunk.retrieved_context.uri || '',
          text: chunk.retrieved_context.text || undefined,
        });
      }
    }

    console.log('Answer extracted, citations found:', citations.length);
    console.log('Response verified from PDF sources');

    const chatResponse: ChatResponse = {
      answer,
      citations,
      verified: true,
    };

    return new Response(
      JSON.stringify(chatResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});