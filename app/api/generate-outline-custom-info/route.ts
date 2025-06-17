import { NextRequest, NextResponse } from "next/server";
import { StructuredOutputParser } from "langchain/output_parsers";
import { createModelInstance } from "../../../lib/utils/model-factory";
import { getModelById } from "../../../types/models";
import { THEME_OPTIONS } from "../../../lib/features/scripts/scriptsSlice";
import { scriptSectionsSchema } from "../../../types/script-section";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// Helper function to log prompts to files
function logPromptToFile(prompt: string, filename: string, type: 'outline' | 'detailed' = 'outline') {
  try {
    const logsDir = join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fullFilename = `${timestamp}_${type}_${filename}.txt`;
    const filepath = join(logsDir, fullFilename);
    
    const logContent = `=== ${type.toUpperCase()} GENERATION PROMPT ===
Generated at: ${new Date().toISOString()}
Type: Custom Info Outline Generation
Filename: ${filename}

${prompt}

=== END OF PROMPT ===`;
    
    writeFileSync(filepath, logContent, 'utf-8');
    console.log(`📝 Custom info outline prompt logged to: ${filepath}`);
  } catch (error) {
    console.error('❌ Failed to log custom info outline prompt:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      title,
      customInformation,
      targetAudience,
      emotionalTone,
      selectedModel,
      themeId,
      additionalInstructions
    } = await request.json();
    
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!customInformation || !customInformation.trim()) {
      return NextResponse.json(
        { error: "Custom information/articles content is required" },
        { status: 400 }
      );
    }

    const modelId = selectedModel || 'gpt-4o-mini';
    const modelConfig = getModelById(modelId);
    
    console.log(`🚀 Generating outline from custom information for: "${title}" using ${modelConfig?.name || modelId}`);

    // Get theme instructions if theme is selected
    const selectedTheme = themeId ? THEME_OPTIONS.find(t => t.id === themeId) : null;
    const themeInstructions = selectedTheme ? `
THEMATIC DIRECTION - ${selectedTheme.name}:
Core Approach: ${selectedTheme.instructions.hook}
Desired Tone: ${selectedTheme.instructions.tone}
Communication Style: ${selectedTheme.instructions.clarity}
Narrative Progression: ${selectedTheme.instructions.narrativeFlow}
Content Balance: ${selectedTheme.instructions.balance}
Audience Connection: ${selectedTheme.instructions.engagement}
Structural Guidelines: ${selectedTheme.instructions.format}
Broader Context: ${selectedTheme.instructions.overall}

CRITICAL: These are thematic guidelines for APPROACH and TONE, not literal phrases to repeat. 
- Use the SPIRIT of these instructions, not the exact wording
- Create detailed writing instructions that embody these principles naturally
- Focus on authentic human communication that follows these thematic guidelines
- Provide specific guidance for how to implement these approaches in each section
` : '';

    // Initialize the model and parser
    const model = createModelInstance(modelId, 0.7);
    const parser = StructuredOutputParser.fromZodSchema(scriptSectionsSchema);

    const prompt = `Based on the title: *${title}* and the additional information provided below, create a comprehensive script outline that transforms this content into compelling video sections.

ADDITIONAL INFORMATION:
*${customInformation}*

${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}
${themeInstructions}
${additionalInstructions ? `ADDITIONAL INSTRUCTIONS: ${additionalInstructions}` : ''}

Create a comprehensive script analysis and outline that follows this structure:

## Script Analysis and Outline

## Overall Theme and Structure
[Provide a comprehensive overview of what this video should be about, the main theme, and how it should be structured as a flowing narrative based on the additional information provided]

## Detailed Information Outline

### **Chapter 1: [Opening Hook/Introduction Title]**
- **Core Concept**: [Main concept for this section]
- **Key Points**:
    - [Specific point 1 with supporting details from the source material]
    - [Specific point 2 with examples or evidence from the content]
    - [Specific point 3 with practical applications derived from the information]
    - [Specific point 4 with expert perspectives or insights from the source]

### **Chapter 2: [Second Section Title]**
- **[Section Focus]**: [What this section addresses in detail]
- **Key Insights**:
    - [Insight 1 with concrete examples from the source material]
    - [Insight 2 with historical context or background]
    - [Insight 3 with practical implications for viewers]
    - [Insight 4 with expert validation or supporting evidence]

[Continue with up to 20 chapters total, each following similar detailed structure]

## Key Psychological and Philosophical Frameworks
[List the main frameworks, concepts, or approaches that should be incorporated throughout the script based on the additional information with specific applications]

## Expert Perspectives and Supporting Evidence
[Identify key authorities, studies, or sources from the provided information that should be referenced to build credibility]

## Practical Applications and Takeaways
[Specific actionable insights viewers should gain from each section based on the source material]

After creating this comprehensive outline, convert it into the required JSON format with sections that can be used for script generation. Each chapter should become a section with DETAILED writing instructions (minimum 200 words each) that include:

- Specific talking points derived from the source material
- Concrete examples or case studies from the provided information
- How to open, develop, and conclude the section effectively
- Engagement techniques and rhetorical strategies appropriate for the content
- Transition methods to maintain narrative flow between related concepts
- Emotional pacing and tonal guidance based on the material's nature
- Methods for building credibility through the source information
- How to connect abstract concepts from the source to practical viewer experience

${parser.getFormatInstructions()}

Focus on creating a narrative flow that makes the provided information compelling and actionable for the target audience. Each writing instruction should be detailed enough that a script writer could create compelling content directly from the source material without additional research. Generate up to 20 comprehensive sections that fully utilize the provided information.`;

    console.log(`🚀 Generating custom information outline: "${title}"`);

    const response = await model.invoke(prompt);
    
    // Log the prompt for debugging
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    logPromptToFile(prompt, `custom_info_${sanitizedTitle}`, 'outline');
    
    let contentString = "";
    if (typeof response.content === 'string') {
      contentString = response.content;
    } else if (Array.isArray(response.content)) {
      contentString = response.content
        .map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null && 'text' in item && typeof item.text === 'string') return item.text;
          return '';
        })
        .join('\n');
    }

    try {
      const parsedResponse = await parser.parse(contentString);
      let sections: any[] = [];
      
      if (Array.isArray(parsedResponse)) {
        sections = parsedResponse;
      } else {
        sections = [parsedResponse];
      }

      console.log(`✅ Generated ${sections.length} sections from custom information: "${title}"`);

      return NextResponse.json({
        success: true,
        sections: sections,
        meta: {
          title,
          generationType: 'custom-information',
          sourceContentLength: customInformation.length,
          theme: selectedTheme ? {
            id: selectedTheme.id,
            name: selectedTheme.name
          } : null
        }
      });

    } catch (parseError) {
      console.error('Failed to parse structured response:', parseError);
      console.log("Raw content:", contentString.substring(0, 500) + "...");
      throw parseError;
    }

  } catch (error) {
    console.error('Error generating custom information outline:', error);
    return NextResponse.json(
      { error: 'Failed to generate outline: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 