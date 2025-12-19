import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const GOOGLE_FILE_SEARCH_STORE_ID = Deno.env.get('GOOGLE_FILE_SEARCH_STORE_ID');

    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'GOOGLE_API_KEY is not configured' }),
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

    // Build the request for Google Gemini API with file search tool
    const fileSearchStoreName = GOOGLE_FILE_SEARCH_STORE_ID.startsWith('fileSearchStores/')
      ? GOOGLE_FILE_SEARCH_STORE_ID
      : `fileSearchStores/${GOOGLE_FILE_SEARCH_STORE_ID}`;

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
            text: `You are a helpful learning assistant. You MUST answer questions ONLY based on the documents available in your file search store. 
            
Rules:
1. Search the documents to find relevant information before answering.
2. If the answer cannot be found in the documents, respond EXACTLY with: "I don't know based on the uploaded materials."
3. When you find relevant information, provide a clear and helpful answer.
4. Always cite the specific sources you used.
5. Do not make up information or use knowledge outside of the documents.`
          }
        ]
      },
      generation_config: {
        temperature: 0.3,
        max_output_tokens: 2048
      }
    };

    console.log('Sending request to Gemini API...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
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

    // Parse the response
    let answer = "I don't know based on the uploaded materials.";
    const citations: Citation[] = [];

    // Extract answer text from candidates[0].content.parts[0].text
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      answer = data.candidates[0].content.parts[0].text;
    }

    // Extract citations from grounding_metadata.grounding_chunks[].retrieved_context
    if (data.candidates?.[0]?.grounding_metadata?.grounding_chunks) {
      for (const chunk of data.candidates[0].grounding_metadata.grounding_chunks) {
        if (chunk.retrieved_context) {
          citations.push({
            title: chunk.retrieved_context.title || 'Document',
            uri: chunk.retrieved_context.uri || '',
            text: chunk.retrieved_context.text || undefined,
          });
        }
      }
    }

    // Also check for grounding_supports which may contain additional context
    if (data.candidates?.[0]?.grounding_metadata?.grounding_supports) {
      console.log('Found grounding supports:', data.candidates[0].grounding_metadata.grounding_supports.length);
    }

    console.log('Answer extracted, citations found:', citations.length);

    const chatResponse: ChatResponse = {
      answer,
      citations,
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