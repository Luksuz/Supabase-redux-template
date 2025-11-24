import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { getModelById } from "../../types/models";

export function createModelInstance(modelId: string, temperature: number = 0.7) {
  const modelConfig = getModelById(modelId);
  console.log('🤖 Model config:', modelConfig);
  
  if (!modelConfig) {
    throw new Error(`Unknown model ID: ${modelId}`);
  }

  if (modelConfig.provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    return new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: modelId,
    });
  } 
  
  if (modelConfig.provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    
    // Check if this is a new Claude model (4.5 series or 4.1)
    const isNewClaudeModel = modelId.includes("4-5") || modelId.includes("4-1") || 
                             modelId === "claude-sonnet-4-5" || 
                             modelId === "claude-haiku-4-5" || 
                             modelId === "claude-opus-4-1";
    
    // New Claude models don't support temperature and top_p parameters
    if (isNewClaudeModel) {
      const model = new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: modelId,
        maxTokens: 8192,
        streaming: true,
      });
      
      // Explicitly remove temperature and top_p properties if they exist
      if ('temperature' in model) {
        delete (model as any).temperature;
      }
      if ('topP' in model) {
        delete (model as any).topP;
      }
      if ('top_p' in model) {
        delete (model as any).top_p;
      }
      
      console.log('✅ Created new Claude model without temperature/top_p parameters');
      return model;
    }
    
    // Older Claude models support temperature
    return new ChatAnthropic({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      modelName: modelId,
      temperature,
      maxTokens: modelId.includes("3-5") ? 8192 : 40000,
      streaming: true,
    });
  }
  
  throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
} 