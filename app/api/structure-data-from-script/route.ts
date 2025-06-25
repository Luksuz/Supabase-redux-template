import { after, type NextRequest, NextResponse } from "next/server"
import { ChatAnthropic } from "@langchain/anthropic"
import { z } from "zod"

// Retry mechanism
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      console.log(`Attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

// Zod schemas for structured output
const SystemUserPromptsSchema = z.object({
  systemPrompt: z.string().describe("Clear, comprehensive instructions for the AI's behavior, role, and constraints"),
  userPrompt: z.string().describe("A realistic, contextually appropriate user input or question with all 6 required properties"),
})

const AssistantResponseSchema = z.object({
  sections: z.string().describe("A JSON array of sections, each with a title and array of writing instructions"),
})

export async function POST(request: NextRequest) {
  try {
    const { prompt, count = 3 } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable." },
        { status: 500 },
      )
    }

    // Create ChatAnthropic model
    const model = new ChatAnthropic({
      modelName: "claude-sonnet-4-20250514",
      temperature: 0.7,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      maxTokens: 20000,
    })

    console.log('Sending request to Anthropic via LangChain...')
    
    // FIRST LLM CALL: Generate System and User Prompts (with retry)
    const systemUserModel = model.withStructuredOutput(SystemUserPromptsSchema)
    
    const systemUserMessage = `Generate natural language system and user prompts for AI training data.

## System Prompt Requirements:
Create a natural language system prompt that explains:
- The AI's role and identity 
- What the AI should do
- How it should behave
- Any constraints or guidelines
- The specific domain expertise needed

## User Prompt Requirements:
Create a natural language user prompt that includes:
- A clear request or question
- Context about the task
- The 6 required properties mentioned naturally in the text:
  * Theme: The subject matter
  * Target Audience: Who this is for
  * Tone: Communication style desired
  * Style Preferences: How it should be written
  * Additional Context: Background information
  * Additional Research: Generate actual mock research materials such as realistic news article excerpts, court document quotes, witness statements, police report details, expert quotes, etc. These should be specific, detailed, and sound authentic - not instructions about what research to gather. IMPORTANT: If the input script mentions that links were not found or research is missing, ignore that and create comprehensive research materials as if they were available.

Both prompts should be written in natural, conversational language with bullet points where appropriate - NOT as structured lists or JSON.

Create training data prompts for this script: ${prompt}

IMPORTANT NOTE: If the input script mentions missing research, broken links, or unavailable sources, disregard those mentions and generate comprehensive, realistic research materials as if all sources were successfully found and available.

Example of natural language style:
System Prompt: "You are an expert video scriptwriter who specializes in creating engaging true crime content for YouTube. Your role is to help users write compelling scripts that balance factual accuracy with dramatic storytelling..."

User Prompt: "I need help writing a script for a true crime video about courtroom drama. The theme should focus on shocking defendant outbursts and family confrontations. My target audience is adults aged 25-65 who enjoy true crime content. The tone should be dramatic and suspenseful while remaining factual. For style preferences, I want short punchy sentences and cliffhanger transitions. Additional context: this is for a YouTube compilation video. Additional research: According to court transcript #2847, the defendant shouted 'You don't understand what happened!' before security intervened. CNN reported on March 15th: 'Family members were escorted from the courtroom after the emotional outburst.' Police report #445-2023 states 'Defendant required physical restraint by three officers.' Witness Maria González told local news: 'I've never seen anything like it in 20 years of court reporting.'"

Generate similar natural language prompts with actual research materials, not research instructions.`

    const systemUserResult = await retryWithBackoff(async () => {
      return await systemUserModel.invoke([
        { role: "user", content: systemUserMessage }
      ])
    })

    console.log('First LLM call completed - System and User prompts generated')

    // SECOND LLM CALL: Generate Assistant Response (with retry)
    const assistantModel = model.withStructuredOutput(AssistantResponseSchema)
    
    const assistantMessage = `You must generate a JSON response with an "sections" field containing an array of sections.

Based on this context:
System Prompt: ${systemUserResult.systemPrompt}
User Prompt: ${systemUserResult.userPrompt}

Create a sections array with 11 sections, each with:
- title: A clear section name
- writing_instructions: A formatted string with appropriate properties based on the user prompt requirements:

IMPORTANT: You must return a formatted string with the exact structure:
\`\`\`json
{
  "sections": [
    {
      "title": "Mackenzie Shirilla",
      "writing_instructions": 
- Begin with the exact line: "This… is Mackenzie Schirilla, who's facing charges of murder, aggravated vehicular homicide, felonious assault, and drug possession in Ohio." Include her full name, all charges, and the location.
- Describe the July 31, 2022 crash, mentioning CCTV footage showing the Toyota Camry making a normal turn before accelerating to over 100 mph with Schirilla, her boyfriend Dominic Russo, and friend Davion Flanagan inside.
- State that Russo (20) and Flanagan (19) died, while Schirilla survived with minor injuries.
- Highlight Schirilla's behavior after the crash, including attending parties and trying to cover up the incident as an accident.
- Narrate the confrontations in court, first by Russo's brother, then Flanagan's sister, and describe Schirilla's response.
- Present the anticipation of the judge's decision, then state Schirilla's sentence of 30 years to life.
- End with a teaser: "There's still some who doubt that Mackenzie murdered her friends on purpose… but how does that compare to a murderous friend whose guilt lands her in a mental institution?" to build suspense for the next segment.
- Keep language clear and concise, balancing the crash's details with courtroom emotional moments and sentencing.
      
    },
    {
      "title": "Rachel Shoaf & Shelia Eddy",
      "writing_instructions": 
- Start exactly with: "This… is Rachel Shoaf, who, along with her best friend Shelia Eddy, is charged with kidnapping and murder in Morgantown, West Virginia." Name all accused, the charges, and the location.
- Explain the friendship between Rachel, Shelia, and Skylar Neese. Mention Skylar's disappearance on July 6, 2012, and Shelia's confession call to Skylar's mom.
- Describe the police investigation and the six months of silence, rumors, and the girls' odd behavior at school.
- Show Rachel snapping, being institutionalized, then confessing to the lead detective. Detail the planning, the murder night with murder supplies, the drive to the woods, and Skylar's murder and burial.
- Narrate police finding Skylar's remains, Shelia's fake memorial tweet, and her arrest with DNA evidence.
- Describe the fallout of the friendship, mean tweets, rumors of a secret sexual relationship, and Shelia's ominous tweet after the crime.
- Contrast Shelia's lack of confidence with Rachel's remorse, and show Skylar's dad's reaction.
- Include Rachel's and Shelia's sentencing moments.
- End with a hook: "These teenage murders sent some heartless tweets… but how can that compare to someone who takes an incriminating Snapchat video from the back of a police car?" to set the stage for the next segment.
- Keep the narration clear and emotionally engaging, balancing crime facts, psychological elements, and courtroom reactions to sustain interest.
      
    },
    {
      "title": "Aiden Fucci",
      "writing_instructions": 
- Start exactly with: "This… is Aiden Fucci, who's facing first-degree murder charges in Florida." Include his full name, charges, and location.
- Describe the May 9th, 2022 disappearance of 13-year-old Tristyn Bailey. Mention neighbor's security footage showing Bailey and Fucci near 1 AM, and later Fucci running alone.
- Identify Fucci as Bailey's high school classmate and neighbor.
- Narrate police finding Fucci and a friend, placing them in a patrol car during the ongoing search.
- Report the discovery of Bailey's body stabbed 114 times in a retention pond nearby.
- Mention Fucci's suspicious Snapchat posts pretending concern for Bailey.
- Highlight that Fucci's parents questioned him intensely during interrogation.
- Explain Fucci's story and his failed insanity defense attempt involving claims of demons.
- Present the sentencing and note his parole eligibility at age 42.
- End with either: "Fucci's motive remains a mystery to this very day… but in this next case, the motive is shockingly inconsequential." or "Fucci's heinous crime left a young family torn apart… but how does that compare to students who murder their own teacher over a simple disagreement?"
- Use direct, clear narration balancing the chilling crime, courtroom moments, and the mystery around motive.
    },
    {
      "title": "Willard Miller & Jeremy Goodale",
      "writing_instructions": 
- Begin exactly with: "This… is Willard Miller and his co-conspirator Jeremy Goodale, who are both facing first-degree murder charges in Fairfield, Iowa." Include full names, ages (16), charges, and location.
- Describe how the boys stalked their Spanish teacher Nohema Graber and ambushed her in Chautauqua Park.
- Mention the discovery of her body on November 2nd, 2021, near railroad tracks under a tarp.
- Highlight that Miller and Goodale documented their crime on Snapchat, bragging and joking, which led to their exposure after Graber's disappearance.
- Narrate their arrest and Goodale's confession, including the stalking behavior and the ambush with Miller wielding a baseball bat.
- Describe the dumping of the body in a wheelbarrow.
- Explain the motive: Miller's anger over a bad grade and recruiting Goodale to help commit murder.
- Note both pleaded guilty, Goodale apologized, but it was too late.
- Both sentenced to life imprisonment.
- End with a hook connecting this crime to a more chaotic school shooting: "These teenagers murdered their Spanish teacher out of anger… but how does that compare to someone who opens fire in a group of students?"
- Use clear, concise narration focusing on the escalation from a bad grade to a brutal murder, the role of social media in their capture, and courtroom outcomes.
      
    },
    {
      "title": "Brandon Spencer",
      "writing_instructions": 
- Open with: "This… is Brandon Spencer, who's charged with attempted murder in California." Include full name, charges, and location.
- Describe the Halloween 2012 USC college party shooting.
- Emphasize Spencer's intention to target a rival gang member amidst a crowded party.
- Note the absence of casualties and LAPD's initial uncertainty about the attempted murder charge.
- Mention the public's perception of Spencer as a dangerous gang member, contrasted with Spencer's plea in court.
- State that Spencer received the maximum sentence.
- Include the perspective of a student who attended the party, reflecting on the event.
- End by teasing the next case: "Spencer's reckless endangerment of strangers landed him in jail for life… but how does that compare to a teenager who plots a brutal murder against her elderly grandparents?"
- Keep narration tight and clear, balancing crime description, courtroom drama, and public reaction.
      
    },
    {
      "title": "Holly Harvey & Sandra Ketchum",
      "writing_instructions": 
- Start with: "This… is Holly Harvey and her girlfriend Sandra Ketchum, who are facing two counts of murder in Lafayette County, Georgia." Include full names, ages (15 for Harvey), charges, and location.
- Outline Harvey's move from her mother's care to her strict grandparents after her mother's imprisonment in 2004, and the curfew and restrictions imposed, including banning Ketchum.
- Describe how Harvey snapped after about four months and, on August 2, 2004, the pair used marijuana to lure the grandparents downstairs.
- Narrate the violent attack, including Carl's attempt to call 911, the stabbing (more than 15 times), and the theft of valuables and the pickup truck.
- Show Sarah Collier's refusal to let the girls inside, then calling police; police discovering the murders.
- Mention the girls' arrest at a beach house, noting only Ketchum showed remorse.
- Describe their sobbing in court, and the sentence details: Ketchum's three life sentences with parole possible in 10 years, Harvey's two life sentences with parole in 20 years.
- Close with a hook teasing the next story, contrasting this crime motivated by love with a killer who murders to impress friends.
- Use clear, emotionally charged narration to highlight the tension between love, rebellion, and violent tragedy.
      
    },
    {
      "title": "Konrad Schafer",
      "writing_instructions": 
- Open with: "This… is Konrad Schafer, who's charged with 2 counts of first degree murder in Florida." Include name, age (15), charges, and location.
- Explain that in July 2013, Schafer stole his father's gun to impress older friends.
- Describe the first shooting in a parking lot that killed Guerrero.
- Detail the second crime: Schafer and friends heard Roopnarine received $18,000 from a settlement; Victoria Rios lured him in, then Schafer and friends demanded money, shooting Roopnarine in the face when he couldn't pay.
- Highlight the careless mistake—leaving a bullet casing, which linked the gun to Schafer's father's pistol.
- Show that police traced the casing and arrested Schafer and his accomplices quickly.
- Mention Schafer's apology to victims' families and their rejection.
- State Schafer's sentence and note his parole eligibility won't come until his 40s.
- Close with a hook contrasting Schafer's motive of money with the next killer's motive to murder their own mother.
- Keep narration direct and clear, emphasizing the sequence of crimes, the forensic mistake, courtroom reaction, and sentencing.
      
    },
    {
      "title": "Gregory Ramos",
      "writing_instructions": 
- Start exactly with: "This… is Gregory Ramos, who's facing charges of first degree murder, abuse of a dead body, and tampering with evidence in Volusia County, Florida." Include full name, charges, and location.
- Describe Ramos returning home on November 2, 2018, to find his house ransacked and his mother missing.
- Convey police arriving and observing the destruction, setting a mysterious or suspicious tone with "something wasn't adding up."
- Portray Ramos snapping and confessing coldly to killing his mother over an argument about his bad grades.
- State he pleaded guilty to all charges and was sentenced.
- End with a hook contrasting Ramos' premeditated crime with the upcoming story of friends committing murder spontaneously out of boredom.
- Keep the tone concise and impactful, highlighting the coldness of the confession and the breakdown of Ramos' plan under pressure.
      
    },
    {
      "title": "Nicholas Karol-Chik, Zachary Kwak, Joseph Koenig",
      "writing_instructions": 
- Start with the exact phrase: "This… is Nicholas Karol-Chik, Joseph Koenig, and Zachary Kwak, who are all facing charges of first degree murder in Denver, Colorado." Make sure to mention all three names, charges, and location clearly.
- Describe the event on April 19th, 2023, when the three high school seniors decided to throw heavy rocks from their speeding car, endangering multiple vehicles.
- Include the detail that seven cars were hit, highlighting Alexa Bartell's car as the fatal victim.
- Detail the fatal injury to Bartell, emphasizing the moment her friend on the phone heard the crash and traced her location.
- Explain how police used street cameras and phone records to identify the suspects.
- Mention the 13 counts charged against them, including first-degree murder and assault, and that Karol and Kwak pleaded guilty while Koenig's trial is pending.
- State that if found guilty, all three face life in prison.
- End with a hook comparing this reckless act to an even more brutal crime involving a math teacher to build suspense for the next segment.
- Keep the narration clear and concise, letting the gravity of the reckless killing and the investigation details come through vividly. 
    },
    {
      "title": "Philip Chism",
      "writing_instructions": 
- Begin with the phrase: "This… is Philip Chism, who's facing charges of rape, armed robbery, and first-degree murder in Danvers, Massachusetts." Clearly state his name, charges, and location.
- Describe the detailed sequence of events caught on school security cameras in October 2013: how Chism followed his math teacher into the bathroom, his suspicious behavior including putting on gloves, leaving with the teacher's clothing, changing clothes multiple times, returning in disguise to clean up, and moving a heavy garbage container across the parking lot.
- Make sure to highlight his multiple outfit changes, the fear-induced retreat after being spotted, and his final check of the crime scene.
- Note that Ritzer's body was found naked from the waist down with her throat slit, and a note reading "I hate you all" was left next to her.
- State that the security footage was damning and led to Chism's immediate arrest.
- Mention the description of Chism's creepy behavior by friends and family during court, and his cold, unemotional demeanor.
- Conclude with the moment Chism was sentenced to life in prison, using the phrase: "Chism will serve a life sentence."
- Write the narration clearly and succinctly, letting the security footage story carry the tension and gravity of the crime.
    }
  ]
}
\`\`\`

Make sure you are detailed about the writing instructions. Your response will be lengthy, so dont miss out on any writing instructions properties.

Generate sections that help someone write content based on the user prompt requirements.`

    const assistantResult = await retryWithBackoff(async () => {
      return await assistantModel.invoke([
        { role: "user", content: assistantMessage }
      ])
    })

    console.log('Second LLM call completed - Assistant response generated')

    // Combine results and return
    return NextResponse.json({
      success: true,
      systemPrompt: systemUserResult.systemPrompt,
      userPrompt: systemUserResult.userPrompt,
      assistantResponse: assistantResult.sections,
    })
  } catch (error) {
    console.error("Error generating training data:", error)
    return NextResponse.json(
      { error: "Failed to generate training data: " + (error as Error).message },
      { status: 500 },
    )
  }
}
