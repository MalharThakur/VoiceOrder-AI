import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Customer, Product } from '../db/daos';

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
  totalCost: number;
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "YOUR_API_KEY_HERE";

export const processVoiceOrder = async (
  audioUri: string,
  customers: Customer[],
  products: Product[]
): Promise<GeminiOrderResult | null> => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
    throw new Error("Gemini API Key is missing! Please set EXPO_PUBLIC_GEMINI_API_KEY.");
  }

  try {
    // 1. Prepare base64 audio
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: 'base64',
    });

    // 2. Prepare customers and products lists
    const customerList = customers.slice(0, 1000).map(c => `ID:${c.id}, Name:${c.name}`).join("\n");
    const productList = products.slice(0, 1000).map(p => `ID:${p.id}, Name:${p.name}`).join("\n");

    const prompt = `
        Extract logistics order details from this audio file. Map customer and product names to the database options lists provided below.

        CUSTOMERS:
        ${customerList}

        PRODUCTS:
        ${productList}

        Look for an order request. Find the matching customer and items. Return exact matching ID values or null if not directly matching.
    `;

    const systemInstr = `
        You are a highly-accurate logistics transcribing AI assistant. Your goal is to parse user voice orders and map them to the database lists provided.

        RULES:
        1. Match Customer: Find the customer in the provided list. Return their exact database ID in "customerId". Also return the spoken/typed name in "detectedCustomerName".
        2. Match Products: Map product names to the closest semantic database products list. Ensure "productId" is the exact matched ID from the PRODUCTS list.
        3. Be strict with quantities: Match the exact number of units mentioned.
        4. No Hallucinations: If a customer or product does not match anything in the provided lists, still return the "detectedCustomerName" and "detectedProductName" values as text, with "customerId" or "productId" as null, so that the client-side fuzzy matcher can handle them. Try your absolute best to extract any words spoken in the audio even if they do not exactly match products.
    `;

    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "audio/mp4", // Adjust depending on Expo AV recording format
                data: base64Audio
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          { text: systemInstr }
        ]
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        responseSchema: {
          type: "OBJECT",
          properties: {
            customerId: { type: "INTEGER" },
            detectedCustomerName: { type: "STRING" },
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  detectedProductName: { type: "STRING" },
                  quantity: { type: "INTEGER" },
                  productId: { type: "INTEGER" },
                  suggestedProductIds: {
                    type: "ARRAY",
                    items: { type: "INTEGER" }
                  }
                },
                required: ["detectedProductName", "quantity"]
              }
            }
          }
        }
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0) return null;

    const contentObj = candidates[0].content;
    if (!contentObj || !contentObj.parts || contentObj.parts.length === 0) return null;

    const text = contentObj.parts[0].text;

    // Cost calculation
    const usageMetadata = response.data.usageMetadata || {};
    const promptTokenCount = usageMetadata.promptTokenCount || 0;
    const candidatesTokenCount = usageMetadata.candidatesTokenCount || 0;
    const totalCost = (promptTokenCount * 0.000000075) + (candidatesTokenCount * 0.0000003);

    // Parse Response
    const orderJson = JSON.parse(text);

    const itemsList: GeminiOrderItem[] = (orderJson.items || []).map((item: any) => ({
      detectedProductName: item.detectedProductName || "",
      quantity: item.quantity || 1,
      productId: item.productId || null,
      suggestedProductIds: item.suggestedProductIds || []
    }));

    return {
      customerId: orderJson.customerId || null,
      detectedCustomerName: orderJson.detectedCustomerName || null,
      items: itemsList,
      totalCost: totalCost
    };

  } catch (error) {
    console.error("Error during voice order processing", error);
    throw error;
  }
};
