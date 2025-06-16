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
      cta,
      ctas,
      quote,
      researchData
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
    if (quote) console.log(`📜 Quote included: "${quote.text}" - ${quote.author}`);

    // Handle multiple CTAs
    const activeCTAs = ctas && Array.isArray(ctas) ? ctas.filter((c: any) => c.enabled) : (cta?.enabled ? [cta] : []);
    if (activeCTAs.length > 0) {
      console.log(`📢 ${activeCTAs.length} CTAs enabled: ${activeCTAs.map((c: any) => c.type).join(', ')}`);
    }

    // Generate detailed content for all sections in parallel
    const sectionPromises = sections.map(async (section: any, index: number) => {
      try {
        console.log(`📝 Starting generation for section ${index + 1}/${sections.length}: "${section.title}"`);
        
        // Build context from previous sections for coherence
        let contextInstructions = "";
        if (index > 0) {
          const previousSections = sections.slice(Math.max(0, index - 2), index);
          contextInstructions = `
CONTEXT FROM PREVIOUS SECTIONS (for narrative continuity):
${previousSections.map((prevSection: any, prevIndex: number) => 
  `Section ${index - previousSections.length + prevIndex + 1}: "${prevSection.title}"
  Key points covered: ${prevSection.writingInstructions.substring(0, 200)}...`
).join('\n\n')}

IMPORTANT: Build upon these previous sections naturally. Reference concepts, themes, or insights from earlier sections where appropriate to create a cohesive narrative flow.
`;
        }

        // Check if this section should include a CTA
        let ctaInstructions = "";
        const sectionCTAs = activeCTAs.filter((ctaItem: any) => {
          if (ctaItem.placement === 'beginning' && index === 0) return true;
          if (ctaItem.placement === 'middle' && index === Math.floor(sections.length / 2)) return true;
          if (ctaItem.placement === 'end' && index === sections.length - 1) return true;
          if (ctaItem.placement === 'custom' && ctaItem.customPosition === index) return true;
          return false;
        });

        if (sectionCTAs.length > 0) {
          ctaInstructions = `
CTA REQUIREMENTS FOR THIS SECTION:
${sectionCTAs.map((ctaItem: any) => {
  if (ctaItem.type === 'newsletter') {
    return `Include a short CTA to our newsletter called "Insights Academy" (make it clear that it is a free newsletter) where we share more hidden knowledge exclusively. Frame the CTA as if some things are too confidential to share on YouTube. Mention that the viewer will receive a free ebook copy of "The Kybalion" upon signing up for a limited time only. The CTA must be incorporated smoothly and naturally into the content flow and can only be 2 sentences max. Make it persuasive and create urgency.`;
  } else if (ctaItem.type === 'engagement') {
    return `Include this engagement CTA naturally: "If this video resonated with you, let us know by commenting, 'I understood it.'" Integrate it seamlessly with the surrounding content.`;
  } else if (ctaItem.type === 'custom' && ctaItem.content) {
    return `Include this custom CTA naturally: ${ctaItem.content}`;
  }
  return '';
}).filter(Boolean).join('\n')}

CRITICAL: CTAs must be integrated naturally into the content flow. Do NOT use transition phrases like "[TRANSITION TO CTA]" or similar - these will be spoken by the voice-over. Instead, make the CTA feel like a natural part of the narrative. Bold or emphasize the CTA content for visual distinction.
`;
        }

        const prompt = `You are writing section ${index + 1} of ${sections.length} for a compelling video script titled "${title}". Write it in greatest detail possible.

SECTION TITLE: "${section.title}"
WRITING INSTRUCTIONS: ${section.writingInstructions}

${contextInstructions}

STYLE GUIDE TO FOLLOW:
${styleContent}

${themeInstructions}
${emotionalTone ? `EMOTIONAL TONE: Ensure the content matches this tone: ${emotionalTone}` : ''}
${targetAudience ? `TARGET AUDIENCE: Write specifically for: ${targetAudience}` : ''}
${forbiddenWords ? `FORBIDDEN WORDS: Avoid using any of these words: ${forbiddenWords}` : ''}

${researchData ? `
RESEARCH CONTEXT TO INCORPORATE:
Use insights from this research to make your content more detailed and authoritative:
${JSON.stringify(researchData, null, 2).substring(0, 1000)}...

Include specific facts, examples, or insights from the research where relevant to enhance the content's value and credibility.
` : ''}

${ctaInstructions}

CRITICAL WRITING REQUIREMENTS:
- Write ONLY the script content for this section - no stage directions, titles, or meta-commentary
- Create content that sounds natural and authentic when spoken aloud
- Use specific examples, case studies, or relatable scenarios to illustrate your points
- Vary your sentence structure and length to create natural rhythm
- Build your argument through logical progression, not repetitive shock tactics
- Include genuine insights that provide real value to the audience
- Avoid repetitive catchphrases or formulaic language patterns
- If including CTAs, make them **bold** for visual emphasis but integrate them naturally
- Use "you" and "your" to address the viewer directly, but balance with "we" for inclusivity
- Build on previous sections naturally (this is section ${index + 1} of ${sections.length})
${emotionalTone ? `- Maintain the ${emotionalTone} emotional tone throughout` : ''}
${targetAudience ? `- Speak directly to ${targetAudience} with relevant examples and language` : ''}

INTRODUCTION SECTION SPECIAL REQUIREMENT:
${index === 0 ? 'This is the introduction section - keep it to 160 words maximum while still being engaging and hook-focused.' : ''}

QUALITY STANDARDS:
- Provide specific, verifiable information when making claims
- Explain not just what happens, but why it happens and how it works
- Connect individual experiences to larger patterns or principles
- Include actionable insights or practical applications
- Maintain respect for your audience's intelligence throughout
- Create content that educates, engages, and empowers rather than manipulates

${forbiddenWords ? `IMPORTANT: Do not use any of these forbidden words: ${forbiddenWords}` : ''}

Write the script content now:`;

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
                content: `You are a professional script writer who creates compelling, authentic content that sounds natural when spoken aloud. Your writing style is:

AUTHENTIC & ENGAGING: Write like an intelligent, passionate expert sharing fascinating insights with a friend. Avoid artificial "YouTube voice" or overly dramatic declarations.

NATURAL FLOW: Use conversational language that flows naturally when spoken. Vary sentence length and structure. Include specific examples and relatable scenarios.

DEPTH & SUBSTANCE: Provide genuine value through well-researched information, specific examples, and actionable insights. Explain not just what happens, but why it happens.

RESPECTFUL INTELLIGENCE: Respect your audience's intelligence. Build complexity gradually. Address different perspectives naturally.

AVOID: Repetitive catchphrases, overly dramatic declarations like "Your life is a lie," vague accusations without evidence, generic advice, or leaving audiences feeling hopeless.

Your goal is to inform, engage, and inspire through authentic communication, not to manipulate through shock tactics.`
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

    // Build the complete script with proper formatting
    let fullScript = '';
    
    // Add quote at the top if provided
    if (quote && quote.text && quote.author) {
      fullScript += `"${quote.text}" - ${quote.author}\n\n`;
      console.log(`📜 Added quote to script: "${quote.text}" - ${quote.author}`);
    }
    
    // Add sections with headlines
    const scriptSections = detailedSections
      .filter(section => !section.error)
      .map((section, index) => {
        // Format section with bold headline
        return `**${section.title}**\n\n${section.detailedContent}`;
      });
    
    fullScript += scriptSections.join('\n\n');

    const totalWords = detailedSections.reduce((sum, section) => sum + section.wordCount, 0);
    const successfulSections = detailedSections.filter(s => !s.error).length;
    const failedSections = detailedSections.filter(s => s.error).length;

    console.log(`✅ Generated complete script in parallel: ${totalWords} words across ${detailedSections.length} sections`);
    console.log(`📊 Success: ${successfulSections}/${detailedSections.length} sections generated successfully`);
    if (quote) console.log(`📜 Quote included at top of script`);

    return NextResponse.json({
      success: true,
      detailedSections,
      fullScript,
      quote: quote || null, // Include quote in response
      meta: {
        title,
        totalSections: detailedSections.length,
        totalWords,
        successfulSections,
        failedSections,
        processingMode: 'parallel',
        hasQuote: !!(quote && quote.text),
        theme: selectedTheme ? {
          id: selectedTheme.id,
          name: selectedTheme.name
        } : null,
        ctas: activeCTAs.length > 0 ? {
          enabled: true,
          count: activeCTAs.length,
          types: activeCTAs.map((cta: any) => cta.type)
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