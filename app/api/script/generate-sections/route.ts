import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Zod schema for structured output
const ScriptSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  writingInstructions: z.string(),
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
    } = requestBody;

    console.log("Extracted values:", {
      theme,
      title,
      additionalContext,
      target_audience,
      tone,
      style_preferences,
      promptId,
      customPrompt: customPromptParam ? `${customPromptParam.substring(0, 100)}...` : null,
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
        .from('prompts')
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

    console.log("Checking OpenAI API key...");
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not found, using mock sections");
      const mockSections = generateMockSections(
        theme,
        target_audience,
        tone,
        style_preferences
      );
      console.log("Generated mock sections:", mockSections.length);
      return NextResponse.json({
        success: true,
        sections: mockSections,
        usingMock: true,
      });
    }

    console.log(`🚀 Generating script sections for theme: ${theme}`);

    try {
      const prompt = finalPrompt || `CRIME DYNASTY SCRIPTWRITING STYLE GUIDE:

Follow these style rules for every script and section you write.

INTROS:
- Keep intros short (30-50 words max), in medias res, simple, and straight to the point
- Avoid long sentences and complex words - if a 5th grader can't understand it, it's too complex
- Fit the "what", "who", "how", and "when" without being verbose
- Dive straight into action instead of lengthy introductions
- Make it appealing to the ear for voiceover

CONVERSATIONAL WRITING:
- Write like you talk, for voiceover narration
- Use short sentences, active voice, simple words, and natural transitions
- Avoid filler like 'uhh'/'umm', but add personal narrator comments when appropriate
- Read your script out loud - it should sound like talking, not writing
- Use transitional words/devices to improve flow

DATES AND STRUCTURE:
- Use dates at the start of sentences when applicable, but never write 'On May 15th' - just 'May 15th'
- Use in medias res often, especially for intros and top 10/5 entries
- Vary entry structure - don't follow the same format for every entry
- For top 5/10 scripts about people, use only the person's name as the subheading

SOURCES AND CLIPS:
- For every article, video, tweet, or photo referenced, attach the link in the script for the editor
- When adding clips, write "(Play this)" and include timestamp links
- Don't spoil clips or repeat what's shown unless it truly adds value

GENERAL PRINCIPLES:
- Remain unbiased, especially on sensitive topics
- Grammar must be perfect
- Use adverbs to sensationalize main events, but don't overdo it
- The best trick is knowing what to leave out - avoid unnecessary details
- Stay on topic and pick the most interesting, valuable, and exciting information

EXAMPLES:
- "July 7th, 2022, a Tiktoker shut down a bridge in Mexico... Here are five times TikTokers messed with the wrong cartel." (49 words, all key info, in medias res)
- Add personal narrator comments for emphasis when appropriate
- Keep background stories brief to maintain engagement

ALWAYS follow these rules. Focus on creating engaging, conversational content that flows naturally when spoken aloud.

You are a professional script writer. Create a detailed outline for a script with the following specifications:

Theme: ${theme}
Target Audience: ${target_audience || 'General audience'}
Tone: ${tone || 'Professional'}
Style Preferences: ${style_preferences || 'Clear and engaging'}
Additional Context: ${additionalContext || 'None provided'}

Generate 4-6 script sections that would make up a complete script. Each section should have:
1. A clear, descriptive title
2. Detailed writing instructions that specify the tone, content, style, and purpose of that section, and that follow the Scriptwriting Style Guide above.

The sections should flow logically and cover the complete narrative or content structure. Make the writing instructions specific and actionable - they will be used to generate the actual script content later.

Return the response in the exact JSON format specified.`;

      console.log("Sending request to OpenAI...");
      console.log("Prompt preview:", prompt.substring(0, 200) + "...");

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional script writer who creates detailed, structured outlines. Always respond with valid JSON in the exact format requested.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "script_sections",
            schema: {
              type: "object",
              properties: {
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "Unique identifier for the section",
                      },
                      title: {
                        type: "string",
                        description: "Clear, descriptive title for the section",
                      },
                      writingInstructions: {
                        type: "string",
                        description:
                          "Detailed instructions for writing this section, including tone, style, content focus, and purpose",
                      },
                    },
                    required: ["id", "title", "writingInstructions"],
                  },
                },
              },
              required: ["sections"],
            },
          },
        },
        max_tokens: 1500,
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
      });
    } catch (openaiError: any) {
      console.error(`❌ OpenAI API error for theme ${theme}:`, openaiError);
      console.error("OpenAI error details:", {
        name: openaiError.name,
        message: openaiError.message,
        status: openaiError.status,
        type: openaiError.type,
      });

      // Fallback to mock if OpenAI fails
      console.log("Falling back to mock sections...");
      const mockSections = generateMockSections(
        theme,
        target_audience,
        tone,
        style_preferences
      );
      console.log("Generated fallback mock sections:", mockSections.length);

      return NextResponse.json({
        success: true,
        sections: mockSections,
        usingMock: true,
        error: openaiError.message,
      });
    }
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

// Mock sections generator (fallback)
function generateMockSections(
  theme: string,
  target_audience?: string,
  tone?: string,
  style_preferences?: string
) {
  console.log("Generating mock sections with:", {
    theme,
    target_audience,
    tone,
    style_preferences,
  });

  const baseId = Date.now();

  const sections = [
    {
      id: `${baseId}-1`,
      title: "Opening Hook",
      writingInstructions: `Create an engaging opening that immediately captures attention related to the theme "${theme}". ${
        target_audience ? `Target this for ${target_audience}.` : ""
      } ${
        tone ? `Use a ${tone} tone.` : ""
      } Set the context and establish credibility. Use a compelling hook that makes the audience want to continue.`,
    },
    {
      id: `${baseId}-2`,
      title: "Main Content - Part 1",
      writingInstructions: `Develop the core content focusing on the primary aspects of "${theme}". ${
        target_audience ? `Keep ${target_audience} in mind.` : ""
      } ${
        tone ? `Maintain a ${tone} tone throughout.` : ""
      } Provide valuable information that supports the main theme. ${
        style_preferences ? `Style: ${style_preferences}` : ""
      }`,
    },
    {
      id: `${baseId}-3`,
      title: "Main Content - Part 2",
      writingInstructions: `Continue building on the foundation from Part 1. Deepen the exploration of "${theme}" with additional insights, examples, or narrative development. ${
        tone ? `Keep the ${tone} tone consistent.` : ""
      } Maintain momentum and ensure smooth transitions.`,
    },
    {
      id: `${baseId}-4`,
      title: "Key Insights",
      writingInstructions: `Highlight the most important takeaways or pivotal moments related to "${theme}". ${
        target_audience ? `Make it relevant for ${target_audience}.` : ""
      } This section should provide clarity and reinforcement of the main messages. Make it memorable and actionable.`,
    },
    {
      id: `${baseId}-5`,
      title: "Conclusion",
      writingInstructions: `Provide a strong, satisfying conclusion that ties together all elements of the theme "${theme}". ${
        tone ? `End with a ${tone} tone.` : ""
      } Reinforce the key messages and leave the audience with a clear understanding or call to action. End on a high note.`,
    },
  ];

  console.log(
    "Mock sections created:",
    sections.map((s) => ({ id: s.id, title: s.title }))
  );
  return sections;
}