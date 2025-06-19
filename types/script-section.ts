import { z } from "zod";

export const scriptSectionSchema = z.object({
  title: z.string().describe("The title of the script section"),
  writingInstructions: z.string().describe("Detailed instructions for writing this section of the script"),
});

export const scriptSectionsSchema = z.array(scriptSectionSchema)
  .describe("An array of script sections that make up the complete script outline");

// Wrapper schema for function calling (OpenAI requires object schemas)
export const scriptSectionsResponseSchema = z.object({
  sections: scriptSectionsSchema
}).describe("Response containing an array of script sections");

// Define schemas for quote generation
export const scriptAnalysisSchema = z.object({
  primarySubject: z.string().describe("The main subject or topic of the script"),
  keyThemes: z.array(z.string()).describe("2-3 main themes being explored in the script"),
  relevantAuthorities: z.array(z.string()).describe("Specific historical figures, experts, or authorities relevant to this topic"),
  approach: z.string().describe("The philosophical, practical, or methodological approach being taken")
});

export const quoteSchema = z.object({
  text: z.string().describe("The exact text of the quote"),
  author: z.string().describe("The name of the person who said or wrote the quote")
});

export type ScriptSection = z.infer<typeof scriptSectionSchema>;
export type ScriptSections = z.infer<typeof scriptSectionsSchema>; 