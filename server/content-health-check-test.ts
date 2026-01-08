import { invokeLLM } from "./_core/llm";

export async function testHealthCheckSimple() {
  console.log('[testHealthCheckSimple] Starting test...');
  
  const simplifiedSchema = {
    type: "object" as const,
    properties: {
      score: { type: "number" as const },
      feedback: { type: "string" as const },
    },
    required: ["score", "feedback"],
    additionalProperties: false,
  };
  
  try {
    console.log('[testHealthCheckSimple] Calling invokeLLM with json_schema...');
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a helpful assistant that outputs JSON." },
        { role: "user", content: "Rate this text: 'Hello world'. Output JSON with score (0-100) and feedback." }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test_schema",
          strict: true,
          schema: simplifiedSchema,
        },
      },
    });
    
    console.log('[testHealthCheckSimple] Response received');
    console.log('[testHealthCheckSimple] Response has choices:', !!response.choices);
    console.log('[testHealthCheckSimple] Choices length:', response.choices?.length);
    
    if (!response.choices || response.choices.length === 0) {
      console.error('[testHealthCheckSimple] ERROR: No choices in response');
      console.error('[testHealthCheckSimple] Full response:', JSON.stringify(response, null, 2));
      return { error: 'No choices in response' };
    }
    
    const content = response.choices[0].message.content;
    console.log('[testHealthCheckSimple] Content type:', typeof content);
    
    if (typeof content !== 'string') {
      console.error('[testHealthCheckSimple] ERROR: Content is not a string');
      console.error('[testHealthCheckSimple] Content:', content);
      return { error: 'Content is not a string' };
    }
    
    const parsed = JSON.parse(content);
    console.log('[testHealthCheckSimple] Parsed successfully:', parsed);
    
    return { success: true, data: parsed };
  } catch (error) {
    console.error('[testHealthCheckSimple] Error:', error);
    return { error: String(error) };
  }
}

export async function testHealthCheckJsonObject() {
  console.log('[testHealthCheckJsonObject] Starting test with json_object mode...');
  
  try {
    console.log('[testHealthCheckJsonObject] Calling invokeLLM with json_object...');
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a helpful assistant that outputs JSON." },
        { role: "user", content: "Rate this text: 'Hello world'. Output JSON with score (0-100) and feedback." }
      ],
      response_format: {
        type: "json_object",
      },
    });
    
    console.log('[testHealthCheckJsonObject] Response received');
    console.log('[testHealthCheckJsonObject] Choices length:', response.choices?.length);
    
    if (!response.choices || response.choices.length === 0) {
      console.error('[testHealthCheckJsonObject] ERROR: No choices in response');
      return { error: 'No choices in response' };
    }
    
    const content = response.choices[0].message.content;
    
    if (typeof content !== 'string') {
      console.error('[testHealthCheckJsonObject] ERROR: Content is not a string');
      return { error: 'Content is not a string' };
    }
    
    const parsed = JSON.parse(content);
    console.log('[testHealthCheckJsonObject] Parsed successfully:', parsed);
    
    return { success: true, data: parsed };
  } catch (error) {
    console.error('[testHealthCheckJsonObject] Error:', error);
    return { error: String(error) };
  }
}
