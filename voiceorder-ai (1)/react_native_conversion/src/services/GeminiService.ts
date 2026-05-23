import { Customer, Product } from '../database/db';

export interface GeminiOrderItem {
  detectedProductName: string;
  quantity: number;
  productId: number | null;
  suggestedProductIds: number[];
}

export interface GeminiOrderResult {
  customerId: number | null;
  detectedCustomerName: string | null;
  items: GeminiOrderItem[];
  aiCost: number;
}

export class GeminiService {
  private getApiKey(): string {
    // Looks up standard Expo environments, React Native variables, or a preset global placeholder
    const key = (process.env.GEMINI_API_KEY || (global as any).ENV_GEMINI_API_KEY || '').trim();
    return key;
  }

  private async executeWithRetry(
    fetchFn: () => Promise<Response>,
    maxAttempts = 3
  ): Promise<Response> {
    let delayMs = 1500;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetchFn();
        if (response.status === 429) {
          console.warn(`Attempt ${attempt} received HTTP 429 Rate Limit. Retrying in ${delayMs / 1000}s...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2;
            continue;
          }
          throw new Error('The Gemini AI service is currently reaching its request limits. Please wait a few seconds and try speaking or typing again!');
        }
        return response;
      } catch (err: any) {
        lastError = err;
        console.error(`Attempt ${attempt} connection failed:`, err.message || err);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }
      }
    }
    throw lastError || new Error(`Network block failed after ${maxAttempts} attempts.`);
  }

  /**
   * Translates a spoken text prompt into structured order details
   */
  async processTextOrder(
    textPrompt: string,
    customersList: Customer[],
    productsList: Product[]
  ): Promise<GeminiOrderResult | null> {
    const apiKey = this.getApiKey();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error('Gemini API Key is missing! Please configure the GEMINI_API_KEY before running voice/text operations.');
    }

    try {
      const customersPrompt = customersList.slice(0, 1000).map(c => `ID:${c.id}, Name:${c.name}`).join('\n');
      const productsPrompt = productsList.slice(0, 1000).map(p => `ID:${p.id}, Name:${p.name}`).join('\n');

      const userPrompt = `
        Extract order details from the user text: "${textPrompt}"
        
        CUSTOMERS:
        ${customersPrompt}
        
        PRODUCTS:
        ${productsPrompt}

        Your response must map the customer name and items verbatim or semantically to the provided lists above.
        Set "customerId" to the exact matched integer ID from the CUSTOMERS list, and set "detectedCustomerName" to the user's spoken/typed name.
        For each item, identify "detectedProductName" (such as "Sourdough Breads" or "Coffee Beans"), "quantity", "productId" (the matched integer ID from the PRODUCTS list above, or null if no match matches), and "suggestedProductIds" (a list of other potential matching product integer IDs if ambiguous).
      `;

      const systemInstruction = `
        You are a highly-accurate logistics transcribing AI assistant. Your goal is to parse user order requests and map them to the database lists provided.

        RULES:
        1. Match Customer: Find the customer in the provided list. Return their exact database ID in "customerId". Also return the spoken/typed name in "detectedCustomerName".
        2. Match Products: Map product names to the closest semantic database products list. Ensure "productId" is the exact matched ID from the PRODUCTS list.
        3. Be strict with quantities: Match the exact number of units mentioned.
        4. No Hallucinations: If a customer or product does not match anything in the provided lists, still return the "detectedCustomerName" and "detectedProductName" values as text, with "customerId" or "productId" as null, so that the client-side fuzzy matcher can handle them.
      `;

      const payload = {
        contents: [
          {
            parts: [
              { text: userPrompt }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            { text: systemInstruction }
          ]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          responseSchema: {
            type: 'OBJECT',
            properties: {
              customerId: { type: 'INTEGER' },
              detectedCustomerName: { type: 'STRING' },
              items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    detectedProductName: { type: 'STRING' },
                    quantity: { type: 'INTEGER' },
                    productId: { type: 'INTEGER' },
                    suggestedProductIds: {
                      type: 'ARRAY',
                      items: { type: 'INTEGER' }
                    }
                  },
                  required: ['detectedProductName', 'quantity']
                }
              }
            }
          }
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const response = await this.executeWithRetry(() => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }));

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API returned error (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      const candidates = resJson.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('Invalid response from Gemini: No generation candidates found.');
      }

      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new Error('Invalid response from Gemini: Content parts list is empty.');
      }

      const extractedJsonText = content.parts[0].text;
      const orderData = JSON.parse(extractedJsonText);

      // Cost estimation based on standard tokens
      const promptTokens = resJson.usageMetadata?.promptTokenCount || 0;
      const candidatesTokens = resJson.usageMetadata?.candidatesTokenCount || 0;
      const promptCost = promptTokens * 0.000000075;
      const candidateCost = candidatesTokens * 0.0000003;
      const totalCost = promptCost + candidateCost;

      const itemsList: GeminiOrderItem[] = (orderData.items || []).map((item: any) => ({
        detectedProductName: item.detectedProductName || '',
        quantity: item.quantity || 1,
        productId: item.productId || null,
        suggestedProductIds: item.suggestedProductIds || []
      }));

      return {
        customerId: orderData.customerId || null,
        detectedCustomerName: orderData.detectedCustomerName || null,
        items: itemsList,
        aiCost: totalCost
      };

    } catch (err: any) {
      console.error('Gemini text processing exception:', err);
      throw err;
    }
  }

  /**
   * Transcribes standard voice audio file back to English text
   */
  async transcribeAudio(audioBytesBase64: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error('Gemini API Key is missing! Please configure the GEMINI_API_KEY.');
    }

    try {
      const prompt = `
        You are an expert audio transcriber. Listen to the audio and transcribe exactly what is spoken word-for-word.
        Do not summarize, do not translate to another style, and do not add any extra explanations or pleasantries.
        CRITICAL: Only output the text spoken in the audio. If the audio is completely silent or contains absolutely no human speech, respond with exactly "[Silence]". Otherwise, transcribe whatever speech is audible, even if there is background noise, static, or if it is quiet. Try your absolute best to transcribe every legible word.
      `;

      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/mp4',
                  data: audioBytesBase64
                }
              },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.0
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const response = await this.executeWithRetry(() => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }));

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API returned error during voice processing (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      const candidates = resJson.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No transcription results returned.');
      }

      const text = candidates[0].content?.parts?.[0]?.text || '';
      return text.trim();

    } catch (err: any) {
      console.error('Audio transcription exception:', err);
      throw err;
    }
  }
}
export const geminiService = new GeminiService();
