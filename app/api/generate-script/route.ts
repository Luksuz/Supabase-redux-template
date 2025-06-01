import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl, imageName, prompt, batchInfo, wordCount } = await request.json()

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
    if (targetWordCount > 300) {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount+200} words. feel free to add some extra words to make it more detailed and engaging.`
    } else {
      wordCountInstruction = `Please write a very detailed script approximately ${targetWordCount+100} words. feel free to add some extra words to make it more detailed and engaging.`
    }
    // Create word count instruction

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
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

  } catch (error) {
    console.error('Error generating script:', error)
    return NextResponse.json(
      { error: 'Failed to generate script: ' + (error as Error).message },
      { status: 500 }
    )
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
