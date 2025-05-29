import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl, imageName, prompt } = await request.json()

    if (!imageDataUrl || !prompt) {
      return NextResponse.json(
        { error: 'Image data and prompt are required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock generation')
      const mockScript = generateMockScript(imageName, prompt)
      return NextResponse.json({
        success: true,
        script: mockScript,
        imageName: imageName,
        usingMock: true
      })
    }

    console.log(`🚀 Generating script for image: ${imageName}`)

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { 
              type: "text", 
              text: `${prompt}\n\nPlease analyze this image titled "${imageName}" and create a compelling narration script based on what you see. Focus on the visual elements, mood, composition, and any story the image tells.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl, // Using data URL directly
              },
            },
          ],
        }],
        max_tokens: 400, // Slightly higher for more detailed scripts
      })

      const script = response.choices[0]?.message?.content?.trim()
      
      if (script) {
        console.log(`✅ Generated script for image: ${imageName}`)
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
      console.error(`❌ OpenAI API error for ${imageName}:`, openaiError)
      
      // Fallback to mock if OpenAI fails
      const mockScript = generateMockScript(imageName, prompt)
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
function generateMockScript(imageName: string, prompt: string): string {
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

  return randomTemplate + additionalContext
}

/* 
TODO: Replace with actual AI integration
Example OpenAI Vision API integration:

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function generateRealScript(imageDataUrl: string, imageName: string, prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${prompt}\n\nPlease analyze this image titled "${imageName}" and create a compelling narration script based on what you see.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    })

    return response.choices[0]?.message?.content || "Could not generate script for this image."
  } catch (error) {
    throw new Error(`OpenAI API error: ${error}`)
  }
}
*/ 