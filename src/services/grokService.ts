/**
 * External route and content generation client.
 * Kept as a lightweight integration for dynamic store features.
 */

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export interface GrokRequestOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: 'json_object' | 'text';
  };
}

export async function callGrokAPI(
  prompt: string,
  options: GrokRequestOptions = {}
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROK_API_KEY || process.env.GROK_API_KEY;

  if (!apiKey) {
    throw new Error('GROK_API_KEY is not configured. Please set it in .env.local');
  }

  const {
    model = 'grok-2-latest',
    temperature = 0.7,
    max_tokens = 1024,
    response_format = { type: 'text' }
  } = options;

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens,
        response_format,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Grok API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Grok API call failed:', error);
    throw error;
  }
}

/**
 * Generate JSON structured response from Grok
 */
export async function callGrokAPIWithJSON<T = any>(
  prompt: string,
  options: GrokRequestOptions = {}
): Promise<T> {
  const responseText = await callGrokAPI(prompt, {
    ...options,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Failed to parse Grok JSON response:', responseText);
    throw new Error('Grok API did not return valid JSON');
  }
}

/**
 * Suggest optimized delivery route coordinates
 */
export async function suggestOptimizedRoute(
  currentLocation: [number, number],
  destination: [number, number]
): Promise<[number, number][]> {
  const prompt = `Given a current location [${currentLocation[0]}, ${currentLocation[1]}] and a destination [${destination[0]}, ${destination[1]}], suggest 5 intermediate coordinates that would form an optimized delivery route avoiding major traffic bottlenecks (simulated). 

Return ONLY a JSON array of coordinate pairs in this exact format:
[[lat1, lng1], [lat2, lng2], [lat3, lng3], [lat4, lng4], [lat5, lng5]]

Do not include any other text or explanation.`;

  const route = await callGrokAPIWithJSON<[number, number][]>(prompt, {
    temperature: 0.3,
    max_tokens: 500,
  });

  return [currentLocation, ...route, destination];
}

/**
 * Generate AI product description and suggestions
 */
export async function generateProductDescription(
  productTitle: string,
  productDescription?: string,
  imageCount: number = 0
): Promise<{
  description: string;
  category: string;
  price: number;
  tags: string[];
}> {
  const categories = [
    "Electronics", "Fashion", "Home & Living", "Groceries",
    "Beauty", "Sports", "Books", "Toys", "Automotive", "Health"
  ];

  const prompt = `Analyze this product ${productTitle ? `titled "${productTitle}"` : ''}.
  ${productDescription ? `Description: ${productDescription}` : ''}
  ${imageCount > 0 ? `(Product has ${imageCount} images)` : ''}
  
  Generate:
  1. A compelling, professional, and SEO-friendly product description (max 150 words).
  2. Suggest the best category from this list: ${categories.join(", ")}.
  3. Suggest a competitive price in Indian Rupees (₹) as a number only (e.g., 1999).
  4. Generate 5 relevant search tags as an array.

  Return ONLY valid JSON in this format:
  {
    "description": "...",
    "category": "...",
    "price": number,
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  }

  Do not include any other text or markdown.`;

  return callGrokAPIWithJSON(prompt, {
    temperature: 0.6,
    max_tokens: 800,
  });
}
