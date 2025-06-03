import { NextRequest, NextResponse } from "next/server";
import { StructuredOutputParser } from "langchain/output_parsers";
import { scriptSectionsSchema } from "../../../types/script-section";
import { createModelInstance } from "../../../lib/utils/model-factory";
import { readFileSync } from "fs";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const { 
      title, 
      wordCount, 
      theme, 
      additionalPrompt,
      emotionalTone,
      targetAudience,
      forbiddenWords,
      selectedModel,
      uploadedStyle
    } = await request.json();
    
    if (!title || !wordCount) {
      return NextResponse.json(
        { error: "Missing required fields: title and wordCount are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not found" },
        { status: 500 }
      );
    }

    // Calculate the number of sections based on word count
    const numSections = Math.max(1, Math.floor(wordCount / 800));

    // Use uploaded style if available, otherwise read the feeder script style file
    let styleContent: string;
    
    if (uploadedStyle && uploadedStyle.trim().length > 0) {
      styleContent = uploadedStyle;
      console.log('📄 Using uploaded style guide');
    } else {
      const stylePath = join(process.cwd(), 'lib', 'data', 'feeder_script_style.txt');
      styleContent = readFileSync(stylePath, 'utf-8');
      console.log('📄 Using default feeder script style');
    }

    // Initialize the model using the factory
    const model = createModelInstance(selectedModel || 'gpt-4o-mini', 0.7);

    // Create a parser based on our Zod schema
    const parser = StructuredOutputParser.fromZodSchema(scriptSectionsSchema);

    // Construct the prompt
    const prompt = `You are an expert script writer creating a compelling, persuasive video script. Based on the provided title and style guide, create ${numSections} sections for a ${wordCount}-word script.

TITLE: "${title}"
NUMBER OF SECTIONS: ${numSections}

STYLE GUIDE TO FOLLOW:
${styleContent}

${theme ? `THEME: ${theme}` : ''}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${forbiddenWords ? `FORBIDDEN WORDS (avoid these): ${forbiddenWords}` : ''}
${additionalPrompt ? `ADDITIONAL INSTRUCTIONS: ${additionalPrompt}` : ''}

For each section, provide:
1. A compelling title that captures the essence of that part of the script
2. Detailed writing instructions that specify the emotional tone, key points to cover, rhetorical devices to use, and how it fits into the overall narrative arc
3. A visual prompt for image generation that describes the scene, mood, and visual elements that would complement this section (avoid controversial or taboo topics)

The sections should build upon each other to create a cohesive, persuasive narrative that follows the style guide's direct, accusatory, urgent, and revelatory tone. Each section should be approximately ${Math.round(wordCount / numSections)} words.

${forbiddenWords ? `IMPORTANT: Avoid using any of these forbidden words: ${forbiddenWords}` : ''}

${parser.getFormatInstructions()}`;

    console.log(`🚀 Generating ${numSections} script sections for: "${title}"`);
    if (emotionalTone) console.log(`🎭 Emotional tone: ${emotionalTone}`);
    if (targetAudience) console.log(`👥 Target audience: ${targetAudience}`);
    if (forbiddenWords) console.log(`🚫 Forbidden words: ${forbiddenWords}`);

    const response = await model.invoke(prompt);
    const parsedSections = await parser.parse(response.content as string);

    console.log(`✅ Generated ${parsedSections.length} script sections for: "${title}"`);

    return NextResponse.json({
      success: true,
      sections: parsedSections,
      meta: {
        title,
        wordCount,
        numSections,
        avgWordsPerSection: Math.round(wordCount / numSections)
      }
    });

  } catch (error) {
    console.error('Error generating script sections:', error);
    return NextResponse.json(
      { error: 'Failed to generate script sections: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 