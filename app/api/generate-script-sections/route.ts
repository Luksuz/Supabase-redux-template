import { NextRequest, NextResponse } from "next/server";
import { StructuredOutputParser } from "langchain/output_parsers";
import { scriptSectionsSchema } from "../../../types/script-section";
import { createModelInstance } from "../../../lib/utils/model-factory";
import { THEME_OPTIONS } from "../../../lib/features/scripts/scriptsSlice";
import { readFileSync } from "fs";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const { 
      title, 
      wordCount, 
      themeId, 
      additionalPrompt,
      emotionalTone,
      targetAudience,
      forbiddenWords,
      selectedModel,
      uploadedStyle,
      cta
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
    const avgWordsPerSection = Math.round(wordCount / numSections);

    // Determine which section should contain the CTA based on placement
    let ctaSectionIndex = -1;
    if (cta?.enabled && cta?.placement > 0) {
      // Calculate which section the CTA placement falls into
      ctaSectionIndex = Math.floor(cta.placement / avgWordsPerSection);
      // Ensure it's within bounds
      ctaSectionIndex = Math.min(ctaSectionIndex, numSections - 1);
      console.log(`📢 CTA placement: ${cta.placement} words -> Section ${ctaSectionIndex + 1}/${numSections}`);
    }

    // Define CTA instructions based on type
    const getCTAInstructions = (type: string) => {
      switch (type) {
        case 'newsletter':
          return `
IMPORTANT CTA REQUIREMENT: You must incorporate a short CTA to our newsletter called "Insights Academy" (make it clear that it is a free newsletter) where we share more hidden knowledge exclusively. Frame the CTA as if some things are too confidential to share on YouTube (so they are more likely to sign up). Mention that the viewer will receive a free ebook copy of "The Kybalion" (hermetic book) upon signing up for a limited time only (this is not a reward). The viewer must go to the link in the description and enter their email to receive the e-book. This CTA must be incorporated smoothly and in flow with the script around it and can only be 2 sentences max. It must be short, sharp and concise so that viewers won't click off or skip. The CTA must use persuasive sales writing and sound as if some things can't be shared on YouTube, but you must come up with your own that suits the current section. It must be positioned in a way so viewers cannot afford to lose this opportunity to not sign up. Make sure you seamlessly flow into this CTA from the previous paragraph and into the next.`;
        
        case 'engagement':
          return `
IMPORTANT CTA REQUIREMENT: You must incorporate this engagement CTA smoothly into the content: "If this video resonated with you, let us know by commenting, 'I understood it.'" This should feel natural and be integrated seamlessly with the surrounding content. Make it feel like a genuine request for engagement rather than a forced call-to-action.`;
        
        default:
          return '';
      }
    };

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

    // Get theme instructions if theme is selected
    const selectedTheme = themeId ? THEME_OPTIONS.find(t => t.id === themeId) : null;
    const themeInstructions = selectedTheme ? `
THEME INSTRUCTIONS - ${selectedTheme.name}:
Hook Strategy: ${selectedTheme.instructions.hook}
Tone Requirements: ${selectedTheme.instructions.tone}
Clarity & Accessibility: ${selectedTheme.instructions.clarity}
Narrative Flow: ${selectedTheme.instructions.narrativeFlow}
Balancing Elements: ${selectedTheme.instructions.balance}
Engagement Devices: ${selectedTheme.instructions.engagement}
Format Requirements: ${selectedTheme.instructions.format}
Overall Direction: ${selectedTheme.instructions.overall}
` : '';

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

${themeInstructions}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${forbiddenWords ? `FORBIDDEN WORDS (avoid these): ${forbiddenWords}` : ''}
${additionalPrompt ? `ADDITIONAL INSTRUCTIONS: ${additionalPrompt}` : ''}

${cta?.enabled ? `
CTA PLACEMENT REQUIREMENT:
- Section ${ctaSectionIndex + 1} of ${numSections} must include the following CTA instructions in its writing instructions:
${getCTAInstructions(cta.type)}
- All other sections should focus purely on content delivery without any CTAs.
` : ''}

For each section, provide:
1. A compelling title that captures the essence of that part of the script
2. Detailed writing instructions that specify the emotional tone, key points to cover, rhetorical devices to use, and how it fits into the overall narrative arc${cta?.enabled && ctaSectionIndex >= 0 ? ` (Section ${ctaSectionIndex + 1} must include the CTA requirements specified above)` : ''}
3. A visual prompt for image generation that describes the scene, mood, and visual elements that would complement this section (avoid controversial or taboo topics)

The sections should build upon each other to create a cohesive, persuasive narrative that follows the style guide's direct, accusatory, urgent, and revelatory tone. Each section should be approximately ${avgWordsPerSection} words.

${forbiddenWords ? `IMPORTANT: Avoid using any of these forbidden words: ${forbiddenWords}` : ''}

${parser.getFormatInstructions()}`;

    console.log(`🚀 Generating ${numSections} script sections for: "${title}"`);
    if (emotionalTone) console.log(`🎭 Emotional tone: ${emotionalTone}`);
    if (targetAudience) console.log(`👥 Target audience: ${targetAudience}`);
    if (forbiddenWords) console.log(`🚫 Forbidden words: ${forbiddenWords}`);
    if (selectedTheme) console.log(`🎨 Theme: ${selectedTheme.name}`);
    if (cta?.enabled) console.log(`📢 CTA enabled: ${cta.type} at ${cta.placement} words (Section ${ctaSectionIndex + 1})`);

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
        avgWordsPerSection,
        theme: selectedTheme ? {
          id: selectedTheme.id,
          name: selectedTheme.name
        } : null,
        cta: cta?.enabled ? {
          enabled: true,
          type: cta.type,
          placement: cta.placement,
          sectionIndex: ctaSectionIndex + 1
        } : { enabled: false }
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