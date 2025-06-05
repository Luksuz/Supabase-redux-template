import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl, imageName, text, prompt } = await request.json()

    // Handle both image-based and text-based script generation
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!imageDataUrl && !text) {
      return NextResponse.json(
        { error: 'Either image data or text content is required' },
        { status: 400 }
      )
    }

    const contentName = imageName || 'Text Content'

    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using mock generation')
      const mockScript = generateMockScript(contentName, prompt, !!text)
      return NextResponse.json({
        success: true,
        script: mockScript,
        contentName: contentName,
        usingMock: true
      })
    }

    console.log(`🚀 Generating script for ${imageDataUrl ? 'image' : 'text'}: ${contentName}`)

    try {
      let messages: any[]

      if (imageDataUrl) {
        // Image-based script generation
        messages = [{
          role: "user",
          content: [
            { 
              type: "text", 
              text: `${prompt}\n\nPlease analyze this image titled "${contentName}" and create a compelling narration script based on what you see. Focus on the visual elements, mood, composition, and any story the image tells.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        }]
      } else {
        // Text-based script generation
        messages = [{
          role: "user",
          content: `${prompt}\n\nPlease create a script based on the following text content:\n\n"${text}"\n\nTransform this content into an engaging script following the provided instructions.`
        }]
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 400,
      })

      const script = response.choices[0]?.message?.content?.trim()
      
      if (script) {
        console.log(`✅ Generated script for: ${contentName}`)
        return NextResponse.json({
          success: true,
          script: script,
          contentName: contentName,
          usingMock: false
        })
      } else {
        console.error(`❌ No script generated for: ${contentName}`)
        throw new Error('No content generated from OpenAI')
      }

    } catch (openaiError: any) {
      console.error(`❌ OpenAI API error for ${contentName}:`, openaiError)
      
      // Fallback to mock if OpenAI fails
      const mockScript = generateMockScript(contentName, prompt, !!text)
      return NextResponse.json({
        success: true,
        script: `[AI Unavailable - Mock Script]\n\n${mockScript}`,
        contentName: contentName,
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
function generateMockScript(contentName: string, prompt: string, isTextBased: boolean = false): string {
  if (isTextBased) {
    const textTemplates = [
      `Based on the provided text content, this script transforms the raw material into a compelling narrative. ${prompt} The content has been restructured to flow naturally, with attention to pacing, clarity, and engagement. Each element has been carefully considered to maximize impact and maintain the audience's attention throughout.`,
      
      `This script adaptation takes the source text and elevates it through strategic storytelling techniques. ${prompt} The narrative structure has been optimized for audio delivery, with smooth transitions and clear pronunciation guides. The content maintains authenticity while improving accessibility and emotional resonance.`,
      
      `Working from the original text, this script creates a dynamic presentation that brings the content to life. ${prompt} The adaptation process has focused on clarity, engagement, and natural flow. Technical considerations for voice delivery have been integrated seamlessly with the narrative structure.`
    ]

    return textTemplates[Math.floor(Math.random() * textTemplates.length)]
  }

  // Original image-based templates
  const templates = [
    `In this captivating image titled "${contentName}", we witness a compelling visual narrative. ${prompt} The composition draws our attention through carefully balanced elements, where light and shadow work together to create depth and meaning. Every detail contributes to the overall story, from the subtle color palette to the thoughtful framing that guides our emotional response.`,
    
    `"${contentName}" presents a striking visual story that speaks directly to the viewer's imagination. ${prompt} The artistic vision is evident in the way visual elements are orchestrated - the interplay of textures, the rhythm of lines, and the harmony of colors all work to create a cohesive and impactful image. The photographer's or artist's technical skill is matched by their creative vision.`,
    
    `This remarkable image, "${contentName}", captures a moment that transcends the ordinary. ${prompt} The visual narrative unfolds through layers of meaning - from the immediate visual impact to the subtle details that reward closer inspection. The composition demonstrates mastery of both technical execution and artistic vision, creating an image that resonates with emotional depth.`,
    
    `In "${contentName}", we encounter a powerful visual statement that demands attention. ${prompt} The image succeeds in creating a dialogue between the subject and the viewer, using visual language that speaks across cultural and temporal boundaries. The careful attention to light, composition, and timing results in a photograph that captures not just a moment, but an entire mood and atmosphere.`
  ]

  const randomTemplate = templates[Math.floor(Math.random() * templates.length)]
  
  // Enhanced context based on image characteristics
  let additionalContext = ""
  const lowerName = contentName.toLowerCase()
  
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