import { invokeLLM } from './server/_core/llm.js';

async function testSimpleLLM() {
  console.log('Testing simple LLM call without json_schema...');
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello" }
      ],
    });
    
    console.log('Response structure:', {
      hasChoices: !!response.choices,
      choicesLength: response.choices?.length,
      firstChoice: response.choices?.[0],
    });
    
    console.log('Full response:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

await testSimpleLLM();
