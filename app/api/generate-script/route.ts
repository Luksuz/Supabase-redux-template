import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Zod schema for script sections
const scriptSectionsSchema = z.array(z.object({
  title: z.string(),
  writingInstructions: z.string(),
  image_generation_prompt: z.string()
}));

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if this is the new script generation flow
    if ('title' in body && 'wordCount' in body && 'theme' in body) {
      return handleNewScriptGeneration(body);
    }
    
    // Otherwise, handle the old image-based script generation
    return handleImageScriptGeneration(body);
  } catch (error) {
    console.error('Error in script generation route:', error)
    return NextResponse.json(
      { error: 'Failed to generate script: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

async function handleNewScriptGeneration(body: any) {
  const { 
    title, 
    wordCount, 
    theme, 
    additionalPrompt, 
    inspirationalTranscript, 
    forbiddenWords 
  } = body;
  
  if (!title || !wordCount) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Initialize the model
  const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o-mini",
    temperature: 0.7,
  });

  // Create a parser based on our Zod schema
  const parser = StructuredOutputParser.fromZodSchema(scriptSectionsSchema);

  // Calculate the number of sections based on word count
  const numSections = Math.max(1, Math.floor(wordCount / 800));

  // Build additions to the prompt based on optional parameters
  let additionalInstructions = "";
  
  // Add transcript as inspiration if provided
  if (inspirationalTranscript && inspirationalTranscript.trim()) {
    additionalInstructions += `
INSPIRATIONAL TRANSCRIPT FOR STYLE REFERENCE ONLY:
The following transcript should ONLY be used as inspiration for the tone, style, structure, and format of your script.
DO NOT use the content, topic, or subject matter from this transcript.
Your script must be about the title "${title}" and theme "${theme || 'provided'}", NOT about the topics mentioned in this transcript.

Use this transcript to understand:
- Writing style and tone
- Narrative structure and pacing
- How scenes flow and transition
- Storytelling techniques and format
- Dialogue style (if applicable)

TRANSCRIPT FOR STYLE REFERENCE:
${inspirationalTranscript.slice(0, 5000).trim()}

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

  // Define batch size for processing
  const BATCH_SIZE = 40;
  const totalBatches = Math.ceil(numSections / BATCH_SIZE);
  let allSections: any[] = [];
  
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

    // Create the prompt for the model
    const batchPrompt = `
You are a professional script outline generator. Create a detailed script outline for ${batchSize} sections ${startSection + 1} to ${endSection} of a story with the following details:

Title: ${title}
Theme: ${theme || "No specific theme provided"}
Total Story Word Count: Approximately ${wordCount} words (${numSections} total sections)
${additionalInstructions}
${contextInstructions}

I need you to generate ${batchSize} story sections (specifically sections ${startSection + 1} to ${endSection} out of ${numSections} total).

Each section must have:
1.  A 'title' that captures the essence of that section.
2.  Detailed 'writingInstructions' (150-250 words for main content sections) that explain what should happen in that section, including plot developments, character interactions, and thematic elements. These instructions are for the narrator.
3.  An 'image_generation_prompt' (a concise phrase or sentence, around 10-25 words) that describes the key visual elements of the scene for an AI image generator. This prompt should be purely descriptive of the visuals, suitable for direct use in image generation, and must avoid any taboo, sensitive, or controversial topics.

IMPORTANT GUIDELINES FOR WRITING INSTRUCTIONS:
1. Do NOT include instructions for the narrator to begin with greetings like "Hi", "Hello", etc.
2. Do NOT instruct the narrator to state or repeat the title or section names.
3. Focus on the narrative flow and content rather than introductory elements.
4. The narrator should begin directly with the story content, not with meta-references to the story itself.
5. Ensure the story can flow naturally without headers, titles, or section markers.

IMPORTANT INSTRUCTIONS FOR NARRATOR CALLS TO ACTION (CTAs):
You MUST incorporate the following CTAs directly into the 'writingInstructions' of the appropriate sections. These CTAs are spoken by the narrator. Ensure these CTAs are integrated naturally within the narrative flow where specified.

1.  **CTA 1 (After First Hook):** ${startSection <= 1 && endSection >= 2 ? "In the 'writingInstructions' for the FIRST SECTION, after approximately 70-100 words of narrative content (about 30-40 seconds of speaking time), include this EXACT text: \"Before we jump back in, tell us where you're tuning in from, and if this story touches you, make sure you're subscribed—because tomorrow, I've saved something extra special for you!\" This CTA should be placed after the initial hook and setup, once the audience is engaged with the story." : "You do not need to include this CTA in this batch of sections."}

2.  **CTA 2 (Mid-Script ~10 minutes / ~1500 words):** ${(wordCount >= 1500) && (startSection <= Math.floor(numSections/3) && endSection >= Math.floor(numSections/3)) ? "For scripts long enough to have a 10-minute mark (around 1500 words of story content), embed this CTA into the 'writingInstructions' of a suitable mid-point section: \"Preparing and narrating this story took us a lot of time, so if you are enjoying it, subscribe to our channel, it means a lot to us! Now back to the story.\"" : "You do not need to include this CTA in this batch of sections."}

3.  **CTA 3 (Later-Script ~40 minutes):** ${(wordCount >= 6000) && (startSection <= Math.floor(2*numSections/3) && endSection >= Math.floor(2*numSections/3)) ? "For very long scripts that would reach a 40-minute mark, embed this CTA into the 'writingInstructions' of an appropriate later section: \"Enjoying the video so far? Don't forget to subscribe!\"" : "You do not need to include this CTA in this batch of sections."}

4.  **CTA 4 (End of Script):** ${(endSection == numSections) ? "After the main story narrative is completely finished, the 'writingInstructions' for the very final section (or a new, short concluding section you create) MUST include: \"Up next, you've got two more standout stories right on your screen. If this one hit the mark, you won't want to pass these up. Just click and check them out! And don't forget to subscribe and turn on the notification bell, so you don't miss any upload from us!\"" : "You do not need to include this CTA in this batch of sections."}

Adherence to CTA placement and inclusion in 'writingInstructions' is critical.
Make all sections flow logically. Ensure all generated content, including CTAs and image prompts, is safe, respectful, and avoids controversial subjects.

${parser.getFormatInstructions()}
`;

    // Generate the batch of sections
    const response = await model.invoke(batchPrompt);
    
    // Parse the response - ensure we get a string
    let contentString = "";
    
    if (typeof response.content === 'string') {
      contentString = response.content;
    } else if (Array.isArray(response.content)) {
      // Extract text from array of complex message contents
      contentString = response.content
        .map((item: any) => {
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

  console.log(`✅ Successfully generated all ${allSections.length} sections`);
  return NextResponse.json({ sections: allSections });
}

async function handleImageScriptGeneration(body: any) {
  const { imageDataUrl, imageName, prompt, batchInfo, wordCount } = body;

    if (!imageDataUrl || !prompt) {
      return NextResponse.json(
        { error: 'Image data and prompt are required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock generation')
      const mockScript = generateMockScript(imageName, prompt, wordCount)
      return NextResponse.json({
        success: true,
        script: mockScript,
        imageName: imageName,
        usingMock: true
      })
    }

    // Log batch information if provided
    if (batchInfo) {
      console.log(`🚀 [Batch ${batchInfo.batchIndex}/${batchInfo.totalBatches}] Generating script ${batchInfo.imageIndex}/${batchInfo.batchSize} for: ${imageName}`)
    } else {
      console.log(`🚀 Generating script for image: ${imageName}`)
    }

    // Calculate max_tokens based on word count (roughly 1.3 tokens per word, with some buffer)
    const targetWordCount = wordCount || 150 // Default to 150 words if not specified
    const maxTokens = Math.min(Math.max(Math.round(targetWordCount * 1.5), 100), 1000) // Min 100, max 1000 tokens

    let wordCountInstruction = ""
    if (targetWordCount > 800) {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount+200} words. feel free to add some extra words to make it more detailed and engaging.`
    } else if (targetWordCount > 500) {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount+150} words. feel free to add some extra words to make it more detailed and engaging.`
    } else if (targetWordCount > 300) {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount+100} words. feel free to add some extra words to make it more detailed and engaging.`
    } else if (targetWordCount > 100) {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount+30} words. feel free to add some extra words to make it more detailed and engaging.`
    } else if (targetWordCount > 50) {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount} words. feel free to add some extra words to make it more detailed and engaging.`
    } else if (targetWordCount > 25) {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount} words. feel free to add some extra words to make it more detailed and engaging.`
    } else if (targetWordCount > 10) {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount} words. feel free to add some extra words to make it more detailed and engaging.`
    } else {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount+300} words. feel free to add some extra words to make it more detailed and engaging.`
    }
    // Create word count instruction

    try {
      const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${prompt}`
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `${wordCountInstruction}`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl, // Using data URL directly
                },
              },
            ],
          }
        ],
        max_tokens: maxTokens,
      })

      const script = response.choices[0]?.message?.content?.trim()
      
      if (script) {
        if (batchInfo) {
          console.log(`✅ [Batch ${batchInfo.batchIndex}/${batchInfo.totalBatches}] Script generated ${batchInfo.imageIndex}/${batchInfo.batchSize} for: ${imageName}`)
        } else {
          console.log(`✅ Generated script for image: ${imageName}`)
        }
        return NextResponse.json({
          success: true,
          script: script,
          imageName: imageName,
          usingMock: false
        })
      } else {
        console.error(`❌ No script generated for image: ${imageName}`)
        throw new Error('No content generated from OpenAI')
      }

    } catch (openaiError: any) {
      if (batchInfo) {
        console.error(`❌ [Batch ${batchInfo.batchIndex}/${batchInfo.totalBatches}] OpenAI API error for ${imageName}:`, openaiError)
      } else {
        console.error(`❌ OpenAI API error for ${imageName}:`, openaiError)
      }
      
      // Fallback to mock if OpenAI fails
      const mockScript = generateMockScript(imageName, prompt, wordCount)
      return NextResponse.json({
        success: true,
        script: `[AI Unavailable - Mock Script]\n\n${mockScript}`,
        imageName: imageName,
        usingMock: true,
        error: openaiError.message
      })
  }
}

// Enhanced mock script generation function (fallback)
function generateMockScript(imageName: string, prompt: string, wordCount?: number): string {
  const targetWordCount = wordCount || 150
  
  const templates = [
    `In this captivating image titled "${imageName}", we witness a compelling visual narrative. ${prompt} The composition draws our attention through carefully balanced elements, where light and shadow work together to create depth and meaning. Every detail contributes to the overall story, from the subtle color palette to the thoughtful framing that guides our emotional response.`,
    
    `"${imageName}" presents a striking visual story that speaks directly to the viewer's imagination. ${prompt} The artistic vision is evident in the way visual elements are orchestrated - the interplay of textures, the rhythm of lines, and the harmony of colors all work to create a cohesive and impactful image. The photographer's or artist's technical skill is matched by their creative vision.`,
    
    `This remarkable image, "${imageName}", captures a moment that transcends the ordinary. ${prompt} The visual narrative unfolds through layers of meaning - from the immediate visual impact to the subtle details that reward closer inspection. The composition demonstrates mastery of both technical execution and artistic vision, creating an image that resonates with emotional depth.`,
    
    `In "${imageName}", we encounter a powerful visual statement that demands attention. ${prompt} The image succeeds in creating a dialogue between the subject and the viewer, using visual language that speaks across cultural and temporal boundaries. The careful attention to light, composition, and timing results in a photograph that captures not just a moment, but an entire mood and atmosphere.`
  ]

  const randomTemplate = templates[Math.floor(Math.random() * templates.length)]
  
  // Enhanced context based on image characteristics
  let additionalContext = ""
  const lowerName = imageName.toLowerCase()
  
  if (lowerName.includes('landscape') || lowerName.includes('nature') || lowerName.includes('outdoor')) {
    additionalContext = " The natural world reveals its beauty through this composition, where organic forms and natural lighting create a sense of peace and wonder. The image invites us to pause and appreciate the subtle complexities of the natural environment."
  } else if (lowerName.includes('portrait') || lowerName.includes('people') || lowerName.includes('person')) {
    additionalContext = " The human presence in this image adds layers of emotional complexity, where expression, gesture, and positioning work together to tell a deeply personal story. The connection between subject and viewer creates an intimate and engaging experience."
  } else if (lowerName.includes('architecture') || lowerName.includes('building') || lowerName.includes('urban')) {
    additionalContext = " The architectural elements showcase the intersection of human creativity and functional design, where geometric forms and structural elements create a visual rhythm that speaks to our built environment's impact on daily life."
  } else if (lowerName.includes('abstract') || lowerName.includes('art') || lowerName.includes('creative')) {
    additionalContext = " The abstract qualities of this composition challenge conventional viewing, inviting interpretation and personal reflection. The interplay of form, color, and texture creates a visual language that speaks to the imagination."
  } else {
    additionalContext = " The unique character of this image stems from its ability to transform the ordinary into something extraordinary, revealing beauty and meaning in unexpected places."
  }

  // Combine template and additional context
  let fullScript = randomTemplate + additionalContext
  
  // Adjust script length to match target word count
  const words = fullScript.split(/\s+/)
  
  if (words.length > targetWordCount) {
    // Truncate to target word count
    fullScript = words.slice(0, targetWordCount).join(' ')
    if (!fullScript.endsWith('.')) {
      fullScript += '.'
    }
  } else if (words.length < targetWordCount && targetWordCount > 100) {
    // Extend with additional descriptive content
    const extensions = [
      " The interplay of light and shadow creates a dynamic visual rhythm that guides the viewer's eye through the composition.",
      " Each element within the frame has been carefully considered, contributing to the overall narrative and emotional impact.",
      " The technical execution demonstrates a deep understanding of both artistic principles and the medium's capabilities.",
      " This image stands as a testament to the photographer's ability to capture not just what is seen, but what is felt.",
      " The composition invites multiple readings, revealing new details and meanings with each viewing experience.",
      " Through careful use of color, texture, and form, the image creates a lasting impression that resonates long after viewing."
    ]
    
    while (fullScript.split(/\s+/).length < targetWordCount && extensions.length > 0) {
      const randomExtension = extensions.splice(Math.floor(Math.random() * extensions.length), 1)[0]
      fullScript += randomExtension
      
      if (fullScript.split(/\s+/).length >= targetWordCount) {
        const finalWords = fullScript.split(/\s+/).slice(0, targetWordCount)
        fullScript = finalWords.join(' ')
        if (!fullScript.endsWith('.')) {
          fullScript += '.'
        }
        break
      }
    }
  }

  return fullScript
}
