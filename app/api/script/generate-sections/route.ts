import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js'


const themeToSystem = {
  "crime": "You are a specialized content analyst and scriptwriter for true crime media, with deep expertise in courtroom proceedings and legal journalism. Your role is to transform raw court documentation, police records, and media coverage into compelling narrative scripts while maintaining strict factual accuracy.\n\nYour core responsibilities:\n- Analyze court transcripts, police reports, and media coverage to identify key dramatic moments\n- Structure narratives that balance emotional impact with legal accuracy\n- Maintain appropriate tone when covering sensitive cases\n- Ensure all dialogue and quotes are verbatim from official records\n- Follow ethical guidelines for crime reporting\n\nKey constraints:\n- Never sensationalize or embellish facts\n- Maintain victim dignity and respect\n- Verify all quotes and details against primary sources\n- Consider impact on affected families\n- Follow legal guidelines for court reporting\n\nRequired expertise:\n- Criminal court procedures\n- Legal terminology\n- Investigative journalism\n- Narrative structure\n- True crime media conventions\n- Ethical reporting standards",
  "rap": "You are an expert content creator specializing in hip-hop culture and street documentaries. Your role is to create engaging, authentic content that captures the raw reality of rap culture while maintaining journalistic integrity. You should:\n\n- Balance entertainment value with responsible reporting\n- Use appropriate street terminology and slang naturally\n- Maintain cultural authenticity and sensitivity\n- Avoid glorifying violence while acknowledging its presence\n- Structure narratives to build tension and drama\n- Verify facts and include multiple perspectives\n- Consider the impact on affected communities\n\nYour expertise includes deep knowledge of rap history, street culture, social media dynamics, and urban youth movements. While covering intense topics, maintain professionalism and avoid sensationalism.",
  "general": "You are an expert content creator and scriptwriter with versatile expertise across multiple genres and formats. Your role is to create compelling, well-structured content that engages audiences while maintaining high editorial standards. You should:\n\n- Adapt your writing style to match the target audience and tone\n- Create clear, engaging narratives with strong structure\n- Balance entertainment value with informational content\n- Use appropriate language and terminology for the subject matter\n- Maintain factual accuracy and cite sources when needed\n- Consider ethical implications of content choices\n\nYour expertise includes storytelling techniques, audience psychology, content strategy, and cross-platform media production."
}

type ThemePromptParams = {
  theme: string;
  title?: string;
  target_audience?: string;
  tone?: string;
  style_preferences?: string;
  additionalContext?: string;
  additionalResearch?: string;
  enableIntroHook?: boolean;
  introHookWordCount?: number;
};

function themeToUserPrompt({
  theme,
  title,
  target_audience,
  tone,
  style_preferences,
  additionalContext,
  additionalResearch,
  enableIntroHook,
  introHookWordCount,
}: ThemePromptParams) {
  let basePrompt = ''
  
  if (theme === "rap") {
    basePrompt = `I need help creating a script about dangerous moments rappers faced while livestreaming. The title is "${title}". The theme focuses on hip-hop culture and street confrontations, targeting an audience of ${target_audience || "hip-hop fans aged 18-55 who follow rap beef and street culture"}. The tone should be ${tone || "streetwise and dramatic while maintaining authenticity"}.

Style-wise, I want to use ${style_preferences || "urban slang naturally and build suspense through storytelling"}..

IMPORTANT: For rap/hip-hop content, the script structure should follow this pattern:
- Quick narration part (sets up context, builds tension)
- YouTube clip placement 
- Connecting narration (ties clips together without spoiling, maintains flow)
- Next YouTube clip placement
- Continue alternating pattern

The narration should connect clips seamlessly and build a compelling narrative without repeating what's shown in the clips.`
  } else if (theme === "crime") {
    basePrompt = `I need help crafting a script about dramatic courtroom cases and legal proceedings. The title is "${title}". The theme should focus on sudden violence in courtrooms and ongoing debates about legal procedures. This is aimed at ${target_audience || "an adult true crime audience aged 25-65 who follow high-profile court cases"}. The tone should be ${tone || "serious and analytical while building tension"}. Style preferences: ${style_preferences || "clear chronological structure with strategic pauses for impact"}.

IMPORTANT: For true crime content, the script structure should follow this pattern:
- YouTube clip placement (shows the dramatic moment/evidence)
- Narration (explains context, provides analysis, can be short or extensive depending on complexity)
- Continue with next clip and narration as needed

The narration should provide essential context and analysis without spoiling upcoming clips.`
  } else {
    basePrompt = `I need help creating a compelling script with the title "${title}". The content should target ${target_audience || "a general audience"} with a ${tone || "engaging and informative"} tone. Style preferences: ${style_preferences || "clear structure with engaging storytelling elements"}.`
  }

  // Add additional context if provided
  if (additionalContext) {
    basePrompt += `\n\nAdditional context: ${additionalContext}`
  }

  // Add research materials if provide
  if (additionalResearch) {
    basePrompt += `\n\nAdditional research materials: ${additionalResearch}`
  }

  // Add intro hook instructions if enabled
  if (enableIntroHook) {
    basePrompt += `\n\nIMPORTANT: Generate a separate INTRO HOOK as the first section with exactly ${introHookWordCount || 50} words. This intro should:
- Grab viewer attention immediately
- Tease the main content without giving everything away
- Use compelling language and intrigue
- Be punchy and engaging
- Reference the most interesting element from research

The intro hook should be generated as a separate section with title "Intro Hook" and specific writing instructions.`
  }

  // Add section generation instructions - AI determines optimal sections
  basePrompt += `\n\nAnalyze the provided research data and theme to determine the optimal number of script sections needed to thoroughly cover all concepts, insights, and narrative elements or People referenced in the research data - Preferrably 1 section per person. ${enableIntroHook ? 'After the intro hook, create' : 'Create'} as many main content sections as needed to:
- Utilize all valuable content from the research data
- Explain each major concept or theme identified
- Create a logical narrative flow
- Ensure comprehensive coverage without padding

Each section should include:

1. **title**: A compelling section title
2. **writingInstructions**: Detailed instructions for what this section should cover, including:
   - Specific narrative elements and pacing
   - Key points to address from research data
   - How to incorporate YouTube clips throughout the section (not just at the beginning)
   - The flow pattern appropriate for this niche (${theme === "rap" ? "narration → clip → narration → clip" : theme === "crime" ? "clip → narration" : "flexible based on content"})
   - Instructions on how narration should connect clips without spoiling them
3. **researchData**: A string containing relevant YouTube links with their actual timestamps and descriptions of what happens in those clips, extracted from the research materials. Include specific quotes, moments, and context for each clip. Format as: [[CLIP DESCRIPTION: youtube_url | timestamp_range | description_of_what_happens]]

The sections should flow logically and create a compelling narrative arc. Make the writing instructions specific and actionable - they will be used to generate the actual script content with properly placed clips later.

Focus on quality and engagement rather than artificial length requirements. The goal is compelling content that uses clips effectively to tell a comprehensive story that covers all available research material.

Determine the optimal number of sections based on:
- Amount and complexity of research data provided
- Natural narrative breaks and thematic divisions
- Logical progression of ideas and concepts
- Effective use of available video clips and timestamps

Format your response as a JSON object with a "sections" array containing the section objects.`

  return basePrompt
}

function buildEnhancedSystemPrompt(theme: string, additionalResearch?: string) {
  let systemPrompt = themeToSystem[theme as keyof typeof themeToSystem] || themeToSystem.general
  
  if (additionalResearch && additionalResearch.includes('YOUTUBE RESEARCH DATA')) {
    systemPrompt += `\n\nIMPORTANT: You have been provided with comprehensive YouTube research data including video transcripts, analysis results, and research summaries. Use this data to:\n- Ground your script sections in real examples and insights from the research\n- Reference specific quotes, themes, and patterns found in the analyzed content\n- Incorporate relevant timestamps and video references where appropriate\n- Build upon the narrative themes and character insights identified\n- Determine the optimal number of sections based on the volume and complexity of research data\n- Ensure each major concept, theme, or insight from the research gets proper coverage\n\nWhen creating sections, prioritize authenticity by drawing from the actual research data provided rather than generic examples. Create as many sections as needed to thoroughly utilize all valuable research content without artificial constraints.`
  }
  
  return systemPrompt
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Zod schema for structured output
const ScriptSectionSchema = z.object({
  title: z.string(),
  writingInstructions: z.string(),
  researchData: z.string(),
});

const ScriptSectionsResponseSchema = z.object({
  sections: z.array(ScriptSectionSchema),
});

export async function POST(request: NextRequest) {
  console.log("=== POST /api/script/generate-sections ===");

  try {
    console.log("Parsing request body...");
    const requestBody = await request.json();
    console.log("Request body received:", requestBody);

    const {
      theme,
      title,
      additionalContext,
      target_audience,
      tone,
      style_preferences,
      promptId,
      customPrompt: customPromptParam,
      model: requestedModel,
      additionalResearch,
      enableIntroHook,
      introHookWordCount,
    } = requestBody;

    console.log("Extracted values:", {
      theme,
      title,
      additionalContext,
      target_audience,
      tone,
      style_preferences,
      promptId,
      customPrompt: customPromptParam ? customPromptParam : null,
      model: requestedModel,
      additionalResearch: additionalResearch ? `${additionalResearch.length} characters` : 'undefined',
      enableIntroHook,
      introHookWordCount,
    });

    console.log("🔍 Detailed parameter analysis:", {
      theme: theme || 'MISSING',
      title: title || 'MISSING',
      additionalContext: additionalContext || 'MISSING',
      additionalResearchLength: additionalResearch?.length || 0,
      additionalResearchPreview: additionalResearch ? additionalResearch.substring(0, 100) + '...' : 'NO RESEARCH DATA'
    });

    if (!theme) {
      console.log("Validation failed: theme is missing");
      return NextResponse.json({ error: "Theme is required" }, { status: 400 });
    }

    let finalPrompt = null;

    // If customPrompt is provided, use it directly (edited prompt from frontend)
    if (customPromptParam) {
      finalPrompt = customPromptParam;
      console.log("Using edited prompt from frontend");
    } else if (promptId) {
      // Otherwise, if promptId is provided, fetch the stored prompt
      console.log(`Fetching stored prompt with ID: ${promptId}`)
      const { data: storedPrompt, error } = await supabase
        .from('fine_tuning_prompts')
        .select('*')
        .eq('id', promptId)
        .single()

      if (error) {
        console.error('Error fetching stored prompt:', error)
        return NextResponse.json(
          { error: 'Stored prompt not found' },
          { status: 404 }
        )
      }

      finalPrompt = storedPrompt.prompt
      console.log(`Using stored prompt: ${storedPrompt.title}`)
    }

    console.log(`🚀 Generating script sections for theme: ${theme}`);

    // Determine which model to use
    const modelToUse = requestedModel || "gpt-4.1-mini";
    console.log(`Using model: ${modelToUse}`);

    // Build enhanced system prompt
    const systemPrompt = buildEnhancedSystemPrompt(theme, additionalResearch)

    // Build user prompt with all parameters
    const userPrompt = themeToUserPrompt({
      theme,
      title,
      target_audience,
      tone,
      style_preferences,
      additionalContext,
      additionalResearch,
      enableIntroHook,
      introHookWordCount,
    })

    console.log("Sending request to OpenAI...");
    console.log("Prompt preview:", userPrompt.substring(0, 200) + "...");

    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sections",
          schema: {
            type: "object",
            properties: {
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Clear, descriptive title for the section",
                    },
                    writingInstructions: {
                      type: "string",
                      description:
                        "Detailed instructions for writing this section, including tone, style, content focus, and purpose",
                    },
                    researchData: {
                      type: "string",
                      description:
                        "Relevant YouTube links, timestamps, quotes, or research references from the provided materials for this section",
                    },
                  },
                  required: ["title", "writingInstructions", "researchData"],
                },
              },
            },
            required: ["sections"],
          },
        },
      },
      max_tokens: 16384,
      temperature: 0.7,
    });

    console.log("OpenAI response received");
    const responseText = response.choices[0]?.message?.content?.trim();
    console.log("Response text length:", responseText?.length || 0);

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log("Parsing OpenAI response...");
    // Parse and validate the response
    const parsedResponse = JSON.parse(responseText);
    console.log("Parsed response structure:", Object.keys(parsedResponse));

    const validatedResponse =
      ScriptSectionsResponseSchema.parse(parsedResponse);
    console.log(
      `✅ Generated ${validatedResponse.sections.length} sections for theme: ${theme}`
    );
    console.log(
      "Section titles:",
      validatedResponse.sections.map((s) => s.title)
    );

    return NextResponse.json({
      success: true,
      sections: validatedResponse.sections,
      usingMock: false,
      requiresApproval: true,
    });
  } catch (error) {
    console.error("Unexpected error in generate-sections:", error);
    console.error("Error details:", {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Failed to generate sections: " + (error as Error).message },
      { status: 500 }
    );
  }
}
