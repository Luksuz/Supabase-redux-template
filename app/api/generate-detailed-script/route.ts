import { NextRequest, NextResponse } from "next/server";
import { createModelInstance } from "../../../lib/utils/model-factory";
import { getModelById } from "../../../types/models";
import { THEME_OPTIONS } from "../../../lib/features/scripts/scriptsSlice";
import OpenAI from 'openai';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to log prompts to files
function logPromptToFile(prompt: string, filename: string, type: 'outline' | 'detailed' = 'detailed') {
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
Filename: ${filename}
Section: ${filename}

${prompt}

=== END OF PROMPT ===`;
    
    writeFileSync(filepath, logContent, 'utf-8');
    console.log(`📝 Detailed script prompt logged to: ${filepath}`);
  } catch (error) {
    console.error('❌ Failed to log detailed script prompt:', error);
  }
}

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
- Vary your language extensively - never repeat the same phrases across sections
- Focus on authentic human communication that embodies these principles naturally
- If the theme mentions specific phrases, treat them as occasional accent points, not repetitive mantras
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
          if (ctaItem.placement === 'custom' && ctaItem.customPosition === index + 1) return true;
          return false;
        });

        if (sectionCTAs.length > 0) {
          ctaInstructions = `
CTA REQUIREMENTS FOR THIS SECTION:
${sectionCTAs.map((ctaItem: any) => {
  let ctaContent = '';
  if (ctaItem.type === 'newsletter') {
    ctaContent = `Include a short CTA to our newsletter called "Insights Academy" (make it clear that it is a free newsletter) where we share more hidden knowledge exclusively. Frame the CTA as if some things are too confidential to share on YouTube. Mention that the viewer will receive a free ebook copy of "The Kybalion" upon signing up for a limited time only. The CTA must be incorporated smoothly and naturally into the content flow and can only be 2 sentences max. Make it persuasive and create urgency.`;
  } else if (ctaItem.type === 'engagement') {
    ctaContent = `Include this engagement CTA naturally: "If this video resonated with you, let us know by commenting, 'I understood it.'" Integrate it seamlessly with the surrounding content.`;
  } else if (ctaItem.type === 'custom' && ctaItem.content) {
    ctaContent = `Include this custom CTA naturally: ${ctaItem.content}`;
  }
  return ctaContent;
}).filter(Boolean).join('\n')}

CRITICAL: CTAs must be integrated naturally into the content flow. Do NOT use transition phrases like "[TRANSITION TO CTA]" or similar - these will be spoken by the voice-over. Instead, make the CTA feel like a natural part of the narrative. Bold or emphasize the CTA content for visual distinction.
`;
        }

        const prompt = `You are a master storyteller and researcher writing section ${index + 1} of ${sections.length} for a compelling video script titled "${title}". Your goal is to create authentic, expert-level content that sounds like a passionate human sharing genuine insights.

SECTION TITLE: "${section.title}"
WRITING INSTRUCTIONS: ${section.writingInstructions}

${contextInstructions}

FUNDAMENTAL WRITING PRINCIPLES:
${styleContent}

THEMATIC DIRECTION:
${themeInstructions}

${emotionalTone ? `EMOTIONAL APPROACH: Ensure content matches this tone: ${emotionalTone}` : ''}
${targetAudience ? `INTENDED AUDIENCE: Write specifically for: ${targetAudience}` : ''}
${forbiddenWords ? `LANGUAGE RESTRICTIONS: Completely avoid these terms: ${forbiddenWords}` : ''}

${researchData ? `
RESEARCH FOUNDATION:
Use insights from this research to create authoritative, fact-based content:
${JSON.stringify(researchData, null, 2).substring(0, 1000)}...

INTEGRATION REQUIREMENTS:
- Weave specific facts, statistics, and insights naturally into the narrative
- Use research to support claims with concrete examples
- Reference current developments and real-world applications
- Build authority through demonstrated knowledge, not dramatic claims
` : ''}

${ctaInstructions}

ANTI-AI CONTENT REQUIREMENTS:
- NEVER use repetitive catchphrases or formulaic expressions
- AVOID dramatic declarations like "Your life is a lie" or "They don't want you to know" unless used sparingly and contextually
- ELIMINATE generic, interchangeable language that could apply to any topic
- REJECT artificial excitement or forced urgency
- NEVER repeat the same rhetorical devices or sentence structures
- AVOID lists of vague benefits or empty promises
- CREATE unique, topic-specific insights that demonstrate genuine expertise

NATURAL HUMAN COMMUNICATION STANDARDS:
- Write as if you're a knowledgeable friend sharing fascinating discoveries
- Use varied sentence structures and natural speech patterns
- Include specific, verifiable details and examples
- Show genuine curiosity and intellectual engagement with the topic
- Build arguments through logic and evidence, not repetitive assertions
- Respect your audience's intelligence and critical thinking abilities
- Connect ideas to real-world experiences and practical applications

CONTENT DEPTH REQUIREMENTS:
- Provide specific, actionable insights that viewers can verify or apply
- Explain underlying mechanisms and causalities, not just surface-level claims
- Include historical context, comparative examples, or case studies
- Address complexity and nuance rather than oversimplifying
- Connect individual concepts to broader frameworks or principles
- Offer practical next steps or applications for the information shared

CRITICAL WRITING REQUIREMENTS:
- Write ONLY the script content for this section - no stage directions, titles, or meta-commentary
- Create content that sounds natural and authentic when spoken aloud
- Use specific examples, case studies, or relatable scenarios to illustrate points
- Vary sentence structure and length extensively to create natural rhythm
- Build arguments through logical progression and evidence, not shock tactics
- Include genuine insights that provide real educational value
- If including CTAs, make them **bold** but integrate naturally into the narrative flow
- Balance direct address ("you") with inclusive language ("we") appropriately
- Build on previous sections naturally (this is section ${index + 1} of ${sections.length})
${emotionalTone ? `- Maintain the ${emotionalTone} emotional tone throughout while remaining authentic` : ''}
${targetAudience ? `- Speak directly to ${targetAudience} with relevant examples and appropriate language` : ''}

CRITICAL WORD COUNT REQUIREMENTS:
- This section should be AT LEAST 500 words minimum
- Target approximately 700-900 words for optimal depth and engagement
- If your initial draft is under 500 words, expand with additional examples, case studies, or deeper explanations
- Better to exceed the target than fall significantly short
- Focus on providing substantial value rather than reaching a word count through filler

INTRODUCTION SECTION SPECIAL REQUIREMENT:
${index === 0 ? 'This is the introduction section - capture attention through genuine intrigue rather than dramatic claims, and limit to 160 words maximum while establishing credibility and value.' : ''}

QUALITY VERIFICATION:
Before finalizing, ensure your content:
- Sounds like a knowledgeable human expert, not an AI
- Provides specific, verifiable information unique to this topic
- Uses completely varied language with no repeated phrases or structures
- Builds trust through transparency and demonstrated expertise
- Educates and empowers rather than manipulates or overwhelms
- Maintains conversational authenticity while delivering substantial value

${forbiddenWords ? `FINAL REMINDER: Completely avoid these prohibited terms: ${forbiddenWords}` : ''}

Write the authentic, expert-level script content now:`;

        let detailedContent: string;
        
        // Log the prompt for debugging
        const sanitizedSectionTitle = section.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        logPromptToFile(prompt, `section_${index + 1}_${sanitizedSectionTitle}`, 'detailed');

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
                content: `You are a master storyteller and researcher who creates compelling, authentic content that sounds like a passionate human expert sharing genuine insights. Your writing embodies these principles:

AUTHENTIC EXPERTISE: Write like an intelligent, passionate expert sharing fascinating discoveries with a friend. Demonstrate genuine knowledge and curiosity about your subject matter.

NATURAL COMMUNICATION: Use conversational language that flows naturally when spoken. Vary sentence length and structure extensively. Include specific examples and verifiable details.

ANTI-AI PATTERNS: 
- NEVER use repetitive catchphrases like "they don't want you to know," "your life is a lie," "wake up"
- AVOID formulaic language that sounds interchangeable between topics
- ELIMINATE dramatic declarations without supporting evidence
- REJECT artificial excitement or forced urgency
- CREATE unique, topic-specific insights that demonstrate genuine expertise

DEPTH & SUBSTANCE: Provide genuine value through well-researched information, specific examples, and actionable insights. Explain not just what happens, but why it happens and how it works.

RESPECTFUL INTELLIGENCE: Respect your audience's intelligence and critical thinking abilities. Build complexity gradually. Address different perspectives naturally and constructively.

EVIDENCE-BASED APPROACH: Support claims with concrete examples, historical context, or verifiable information. Build trust through transparency about sources and reasoning.

Your goal is to inform, engage, and inspire through authentic human communication that educates and empowers rather than manipulates through shock tactics or AI-generated patterns.`
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
    
    // Add quote at the top if provided - in a clearly labeled quote box
    if (quote && quote.text && quote.author) {
      fullScript += `╔════════════════════════════════════════════════════════════════╗
║                              OPENING QUOTE                             ║
╚════════════════════════════════════════════════════════════════╝

"${quote.text}"

— ${quote.author}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
      console.log(`📜 Added formatted quote box to script: "${quote.text}" - ${quote.author}`);
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