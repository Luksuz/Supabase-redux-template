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
      script,
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

    if (!script || !script.trim()) {
      return NextResponse.json(
        { error: "Script content is required" },
        { status: 400 }
      );
    }

    const modelId = selectedModel || 'gpt-4o-mini';
    const modelConfig = getModelById(modelId);
    
    console.log(`🚀 Extracting outline from script for: "${title}" using ${modelConfig?.name || modelId}`);

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

    const prompt = `Analyse the following script in detail, and write out the outline of the script: ${title}

${script}

${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}
${themeInstructions}
${additionalInstructions ? `ADDITIONAL INSTRUCTIONS: ${additionalInstructions}` : ''}

Provide a detailed analysis and outline that captures:
1. The main structure and flow of the script
2. Key themes and concepts covered
3. Writing style and tone used
4. Important points and insights
5. How each section contributes to the overall message

After your analysis, format the outline as sections that can be used for script generation. Create up to 20 sections based on the script content.

${parser.getFormatInstructions()}

Make sure to capture the essence, flow, and style of the original script while organizing it into clear, actionable sections.`;

    console.log(`🚀 Extracting script outline: "${title}"`);

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

      console.log(`✅ Extracted ${sections.length} sections from script: "${title}"`);

      return NextResponse.json({
        success: true,
        sections: sections,
        meta: {
          title,
          generationType: 'script-extraction',
          originalScriptLength: script.length,
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
    console.error('Error extracting script outline:', error);
    return NextResponse.json(
      { error: 'Failed to extract outline: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 