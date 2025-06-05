import { NextRequest, NextResponse } from "next/server";
import { StructuredOutputParser } from "langchain/output_parsers";
import { scriptSectionsSchema } from "../../../types/script-section";
import { createModelInstance } from "../../../lib/utils/model-factory";
import { THEME_OPTIONS } from "../../../lib/features/scripts/scriptsSlice";
import { readFileSync } from "fs";
import { join } from "path";
import { ScriptSection } from "../../../types/script-section";

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
      cta,
      inspirationalTranscript,
      regenerateSection
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

    // Build additions to the prompt based on optional parameters
    let additionalInstructions = "";
    
    // Add transcript as inspiration if provided
    if (inspirationalTranscript && inspirationalTranscript.trim()) {
      additionalInstructions += `
    INSPIRATIONAL TRANSCRIPT FOR STYLE REFERENCE ONLY:
    The following transcript should ONLY be used as inspiration for the tone, style, structure, and format of your script.
    DO NOT use the content, topic, or subject matter from this transcript.
    Your script must be about the title "${title}" and theme "${selectedTheme ? selectedTheme.name : 'provided'}", NOT about the topics mentioned in this transcript.
    
    Use this transcript to understand:
    - Writing style and tone
    - Narrative structure and pacing
    - How scenes flow and transition
    - Storytelling techniques and format
    - Dialogue style (if applicable)
    
    TRANSCRIPT FOR STYLE REFERENCE:
    ${inspirationalTranscript.trim()}
    
    IMPORTANT: Create your story about "${title}" using the above transcript's STYLE ONLY, not its content or topic.
    `;
    }
    
    // Add forbidden words if provided
    if (forbiddenWords && forbiddenWords.trim()) {
      const wordsList = forbiddenWords.split(',').map((word: string) => word.trim()).filter(Boolean);
      if (wordsList.length > 0) {
        additionalInstructions += `
    FORBIDDEN WORDS:
    The following words should be completely avoided in your script outline: ${wordsList.join(', ')}.
    `;
      }
    }
    
    // Add any additional custom instructions
    if (additionalPrompt && additionalPrompt.trim()) {
      additionalInstructions += `
    ADDITIONAL INSTRUCTIONS:
    ${additionalPrompt.trim()}
    `;
    }

    // Check if this is a single section regeneration
    if (regenerateSection && regenerateSection.sectionId && regenerateSection.currentTitle) {
      console.log(`🔄 Regenerating single section: "${regenerateSection.currentTitle}"`);
      
      // For single section regeneration, we only generate 1 section
      const singleSectionPrompt = `You are an expert script writer creating a compelling, persuasive video script. Regenerate a single section for a ${wordCount}-word script.

TITLE: "${title}"
CURRENT SECTION TO REGENERATE: "${regenerateSection.currentTitle}"
TOTAL SECTIONS IN SCRIPT: ${numSections}

STYLE GUIDE TO FOLLOW:
${styleContent}

${themeInstructions}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${forbiddenWords ? `FORBIDDEN WORDS (avoid these): ${forbiddenWords}` : ''}
${additionalInstructions}

Create a NEW version of this section with:
1. A compelling title that captures the essence of that part of the script (can be different from the current title)
2. Detailed writing instructions that specify the emotional tone, key points to cover, rhetorical devices to use, and how it fits into the overall narrative arc
3. A visual prompt for image generation that describes the scene, mood, and visual elements that would complement this section (avoid controversial or taboo topics)

The section should be approximately ${avgWordsPerSection} words and follow the style guide's direct, accusatory, urgent, and revelatory tone.

${forbiddenWords ? `IMPORTANT: Avoid using any of these forbidden words: ${forbiddenWords}` : ''}

${parser.getFormatInstructions()}`;

      console.log(`🚀 Regenerating single section: "${regenerateSection.currentTitle}"`);

      // Generate the single section
      const response = await model.invoke(singleSectionPrompt);
      
      // Parse the response
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
        let regeneratedSections: any[] = [];
        
        if (Array.isArray(parsedResponse)) {
          regeneratedSections = parsedResponse;
        } else {
          regeneratedSections = [parsedResponse];
        }

        console.log(`✅ Successfully regenerated section: "${regeneratedSections[0]?.title || 'Untitled'}"`);

        return NextResponse.json({
          success: true,
          sections: regeneratedSections,
          meta: {
            title,
            wordCount,
            numSections: 1,
            avgWordsPerSection,
            theme: selectedTheme ? {
              id: selectedTheme.id,
              name: selectedTheme.name
            } : null,
            regeneration: {
              originalTitle: regenerateSection.currentTitle,
              newTitle: regeneratedSections[0]?.title
            }
          }
        });

      } catch (parseError) {
        console.error(`❌ Failed to parse regenerated section:`, parseError);
        throw parseError;
      }
    }

    // Define batch size for processing
    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(numSections / BATCH_SIZE);
    let allSections: ScriptSection[] = [];
    
    console.log(`Generating ${numSections} sections in ${totalBatches} batch(es) of max ${BATCH_SIZE} each`);

    // Process sections in batches
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startSection = batchIndex * BATCH_SIZE;
      const endSection = Math.min((batchIndex + 1) * BATCH_SIZE, numSections);
      const batchSize = endSection - startSection;
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches}: sections ${startSection + 1} to ${endSection}`);
      
      // Create context from previous sections if this isn't the first batch
      let contextInstructions = "";
      if (batchIndex > 0) {
        // Get the last 3 sections or fewer from the previous batch
        const contextSections = allSections.slice(-3);
        contextInstructions = `
    CONTEXT FROM PREVIOUS SECTIONS:
    Here are the last ${contextSections.length} sections that were already created to maintain continuity:
    ${contextSections.map((section, i) => 
      `Section ${startSection - contextSections.length + i + 1}: "${section.title}"
      Writing Instructions: ${section.writingInstructions.substring(0, 150)}...`
    ).join('\n\n')}

    Ensure that your new sections maintain narrative continuity with these previous sections.
    `;
      }

      // Adjust CTA section index for current batch
      let batchCtaSectionIndex = -1;
      if (cta?.enabled && ctaSectionIndex >= startSection && ctaSectionIndex < endSection) {
        batchCtaSectionIndex = ctaSectionIndex - startSection;
      }

      // Create the batch prompt
      const batchPrompt = `You are an expert script writer creating a compelling, persuasive video script. Based on the provided title and style guide, create ${batchSize} sections (sections ${startSection + 1} to ${endSection}) for a ${wordCount}-word script.

TITLE: "${title}"
CURRENT BATCH: Sections ${startSection + 1} to ${endSection} of ${numSections} total sections
BATCH SIZE: ${batchSize}

STYLE GUIDE TO FOLLOW:
${styleContent}

${themeInstructions}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${forbiddenWords ? `FORBIDDEN WORDS (avoid these): ${forbiddenWords}` : ''}
${additionalInstructions}
${contextInstructions}

${cta?.enabled && batchCtaSectionIndex >= 0 ? `
CTA PLACEMENT REQUIREMENT:
- Section ${batchCtaSectionIndex + 1} of this batch (overall section ${ctaSectionIndex + 1}) must include the following CTA instructions in its writing instructions:
${getCTAInstructions(cta.type)}
- All other sections should focus purely on content delivery without any CTAs.
` : ''}

For each section, provide:
1. A compelling title that captures the essence of that part of the script
2. Detailed writing instructions that specify the emotional tone, key points to cover, rhetorical devices to use, and how it fits into the overall narrative arc${cta?.enabled && batchCtaSectionIndex >= 0 ? ` (Section ${batchCtaSectionIndex + 1} of this batch must include the CTA requirements specified above)` : ''}
3. A visual prompt for image generation that describes the scene, mood, and visual elements that would complement this section (avoid controversial or taboo topics)

The sections should build upon each other to create a cohesive, persuasive narrative that follows the style guide's direct, accusatory, urgent, and revelatory tone. Each section should be approximately ${avgWordsPerSection} words.

${forbiddenWords ? `IMPORTANT: Avoid using any of these forbidden words: ${forbiddenWords}` : ''}

${parser.getFormatInstructions()}`;

      console.log(`🚀 Generating batch ${batchIndex + 1}/${totalBatches}: ${batchSize} sections for: "${title}"`);

      // Generate the batch of sections
      const response = await model.invoke(batchPrompt);
      
      // Parse the response - ensure we get a string
      let contentString = "";
      
      if (typeof response.content === 'string') {
        contentString = response.content;
      } else if (Array.isArray(response.content)) {
        // Extract text from array of complex message contents
        contentString = response.content
          .map(item => {
            if (typeof item === 'string') return item;
            // Handle text content if it's a text content object
            if (typeof item === 'object' && item !== null && 'text' in item && typeof item.text === 'string') return item.text;
            return '';
          })
          .join('\n');
      }
          
      try {
        const parsedBatchResponse = await parser.parse(contentString);
        
        if (Array.isArray(parsedBatchResponse)) {
          console.log(`✅ Successfully generated ${parsedBatchResponse.length} sections for batch ${batchIndex + 1}`);
          allSections = [...allSections, ...parsedBatchResponse];
        } else {
          console.error(`❌ Parser returned non-array response for batch ${batchIndex + 1}:`, parsedBatchResponse);
          throw new Error("Parsing error: Expected array of sections");
        }
      } catch (parseError) {
        console.error(`❌ Failed to parse response for batch ${batchIndex + 1}:`, parseError);
        console.log("Raw content:", contentString.substring(0, 500) + "...");
        throw parseError;
      }
    }

    console.log(`✅ Generated all ${allSections.length} script sections for: "${title}"`);

    return NextResponse.json({
      success: true,
      sections: allSections,
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
        } : { enabled: false },
        batchInfo: {
          totalBatches,
          batchSize: BATCH_SIZE,
          sectionsGenerated: allSections.length
        }
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