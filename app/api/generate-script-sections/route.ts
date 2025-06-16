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
      ctas,
      inspirationalTranscript,
      regenerateSection,
      researchData,
      generateQuote
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

    // Handle multiple CTAs
    const activeCTAs = ctas && Array.isArray(ctas) ? ctas.filter((c: any) => c.enabled) : (cta?.enabled ? [cta] : []);
    
    // Determine which sections should contain CTAs
    const ctaSectionIndices: number[] = [];
    activeCTAs.forEach((ctaItem: any) => {
      let ctaSectionIndex = -1;
      if (ctaItem.placement === 'beginning') {
        ctaSectionIndex = 0;
      } else if (ctaItem.placement === 'middle') {
        ctaSectionIndex = Math.floor(numSections / 2);
      } else if (ctaItem.placement === 'end') {
        ctaSectionIndex = numSections - 1;
      } else if (ctaItem.placement === 'custom' && ctaItem.customPosition !== undefined) {
        ctaSectionIndex = Math.min(ctaItem.customPosition, numSections - 1);
      }
      
      if (ctaSectionIndex >= 0) {
        ctaSectionIndices.push(ctaSectionIndex);
      }
    });

    console.log(`📢 CTA placements: sections ${ctaSectionIndices.join(', ')} of ${numSections} total`);

    // Get theme instructions if theme is selected (moved up for quote generation)
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

    // Generate quote if requested
    let generatedQuote = null;
    if (generateQuote) {
      console.log('📜 Generating relevant quote...');
      try {
        const quoteModel = createModelInstance(selectedModel || 'gpt-4o-mini', 0.7);
        const quotePrompt = `Generate a powerful, relevant quote for a video about "${title}". 

Requirements:
- Must be from a real, credible figure (philosopher, scientist, author, historical figure, etc.)
- Should be directly relevant to the topic and theme
- Must be inspiring, thought-provoking, or wisdom-filled
- Verify the quote is authentic and properly attributed

${themeInstructions ? `Theme context: ${themeInstructions}` : ''}
${researchData ? `Research context: ${JSON.stringify(researchData).substring(0, 500)}...` : ''}

Return ONLY the quote text and author in this exact format:
"Quote text here" - Author Name`;

        const quoteResponse = await quoteModel.invoke(quotePrompt);
        let quoteContent = "";
        if (typeof quoteResponse.content === 'string') {
          quoteContent = quoteResponse.content;
        } else if (Array.isArray(quoteResponse.content)) {
          quoteContent = quoteResponse.content
            .map(item => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null && 'text' in item && typeof item.text === 'string') return item.text;
              return '';
            })
            .join('\n');
        }

        // Parse quote and author
        const quoteMatch = quoteContent.match(/"([^"]+)"\s*-\s*(.+)/);
        if (quoteMatch) {
          generatedQuote = {
            text: quoteMatch[1].trim(),
            author: quoteMatch[2].trim()
          };
          console.log(`✅ Generated quote: "${generatedQuote.text}" - ${generatedQuote.author}`);
        }
      } catch (quoteError) {
        console.error('❌ Quote generation failed:', quoteError);
        // Continue without quote if generation fails
      }
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
      if (cta?.enabled && ctaSectionIndices.includes(startSection)) {
        batchCtaSectionIndex = ctaSectionIndices.indexOf(startSection);
      }

      // Create the batch prompt
      const batchPrompt = `You are a professional script writer creating compelling, authentic video content. Based on the provided title and style guide, create ${batchSize} sections (sections ${startSection + 1} to ${endSection}) for a ${wordCount}-word script.

TITLE: "${title}"
CURRENT BATCH: Sections ${startSection + 1} to ${endSection} of ${numSections} total sections
BATCH SIZE: ${batchSize}

STYLE GUIDE TO FOLLOW:
${styleContent}

${themeInstructions}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}

${researchData ? `
RESEARCH INSIGHTS TO INCORPORATE:
Use the following research data to create more detailed, informative, and engaging content:

Research Analysis: ${JSON.stringify(researchData.analysis || {}, null, 2)}
Key Search Results: ${researchData.searchResults ? researchData.searchResults.slice(0, 5).map((result: any) => `- ${result.title}: ${result.description}`).join('\n') : 'No search results available'}

IMPORTANT: Use this research to:
- Add specific facts, statistics, or insights to make sections more authoritative
- Include relevant examples or case studies mentioned in the research
- Reference current trends or popular discussions around the topic
- Make each section more detailed and value-packed for viewers
- Ensure content is backed by research-driven insights
` : ''}

${forbiddenWords ? `FORBIDDEN WORDS (avoid these): ${forbiddenWords}` : ''}
${additionalInstructions}
${contextInstructions}

${activeCTAs.length > 0 && ctaSectionIndices.some(idx => idx >= startSection && idx < endSection) ? `
CTA PLACEMENT REQUIREMENTS:
${activeCTAs.map((ctaItem: any, ctaIndex: number) => {
  const ctaSectionIndex = ctaSectionIndices[ctaIndex];
  if (ctaSectionIndex >= startSection && ctaSectionIndex < endSection) {
    const batchPosition = ctaSectionIndex - startSection + 1;
    return `- Section ${batchPosition} of this batch (overall section ${ctaSectionIndex + 1}) must include the following CTA:
${getCTAInstructions(ctaItem.type)}${ctaItem.type === 'custom' && ctaItem.content ? `\nCustom CTA Content: ${ctaItem.content}` : ''}`;
  }
  return '';
}).filter(Boolean).join('\n')}
- All other sections should focus purely on content delivery without any CTAs.
` : ''}

CRITICAL WRITING REQUIREMENTS:
Create sections that sound natural and authentic when spoken aloud. Each section should:
- Provide genuine value through well-researched information and specific examples
- Use conversational language that flows naturally when spoken
- Build arguments through logical progression, not repetitive shock tactics
- Include specific, verifiable information when making claims
- Avoid repetitive catchphrases or formulaic language patterns
- Respect the audience's intelligence and build complexity gradually
- Connect individual experiences to larger patterns or principles

SECTION DETAIL REQUIREMENTS:
Each section must be comprehensive and valuable. The writing instructions should specify:
- Clear emotional tone and authentic engagement strategies
- Specific key points, facts, or insights to cover (use research data when available)
- Natural rhetorical devices and persuasion techniques
- How this section connects to and builds upon previous sections
- Smooth transition strategies to maintain narrative flow
- Specific examples, analogies, or relatable scenarios to include
- Target word count and natural pacing guidelines
- Any special emphasis or delivery requirements

For each section, provide:
1. A compelling, descriptive title that captures the essence and value of that part of the script
2. Detailed writing instructions (minimum 100 words per section) that specify:
   - The authentic emotional journey the viewer should experience
   - Specific content points to cover with supporting details from research
   - Natural rhetorical techniques and engagement strategies to use
   - How this section fits into the overall narrative arc and connects to other sections
   - Smooth transition elements to maintain natural flow
   - Any special emphasis, pacing, or delivery notes
3. A detailed visual prompt for image generation that describes the scene, mood, lighting, composition, and visual elements that would complement this section (avoid controversial or taboo topics)

The sections should build upon each other to create a cohesive, engaging narrative that follows the style guide while maintaining authenticity. Each section should be approximately ${avgWordsPerSection} words and packed with genuine value for the viewer.

INTRODUCTION SECTION REQUIREMENT:
If this batch includes the first section (introduction), ensure it is limited to 160 words maximum to avoid being too lengthy while still being engaging and hook-focused.

QUALITY STANDARDS:
- Provide specific, verifiable information when making claims
- Explain not just what happens, but why it happens and how it works
- Include actionable insights or practical applications
- Maintain respect for your audience's intelligence throughout
- Create content that educates, engages, and empowers rather than manipulates
- Avoid overly dramatic declarations that sound artificial
- Focus on building trust through transparency and valuable insights

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
      quote: generatedQuote,
      meta: {
        title,
        wordCount,
        numSections,
        avgWordsPerSection,
        theme: selectedTheme ? {
          id: selectedTheme.id,
          name: selectedTheme.name
        } : null,
        ctas: activeCTAs.length > 0 ? {
          enabled: true,
          count: activeCTAs.length,
          placements: ctaSectionIndices.map(idx => idx + 1),
          types: activeCTAs.map((cta: any) => cta.type)
        } : { enabled: false },
        quote: generatedQuote ? {
          generated: true,
          text: generatedQuote.text,
          author: generatedQuote.author
        } : { generated: false },
        researchUsed: !!researchData,
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

// Create new file for Option 1: Title only outline generation 