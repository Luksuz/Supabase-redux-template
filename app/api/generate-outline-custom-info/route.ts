import { NextRequest, NextResponse } from "next/server";
import { StructuredOutputParser } from "langchain/output_parsers";
import { createModelInstance } from "../../../lib/utils/model-factory";
import { getModelById } from "../../../types/models";
import { THEME_OPTIONS } from "../../../lib/features/scripts/scriptsSlice";
import { scriptSectionsSchema } from "../../../types/script-section";

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
THEME CONTEXT - ${selectedTheme.name}:
${selectedTheme.description}

Theme Guidelines:
- Hook Strategy: ${selectedTheme.instructions.hook}
- Tone Requirements: ${selectedTheme.instructions.tone}
- Content Focus: ${selectedTheme.instructions.overall}
` : '';

    // Initialize the model and parser
    const model = createModelInstance(modelId, 0.7);
    const parser = StructuredOutputParser.fromZodSchema(scriptSectionsSchema);

    const prompt = `Based on the title: *${title}* and the additional information inputted below (this can be article texts, scripts, outlines etc, any information I want to be in the script) and write an information text/script outline like the example below on what this video can be about. Make sure it's packed with value to the viewer. Make sure it is in a similar writing and format style and use no emoji's as the example text below.

The additional information:

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
    - [Specific point 1]
    - [Specific point 2]
    - [Specific point 3]
    - [Specific point 4]

### **Chapter 2: [Second Section Title]**
- **[Section Focus]**: [What this section addresses]
- **Key Insights**:
    - [Insight 1]
    - [Insight 2]
    - [Insight 3]
    - [Insight 4]

[Continue with up to 20 chapters total, each following similar structure]

## Key Psychological and Philosophical Frameworks
[List the main frameworks, concepts, or approaches that should be incorporated throughout the script based on the additional information]

After creating this comprehensive outline, convert it into the required format with sections that can be used for script generation. Create up to 20 sections based on the information provided.

${parser.getFormatInstructions()}

Focus on creating a narrative flow that makes the information compelling and actionable for the target audience, generating up to 20 comprehensive sections.`;

    console.log(`🚀 Generating custom information outline: "${title}"`);

    const response = await model.invoke(prompt);
    
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