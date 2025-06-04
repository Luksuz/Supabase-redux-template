import { NextRequest, NextResponse } from "next/server";
import { createModelInstance } from "../../../lib/utils/model-factory";
import { getModelById } from "../../../types/models";
import { THEME_OPTIONS } from "../../../lib/features/scripts/scriptsSlice";
import OpenAI from 'openai';
import { readFileSync } from "fs";
import { join } from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { 
      sections, 
      title, 
      emotionalTone, 
      targetAudience, 
      forbiddenWords,
      selectedModel,
      uploadedStyle,
      themeId,
      cta
    } = await request.json();
    
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: "Sections array is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not found" },
        { status: 500 }
      );
    }

    // Use uploaded style if available, otherwise read the feeder script style file
    let styleContent: string;
    
    if (uploadedStyle && uploadedStyle.trim().length > 0) {
      styleContent = uploadedStyle;
      console.log('📄 Using uploaded style guide for detailed script generation');
    } else {
      const stylePath = join(process.cwd(), 'lib', 'data', 'feeder_script_style.txt');
      styleContent = readFileSync(stylePath, 'utf-8');
      console.log('📄 Using default feeder script style for detailed script generation');
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

    const modelId = selectedModel || 'gpt-4o-mini';
    const modelConfig = getModelById(modelId);
    
    console.log(`🚀 Generating detailed script for ${sections.length} sections in parallel: "${title}" using ${modelConfig?.name || modelId}`);
    if (emotionalTone) console.log(`🎭 Emotional tone: ${emotionalTone}`);
    if (targetAudience) console.log(`👥 Target audience: ${targetAudience}`);
    if (forbiddenWords) console.log(`🚫 Forbidden words: ${forbiddenWords}`);
    if (selectedTheme) console.log(`🎨 Theme: ${selectedTheme.name}`);
    if (cta?.enabled) console.log(`📢 CTA enabled: ${cta.type} at ${cta.placement} words`);

    // Generate detailed content for all sections in parallel
    const sectionPromises = sections.map(async (section: any, index: number) => {
      try {
        console.log(`📝 Starting generation for section ${index + 1}/${sections.length}: "${section.title}"`);
        
        const prompt = `You are writing section ${index + 1} of ${sections.length} for a compelling video script titled "${title}".

SECTION TITLE: "${section.title}"
WRITING INSTRUCTIONS: ${section.writingInstructions}

OVERALL STYLE TO MAINTAIN:
${styleContent}

${themeInstructions}
${emotionalTone ? `EMOTIONAL TONE: Ensure the content matches this tone: ${emotionalTone}` : ''}
${targetAudience ? `TARGET AUDIENCE: Write specifically for: ${targetAudience}` : ''}
${forbiddenWords ? `FORBIDDEN WORDS: Avoid using any of these words: ${forbiddenWords}` : ''}

Write this section following the provided writing instructions in greatest detail possible. The content should:
- Follow the style guide provided above
- Use "you" and "your" to address the viewer directly
- Build on the previous sections (this is section ${index + 1} of ${sections.length})
- Transition smoothly into the next section if not the last section
- Use strong, declarative sentences and rhetorical questions
- Include specific examples and analogies where appropriate
${emotionalTone ? `- Maintain the ${emotionalTone} emotional tone throughout` : ''}
${targetAudience ? `- Speak directly to ${targetAudience} with relevant examples and language` : ''}

${forbiddenWords ? `IMPORTANT: Do not use any of these forbidden words: ${forbiddenWords}` : ''}

Write ONLY the script content for this section. Do not include stage directions, titles, or meta-commentary.`;

        let detailedContent: string;

        // Use LangChain for Anthropic models, direct OpenAI for OpenAI models
        if (modelConfig?.provider === 'anthropic') {
          // Use LangChain for Anthropic models
          const model = createModelInstance(modelId, 0.7);
          const response = await model.invoke(prompt);
          detailedContent = response.content as string;
        } else {
          // Use direct OpenAI client for better compatibility
          const response = await openai.chat.completions.create({
            model: modelId,
            messages: [
              {
                role: "system",
                content: "You are an expert script writer specializing in persuasive, direct, and revelatory content that awakens awareness in viewers."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 2000,
            temperature: 0.7,
          });

          detailedContent = response.choices[0]?.message?.content?.trim() || '';
        }
        
        if (!detailedContent) {
          throw new Error(`No content generated for section: ${section.title}`);
        }

        const wordCount = detailedContent.split(/\s+/).filter(word => word.length > 0).length;
        console.log(`✅ Completed section ${index + 1}/${sections.length}: "${section.title}" (${wordCount} words)`);

        return {
          ...section,
          detailedContent,
          wordCount,
          error: false
        };

      } catch (error) {
        console.error(`❌ Error generating section ${index + 1}:`, error);
        return {
          ...section,
          detailedContent: `[Error generating content for this section: ${(error as Error).message}]`,
          wordCount: 0,
          error: true
        };
      }
    });

    // Wait for all sections to complete in parallel
    console.log(`⏳ Processing ${sections.length} sections in parallel...`);
    const detailedSections = await Promise.all(sectionPromises);

    // Concatenate all sections into a complete script
    const fullScript = detailedSections
      .filter(section => !section.error)
      .map(section => section.detailedContent)
      .join('\n\n');

    const totalWords = detailedSections.reduce((sum, section) => sum + section.wordCount, 0);
    const successfulSections = detailedSections.filter(s => !s.error).length;
    const failedSections = detailedSections.filter(s => s.error).length;

    console.log(`✅ Generated complete script in parallel: ${totalWords} words across ${detailedSections.length} sections`);
    console.log(`📊 Success: ${successfulSections}/${detailedSections.length} sections generated successfully`);

    return NextResponse.json({
      success: true,
      detailedSections,
      fullScript,
      meta: {
        title,
        totalSections: detailedSections.length,
        totalWords,
        successfulSections,
        failedSections,
        processingMode: 'parallel',
        theme: selectedTheme ? {
          id: selectedTheme.id,
          name: selectedTheme.name
        } : null,
        cta: cta?.enabled ? {
          enabled: true,
          type: cta.type,
          placement: cta.placement
        } : { enabled: false }
      }
    });

  } catch (error) {
    console.error('Error generating detailed script:', error);
    return NextResponse.json(
      { error: 'Failed to generate detailed script: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 