import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { getModelById } from "../../types/models";

export function createModelInstance(modelId: string, temperature: number = 0.7) {
  const modelConfig = getModelById(modelId);
  
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
      temperature,
      maxTokens: Math.min(4000, modelConfig.maxTokens), // Limit output tokens for safety
    });
  } 
  
  if (modelConfig.provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    
    return new ChatAnthropic({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      modelName: modelId,
      temperature,
      maxTokens: Math.min(4000, modelConfig.maxTokens), // Limit output tokens for safety
    });
  }
  
  throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
} 