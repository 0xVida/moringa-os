"use server";

export type Intent = "BUILD_APP" | "ON_CHAIN_TX" | "GENERAL_CHAT";

export interface PlannerResponse {
  intent: Intent;
  parameters: Record<string, any>;
}

// We use the 0G Compute Router (OpenAI compatible) for fast server-side inference
export async function classifyIntent(prompt: string): Promise<PlannerResponse> {
  console.log("Planner received prompt:", prompt);

  // Fallback logic if API key isn't provided in the environment yet
  if (!process.env.ZEROG_API_KEY) {
    console.warn("ZEROG_API_KEY not found. Falling back to local keyword routing for testing.");
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes("build") || lowerPrompt.includes("app") || lowerPrompt.includes("generate")) {
      return { intent: "BUILD_APP", parameters: { appDescription: prompt } };
    }
    if (lowerPrompt.includes("swap") || lowerPrompt.includes("send") || lowerPrompt.includes("usdc") || lowerPrompt.includes("eth")) {
      return { intent: "ON_CHAIN_TX", parameters: { rawIntent: prompt } };
    }
    return { intent: "GENERAL_CHAT", parameters: { message: prompt } };
  }

  try {
    const response = await fetch("https://router-api.0g.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ZEROG_API_KEY}`
      },
      body: JSON.stringify({
        model: "zai-org/GLM-5-FP8",
        messages: [
          {
            role: "system",
            content: `You are the core Planner for Moringa AI OS. Classify the user intent into one of three categories: "BUILD_APP", "ON_CHAIN_TX", or "GENERAL_CHAT". 
Extract relevant parameters. 
Respond ONLY with valid JSON in this exact structure: 
{ "intent": "BUILD_APP" | "ON_CHAIN_TX" | "GENERAL_CHAT", "parameters": {} }`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`0G API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    
    return {
      intent: parsed.intent as Intent,
      parameters: parsed.parameters || {}
    };
  } catch (error) {
    console.error("0G Intent Classification Failed:", error);
    // Fallback to general chat if classification fails
    return {
      intent: "GENERAL_CHAT",
      parameters: { message: prompt }
    };
  }
}
