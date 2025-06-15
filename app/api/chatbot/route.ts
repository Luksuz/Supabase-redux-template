import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    // System prompt for the script generation assistant
    const systemPrompt = `You are a helpful AI assistant specialized in script generation and creative writing. You help users with:

1. Script writing techniques and best practices
2. Character development and dialogue
3. Story structure and narrative flow
4. Genre-specific writing advice
5. Creative brainstorming and idea generation
6. Fine-tuning and improving existing scripts
7. Understanding the script generation process
8. YouTube research integration for script enhancement

You should be:
- Encouraging and supportive
- Practical and actionable in your advice
- Knowledgeable about various writing genres
- Able to help with both technical and creative aspects
- Concise but thorough in your responses

Keep responses helpful, professional, and focused on script generation and creative writing assistance.`

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
      return NextResponse.json(
        { error: 'No response generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Chatbot API error:', error)
    
    // Return mock response if API fails
    const mockResponses = [
      "I'm here to help you with your script generation! What specific aspect of scriptwriting would you like assistance with?",
      "Great question! For script generation, I'd recommend focusing on clear character motivations and strong dialogue. What genre are you working with?",
      "That's an interesting challenge. In script writing, structure is key. Have you considered using the three-act structure for your narrative?",
      "I can definitely help with that! Script generation works best when you have a clear theme and target audience in mind. Tell me more about your project.",
      "Excellent! For fine-tuning your scripts, consider the emotional arc of your characters. What tone are you aiming for in your script?"
    ]
    
    const mockResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)]
    
    return NextResponse.json({
      success: true,
      response: mockResponse,
      timestamp: new Date().toISOString(),
      usingMock: true
    })
  }
} 