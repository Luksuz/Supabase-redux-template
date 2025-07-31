import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";

// Zod schema for a single script section
const scriptSectionSchema = z.object({
  title: z.string(),
  writingInstructions: z.string(),
  image_generation_prompt: z.string(),
  narrativeRole: z.string().describe("The role this section plays in the overall story structure"),
  storyArc: z.string().describe("How this section contributes to the complete story arc")
});

interface ScriptSection {
  title: string;
  writingInstructions: string;
  image_generation_prompt: string;
  narrativeRole?: string;
  storyArc?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      sectionIndex,
      totalSections,
      title, 
      theme, 
      additionalPrompt,
      sectionPrompt = "",
      researchContext,
      inspirationalTranscript, 
      forbiddenWords,
      modelName = "gpt-4o-mini",
      povSelection = "3rd Person",
      scriptFormat = "Story",
      audience = "",
      previousSections = [] // Context from previous sections
    } = body;
    
    if (!title || typeof sectionIndex !== 'number' || typeof totalSections !== 'number') {
      return NextResponse.json(
        { error: "Missing required fields: title, sectionIndex, or totalSections" },
        { status: 400 }
      );
    }

    console.log(`🔄 Generating section ${sectionIndex + 1}/${totalSections} for "${title}"`);
    console.log(`📚 Using context from ${previousSections.length} previous sections`);

    // Initialize the model
    let model;
    if (modelName.startsWith('claude')) {
      model = new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: modelName,
        temperature: 0.7,
        maxTokens: 4000,
      });
    } else {
      model = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: modelName,
        temperature: 0.7,
        maxTokens: 4000,
      });
    }

    // Create a parser based on our Zod schema
    const parser = StructuredOutputParser.fromZodSchema(scriptSectionSchema);

    // Build context from previous sections
    let contextInformation = "";
    if (previousSections.length > 0) {
      contextInformation = `
CONTEXT FROM PREVIOUS SECTIONS:
The following sections have already been generated for this story. Use this context to maintain consistency and build upon the established narrative:

`;
      previousSections.forEach((section: ScriptSection, index: number) => {
        contextInformation += `
--- Section ${index + 1}: ${section.title} ---
Role: ${section.narrativeRole || 'Story progression'}
Story Arc: ${section.storyArc || 'Advances the narrative'}
Writing Instructions: ${section.writingInstructions}

`;
      });

      contextInformation += `
IMPORTANT: Maintain consistency with characters, locations, facts, and narrative elements established in the above sections. Continue the story naturally from where the previous sections left off.
`;
    }

    // Build additions to the prompt based on optional parameters
    let additionalInstructions = "";
    
    // Add research context if provided
    if (researchContext && researchContext.trim()) {
      additionalInstructions += `
RESEARCH CONTEXT:
The following research insights should be incorporated into your script to ensure it's backed by data and analysis:

${researchContext.trim()}

Use this research to inform the content, themes, and narrative direction of your script sections.
`;
    }
    
    // Add transcript as inspiration if provided
    if (inspirationalTranscript && inspirationalTranscript.trim()) {
      additionalInstructions += `
INSPIRATIONAL TRANSCRIPT FOR STYLE REFERENCE ONLY:
The following transcript should ONLY be used as inspiration for the tone, style, structure, and format of your script.
DO NOT use the content, topic, or subject matter from this transcript.
Your script must be about the title "${title}" and theme "${theme || 'provided'}", NOT about the topics mentioned in this transcript.

Use this transcript to understand:
- Writing style and tone
- Narrative structure and pacing
- How scenes flow and transition
- Storytelling techniques and format
- Dialogue style (if applicable)

TRANSCRIPT FOR STYLE REFERENCE:
${inspirationalTranscript.slice(0, 3000).trim()}

IMPORTANT: Create your story about "${title}" using the above transcript's STYLE ONLY, not its content or topic.
`;
    }
    
    // Add forbidden words if provided
    if (forbiddenWords && forbiddenWords.trim()) {
      const wordsList = forbiddenWords.split(',').map((word: string) => word.trim()).filter(Boolean);
      if (wordsList.length > 0) {
        additionalInstructions += `
FORBIDDEN WORDS AND PHRASES:
The following words and phrases should be completely avoided in your script outline: ${wordsList.join(', ')}.
Also avoid: "Would you like me to continue", "Let me continue", "Shall I proceed", "Do you want more", and similar interactive prompts.
`;
      }
    }
    
    // Add any section-specific custom instructions
    if (sectionPrompt && sectionPrompt.trim()) {
      additionalInstructions += `
SECTION GENERATION INSTRUCTIONS:
${sectionPrompt.trim()}
`;
    }
    
    // Add any additional custom instructions
    if (additionalPrompt && additionalPrompt.trim()) {
      additionalInstructions += `
ADDITIONAL GENERAL INSTRUCTIONS:
${additionalPrompt.trim()}
`;
    }

    // Determine section role based on position
    let sectionRole = "";
    let sectionPurpose = "";
    
    if (sectionIndex === 0) {
      sectionRole = "Opening/Introduction";
      sectionPurpose = "Establish the premise, characters, and central question/conflict. Create an engaging hook that draws the audience in.";
    } else if (sectionIndex === totalSections - 1) {
      sectionRole = "Conclusion/Resolution";
      sectionPurpose = "Bring the story to a satisfying conclusion. Address the central conflict or question. Provide closure and meaningful takeaways.";
    } else {
      const middlePosition = Math.ceil(totalSections / 2);
      if (sectionIndex < middlePosition) {
        sectionRole = "Development/Building";
        sectionPurpose = "Build tension, explore themes, introduce complications. Advance the narrative from the opening.";
      } else {
        sectionRole = "Climax/Resolution Building";
        sectionPurpose = "Address the central conflict, reveal key insights, and build toward the conclusion.";
      }
    }

    // Create a comprehensive system prompt
    const systemPrompt = `You are a master storyteller and script writer creating section ${sectionIndex + 1} of ${totalSections} for a cohesive narrative. Your task is to create a well-structured section that fits perfectly within the complete story arc.

CRITICAL REQUIREMENTS:
1. Create ONE section that serves a specific narrative purpose
2. Maintain absolute consistency with any previous sections provided
3. Ensure the section naturally flows from what came before
4. Use the same character names, locations, and factual details as established
5. Do not use interactive phrases like "Would you like me to continue"
6. Focus on advancing the story meaningfully
7. Create natural narrative progression toward the story's conclusion

SECTION REQUIREMENTS:
- This is section ${sectionIndex + 1} of ${totalSections}
- Section Role: ${sectionRole}
- Section Purpose: ${sectionPurpose}`;

    const userPrompt = `Create section ${sectionIndex + 1} of ${totalSections} for the story "${title}".

STORY REQUIREMENTS:
- Title: ${title}
- Theme: ${theme || "No specific theme provided"}
- POV: ${povSelection}
- Format: ${scriptFormat}
- Target Audience: ${audience || "General audience"}

SECTION POSITION: ${sectionIndex + 1} of ${totalSections}
SECTION ROLE: ${sectionRole}

${contextInformation}

CONTENT REQUIREMENTS:
- Focus on compelling storytelling and natural narrative flow
- Maintain consistency with established story elements
- Each section should advance the story meaningfully
- Use specific, consistent details that match previous sections
- Create engaging, original content that serves the story
- Ensure this section contributes to the complete story arc

${additionalInstructions}

${parser.getFormatInstructions()}

Create a compelling section that naturally continues the story and serves its designated role in the ${totalSections}-part narrative structure.`;

    try {
      console.log(`🎯 Generating ${sectionRole} section with ${previousSections.length} context sections`);

      // Generate the section
      const result = await model.invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]);

      let resultContent = "";
      if (typeof result.content === 'string') {
        resultContent = result.content;
      } else if (Array.isArray(result.content)) {
        resultContent = result.content
          .map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'text' in item) return item.text;
            return '';
          })
          .join('\n');
      }

      console.log(`📄 Raw LLM result for section ${sectionIndex + 1}:`, resultContent.substring(0, 200) + "...");

      // Parse the result
      const section = await parser.parse(resultContent);
      console.log(`✅ Successfully parsed section ${sectionIndex + 1}: ${section.title}`);

      return NextResponse.json({
        section: section,
        success: true,
        sectionIndex: sectionIndex,
        message: `Generated section ${sectionIndex + 1}/${totalSections}: ${section.title}`
      });

    } catch (error) {
      console.error(`❌ Error generating section ${sectionIndex + 1}:`, error);
      
      // Fallback section if parsing fails
      const fallbackSection = {
        title: `Section ${sectionIndex + 1}`,
        writingInstructions: `Continue the story of "${title}" in this ${sectionRole.toLowerCase()} section. ${sectionPurpose}`,
        image_generation_prompt: `Scene for section ${sectionIndex + 1} of ${title}`,
        narrativeRole: sectionRole,
        storyArc: `Section ${sectionIndex + 1} story progression`
      };

      return NextResponse.json({
        section: fallbackSection,
        success: true,
        sectionIndex: sectionIndex,
        message: `Generated fallback section ${sectionIndex + 1}/${totalSections}`,
        fallback: true
      });
    }

  } catch (error) {
    console.error('❌ Error in sequential section generation route:', error);
    return NextResponse.json(
      { error: 'Failed to generate section: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 