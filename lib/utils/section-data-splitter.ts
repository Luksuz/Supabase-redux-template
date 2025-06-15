import { createClient } from '@/lib/supabase/server'

export interface SectionTrainingExample {
  messages: Array<{
    role: string
    content: string
  }>
  metadata: {
    split: "training" | "validation"
    job_id: string
    job_name: string
    job_theme: string
    sections_count: number
    created_at: string
  }
}

export interface SectionDataSplit {
  trainingData: SectionTrainingExample[]
  validationData: SectionTrainingExample[]
  summary: {
    totalJobs: number
    filteredJobs: number
    totalExamples: number
    trainingExamples: number
    validationExamples: number
    totalSections: number
    filters: { minSections: number }
  }
}

export async function getSectionDataSplit(
  userId: string, 
  minSections: number = 3
): Promise<SectionDataSplit> {
  const supabase = await createClient()
  
  // Fetch all jobs with their sections
  const { data: jobs, error } = await supabase
    .from('fine_tuning_jobs')
    .select(`
      id,
      name,
      theme,
      prompt_used,
      created_at,
      fine_tuning_outline_sections (
        id,
        title,
        writing_instructions,
        target_audience,
        tone,
        style_preferences,
        section_order
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Database error fetching jobs: ${error.message}`)
  }

  console.log('Found jobs:', jobs?.length || 0)

  // Transform data into training examples with filtering
  const allTrainingData: SectionTrainingExample[] = []
  let totalJobs = 0
  let filteredJobs = 0
  
  jobs?.forEach((job: any) => {
    totalJobs++
    
    // Apply filters - only include jobs with enough sections and a prompt
    const hasEnoughSections = job.fine_tuning_outline_sections && job.fine_tuning_outline_sections.length >= minSections
    const hasPrompt = job.prompt_used
    
    if (hasEnoughSections && hasPrompt) {
      filteredJobs++
      
      // Get the first section's metadata for context (target_audience, tone, style_preferences)
      const firstSection = job.fine_tuning_outline_sections[0] || {}
      
      // Create the sections array as it would be generated
      const sectionsOutput = job.fine_tuning_outline_sections
        .sort((a: any, b: any) => a.section_order - b.section_order)
        .map((section: any) => ({
          title: section.title,
          writingInstructions: section.writing_instructions
        }))

      const trainingExample: SectionTrainingExample = {
        messages: [
          {
            role: "system",
            content: job.prompt_used
          },
          {
            role: "user", 
            content: `Theme: ${job.theme}\n${firstSection.target_audience ? `Target Audience: ${firstSection.target_audience}\n` : ''}${firstSection.tone ? `Tone: ${firstSection.tone}\n` : ''}${firstSection.style_preferences ? `Style: ${firstSection.style_preferences}\n` : ''}Generate script sections for this theme.`
          },
          {
            role: "assistant",
            content: JSON.stringify({ sections: sectionsOutput }, null, 2)
          }
        ],
        metadata: {
          split: "training", // Will be updated for validation data
          job_id: job.id,
          job_name: job.name,
          job_theme: job.theme,
          sections_count: job.fine_tuning_outline_sections.length,
          created_at: job.created_at
        }
      }
      
      allTrainingData.push(trainingExample)
    }
  })

  if (allTrainingData.length === 0) {
    return {
      trainingData: [],
      validationData: [],
      summary: {
        totalJobs,
        filteredJobs: 0,
        totalExamples: 0,
        trainingExamples: 0,
        validationExamples: 0,
        totalSections: jobs?.reduce((acc: number, job: any) => acc + (job.fine_tuning_outline_sections?.length || 0), 0) || 0,
        filters: { minSections }
      }
    }
  }

  // Sort by creation time for consistent splits (CRITICAL: Use job ID as secondary sort for deterministic ordering)
  const sortedData = allTrainingData.sort((a, b) => {
    const timeA = new Date(a.metadata.created_at).getTime()
    const timeB = new Date(b.metadata.created_at).getTime()
    
    // If times are equal, sort by job_id for deterministic ordering
    if (timeA === timeB) {
      return a.metadata.job_id.localeCompare(b.metadata.job_id)
    }
    
    return timeA - timeB
  })
  
  // Calculate split indices for 80/20 split
  const totalCount = sortedData.length
  const trainEndIndex = Math.floor(totalCount * 0.8)
  
  // Get training set (80%)
  const trainingData = sortedData.slice(0, trainEndIndex).map(example => ({
    ...example,
    metadata: { ...example.metadata, split: "training" as const }
  }))
  
  // Get validation set (20%)
  const validationData = sortedData.slice(trainEndIndex).map(example => ({
    ...example,
    metadata: { ...example.metadata, split: "validation" as const }
  }))

  console.log(`Split summary: Total=${totalCount}, Training=${trainingData.length}, Validation=${validationData.length}`)

  return {
    trainingData,
    validationData,
    summary: {
      totalJobs: jobs?.length || 0,
      filteredJobs,
      totalExamples: totalCount,
      trainingExamples: trainingData.length,
      validationExamples: validationData.length,
      totalSections: jobs?.reduce((acc: number, job: any) => acc + (job.fine_tuning_outline_sections?.length || 0), 0) || 0,
      filters: { minSections }
    }
  }
} 