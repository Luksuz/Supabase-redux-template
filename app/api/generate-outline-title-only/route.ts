import { NextRequest, NextResponse } from "next/server";
import { createModelInstance } from "../../../lib/utils/model-factory";
import { getModelById } from "../../../types/models";
import { THEME_OPTIONS } from "../../../lib/features/scripts/scriptsSlice";
import { scriptSectionsResponseSchema } from "../../../types/script-section";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
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
      wordCount,
      targetAudience,
      emotionalTone,
      selectedModel,
      themeId,
      additionalInstructions,
      uploadedStyle,
      ctas,
      forbiddenWords,
      researchData,
      generateQuote
    } = await request.json();
    
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!wordCount) {
      return NextResponse.json(
        { error: "Word count is required" },
        { status: 400 }
      );
    }

    const modelId = selectedModel || 'claude-sonnet-4-5';
    const modelConfig = getModelById(modelId);
    
    console.log(`🚀 Generating title-only outline for: "${title}" using ${modelConfig?.name || modelId}`);
    console.log(`📊 Target word count: ${wordCount} words`);

    // Calculate the number of sections based on word count
    const numSections = Math.max(1, Math.ceil(wordCount / 800)); // Aim for ~800 words per section
    const avgWordsPerSection = Math.round(wordCount / numSections);
    
    console.log(`📊 Word distribution: ${wordCount} total words → ${numSections} sections → ~${avgWordsPerSection} words per section`);

    // Handle multiple CTAs
    const activeCTAs = ctas && Array.isArray(ctas) ? ctas.filter((c: any) => c.enabled) : [];
    
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
        ctaSectionIndex = Math.min(ctaItem.customPosition - 1, numSections - 1); // Convert to 0-based index
      }
      
      if (ctaSectionIndex >= 0) {
        ctaSectionIndices.push(ctaSectionIndex);
      }
    });

    console.log(`📢 CTA placements: sections ${ctaSectionIndices.map(i => i + 1).join(', ')} of ${numSections} total`);
    if (activeCTAs.length > 0) {
      console.log(`📋 Active CTAs:`, activeCTAs.map(cta => `${cta.type} (${cta.placement})`).join(', '));
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
- Create detailed writing instructions that embody these principles naturally
- Focus on authentic human communication that follows these thematic guidelines
- Provide specific guidance for how to implement these approaches in each section
` : '';

    // Generate quote if requested
    let generatedQuote = null;
    if (generateQuote) {
      console.log('📜 Generating relevant quote...');
      try {
        const quoteModel = createModelInstance(selectedModel || 'claude-sonnet-4-5', 0.3);
        
        const scriptAnalysisPrompt = `Analyze this video script content and identify the main subject, key themes, and any prominent figures mentioned:

TITLE: "${title}"
THEME: ${selectedTheme ? selectedTheme.name : 'General'}
${researchData ? `RESEARCH CONTEXT: ${JSON.stringify(researchData.analysis || {}).substring(0, 500)}` : ''}

Based on this information, identify:
1. The PRIMARY subject/topic of this script
2. The main THEMES being explored 
3. Any SPECIFIC HISTORICAL FIGURES, experts, or authorities mentioned or relevant to this topic
4. The PHILOSOPHICAL or PRACTICAL approach being taken

Respond with a brief analysis in this format:
PRIMARY SUBJECT: [main topic]
KEY THEMES: [2-3 main themes]
RELEVANT AUTHORITIES: [specific people who are experts on this subject]
APPROACH: [philosophical, practical, historical, etc.]`;

        const analysisResponse = await quoteModel.invoke(scriptAnalysisPrompt);
        let analysisContent = "";
        if (typeof analysisResponse.content === 'string') {
          analysisContent = analysisResponse.content;
        } else if (Array.isArray(analysisResponse.content)) {
          analysisContent = analysisResponse.content
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null && 'text' in item && typeof item.text === 'string') return item.text;
              return '';
            })
            .join('\n');
        }

        const quotePrompt = `Based on this script analysis, find a profound, verified quote that perfectly captures the essence of this content:

${analysisContent}

SCRIPT DETAILS:
Title: "${title}"
Theme: ${selectedTheme ? selectedTheme.name : 'General'}
${themeInstructions ? `Theme Context: ${themeInstructions.substring(0, 300)}` : ''}

QUOTE REQUIREMENTS:
- Must be from a REAL, credible authority figure directly relevant to the subject matter
- Must be PROFOUND and thought-provoking, not generic motivational quotes
- Should capture the CORE ESSENCE of what this script is exploring
- Must be VERIFIED and authentic (not misattributed)

Return ONLY the quote and author in this exact format:
"Quote text here" - Author Name

Do NOT include any explanation, context, or additional text.`;

        const quoteResponse = await quoteModel.invoke(quotePrompt);
        let quoteContent = "";
        if (typeof quoteResponse.content === 'string') {
          quoteContent = quoteResponse.content;
        } else if (Array.isArray(quoteResponse.content)) {
          quoteContent = quoteResponse.content
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null && 'text' in item && typeof item.text === 'string') return item.text;
              return '';
            })
            .join('\n');
        }

        const quoteMatch = quoteContent.match(/"([^"]+)"\s*-\s*(.+)/);
        if (quoteMatch && quoteMatch[1] && quoteMatch[2]) {
          generatedQuote = {
            text: quoteMatch[1].trim(),
            author: quoteMatch[2].trim()
          };
          console.log(`✅ Generated contextual quote: "${generatedQuote.text}" - ${generatedQuote.author}`);
        }
      } catch (quoteError) {
        console.error('❌ Quote generation failed:', quoteError);
      }
    }

    // Use uploaded style if available, otherwise read the feeder script style file
    let styleContent: string;
    
    if (uploadedStyle && uploadedStyle.trim().length > 0) {
      styleContent = uploadedStyle;
      console.log('📄 Using uploaded style guide for title-only outline');
    } else {
      const stylePath = join(process.cwd(), 'lib', 'data', 'feeder_script_style.txt');
      styleContent = readFileSync(stylePath, 'utf-8');
      console.log('📄 Using default feeder script style for title-only outline');
    }

    // Initialize the model
    const model = createModelInstance(modelId, 0.7);

    // Build additional instructions
    let additionalInstructionsText = "";
    
    if (forbiddenWords && forbiddenWords.trim()) {
      const wordsList = forbiddenWords.split(',').map((word: string) => word.trim()).filter(Boolean);
      if (wordsList.length > 0) {
        additionalInstructionsText += `
FORBIDDEN WORDS: Completely avoid these terms: ${wordsList.join(', ')}.
`;
      }
    }
    
    if (additionalInstructions && additionalInstructions.trim()) {
      additionalInstructionsText += `
ADDITIONAL INSTRUCTIONS: ${additionalInstructions.trim()}
`;
    }

    const prompt = `You are a master storyteller and researcher creating compelling, authentic video content that sounds like a passionate expert sharing genuine insights. Based on the title: **${title}**

TARGET SPECIFICATIONS:
- Total word count: ${wordCount} words
- Number of sections: ${numSections}
- Average words per section: ${avgWordsPerSection} words
- Introduction section limit: 170 words maximum
- Other sections: ~${avgWordsPerSection} words each

FUNDAMENTAL WRITING PRINCIPLES:
${styleContent}

THEMATIC DIRECTION:
${themeInstructions}

${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${emotionalTone ? `EMOTIONAL TONE: ${emotionalTone}` : ''}

${researchData ? `
RESEARCH FOUNDATION:
Incorporate these research insights to create authoritative, fact-based content:

Analysis: ${JSON.stringify(researchData.analysis || {}, null, 2)}
Key Findings: ${researchData.searchResults ? researchData.searchResults.slice(0, 5).map((result: any) => `- ${result.title}: ${result.description}`).join('\n') : 'No search results available'}

INTEGRATION REQUIREMENTS:
- Weave specific facts, statistics, and insights naturally into the narrative
- Use research to support claims with concrete examples
- Reference current developments and real-world applications
- Build authority through demonstrated knowledge, not dramatic claims
` : ''}

${additionalInstructionsText}

${activeCTAs.length > 0 ? `
CTA INTEGRATION REQUIREMENTS:
${activeCTAs.map((ctaItem: any, ctaIndex: number) => {
  const ctaSectionIndex = ctaSectionIndices[ctaIndex];
  if (ctaSectionIndex >= 0) {
    return `- Section ${ctaSectionIndex + 1} must include the following CTA:
${getCTAInstructions(ctaItem.type, ctaItem.content)}${ctaItem.type === 'custom' && ctaItem.content ? `\nCustom CTA Content: ${ctaItem.content}` : ''}
CRITICAL: Integrate the CTA naturally into the content flow.`;
  }
  return '';
}).filter(Boolean).join('\n')}
` : ''}

ANTI-AI CONTENT REQUIREMENTS:
- NEVER use repetitive catchphrases or formulaic expressions
- ELIMINATE generic, interchangeable language that could apply to any topic
- REJECT artificial excitement or forced urgency
- NEVER repeat the same rhetorical devices or sentence structures across sections
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
- Address complexity and nuance rather than oversimplifying, but not too much to keep it WIDE TAM & broadly understandable

CRITICAL WORD COUNT REQUIREMENTS:
- Section 1 (Introduction): Maximum 170 words - capture attention through genuine intrigue
- The first section (introduction) of the script should be 170 words MAXIMUM, and its purpose is to REEL the viewer into watching the full video, it must spark curiosity to keep watching
- Sections 2-${numSections}: Target approximately ${avgWordsPerSection} words each (minimum 800 words)
- Total script should aim for ${wordCount} words across all sections
- Better to exceed targets than fall short - focus on substantial, valuable content

For each section, provide:
1. A compelling, specific title that captures unique value
2. Comprehensive writing instructions (minimum 200 words) detailing:
   - The authentic intellectual journey viewers should experience
   - Specific content points with supporting evidence and examples
   - Natural engagement techniques that respect audience intelligence
   - How this section contributes to the overall educational narrative
   - Smooth transition strategies maintaining conversational flow
   - Concrete examples, analogies, or case studies to include
   - Key questions to address or insights to reveal
   - Emotional pacing and tonal shifts throughout the section
   - Specific facts, statistics, or expert perspectives to reference
   - How to connect abstract concepts to tangible experiences
   - Methods for building credibility and trust with the audience

${forbiddenWords ? `FINAL REMINDER: Completely avoid these prohibited terms: ${forbiddenWords}` : ''}

Create exactly ${numSections} sections that will form a comprehensive, value-packed video script totaling ${wordCount} words.`;

    console.log(`🚀 Generating title-only outline: "${title}" with ${numSections} sections`);

    const response = await (model as any).withStructuredOutput(scriptSectionsResponseSchema).invoke(prompt);
    
    // Log the prompt for debugging
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    logPromptToFile(prompt, `title_only_${sanitizedTitle}`, 'outline');

    console.log(`✅ Generated ${response.sections.length} sections for title-only outline: "${title}"`);

    return NextResponse.json({
      success: true,
      sections: response.sections,
      quote: generatedQuote,
      meta: {
        title,
        wordCount,
        numSections,
        avgWordsPerSection,
        generationType: 'title-only',
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
        researchUsed: !!researchData
      }
    });

  } catch (error) {
    console.error('Error generating title-only outline:', error);
    return NextResponse.json(
      { error: 'Failed to generate outline: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// Define CTA instructions based on type
const getCTAInstructions = (type: string, content?: string) => {
  switch (type) {
    case 'newsletter':
      return `
IMPORTANT CTA REQUIREMENT: You must incorporate a short CTA to our newsletter called "Insights Academy" (make it clear that it is a free newsletter) where we share more hidden knowledge exclusively. Frame the CTA as if some things are too confidential to share on YouTube. Mention that the viewer will receive a free ebook copy of "The Kybalion" upon signing up for a limited time only. The CTA must be incorporated smoothly and naturally into the content flow and can only be 2 sentences max. Make it persuasive and create urgency.`;
    
    case 'engagement':
      return `
IMPORTANT CTA REQUIREMENT: You must incorporate this engagement CTA: "If this video resonated with you, let us know by commenting, 'I understood it.'" CRITICAL: When this CTA is positioned in the final section (end positioning), it MUST be the very last sentence of the entire section. For other positions, integrate it smoothly within the content flow. This should feel natural and be integrated seamlessly with the surrounding content.`;
    
    case 'custom':
      return content ? `
IMPORTANT CTA REQUIREMENT: You must incorporate this custom CTA smoothly into the content: "${content}" This should feel natural and be integrated seamlessly with the surrounding content.` : '';
    
    default:
      return '';
  }
}; 