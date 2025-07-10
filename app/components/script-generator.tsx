'use client'

import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { 
  createNewJob,
  startGeneratingSections,
  setSections,
  updateSection,
  startGeneratingScript,
  addGeneratedText,
  startGeneratingAllScripts,
  setLoading,
  setError,
  loadJobs,
  type FineTuningJob,
  type FineTuningSection,
  setCurrentJob
} from '@/lib/features/scripts/scriptsSlice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Copy, Download, Plus, Wand2, FileText, Youtube, Database, YoutubeIcon } from 'lucide-react'
import { showToast } from '@/lib/utils/toast'

export default function ScriptGenerator() {
  const dispatch = useAppDispatch()
  const { currentJob, jobs, isLoading, error } = useAppSelector((state) => state.scripts)
  
  // Get YouTube research data from Redux store
  const youtubeState = useAppSelector((state) => state.youtube)

  // Form states
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [theme, setTheme] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [tone, setTone] = useState('')
  const [stylePreferences, setStylePreferences] = useState('')

  // YouTube data integration state
  const [includeYouTubeData, setIncludeYouTubeData] = useState(false)
  const [youtubeDataSummary, setYoutubeDataSummary] = useState('')

  // Load jobs on component mount
  useEffect(() => {
    loadJobsFromDB()
  }, [])

  // Update YouTube data summary when YouTube state changes
  useEffect(() => {
    generateYouTubeDataSummary()
    
    // Debug: Log the current YouTube state
    console.log('🔍 YouTube state updated:', {
      videosSummary: !!youtubeState.videosSummary,
      analysisResults: youtubeState.analysisResults?.length || 0,
      googleResearchSummaries: youtubeState.googleResearchSummaries?.length || 0,
      youtubeResearchSummaries: youtubeState.youtubeResearchSummaries?.length || 0,
      subtitleFiles: youtubeState.subtitleFiles?.filter(sf => sf.status === 'completed').length || 0,
      appliedGoogleResearch: youtubeState.googleResearchSummaries?.filter(r => r.appliedToScript).length || 0,
      appliedYouTubeResearch: youtubeState.youtubeResearchSummaries?.filter(r => r.appliedToScript).length || 0
    })
  }, [youtubeState])

  const generateYouTubeDataSummary = () => {
    const subtitleCount = youtubeState.subtitleFiles?.filter(sf => sf.status === 'completed').length || 0
    const analysisCount = youtubeState.analysisResults?.length || 0
    const hasSummary = !!youtubeState.videosSummary
    const researchCount = (youtubeState.googleResearchSummaries?.length || 0) + (youtubeState.youtubeResearchSummaries?.length || 0)
    
    if (subtitleCount === 0 && analysisCount === 0 && !hasSummary && researchCount === 0) {
      setYoutubeDataSummary('No YouTube research data available')
      return
    }

    const parts = []
    if (subtitleCount > 0) parts.push(`${subtitleCount} video transcripts`)
    if (analysisCount > 0) parts.push(`${analysisCount} transcript analyses`)
    if (hasSummary) parts.push('video collection summary')
    if (researchCount > 0) parts.push(`${researchCount} research summaries`)
    
    setYoutubeDataSummary(`Available: ${parts.join(', ')}`)
  }

  const buildYouTubeResearchContext = () => {
    // Check if there's any YouTube data available
    const hasVideosSummary = !!youtubeState.videosSummary
    const hasAnalysisResults = youtubeState.analysisResults && youtubeState.analysisResults.length > 0
    const hasGoogleResearch = youtubeState.googleResearchSummaries && youtubeState.googleResearchSummaries.length > 0
    const hasYouTubeResearch = youtubeState.youtubeResearchSummaries && youtubeState.youtubeResearchSummaries.length > 0
    const hasCompletedSubtitles = youtubeState.subtitleFiles && youtubeState.subtitleFiles.filter(sf => sf.status === 'completed').length > 0
    
    if (!hasVideosSummary && !hasAnalysisResults && !hasGoogleResearch && !hasYouTubeResearch && !hasCompletedSubtitles) {
      console.log('❌ No YouTube research data available')
      return ''
    }

    console.log('✅ Building YouTube research context with:', {
      hasVideosSummary,
      hasAnalysisResults,
      hasGoogleResearch,
      hasYouTubeResearch,
      hasCompletedSubtitles
    })

    let context = '\n\n=== YOUTUBE RESEARCH DATA ===\n'
    
    // Collect all YouTube links and timestamps for easy reference
    const youtubeLinks: Array<{ url: string; timestamp?: string; title?: string; description?: string }> = []
    
    // Add note about applied research (prioritized)
    const appliedGoogleResearch = youtubeState.googleResearchSummaries?.filter(r => r.appliedToScript) || []
    const appliedYouTubeResearch = youtubeState.youtubeResearchSummaries?.filter(r => r.appliedToScript) || []
    
    if (appliedGoogleResearch.length > 0 || appliedYouTubeResearch.length > 0) {
      context += `\n--- PRIORITIZED APPLIED RESEARCH ---\n`
      context += `✓ ${appliedGoogleResearch.length} Google research summaries marked as applied\n`
      context += `✓ ${appliedYouTubeResearch.length} YouTube research summaries marked as applied\n`
      context += `Note: These research summaries were specifically selected for script generation.\n\n`
    }

    // Add video summaries if available
    if (youtubeState.videosSummary) {
      context += '\n--- VIDEO COLLECTION ANALYSIS ---\n'
      context += `Overall Theme: ${youtubeState.videosSummary.overallTheme}\n\n`
      
      context += 'Key Insights:\n'
      youtubeState.videosSummary.keyInsights.forEach((insight, i) => {
        context += `${i + 1}. ${insight}\n`
      })
      
      context += '\nNarrative Themes:\n'
      youtubeState.videosSummary.narrativeThemes.forEach((theme, i) => {
        context += `${i + 1}. ${theme}\n`
      })
      
      // Add character insights if available
      if (youtubeState.videosSummary.characterInsights && youtubeState.videosSummary.characterInsights.length > 0) {
        context += '\nCharacter Insights:\n'
        youtubeState.videosSummary.characterInsights.forEach((insight, i) => {
          context += `${i + 1}. ${insight}\n`
        })
      }
      
      // Add conflict elements if available
      if (youtubeState.videosSummary.conflictElements && youtubeState.videosSummary.conflictElements.length > 0) {
        context += '\nConflict Elements:\n'
        youtubeState.videosSummary.conflictElements.forEach((conflict, i) => {
          context += `${i + 1}. ${conflict}\n`
        })
      }
      
      // Add story ideas if available
      if (youtubeState.videosSummary.storyIdeas && youtubeState.videosSummary.storyIdeas.length > 0) {
        context += '\nStory Ideas:\n'
        youtubeState.videosSummary.storyIdeas.forEach((idea, i) => {
          context += `${i + 1}. ${idea}\n`
        })
      }
      
      // Add common patterns if available
      if (youtubeState.videosSummary.commonPatterns && youtubeState.videosSummary.commonPatterns.length > 0) {
        context += '\nCommon Patterns:\n'
        youtubeState.videosSummary.commonPatterns.forEach((pattern, i) => {
          context += `${i + 1}. ${pattern}\n`
        })
      }
      
      context += `\nCreative Prompt: ${youtubeState.videosSummary.creativePrompt}\n`
      
      // Add individual video summaries with enhanced fields and YouTube links
      context += '\n--- INDIVIDUAL VIDEO ANALYSIS ---\n'
      youtubeState.videosSummary.videoSummaries.forEach((video, i) => {
        // Generate YouTube URL from videoId
        const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`
        youtubeLinks.push({
          url: youtubeUrl,
          timestamp: video.timestamp,
          title: video.title,
          description: `Video ${i + 1}: ${video.mainTopic}`
        })
        
        context += `\nVideo ${i + 1}: ${video.title}\n`
        context += `YouTube Link: ${youtubeUrl}\n`
        if (video.timestamp) {
          context += `Key Timestamp: ${video.timestamp} (${youtubeUrl}&t=${Math.floor(srtToSeconds(video.timestamp))}s)\n`
        }
        context += `Main Topic: ${video.mainTopic}\n`
        context += `Emotional Tone: ${video.emotionalTone}\n`
        
        context += 'Key Points:\n'
        video.keyPoints.forEach(point => context += `- ${point}\n`)
        
        context += 'Narrative Elements:\n'
        video.narrativeElements.forEach(element => context += `- ${element}\n`)
        
        // Add ALL timestamps from analysis if available
        if (video.timestamps && video.timestamps.length > 0) {
          context += `\nDetailed Timestamps (${video.timestamps.length} total):\n`
          video.timestamps.forEach((timestamp: any, index: number) => {
            const timestampUrl = `${youtubeUrl}&t=${Math.floor(srtToSeconds(timestamp.startTime))}s`
            context += `${index + 1}. ${timestamp.startTime} - ${timestamp.endTime}: [${timestamp.speaker}]\n`
            if (timestamp.quote) {
              context += `   Quote: "${timestamp.quote}"\n`
            }
            context += `   Description: ${timestamp.description}\n`
            context += `   Significance: ${timestamp.significance}\n`
            context += `   Context: ${timestamp.extraInfo}\n`
            context += `   YouTube Link: ${timestampUrl}\n`
            
            // Add to youtubeLinks for reference
            youtubeLinks.push({
              url: timestampUrl,
              timestamp: timestamp.startTime,
              title: `${video.title} - ${timestamp.startTime}`,
              description: timestamp.description
            })
          })
        }
        
        // Add enhanced fields if available
        if (video.keyQuotes && video.keyQuotes.length > 0) {
          context += '\nKey Quotes with Timestamps:\n'
          video.keyQuotes.forEach((quote: any) => {
            const quoteUrl = `${youtubeUrl}&t=${Math.floor(srtToSeconds(quote.startTime))}s`
            context += `- [${quote.startTime}-${quote.endTime}] ${quote.speaker}: "${quote.quote}"\n`
            context += `  Context: ${quote.context}\n`
            context += `  YouTube Link: ${quoteUrl}\n`
            
            // Add to youtubeLinks for reference
            youtubeLinks.push({
              url: quoteUrl,
              timestamp: quote.startTime,
              title: `${video.title} - Quote at ${quote.startTime}`,
              description: `Quote by ${quote.speaker}: ${quote.quote.substring(0, 100)}...`
            })
          })
        }
        
        if (video.dramaticElements && video.dramaticElements.length > 0) {
          context += 'Dramatic Elements:\n'
          video.dramaticElements.forEach(element => context += `- ${element}\n`)
        }
        
        if (video.contextualInfo) {
          context += `Contextual Information: ${video.contextualInfo}\n`
        }
      })
    }

    // Add transcript analysis results with YouTube links
    if (youtubeState.analysisResults && youtubeState.analysisResults.length > 0) {
      context += '\n--- TRANSCRIPT ANALYSIS RESULTS ---\n'
      youtubeState.analysisResults.forEach((result, i) => {
        context += `\nAnalysis ${i + 1} - Query: "${result.query}"\n`
        result.analysis.forEach((analysis, j) => {
          context += `Result ${j + 1}:\n`
          context += `- Summary: ${analysis.summary}\n`
          context += `- Relevant Content: "${analysis.relevantContent}"\n`
          context += `- Timestamp: ${analysis.timestamp}\n`
          context += `- Confidence: ${Math.round(analysis.confidence * 100)}%\n`
          
          // Add YouTube URL with timestamp if available
          if (analysis.youtubeUrl) {
            context += `- YouTube Link: ${analysis.youtubeUrl}\n`
            youtubeLinks.push({
              url: analysis.youtubeUrl,
              timestamp: analysis.timestamp,
              title: `Analysis: ${result.query}`,
              description: analysis.summary
            })
          }
          
          // Add enhanced analysis fields
          if (analysis.keyQuotes && analysis.keyQuotes.length > 0) {
            context += `- Key Quotes: ${analysis.keyQuotes.map(q => `"${q}"`).join(', ')}\n`
          }
          
          if (analysis.dramaticElements && analysis.dramaticElements.length > 0) {
            context += `- Dramatic Elements: ${analysis.dramaticElements.join(', ')}\n`
          }
          
          if (analysis.contextualInfo) {
            context += `- Context: ${analysis.contextualInfo}\n`
          }
        })
      })
    }

    // Add ALL Google research summaries (applied ones are prioritized above)
    if (youtubeState.googleResearchSummaries && youtubeState.googleResearchSummaries.length > 0) {
      context += '\n--- GOOGLE RESEARCH SUMMARIES ---\n'
      youtubeState.googleResearchSummaries.forEach((research, i) => {
        const isApplied = research.appliedToScript ? ' [APPLIED]' : ''
        context += `\nGoogle Research ${i + 1}${isApplied}: ${research.query}\n`
        context += `Insights: ${research.insights}\n`
        context += 'Key Findings:\n'
        research.keyFindings.forEach(finding => context += `- ${finding}\n`)
        context += 'Recommendations:\n'
        research.recommendations.forEach(rec => context += `- ${rec}\n`)
        
        // Add web search result links
        if (research.webResults && research.webResults.length > 0) {
          context += 'Source Links:\n'
          research.webResults.slice(0, 3).forEach((webResult, idx) => {
            context += `- ${webResult.title}: ${webResult.link}\n`
          })
        }
      })
    }

    // Add ALL YouTube research summaries (applied ones are prioritized above)
    if (youtubeState.youtubeResearchSummaries && youtubeState.youtubeResearchSummaries.length > 0) {
      context += '\n--- YOUTUBE RESEARCH SUMMARIES ---\n'
      youtubeState.youtubeResearchSummaries.forEach((research, i) => {
        const isApplied = research.appliedToScript ? ' [APPLIED]' : ''
        context += `\nYouTube Research ${i + 1}${isApplied}: ${research.query}\n`
        context += `Overall Theme: ${research.videosSummary.overallTheme}\n`
        context += 'Key Insights:\n'
        research.videosSummary.keyInsights.forEach(insight => context += `- ${insight}\n`)
        
        // Add YouTube links from video summaries with ALL timestamps
        if (research.videosSummary.videoSummaries) {
          context += 'Video References:\n'
          research.videosSummary.videoSummaries.forEach((video, vidIdx) => {
            const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`
            context += `- ${video.title}: ${youtubeUrl}\n`
            
            // Add ALL timestamps if available
            if (video.timestamps && video.timestamps.length > 0) {
              context += `  Timestamps (${video.timestamps.length} total):\n`
              video.timestamps.forEach((timestamp: any, tsIdx: number) => {
                const timestampUrl = `${youtubeUrl}&t=${Math.floor(srtToSeconds(timestamp.startTime))}s`
                context += `    ${tsIdx + 1}. ${timestamp.startTime}-${timestamp.endTime}: [${timestamp.speaker}] ${timestamp.description}\n`
                if (timestamp.quote) {
                  context += `       Quote: "${timestamp.quote}"\n`
                }
                
                youtubeLinks.push({
                  url: timestampUrl,
                  timestamp: timestamp.startTime,
                  title: `${video.title} - ${timestamp.startTime}`,
                  description: timestamp.description
                })
              })
            } else {
              youtubeLinks.push({
                url: youtubeUrl,
                timestamp: video.timestamp,
                title: video.title,
                description: `YouTube Research: ${research.query}`
              })
            }
          })
        }
      })
    }

    // Add subtitle content (first few for context)
    const completedSubtitles = youtubeState.subtitleFiles?.filter(sf => sf.status === 'completed') || []
    if (completedSubtitles.length > 0) {
      context += '\n--- TRANSCRIPT EXCERPTS ---\n'
      completedSubtitles.slice(0, 3).forEach((subtitle, i) => {
        const youtubeUrl = `https://www.youtube.com/watch?v=${subtitle.videoId}`
        context += `\nTranscript ${i + 1}: ${subtitle.title}\n`
        context += `YouTube Link: ${youtubeUrl}\n`
        // Extract first few lines of subtitle for context
        const lines = subtitle.srtContent.split('\n').slice(0, 20).join('\n')
        context += `Content Preview:\n${lines}\n...\n`
        
        youtubeLinks.push({
          url: youtubeUrl,
          title: subtitle.title,
          description: `Transcript: ${subtitle.title}`
        })
      })
    }

    // Add summary of all YouTube links found
    if (youtubeLinks.length > 0) {
      context += '\n--- YOUTUBE LINKS SUMMARY ---\n'
      context += `Total YouTube references found: ${youtubeLinks.length}\n`
      youtubeLinks.forEach((link, i) => {
        context += `${i + 1}. ${link.title}: ${link.url}`
        if (link.timestamp) {
          context += ` (at ${link.timestamp})`
        }
        context += `\n`
      })
    }

    context += '\n=== END YOUTUBE RESEARCH DATA ===\n'
    
    console.log('📝 Generated YouTube research context length:', context.length)
    console.log('📝 YouTube links found:', youtubeLinks.length)
    console.log('📝 Context preview:', context.substring(0, 300) + '...')
    
    return context
  }

  // Helper function to convert SRT timestamp to seconds
  const srtToSeconds = (srtTimestamp: string): number => {
    try {
      const [time, ms] = srtTimestamp.split(',')
      const [hours, minutes, seconds] = time.split(':').map(Number)
      return hours * 3600 + minutes * 60 + seconds + (Number(ms) || 0) / 1000
    } catch (error) {
      console.warn('Failed to parse SRT timestamp:', srtTimestamp)
      return 0
    }
  }

  const loadJobsFromDB = async () => {
    try {
      dispatch(setLoading(true))
      const response = await fetch('/api/fine-tuning/jobs')
      const data = await response.json()
      
      if (response.ok) {
        dispatch(loadJobs(data.jobs))
      } else {
        dispatch(setError(data.error || 'Failed to load jobs'))
      }
    } catch (error) {
      dispatch(setError('Failed to load jobs'))
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleCreateJob = async () => {
    if (!name || !theme) return

    try {
      dispatch(setLoading(true))
      
      console.log('🏗️ Creating job with:', { name, theme, description })
      
      // Build enhanced description with YouTube data if included
      let enhancedDescription = description
      if (includeYouTubeData) {
        const youtubeContext = buildYouTubeResearchContext()
        enhancedDescription = `${description}\n\n=== YOUTUBE RESEARCH DATA INCLUDED ===\n${youtubeContext}`
      }
      
      // Create job in database
      const response = await fetch('/api/fine-tuning/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          description: enhancedDescription, 
          theme,
          includeYouTubeData,
          youtubeDataSummary: includeYouTubeData ? youtubeDataSummary : null
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        console.log('✅ Job created in database:', data.job)
        
        // Create job in Redux state with the actual database ID
        const newJob = {
          id: data.job.id,
          name: data.job.name,
          description: enhancedDescription,
          theme: data.job.theme,
          model_name: data.job.model_name || 'gpt-4o-mini',
          total_sections: 0,
          completed_sections: 0,
          total_training_examples: 0,
          sections: [],
          isGeneratingSections: false,
          sectionsGenerated: false,
          created_at: data.job.created_at,
          updated_at: data.job.updated_at
        }
        
        dispatch(createNewJob({ name: data.job.name, description: enhancedDescription, theme: data.job.theme }))
        
        // Also set as current job explicitly
        dispatch(setCurrentJob(newJob))
        
        console.log('✅ Job set in Redux state:', newJob)
        
        // Reset form
        setName('')
        setDescription('')
        setTheme('')
        setTargetAudience('')
        setTone('')
        setStylePreferences('')
        setIncludeYouTubeData(false)
      } else {
        console.error('❌ Failed to create job:', data.error)
        dispatch(setError(data.error || 'Failed to create job'))
      }
    } catch (error) {
      console.error('❌ Job creation error:', error)
      dispatch(setError('Failed to create job'))
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleGenerateSections = async () => {
    if (!currentJob) {
      console.error('❌ No current job available for section generation')
      dispatch(setError('No current job selected. Please create a job first.'))
      return
    }

    console.log('🎯 Current job details:', {
      id: currentJob.id,
      name: currentJob.name,
      theme: currentJob.theme,
      description: currentJob.description?.substring(0, 100) + '...'
    })

    try {
      dispatch(startGeneratingSections())

      // Build enhanced context with YouTube data
      let additionalContext = ''
      let additionalResearch = ''
      
      // Always check if we have YouTube research data available
      const youtubeContext = buildYouTubeResearchContext()
      const hasActualYouTubeData = youtubeContext.trim().length > 0
      
      // Check if job was created with YouTube data OR if currently enabled OR if data is available
      const hasYouTubeData = includeYouTubeData || 
                            currentJob.description?.includes('=== YOUTUBE RESEARCH DATA INCLUDED ===') ||
                            hasActualYouTubeData
      
      console.log('🔍 YouTube data detection results:', {
        includeYouTubeData,
        hasJobMarker: currentJob.description?.includes('=== YOUTUBE RESEARCH DATA INCLUDED ==='),
        hasActualYouTubeData,
        finalDecision: hasYouTubeData,
        contextLength: youtubeContext.length
      })
      
      // Extract YouTube links and timestamps for researchData
      let extractedYouTubeLinks: Array<{ url: string; timestamp?: string; title?: string }> = []
      let formattedResearchData = ''
      
      if (hasYouTubeData && hasActualYouTubeData) {
        additionalContext = 'This script should incorporate insights from analyzed YouTube videos and research data.'
        additionalResearch = youtubeContext
        
        // Extract YouTube links from analysis results
        if (youtubeState.analysisResults && youtubeState.analysisResults.length > 0) {
          youtubeState.analysisResults.forEach((result) => {
            result.analysis.forEach((analysis) => {
              if (analysis.youtubeUrl) {
                extractedYouTubeLinks.push({
                  url: analysis.youtubeUrl,
                  timestamp: analysis.timestamp,
                  title: `${result.query}: ${analysis.summary.substring(0, 100)}...`
                })
              }
            })
          })
        }
        
        // Extract YouTube links from video summaries
        if (youtubeState.videosSummary?.videoSummaries) {
          youtubeState.videosSummary.videoSummaries.forEach((video) => {
            const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`
            if (video.timestamp) {
              const timestampUrl = `${youtubeUrl}&t=${Math.floor(srtToSeconds(video.timestamp))}s`
              extractedYouTubeLinks.push({
                url: timestampUrl,
                timestamp: video.timestamp,
                title: video.title
              })
            } else {
              extractedYouTubeLinks.push({
                url: youtubeUrl,
                title: video.title
              })
            }
          })
        }
        
        // Extract YouTube links from subtitle files
        const completedSubtitles = youtubeState.subtitleFiles?.filter(sf => sf.status === 'completed') || []
        completedSubtitles.forEach((subtitle) => {
          const youtubeUrl = `https://www.youtube.com/watch?v=${subtitle.videoId}`
          extractedYouTubeLinks.push({
            url: youtubeUrl,
            title: subtitle.title
          })
        })
        
        // Format research data with YouTube links in double brackets
        if (extractedYouTubeLinks.length > 0) {
          formattedResearchData = extractedYouTubeLinks.map((link, index) => {
            let linkText = `[[${link.title || `YouTube Video ${index + 1}`}: ${link.url}`
            if (link.timestamp) {
              linkText += ` (at ${link.timestamp})`
            }
            linkText += ']]'
            return linkText
          }).join('\n')
        }
        
        console.log('✅ YouTube research data included in section generation')
        console.log('📊 Research context length:', youtubeContext.length)
        console.log('🔗 YouTube links extracted:', extractedYouTubeLinks.length)
        console.log('📋 Research context preview:', youtubeContext.substring(0, 200) + '...')
      } else {
        console.log('❌ No YouTube research data found or not enabled')
        console.log('📊 Available YouTube state summary:', {
          videosSummary: !!youtubeState.videosSummary,
          analysisResults: youtubeState.analysisResults?.length || 0,
          googleResearch: youtubeState.googleResearchSummaries?.length || 0,
          youtubeResearch: youtubeState.youtubeResearchSummaries?.length || 0,
          subtitleFiles: youtubeState.subtitleFiles?.filter(sf => sf.status === 'completed').length || 0,
          appliedGoogleResearch: youtubeState.googleResearchSummaries?.filter(r => r.appliedToScript).length || 0,
          appliedYouTubeResearch: youtubeState.youtubeResearchSummaries?.filter(r => r.appliedToScript).length || 0
        })
      }

      const requestPayload = {
        theme: currentJob.theme,
        title: currentJob.name,
        target_audience: targetAudience,
        tone: tone,
        style_preferences: stylePreferences,
        additionalContext,
        additionalResearch
      }

      console.log('🚀 Sending to API with full payload:', {
        ...requestPayload,
        additionalResearchLength: additionalResearch.length,
        additionalResearchPreview: additionalResearch.substring(0, 100) + (additionalResearch.length > 100 ? '...' : '')
      })

      // Generate sections using OpenAI with enhanced prompts
      const response = await fetch('/api/script/generate-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      })

      const data = await response.json()

      if (response.ok && data.sections) {
        console.log('✅ Sections generated successfully:', data.sections.length)
        
        // Save sections to database with research data
        const sectionsResponse = await fetch('/api/fine-tuning/sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: currentJob.id,
            sections: data.sections.map((section: any) => ({
              ...section,
              target_audience: targetAudience,
              tone: tone,
              style_preferences: stylePreferences,
              // Add formatted research data to each section
              researchData: formattedResearchData || section.researchData || ''
            }))
          })
        })

        const sectionsData = await sectionsResponse.json()

        if (sectionsResponse.ok) {
          dispatch(setSections(sectionsData.sections.map((section: any) => ({
            ...section,
            texts: []
          }))))
          console.log('✅ Sections saved to database and Redux state updated')
          console.log('🔗 Research data added to', sectionsData.sections.length, 'sections')
        } else {
          console.error('❌ Failed to save sections to database:', sectionsData.error)
          dispatch(setError(sectionsData.error || 'Failed to save sections'))
        }
      } else {
        console.error('❌ Failed to generate sections:', data.error)
        dispatch(setError(data.error || 'Failed to generate sections'))
      }
    } catch (error) {
      console.error('❌ Section generation error:', error)
      dispatch(setError('Failed to generate sections'))
    }
  }

  const handleUpdateSection = async (sectionId: string, updates: any) => {
    try {
      const response = await fetch('/api/fine-tuning/sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          updates
        })
      })

      if (response.ok) {
        dispatch(updateSection({ sectionId, updates }))
      } else {
        const data = await response.json()
        dispatch(setError(data.error || 'Failed to update section'))
      }
    } catch (error) {
      dispatch(setError('Failed to update section'))
    }
  }

  const handleGenerateScript = async (section: FineTuningSection) => {
    try {
      dispatch(startGeneratingScript(section.id))

      // Build enhanced context for script generation
      let enhancedInstructions = section.writing_instructions
      
      // Check if job was created with YouTube data OR if currently enabled
      const hasYouTubeData = includeYouTubeData || currentJob?.description?.includes('=== YOUTUBE RESEARCH DATA INCLUDED ===')
      
      if (hasYouTubeData) {
        const youtubeContext = buildYouTubeResearchContext()
        enhancedInstructions += `\n\nAdditional Research Context:${youtubeContext}`
      }

      const response = await fetch('/api/script/generate-full-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: section.title,
          writingInstructions: enhancedInstructions,
          theme: currentJob?.theme,
          targetAudience: section.target_audience,
          tone: section.tone,
          stylePreferences: section.style_preferences
        })
      })

      const data = await response.json()

      if (response.ok && data.script) {
        // Prepend research data to the beginning of the script if it exists
        let finalScript = data.script
        if (section.researchData && section.researchData.trim()) {
          finalScript = `${section.researchData}\n\n${data.script}`
        }

        // Save text to database
        const textResponse = await fetch('/api/fine-tuning/texts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outline_section_id: section.id,
            input_text: `Theme: ${currentJob?.theme}\nTitle: ${section.title}\nInstructions: ${enhancedInstructions}`,
            generated_script: finalScript,
            text_order: section.texts?.length || 0
          })
        })

        const textData = await textResponse.json()

        if (textResponse.ok) {
          dispatch(addGeneratedText({
            sectionId: section.id,
            text: {
              input_text: textData.text.input_text,
              generated_script: textData.text.generated_script,
              text_order: textData.text.text_order,
              is_validated: false,
              character_count: textData.text.generated_script.length,
              word_count: textData.text.generated_script.split(' ').length
            }
          }))
        } else {
          dispatch(setError(textData.error || 'Failed to save generated text'))
        }
      } else {
        dispatch(setError(data.error || 'Failed to generate script'))
      }
    } catch (error) {
      dispatch(setError('Failed to generate script'))
    }
  }

  const handleGenerateAllScripts = async () => {
    if (!currentJob?.sections) return

    dispatch(startGeneratingAllScripts())
    
    try {
      await Promise.all(
        currentJob.sections.map(section => handleGenerateScript(section))
      )
    } catch (error) {
      dispatch(setError('Failed to generate some scripts'))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadScript = (script: string, filename: string) => {
    const blob = new Blob([script], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Debug function to test YouTube research context building
  const testYouTubeContext = () => {
    console.log('🧪 Testing YouTube research context building...')
    const context = buildYouTubeResearchContext()
    console.log('📋 Generated context length:', context.length)
    console.log('📋 Generated context:', context)
    showToast.success(`YouTube research context generated!\nLength: ${context.length} characters\nCheck console for full content.`)
  }

  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fine-Tuning Script Generator</h1>
          <p className="text-gray-600">Create training data for your custom script generation model</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* YouTube Data Integration Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <YoutubeIcon className="h-5 w-5" />
              YouTube Research Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="includeYouTubeData"
                  checked={includeYouTubeData}
                  onChange={(e) => setIncludeYouTubeData(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="includeYouTubeData" className="text-sm font-medium text-blue-800">
                  Include YouTube research data in script generation
                </label>
              </div>
              
              <div className="bg-white p-3 rounded border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Research Data Status:</span>
                </div>
                <p className="text-sm text-gray-700">{youtubeDataSummary}</p>
              </div>
              
              {includeYouTubeData && (
                <div className="bg-blue-100 p-3 rounded border border-blue-300">
                  <p className="text-sm text-blue-800">
                    ✓ Your YouTube research data will be integrated into the system and user prompts 
                    to enhance script generation with real insights from analyzed videos, transcripts, 
                    and research summaries.
                  </p>
                </div>
              )}
              
              {/* Debug Test Button */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testYouTubeContext}
                  className="text-xs"
                >
                  🧪 Test YouTube Context
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Selection/Creation */}
        {!currentJob && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Fine-Tuning Job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Job Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Marketing Copy Generator"
                  />
                </div>
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rap">Hip-Hop/Rap Culture</SelectItem>
                      <SelectItem value="crime">True Crime</SelectItem>
                      <SelectItem value="general">General Content</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this fine-tuning job will accomplish"
                  rows={3}
                />
              </div>

              <Button 
                onClick={handleCreateJob}
                disabled={!name || !theme || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Job {includeYouTubeData && '(with YouTube Data)'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Current Job Overview */}
        {currentJob && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{currentJob.name}</span>
                {currentJob.description?.includes('YOUTUBE RESEARCH DATA') && (
                  <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                    <Youtube className="h-4 w-4" />
                    Enhanced with YouTube Data
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-500">Theme</p>
                  <p>{currentJob.theme}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Sections</p>
                  <p>{currentJob.total_sections}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Training Examples</p>
                  <p>{currentJob.total_training_examples}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Model</p>
                  <p>{currentJob.model_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Generation */}
        {currentJob && !currentJob.sectionsGenerated && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Configure Script Sections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Input
                    id="target-audience"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g., Young professionals"
                  />
                </div>
                <div>
                  <Label htmlFor="tone">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="authoritative">Authoritative</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="humorous">Humorous</SelectItem>
                      <SelectItem value="streetwise">Streetwise</SelectItem>
                      <SelectItem value="dramatic">Dramatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="style">Style Preferences</Label>
                  <Input
                    id="style"
                    value={stylePreferences}
                    onChange={(e) => setStylePreferences(e.target.value)}
                    placeholder="e.g., Short sentences, bullet points"
                  />
                </div>
              </div>

              <Button 
                onClick={handleGenerateSections}
                disabled={currentJob.isGeneratingSections || isLoading}
                className="w-full"
              >
                {currentJob.isGeneratingSections ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Sections...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Script Sections
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Generated Sections */}
        {currentJob?.sections && currentJob.sections.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Script Sections</h2>
              <Button 
                onClick={handleGenerateAllScripts}
                disabled={isLoading}
                variant="outline"
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate All Scripts
              </Button>
            </div>

            {currentJob.sections.map((section) => (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <Input
                      value={section.title}
                      onChange={(e) => handleUpdateSection(section.id, { title: e.target.value })}
                      className="text-lg font-semibold border-none p-0 focus:ring-0"
                    />
                    <div className="flex gap-2">
                      <span className="text-sm text-gray-500">
                        {section.texts?.length || 0} examples
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleGenerateScript(section)}
                        disabled={section.isGeneratingScript || isLoading}
                      >
                        {section.isGeneratingScript ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Writing Instructions</Label>
                    <Textarea
                      value={section.writing_instructions}
                      onChange={(e) => handleUpdateSection(section.id, { writing_instructions: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* Generated Scripts */}
                  {section.texts && section.texts.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Generated Scripts:</h4>
                      {section.texts.map((text, index) => (
                        <div key={text.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium">Version {index + 1}</span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(text.generated_script)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadScript(text.generated_script, `${section.title}-v${index + 1}`)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{text.generated_script}</p>
                          <div className="mt-2 text-xs text-gray-500">
                            {text.character_count} characters • {text.word_count} words
                            {text.quality_score && (
                              <span className="ml-2">• Rating: {text.quality_score}/10</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Job List */}
        {jobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {jobs.slice(0, 5).map((job: FineTuningJob) => (
                  <div key={job.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{job.name}</p>
                        {job.description?.includes('YOUTUBE RESEARCH DATA') && (
                          <div className="flex items-center gap-1 bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs">
                            <Youtube className="h-3 w-3" />
                            Enhanced
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{job.theme}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {job.total_training_examples} examples
                      </p>
                      <p className="text-xs text-gray-500">
                        {job.total_sections} sections
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 