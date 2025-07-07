"use server";

import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

interface ScriptSection {
  title: string;
  writingInstructions: string;
  image_generation_prompt: string;
}

// Simple function to remove markdown formatting
function removeMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove inline code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .trim();
}

export async function POST(request: Request) {
  try {
    const requestData = await request.json();
    const { 
      title, 
      theme, 
      sections, 
      additionalPrompt, 
      researchContext, 
      forbiddenWords, 
      modelName = "gpt-4o-mini",
      povSelection = "3rd Person",
      scriptFormat = "Story",
      audience = ""
    } = requestData;
    
    console.log("Received request for script generation:");
    console.log("- Title:", title);
    console.log("- Theme:", theme || "Not provided");
    console.log("- POV Selection:", povSelection);
    console.log("- Script Format:", scriptFormat);
    console.log("- Audience:", audience || "Not specified");
    console.log("- Sections:", Array.isArray(sections) ? `${sections.length} sections` : "None");
    console.log("- Additional Prompt:", additionalPrompt ? "Provided" : "None");
    console.log("- Research Context:", researchContext ? "Provided" : "None");
    console.log("- Forbidden Words:", forbiddenWords ? "Provided" : "None");
    console.log("- Model Name:", modelName);
    
    if (!title || !sections || !Array.isArray(sections) || sections.length === 0) {
      console.log("Missing or invalid required fields");
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    // Initialize the model
    let model;
    if (modelName.startsWith('claude')) {
      model = new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: modelName,
        temperature: 0.7,
        maxTokens: 8000,
      });
    } else {
      model = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: modelName,
        temperature: 0.7,
        maxTokens: 8000,
      });
    }
    console.log("Model initialized");

    // Build additional instructions based on optional parameters
    let additionalInstructions = "";
    
    // Add research context if provided
    if (researchContext && researchContext.trim()) {
      additionalInstructions += `
RESEARCH CONTEXT:
The following research insights should be incorporated into your script to ensure it's backed by data and analysis:

${researchContext.trim()}

Use this research to inform the content, themes, and narrative direction of your script.
`;
    }
    
    if (additionalPrompt && additionalPrompt.trim()) {
      additionalInstructions += `
ADDITIONAL INSTRUCTIONS:
${additionalPrompt.trim()}
`;
    }
    
    // Add forbidden words if provided
    if (forbiddenWords && forbiddenWords.trim()) {
      const wordsList = forbiddenWords.split(',').map((word: string) => word.trim()).filter(Boolean);
      if (wordsList.length > 0) {
        additionalInstructions += `
FORBIDDEN WORDS:
The following words should be completely avoided in your script: ${wordsList.join(', ')}.
`;
      }
    }

    // Add reminder about focusing on the title's content, not any reference material
    additionalInstructions += `

CRITICAL CONTENT FOCUS:
Your script must be about "${title}" and the theme "${theme || 'provided'}".
If any inspirational content was used during outline creation, it was ONLY for style reference.
DO NOT include content, topics, or subject matter from any reference material.
Focus exclusively on creating a story about "${title}".
`;

    // Create an async function to process a single section
    const processSection = async (section: ScriptSection, index: number) => {
      try {
        console.log(`Started processing section ${index + 1}: ${section.title}`);
        
        // Create a prompt for this section
        const sectionPrompt = `
You are a professional writer creating a section of a script based on the following outline:

TITLE: ${title}
THEME: ${theme || "No specific theme provided"}
POV: Write in ${povSelection} perspective
FORMAT: This is a ${scriptFormat} format script
${audience ? `TARGET AUDIENCE: ${audience}` : ""}
SECTION ${index + 1} TITLE: ${section.title}
WRITING INSTRUCTIONS: ${section.writingInstructions}
${additionalInstructions}

CRITICAL: Your script must be about "${title}" - create content that directly relates to this title.
If any reference material was mentioned in the writing instructions, use it ONLY for style inspiration, not content.

Based on the WRITING INSTRUCTIONS, generate ONLY the text that is to be spoken aloud by a narrator for this section of the script.
Your response must exclusively contain the narrative and dialogue that will be voiced.

IMPORTANT FORMATTING RULES:
1. Do NOT begin your script with the title, section name, or any form of header/title text.
2. Do NOT include any greetings like "Hi!", "Hello", or similar phrases at the beginning.
3. Start directly with the narrative content - for example, begin with a description of a scene or action.
4. Do NOT repeat the title or section name within the content.
5. Write in ${povSelection} perspective throughout the script.
6. Follow the ${scriptFormat} format conventions while maintaining spoken narrative style.
${audience ? `7. Tailor the language and tone for the target audience: ${audience}.` : ""}

MARKDOWN FORMATTING FOR SPECIAL ELEMENTS:
- When including any Call-to-Action (CTA) text specified in the writing instructions, wrap it in **bold markdown** (e.g., **Subscribe to our channel for more amazing content!**)
- When including any Hook text specified in the writing instructions, wrap it in **bold markdown** (e.g., **What if I told you everything you know is wrong?**)
- Use *italics* for emphasis on important narrative points
- This formatting helps distinguish interactive elements from regular narrative content

CONTENT TO EXCLUDE:
- Any form of title, header, or section name
- Greetings or introductory phrases that aren't part of the narrative
- Scene headings (e.g., "INT. CAFE - DAY")
- Character names before dialogue (unless the narrator is quoting someone like "John said: 'Hello'")
- Parentheticals or action descriptions (e.g., "(smiles)", "[He walks to the window]")
- Any visual descriptions or camera directions
- Any form of commentary or notes about the script itself

The WRITING INSTRUCTIONS already contain guidance on plot, character interactions, thematic elements, and specific Call to Actions (CTAs) that the narrator must say. Your task is to transform these instructions into a polished, narratable script.

Format the spoken text using Markdown where appropriate for emphasis or stylistic representation of speech (e.g., **bold** for emphasis, *italics* for thoughts if narrated).
Maintain a word count of at least 1000 words for this section, consisting purely of speakable text.
Keep sentences short for clarity and impact.
`;

        // Generate content for this section
        const response = await model.invoke(sectionPrompt);
        
        // Carefully extract content ensuring it's valid text
        let sectionContent = "";
      
        if (typeof response.content === 'string') {
          sectionContent = response.content;
        } else if (Array.isArray(response.content)) {
          sectionContent = response.content
            .map(item => {
              if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'text' in item) return item.text;
              return '';
            })
            .join('\n');
        }

        // Validate we actually got content
        if (!sectionContent || sectionContent.trim() === '') {
          console.warn(`Warning: Empty content returned for section ${index + 1}`);
          sectionContent = `[Content for "${section.title}" could not be generated.]`;
        }

        console.log(`✓ Section ${index + 1} processed successfully: ${sectionContent.length} characters`);
        
        // Return the processed section
        return {
          index,
          title: section.title,
          content: sectionContent,
          success: true
        };
        
      } catch (sectionError) {
        console.error(`Error processing section ${index + 1}:`, sectionError);
        
        // Return a placeholder for the failed section
        return {
          index,
          title: section.title,
          content: `[An error occurred while generating content for "${section.title}". Please try again.]`,
          success: false
        };
      }
    };

    // Process all sections concurrently
    console.log(`Starting parallel processing of ${sections.length} sections...`);
    const sectionPromises = sections.map((section, index) => processSection(section, index));
    const results = await Promise.allSettled(sectionPromises);
    
    // Extract results, preserving order and handling any rejected promises
    const processedSections = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Promise rejected for section ${index + 1}:`, result.reason);
        return {
          index,
          title: sections[index].title,
          content: `[Failed to generate content for this section. Please try again.]`,
          success: false
        };
      }
    });
    
    // Sort sections by index to ensure correct order
    processedSections.sort((a, b) => a.index - b.index);
    
    // Log success/failure stats
    const successCount = processedSections.filter(s => s.success).length;
    console.log(`Processing complete: ${successCount}/${sections.length} sections successful`);
    
    // Combine all sections into the full script with markdown headings
    const fullScriptWithMarkdown = processedSections
      .map(section => `## ${section.title}\n\n${section.content}\n\n`)
      .join('');

    const scriptCleaned = removeMarkdown(fullScriptWithMarkdown);
    
    // Calculate word count
    const wordCount = scriptCleaned.split(/\s+/).filter(Boolean).length;
    console.log(`Full script generated successfully with ${wordCount} words`);

    return NextResponse.json({ 
      scriptWithMarkdown: fullScriptWithMarkdown, 
      scriptCleaned: scriptCleaned,
      wordCount
    });
  } catch (error) {
    console.error("Error generating full script:", error);
    return NextResponse.json(
      { error: "Failed to generate full script", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 