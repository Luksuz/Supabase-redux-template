import { ChatAnthropic } from "@langchain/anthropic";
import dotenv from "dotenv";
import { z } from "zod";
import { readFileSync } from "fs";

const scriptSectionsSchema = z.object({
  sections: z.array(z.object({
    title: z.string(),
    writingInstructions: z.string(),
  })),
});

dotenv.config();

const model = new ChatAnthropic({
  model: "claude-3-7-sonnet-20250219",
  temperature: 0,
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxTokens: 40000,
  streaming: true,
});

const prompt = readFileSync("prompt.txt", "utf8");
console.log("Model: ", model.model);

const response = await model.withStructuredOutput(scriptSectionsSchema).invoke(prompt);

console.log(response);