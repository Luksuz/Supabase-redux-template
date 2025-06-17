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
Type: Title-Only Outline Generation
Filename: ${filename}

${prompt}

=== END OF PROMPT ===`;
    
    writeFileSync(filepath, logContent, 'utf-8');
    console.log(`📝 Title-only outline prompt logged to: ${filepath}`);
  } catch (error) {
    console.error('❌ Failed to log title-only outline prompt:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      title,
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

    const modelId = selectedModel || 'gpt-4o-mini';
    const modelConfig = getModelById(modelId);
    
    console.log(`🚀 Generating title-only outline for: "${title}" using ${modelConfig?.name || modelId}`);

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

    const prompt = `Based on the title: **${title}**

Research the title and write an comprehensive information text/script outline like below on what this video can be about. Make sure it's packed with value to the viewer and provides detailed guidance for script creation.

${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}
${themeInstructions}
${additionalInstructions ? `ADDITIONAL INSTRUCTIONS: ${additionalInstructions}` : ''}

Create a comprehensive script analysis and outline that follows this structure:

## Script Analysis and Outline

## Overall Theme and Structure
[Provide a comprehensive overview of what this video should be about, the main theme, and how it should be structured as a flowing narrative]

## Detailed Information Outline

### **Chapter 1: [Opening Hook/Introduction Title]**
- **Core Concept**: [Main concept for this section]
- **Key Points**:
    - [Specific point 1 with supporting details]
    - [Specific point 2 with examples or evidence]
    - [Specific point 3 with practical applications]
    - [Specific point 4 with expert perspectives]

### **Chapter 2: [Second Section Title]**
- **[Section Focus]**: [What this section addresses in detail]
- **Key Insights**:
    - [Insight 1 with concrete examples]
    - [Insight 2 with historical context]
    - [Insight 3 with practical implications]
    - [Insight 4 with expert validation]

[Continue with up to 20 chapters total, each following similar detailed structure]

## Key Psychological and Philosophical Frameworks
[List the main frameworks, concepts, or approaches that should be incorporated throughout the script with specific applications]

## Expert Perspectives and Supporting Evidence
[Identify key authorities, studies, or sources that should be referenced to build credibility]

## Practical Applications and Takeaways
[Specific actionable insights viewers should gain from each section]

After creating this comprehensive outline, convert it into the required JSON format with sections that can be used for script generation. Each chapter should become a section with DETAILED writing instructions (minimum 200 words each) that include:

- Specific talking points and content to cover
- Concrete examples or case studies to include
- How to open, develop, and conclude the section
- Engagement techniques and rhetorical strategies
- Transition methods to maintain narrative flow
- Emotional pacing and tonal guidance
- Methods for building credibility and authority
- How to connect abstract concepts to practical experience

${parser.getFormatInstructions()}

Make sure each section's writing instructions capture the depth and value outlined in the detailed analysis, provide specific guidance beyond general direction, and create a comprehensive, value-packed video script with up to 20 sections. Each writing instruction should be detailed enough that a script writer could create compelling content without additional research.`;

    console.log(`🚀 Generating title-only outline: "${title}"`);

    const response = await model.invoke(prompt);
    
    // Log the prompt for debugging
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    logPromptToFile(prompt, `title_only_${sanitizedTitle}`, 'outline');

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

      console.log(`✅ Generated ${sections.length} sections for title-only outline: "${title}"`);

      return NextResponse.json({
        success: true,
        sections: sections,
        meta: {
          title,
          generationType: 'title-only',
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
    console.error('Error generating title-only outline:', error);
    return NextResponse.json(
      { error: 'Failed to generate outline: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 