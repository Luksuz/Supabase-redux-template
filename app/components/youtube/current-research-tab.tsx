'use client'

import React from 'react'
import { BookOpen, PenTool, ChevronDown, ChevronRight, Globe, FileText, Plus, Save, X, Edit, Download, Loader2 } from 'lucide-react'
import { clearAllResearchSummaries, markMultipleResearchAsApplied, removeGoogleResearchSummary, removeYouTubeResearchSummary, addGoogleResearchSummary, addYouTubeResearchSummary, updateGoogleResearchSummary, updateYouTubeResearchSummary, addSavingToHistory, removeSavingToHistory, selectResearchLoadingStates } from '@/lib/features/youtube/youtubeSlice'
import { AppDispatch, RootState } from '@/lib/store'
import { useSelector } from 'react-redux'
import { showToast } from '@/lib/utils/toast'
import ReactMarkdown from 'react-markdown'

interface CurrentResearchTabProps {
  researchSummaries: any
  dispatch: AppDispatch
}

interface CustomResearchData {
  type: 'google' | 'youtube'
  query: string
  insights?: string
  keyFindings: string[]
  recommendations: string[]
  // YouTube specific fields
  videosSummary?: {
    overallTheme: string
    keyInsights: string[]
    characterInsights: string[]
    conflictElements: string[]
    storyIdeas: string[]
    commonPatterns: string[]
    creativePrompt: string
    actionableItems: string[]
    narrativeThemes: string[]
    videoSummaries?: any[] // Made optional for video summaries
  }
}

export const CurrentResearchTab: React.FC<CurrentResearchTabProps> = ({ 
  researchSummaries,
  dispatch
}) => {
  const [expandedSummaries, setExpandedSummaries] = React.useState<Set<string>>(new Set())
  const [selectedForScript, setSelectedForScript] = React.useState<Set<string>>(new Set())
  const [editingFields, setEditingFields] = React.useState<Set<string>>(new Set())
  const [editedData, setEditedData] = React.useState<Record<string, any>>({})
  const [showCustomModal, setShowCustomModal] = React.useState(false)
  const [loadingFromDatabase, setLoadingFromDatabase] = React.useState(false)
  const [showResearchHistory, setShowResearchHistory] = React.useState(false)
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [researchHistory, setResearchHistory] = React.useState<any[]>([])
  const [selectedHistoryItems, setSelectedHistoryItems] = React.useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = React.useState(false)
  const [historySearchQuery, setHistorySearchQuery] = React.useState('')
  // Get saving to history state from Redux
  const { savingToHistory } = useSelector((state: RootState) => selectResearchLoadingStates(state))
  
  const [customResearch, setCustomResearch] = React.useState<CustomResearchData>({
    type: 'google',
    query: '',
    insights: '',
    keyFindings: [''],
    recommendations: [''],
    videosSummary: {
      overallTheme: '',
      keyInsights: [''],
      characterInsights: [''],
      conflictElements: [''],
      storyIdeas: [''],
      commonPatterns: [''],
      creativePrompt: '',
      actionableItems: [''],
      narrativeThemes: ['']
    }
  })

  // Load research cards from database on component mount
  React.useEffect(() => {
    // Remove automatic loading - users should manually choose via Research History modal
    // This prevents all database research from being automatically added to Current Research
    console.log('Current Research tab loaded - use Research History to add saved research')
  }, []) // Empty dependency array - no automatic loading

  // Handle deleting research from both database and Redux store
  const handleDeleteResearch = async (summaryId: string, summaryType: string) => {
    try {
      // First try to delete from database
      const response = await fetch(`/api/research-cards?id=${summaryId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (!result.success && response.status !== 404) {
        // If it's not a 404 (not found), show the error
        throw new Error(result.error || 'Failed to delete from database')
      }
      
      // Remove from Redux store regardless of database result
      // (in case the item was created before database integration)
      if (summaryType === 'google') {
        dispatch(removeGoogleResearchSummary(summaryId))
      } else {
        dispatch(removeYouTubeResearchSummary(summaryId))
      }
      
    } catch (error) {
      console.error('Error deleting research:', error)
      // Still remove from Redux store even if database deletion failed
      if (summaryType === 'google') {
        dispatch(removeGoogleResearchSummary(summaryId))
      } else {
        dispatch(removeYouTubeResearchSummary(summaryId))
      }
      
      // Show warning but don't prevent the deletion
      console.warn('Item removed from interface, but database deletion may have failed:', error)
    }
  }

  // Research History functions
  const loadResearchHistory = async () => {
    try {
      setHistoryLoading(true)
      const response = await fetch('/api/research-cards')
      const result = await response.json()

      if (result.success) {
        setResearchHistory(result.data || [])
      } else {
        console.error('Failed to load research history:', result.error)
        showToast.error('Failed to load research history: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading research history:', error)
      showToast.error('Error loading research history: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setHistoryLoading(false)
    }
  }

  const toggleHistorySelection = (itemId: string) => {
    setSelectedHistoryItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const addSelectedHistoryToCurrentResearch = async () => {
    try {
      const selectedItems = researchHistory.filter(item => selectedHistoryItems.has(item.id))
      
      if (selectedItems.length === 0) return

      for (const item of selectedItems) {
        // Check if already exists in current research
        const existsInGoogle = researchSummaries.googleResearchSummaries.find((s: any) => s.id === item.id)
        const existsInYoutube = researchSummaries.youtubeResearchSummaries.find((s: any) => s.id === item.id)
        
        if (existsInGoogle || existsInYoutube) {
          continue // Skip if already exists
        }

        const researchData = {
          id: item.id,
          query: item.query,
          timestamp: item.created_at,
          appliedToScript: item.applied_to_script,
          usingMock: false,
          source: item.source // Add source to identify database entries
        }

        if (item.type === 'google') {
          const googleResearch = {
            ...researchData,
            type: 'google',
            researchSummary: item.content.researchSummary || {
              overallTheme: item.content.insights || '',
              keyInsights: item.content.keyFindings || [],
              articleSummaries: [],
              commonPatterns: [],
              actionableItems: item.content.recommendations || [],
              narrativeThemes: [],
              characterInsights: [],
              conflictElements: [],
              storyIdeas: [],
              creativePrompt: '',
              visualAudioCues: [],
              audienceQuestions: []
            },
            insights: item.content.insights || '',
            keyFindings: item.content.keyFindings || [],
            recommendations: item.content.recommendations || [],
            webResults: item.content.webResults || [],
            sources: item.content.sources || []
          }
          dispatch(addGoogleResearchSummary(googleResearch))
        } else if (item.type === 'youtube') {
          const youtubeResearch = {
            ...researchData,
            type: 'youtube',
            videosSummary: item.content.videosSummary || {
              overallTheme: '',
              keyInsights: [],
              characterInsights: [],
              conflictElements: [],
              storyIdeas: [],
              commonPatterns: [],
              creativePrompt: '',
              actionableItems: [],
              narrativeThemes: [],
              videoSummaries: []
            }
          }
          dispatch(addYouTubeResearchSummary(youtubeResearch))
        }
      }

      // Reset and close
      setSelectedHistoryItems(new Set())
      setShowResearchHistory(false)
      
      showToast.success(`Added ${selectedItems.length} research items to Current Research!`)
      
    } catch (error) {
      console.error('Error adding history to current research:', error)
      showToast.error('Error adding research: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const toggleSummaryExpansion = (summaryId: string) => {
    const newExpanded = new Set(expandedSummaries)
    if (newExpanded.has(summaryId)) {
      newExpanded.delete(summaryId)
    } else {
      newExpanded.add(summaryId)
    }
    setExpandedSummaries(newExpanded)
  }

  const toggleScriptSelection = (summaryId: string) => {
    const newSelected = new Set(selectedForScript)
    if (newSelected.has(summaryId)) {
      newSelected.delete(summaryId)
    } else {
      newSelected.add(summaryId)
    }
    setSelectedForScript(newSelected)
  }

  const startEditing = (fieldId: string, currentValue: any) => {
    setEditingFields(prev => new Set([...prev, fieldId]))
    setEditedData(prev => ({ ...prev, [fieldId]: currentValue }))
  }

  const saveEdit = async (fieldId: string, summaryId: string, summary: any) => {
    const newValue = editedData[fieldId]
    
    // Create a deep copy of the summary to avoid mutations
    const updatedSummary = JSON.parse(JSON.stringify(summary))
    
    // Parse the field path and update the value
    const fieldParts = fieldId.replace(`${summaryId}.`, '').split('.')
    
    let current = updatedSummary
    for (let i = 0; i < fieldParts.length - 1; i++) {
      const part = fieldParts[i]
      if (!current[part]) {
        current[part] = {}
      }
      current = current[part]
    }
    current[fieldParts[fieldParts.length - 1]] = newValue
    
    // Check if this entry came from database (has proper database format)
    const isFromDatabase = summary.source === 'custom' || summary.source === 'google_api' || summary.source === 'gemini_analysis' || 
                           (summary.id && summary.id.includes('card-')) // Database entries have specific ID patterns
    
    if (isFromDatabase) {
      try {
        // Save to database
        const response = await fetch('/api/research-cards', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: summaryId,
            title: updatedSummary.query,
            query: updatedSummary.query,
            type: updatedSummary.type,
            content: updatedSummary.type === 'google' ? {
              insights: updatedSummary.insights,
              keyFindings: updatedSummary.keyFindings,
              recommendations: updatedSummary.recommendations,
              webResults: updatedSummary.webResults || [],
              sources: updatedSummary.sources || []
            } : {
              videosSummary: updatedSummary.videosSummary
            },
            applied_to_script: updatedSummary.appliedToScript
          }),
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to update in database')
        }

        console.log('✅ Successfully updated research in database')
      } catch (error) {
        console.error('❌ Failed to save to database:', error)
        showToast.warning(`Changes saved locally but failed to sync with database: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Update Redux store regardless of database result
    if (summary.type === 'google') {
      dispatch(updateGoogleResearchSummary(updatedSummary))
    } else {
      dispatch(updateYouTubeResearchSummary(updatedSummary))
    }
    
    setEditingFields(prev => {
      const newSet = new Set(prev)
      newSet.delete(fieldId)
      return newSet
    })
    setEditedData(prev => {
      const newData = { ...prev }
      delete newData[fieldId]
      return newData
    })
  }

  const cancelEdit = (fieldId: string) => {
    setEditingFields(prev => {
      const newSet = new Set(prev)
      newSet.delete(fieldId)
      return newSet
    })
    setEditedData(prev => {
      const newData = { ...prev }
      delete newData[fieldId]
      return newData
    })
  }

  const handleApplyToScript = () => {
    const selectedSummaries = allSummaries.filter(s => selectedForScript.has(s.id))
    
    if (selectedSummaries.length === 0) return
    
    // Separate Google and YouTube research IDs
    const googleIds = selectedSummaries.filter(s => s.type === 'google').map(s => s.id)
    const youtubeIds = selectedSummaries.filter(s => s.type === 'youtube').map(s => s.id)
    
    // Mark selected summaries as applied in Redux state
    dispatch(markMultipleResearchAsApplied({ googleIds, youtubeIds }))
    
    // Show success message with guidance
    const summaryTypes = selectedSummaries.map(s => s.type === 'google' ? 'Perplexity Research' : 'YouTube Analysis').join(', ')
    
    // For now, we'll show a success message and log the data
    // In a real implementation, this would integrate with the script generator
    console.log('Selected research summaries for script generation:', selectedSummaries)
    
    // Show success message
    showToast.custom(
      `Applied ${selectedSummaries.length} research summaries`,
      `Applied research summaries (${summaryTypes}) to script generation!\n\nThese research summaries are now marked as applied and will be automatically included when generating script sections.\n\nGo to the Script Generator to create sections with this research data.`,
      'success'
    )
    
    // Clear selection after applying
    setSelectedForScript(new Set())
  }

  const handleExportResearch = async () => {
    if (allSummaries.length === 0) {
      showToast.error('No research data to export')
      return
    }

    setIsExporting(true)
    try {
      console.log('📄 Exporting research data to DOCX...')
      
      const response = await fetch('/api/research/export-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          researchData: allSummaries,
          title: `Research Export - ${new Date().toLocaleDateString()}`
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to export research')
      }

      // Get the blob and create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Research_Export_${new Date().toISOString().split('T')[0]}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showToast.success(`Successfully exported ${allSummaries.length} research items to DOCX!`)
      
    } catch (error) {
      console.error('Export error:', error)
      showToast.error('Failed to export research: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsExporting(false)
    }
  }

  const handleSaveCustomResearch = async () => {
    try {
      // Prepare the data for the API
      const requestData = {
        title: customResearch.query, // Use query as title for now
        query: customResearch.query,
        type: customResearch.type,
        content: customResearch.type === 'google' ? {
          insights: customResearch.insights || '',
          keyFindings: customResearch.keyFindings.filter(f => f.trim()),
          recommendations: customResearch.recommendations.filter(r => r.trim()),
          webResults: [],
          sources: []
        } : {
          videosSummary: {
            overallTheme: customResearch.videosSummary!.overallTheme,
            keyInsights: customResearch.videosSummary!.keyInsights.filter(i => i.trim()),
            characterInsights: customResearch.videosSummary!.characterInsights.filter(i => i.trim()),
            conflictElements: customResearch.videosSummary!.conflictElements.filter(e => e.trim()),
            storyIdeas: customResearch.videosSummary!.storyIdeas.filter(s => s.trim()),
            commonPatterns: customResearch.videosSummary!.commonPatterns.filter(p => p.trim()),
            creativePrompt: customResearch.videosSummary!.creativePrompt,
            actionableItems: customResearch.videosSummary!.actionableItems.filter(a => a.trim()),
            narrativeThemes: customResearch.videosSummary!.narrativeThemes.filter(t => t.trim()),
            videoSummaries: []
          }
        },
        tags: [], // You could add tags functionality later
        category: 'Custom Research',
        source: 'custom'
      }

      // Save to database via API
      const response = await fetch('/api/research-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to save research')
      }

      // Also add to Redux store for immediate UI update
      const researchData = {
        id: result.data.id,
        query: customResearch.query,
        timestamp: result.data.created_at,
        appliedToScript: false,
        usingMock: false,
        source: 'custom' // Mark as database entry
      }

      if (customResearch.type === 'google') {
        const googleResearch = {
          ...researchData,
          type: 'google',
          researchSummary: {
            overallTheme: customResearch.insights || 'Custom research findings',
            keyInsights: customResearch.keyFindings.filter(f => f.trim()),
            articleSummaries: [],
            commonPatterns: [],
            actionableItems: customResearch.recommendations.filter(r => r.trim()),
            narrativeThemes: [],
            characterInsights: [],
            conflictElements: [],
            storyIdeas: [],
            creativePrompt: '',
            visualAudioCues: [],
            audienceQuestions: []
          },
          insights: customResearch.insights || '',
          keyFindings: customResearch.keyFindings.filter(f => f.trim()),
          recommendations: customResearch.recommendations.filter(r => r.trim()),
          webResults: [],
          sources: []
        }
        dispatch(addGoogleResearchSummary(googleResearch))
      } else {
        const youtubeResearch = {
          ...researchData,
          type: 'youtube',
          videosSummary: {
            overallTheme: customResearch.videosSummary!.overallTheme,
            keyInsights: customResearch.videosSummary!.keyInsights.filter(i => i.trim()),
            characterInsights: customResearch.videosSummary!.characterInsights.filter(i => i.trim()),
            conflictElements: customResearch.videosSummary!.conflictElements.filter(e => e.trim()),
            storyIdeas: customResearch.videosSummary!.storyIdeas.filter(s => s.trim()),
            commonPatterns: customResearch.videosSummary!.commonPatterns.filter(p => p.trim()),
            creativePrompt: customResearch.videosSummary!.creativePrompt,
            actionableItems: customResearch.videosSummary!.actionableItems.filter(a => a.trim()),
            narrativeThemes: customResearch.videosSummary!.narrativeThemes.filter(t => t.trim()),
            videoSummaries: []
          }
        }
        dispatch(addYouTubeResearchSummary(youtubeResearch))
      }

      // Reset form and close modal
      setCustomResearch({
        type: 'google',
        query: '',
        insights: '',
        keyFindings: [''],
        recommendations: [''],
        videosSummary: {
          overallTheme: '',
          keyInsights: [''],
          characterInsights: [''],
          conflictElements: [''],
          storyIdeas: [''],
          commonPatterns: [''],
          creativePrompt: '',
          actionableItems: [''],
          narrativeThemes: ['']
        }
      })
      setShowCustomModal(false)

      // Show success message
      showToast.success(`Custom research "${customResearch.query}" saved successfully to database!`)

    } catch (error) {
      console.error('Error saving custom research:', error)
      showToast.error(`Failed to save research: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const addArrayItem = (field: keyof CustomResearchData | string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setCustomResearch(prev => {
        const parentObj = prev[parent as keyof CustomResearchData]
        if (parent === 'videosSummary' && parentObj && typeof parentObj === 'object') {
          return {
            ...prev,
            [parent]: {
              ...(parentObj as any),
              [child]: [...((parentObj as any)[child] || []), '']
            }
          }
        }
        return prev
      })
    } else {
      setCustomResearch(prev => {
        const currentField = prev[field as keyof CustomResearchData]
        if (Array.isArray(currentField)) {
          return {
            ...prev,
            [field]: [...currentField, '']
          }
        }
        return prev
      })
    }
  }

  const updateArrayItem = (field: keyof CustomResearchData | string, index: number, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setCustomResearch(prev => {
        const parentObj = prev[parent as keyof CustomResearchData]
        if (parent === 'videosSummary' && parentObj && typeof parentObj === 'object') {
          const childArray = (parentObj as any)[child] || []
          const newArray = [...childArray]
          newArray[index] = value
          return {
            ...prev,
            [parent]: {
              ...(parentObj as any),
              [child]: newArray
            }
          }
        }
        return prev
      })
    } else {
      setCustomResearch(prev => {
        const currentField = prev[field as keyof CustomResearchData]
        if (Array.isArray(currentField)) {
          const newArray = [...currentField]
          newArray[index] = value
          return {
            ...prev,
            [field]: newArray
          }
        }
        return prev
      })
    }
  }

  const removeArrayItem = (field: keyof CustomResearchData | string, index: number) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setCustomResearch(prev => {
        const parentObj = prev[parent as keyof CustomResearchData]
        if (parent === 'videosSummary' && parentObj && typeof parentObj === 'object') {
          const childArray = (parentObj as any)[child] || []
          return {
            ...prev,
            [parent]: {
              ...(parentObj as any),
              [child]: childArray.filter((_: any, i: number) => i !== index)
            }
          }
        }
        return prev
      })
    } else {
      setCustomResearch(prev => {
        const currentField = prev[field as keyof CustomResearchData]
        if (Array.isArray(currentField)) {
          return {
            ...prev,
            [field]: currentField.filter((_, i) => i !== index)
          }
        }
        return prev
      })
    }
  }

  // Function to add new timestamp to a video summary
  const addNewTimestamp = (summaryId: string, videoIndex: number, summary: any) => {
    const newTimestamp = {
      startTime: '00:00:00',
      endTime: '00:00:00',
      speaker: '',
      description: '',
      quote: '',
      significance: ''
    }
    
    const updatedSummary = {
      ...summary,
      videosSummary: {
        ...summary.videosSummary,
        videoSummaries: summary.videosSummary.videoSummaries.map((vs: any, idx: number) => 
          idx === videoIndex 
            ? { ...vs, timestamps: [...(vs.timestamps || []), newTimestamp] }
            : vs
        )
      }
    }
    
    if (summary.type === 'youtube') {
      dispatch(updateYouTubeResearchSummary(updatedSummary))
    }
  }

  // Function to remove timestamp from a video summary
  const removeTimestamp = (summaryId: string, videoIndex: number, timestampIndex: number, summary: any) => {
    const updatedSummary = {
      ...summary,
      videosSummary: {
        ...summary.videosSummary,
        videoSummaries: summary.videosSummary.videoSummaries.map((vs: any, idx: number) => 
          idx === videoIndex 
            ? { ...vs, timestamps: vs.timestamps.filter((_: any, tsIdx: number) => tsIdx !== timestampIndex) }
            : vs
        )
      }
    }
    
    if (summary.type === 'youtube') {
      dispatch(updateYouTubeResearchSummary(updatedSummary))
    }
  }

  // Function to add new key point to a video summary
  const addNewKeyPoint = (summaryId: string, videoIndex: number, summary: any) => {
    const updatedSummary = {
      ...summary,
      videosSummary: {
        ...summary.videosSummary,
        videoSummaries: summary.videosSummary.videoSummaries.map((vs: any, idx: number) => 
          idx === videoIndex 
            ? { ...vs, keyPoints: [...(vs.keyPoints || []), 'New key point'] }
            : vs
        )
      }
    }
    
    if (summary.type === 'youtube') {
      dispatch(updateYouTubeResearchSummary(updatedSummary))
    }
  }

  // Function to remove key point from a video summary
  const removeKeyPoint = (summaryId: string, videoIndex: number, pointIndex: number, summary: any) => {
    const updatedSummary = {
      ...summary,
      videosSummary: {
        ...summary.videosSummary,
        videoSummaries: summary.videosSummary.videoSummaries.map((vs: any, idx: number) => 
          idx === videoIndex 
            ? { ...vs, keyPoints: vs.keyPoints.filter((_: any, pIdx: number) => pIdx !== pointIndex) }
            : vs
        )
      }
    }
    
    if (summary.type === 'youtube') {
      dispatch(updateYouTubeResearchSummary(updatedSummary))
    }
  }

  // Function to add new key quote to a video summary
  const addNewKeyQuote = (summaryId: string, videoIndex: number, summary: any) => {
    const updatedSummary = {
      ...summary,
      videosSummary: {
        ...summary.videosSummary,
        videoSummaries: summary.videosSummary.videoSummaries.map((vs: any, idx: number) => 
          idx === videoIndex 
            ? { ...vs, keyQuotes: [...(vs.keyQuotes || []), 'New quote'] }
            : vs
        )
      }
    }
    
    if (summary.type === 'youtube') {
      dispatch(updateYouTubeResearchSummary(updatedSummary))
    }
  }

  // Function to remove key quote from a video summary
  const removeKeyQuote = (summaryId: string, videoIndex: number, quoteIndex: number, summary: any) => {
    const updatedSummary = {
      ...summary,
      videosSummary: {
        ...summary.videosSummary,
        videoSummaries: summary.videosSummary.videoSummaries.map((vs: any, idx: number) => 
          idx === videoIndex 
            ? { ...vs, keyQuotes: vs.keyQuotes.filter((_: any, qIdx: number) => qIdx !== quoteIndex) }
            : vs
        )
      }
    }
    
    if (summary.type === 'youtube') {
      dispatch(updateYouTubeResearchSummary(updatedSummary))
    }
  }

  const allSummaries = React.useMemo(() => {
    // Create a Map to ensure uniqueness by ID
    const summaryMap = new Map()
    
    // Add Perplexity research summaries
    researchSummaries.googleResearchSummaries.forEach((s: any) => {
      summaryMap.set(s.id, { ...s, type: 'google' })
    })
    
    // Add YouTube research summaries  
    researchSummaries.youtubeResearchSummaries.forEach((s: any) => {
      summaryMap.set(s.id, { ...s, type: 'youtube' })
    })
    
    // Convert back to array and sort by timestamp
    return Array.from(summaryMap.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [researchSummaries.googleResearchSummaries, researchSummaries.youtubeResearchSummaries])

  // Count applied summaries
  const appliedCount = allSummaries.filter(s => s.appliedToScript).length

  const renderEditableField = (fieldId: string, value: string, summaryId: string, summary: any, placeholder?: string) => {
    const isEditing = editingFields.has(fieldId)
    
    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editedData[fieldId] || value}
            onChange={(e) => setEditedData(prev => ({ ...prev, [fieldId]: e.target.value }))}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            placeholder={placeholder}
          />
          <button
            onClick={() => saveEdit(fieldId, summaryId, summary)}
            className="text-green-600 hover:text-green-800"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            onClick={() => cancelEdit(fieldId)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-2 group">
        <span className="flex-1">{value}</span>
        <button
          onClick={() => startEditing(fieldId, value)}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
        >
          <Edit className="h-3 w-3" />
        </button>
      </div>
    )
  }

  const renderEditableArray = (fieldId: string, items: string[], summaryId: string, summary: any) => {
    return (
      <ul className="space-y-1">
        {items.map((item: string, index: number) => (
          <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
            <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
              {index + 1}
            </span>
            {renderEditableField(`${fieldId}.${index}`, item, summaryId, summary)}
          </li>
        ))}
      </ul>
    )
  }

  // Special textarea version for large content like articles
  const renderEditableTextArea = (fieldId: string, value: string, summaryId: string, summary: any, placeholder?: string) => {
    const isEditing = editingFields.has(fieldId)
    
    if (isEditing) {
      return (
        <div className="space-y-2">
          <textarea
            value={editedData[fieldId] || value}
            onChange={(e) => setEditedData(prev => ({ ...prev, [fieldId]: e.target.value }))}
            className="w-full h-96 px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-vertical"
            placeholder={placeholder}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveEdit(fieldId, summaryId, summary)}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            <button
              onClick={() => cancelEdit(fieldId)}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )
    }
    
    return (
      <div className="space-y-2">
        <ReactMarkdown>{value}</ReactMarkdown>
        <button
          onClick={() => startEditing(fieldId, value)}
          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          <Edit className="h-4 w-4" />
          Edit Article
        </button>
      </div>
    )
  }

  // Helper functions for determining research category and source
  const getResearchCategory = (summary: any) => {
    if (summary.category === 'Article Content') return 'Article Content'
    if (summary.research_method === 'firecrawl_scraping') return 'Article Content'
    if (summary.type === 'youtube') return 'YouTube Analysis'
    return 'Perplexity Research'
  }

  const getResearchSource = (summary: any) => {
    if (summary.research_method === 'firecrawl_scraping') return 'firecrawl_api'
    if (summary.type === 'youtube') return 'gemini_analysis'
    return 'perplexity_api'
  }

  const convertTimestampToSeconds = (timestamp: string) => {
    const parts = timestamp.split(':')
    let totalSeconds = 0
    for (let i = 0; i < parts.length; i++) {
      totalSeconds += parseInt(parts[i]) * Math.pow(60, parts.length - 1 - i)
    }
    return totalSeconds
  }

  // Save research to history function
  const saveToResearchHistory = async (summary: any) => {
    const summaryId = summary.id
    dispatch(addSavingToHistory(summaryId))
    
    try {
      // Standardize research format - make all fields more flexible
      const standardizedData = {
        title: summary.query || summary.title || 'Research Item',
        query: summary.query || summary.title || 'No query available',
        type: summary.type || 'google', // Default to google if type missing
        content: {
          // Always include full original data
          originalData: summary,
          // Standardized common fields (only include if they exist)
          ...(summary.researchSummary && { researchSummary: summary.researchSummary }),
          ...(summary.insights && { insights: summary.insights }),
          ...(summary.keyFindings && { keyFindings: summary.keyFindings }),
          ...(summary.recommendations && { recommendations: summary.recommendations }),
          ...(summary.webResults && { webResults: summary.webResults }),
          ...(summary.sources && { sources: summary.sources }),
          ...(summary.videosSummary && { videosSummary: summary.videosSummary }),
          // Additional metadata
          timestamp: summary.timestamp || new Date().toISOString(),
          usingMock: summary.usingMock || false
        },
        tags: summary.tags || [],
        category: summary.category || getResearchCategory(summary),
        source: summary.source || getResearchSource(summary)
      }

      const response = await fetch('/api/research-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(standardizedData),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to save research to history')
      }

      showToast.success(`Research "${summary.query}" saved to history successfully!`)
      
    } catch (error) {
      console.error('Error saving research to history:', error)
      showToast.error(`Failed to save to history: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      dispatch(removeSavingToHistory(summaryId))
    }
  }

  // Save all research to history function
  const saveAllToResearchHistory = async () => {
    const allItems = [...researchSummaries.googleResearchSummaries, ...researchSummaries.youtubeResearchSummaries]
    
    if (allItems.length === 0) {
      showToast.info('No research items to save')
      return
    }

    // Mark all items as saving
    allItems.forEach(item => dispatch(addSavingToHistory(item.id)))
    
    try {
      let successCount = 0
      let failureCount = 0
      
      // Process all items in parallel
      const savePromises = allItems.map(async (summary) => {
        try {
          // Use same standardized format as saveToResearchHistory
          const standardizedData = {
            title: summary.query || summary.title || 'Research Item',
            query: summary.query || summary.title || 'No query available',
            type: summary.type || 'google',
            content: {
              // Always include full original data
              originalData: summary,
              // Standardized common fields (only include if they exist)
              ...(summary.researchSummary && { researchSummary: summary.researchSummary }),
              ...(summary.insights && { insights: summary.insights }),
              ...(summary.keyFindings && { keyFindings: summary.keyFindings }),
              ...(summary.recommendations && { recommendations: summary.recommendations }),
              ...(summary.webResults && { webResults: summary.webResults }),
              ...(summary.sources && { sources: summary.sources }),
              ...(summary.videosSummary && { videosSummary: summary.videosSummary }),
              // Additional metadata
              timestamp: summary.timestamp || new Date().toISOString(),
              usingMock: summary.usingMock || false
            },
            tags: summary.tags || [],
                    category: summary.category || getResearchCategory(summary),
        source: summary.source || getResearchSource(summary)
          }

          const response = await fetch('/api/research-cards', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(standardizedData),
          })

          const result = await response.json()

          if (!result.success) {
            throw new Error(result.error || 'Failed to save research to history')
          }

          successCount++
          return { success: true, summary }
        } catch (error) {
          console.error(`Error saving research "${summary.query}" to history:`, error)
          failureCount++
          return { success: false, summary, error }
        }
      })

      await Promise.all(savePromises)

      // Show summary toast
      if (successCount > 0 && failureCount === 0) {
        showToast.success(`Successfully saved all ${successCount} research items to history!`)
      } else if (successCount > 0 && failureCount > 0) {
        showToast.warning(`Saved ${successCount} items successfully, but ${failureCount} failed`)
      } else {
        showToast.error(`Failed to save all ${failureCount} research items`)
      }
      
    } catch (error) {
      console.error('Error in batch save operation:', error)
      showToast.error('Batch save operation failed')
    } finally {
      // Remove all items from saving state
      allItems.forEach(item => dispatch(removeSavingToHistory(item.id)))
    }
  }

  // Link scraping handler functions


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Current Research ({allSummaries.length})
          {appliedCount > 0 && (
            <span className="text-sm font-normal text-green-600">
              • {appliedCount} applied
            </span>
          )}
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowCustomModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Custom Research
          </button>
          
          <button
            onClick={() => {
              setShowResearchHistory(true)
              loadResearchHistory()
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Research History
          </button>
          

          
          {allSummaries.length > 0 && (
            <>
              <button
                onClick={saveAllToResearchHistory}
                disabled={savingToHistory.length > 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {savingToHistory.length > 0 ? `Saving ${savingToHistory.length}...` : 'Save All to History'}
              </button>
              
            <button
              onClick={handleExportResearch}
              disabled={isExporting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export Research'}
            </button>
            </>
          )}
          
          {selectedForScript.size > 0 && (
            <button
              onClick={handleApplyToScript}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <PenTool className="h-4 w-4" />
              Apply to Script ({selectedForScript.size})
            </button>
          )}
          
          {allSummaries.length > 0 && (
            <button
              onClick={() => dispatch(clearAllResearchSummaries())}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>



      {/* Custom Research Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">Add Custom Research</h2>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Research Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Research Type:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCustomResearch(prev => ({ ...prev, type: 'google' }))}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      customResearch.type === 'google'
                        ? 'border-blue-500 bg-blue-100 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="h-4 w-4" />
                      <span className="font-medium">Perplexity Research</span>
                    </div>
                    <p className="text-xs">General research with insights and findings</p>
                  </button>
                  
                  <button
                    onClick={() => setCustomResearch(prev => ({ ...prev, type: 'youtube' }))}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      customResearch.type === 'youtube'
                        ? 'border-red-500 bg-red-100 text-red-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">YouTube Analysis</span>
                    </div>
                    <p className="text-xs">Video analysis with story elements and insights</p>
                  </button>
                </div>
              </div>

              {/* Query */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Research Query:
                </label>
                <input
                  type="text"
                  value={customResearch.query}
                  onChange={(e) => setCustomResearch(prev => ({ ...prev, query: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your research topic or question..."
                />
              </div>

              {customResearch.type === 'google' ? (
                <>
                  {/* Insights */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Insights:
                    </label>
                    <textarea
                      value={customResearch.insights}
                      onChange={(e) => setCustomResearch(prev => ({ ...prev, insights: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder="Enter your research insights..."
                    />
                  </div>

                  {/* Key Findings */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Key Findings:
                    </label>
                    {customResearch.keyFindings.map((finding, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={finding}
                          onChange={(e) => updateArrayItem('keyFindings', index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter a key finding..."
                        />
                        <button
                          onClick={() => removeArrayItem('keyFindings', index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('keyFindings')}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Finding
                    </button>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recommendations:
                    </label>
                    {customResearch.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={rec}
                          onChange={(e) => updateArrayItem('recommendations', index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter a recommendation..."
                        />
                        <button
                          onClick={() => removeArrayItem('recommendations', index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('recommendations')}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Recommendation
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* YouTube Analysis Fields */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Overall Theme:
                    </label>
                    <textarea
                      value={customResearch.videosSummary!.overallTheme}
                      onChange={(e) => setCustomResearch(prev => ({
                        ...prev,
                        videosSummary: { ...prev.videosSummary!, overallTheme: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={3}
                      placeholder="Describe the overall theme..."
                    />
                  </div>

                  {/* Key Insights */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Key Insights:
                    </label>
                    {customResearch.videosSummary!.keyInsights.map((insight, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={insight}
                          onChange={(e) => updateArrayItem('videosSummary.keyInsights', index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Enter a key insight..."
                        />
                        <button
                          onClick={() => removeArrayItem('videosSummary.keyInsights', index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('videosSummary.keyInsights')}
                      className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Insight
                    </button>
                  </div>

                  {/* Story Ideas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Story Ideas:
                    </label>
                    {customResearch.videosSummary!.storyIdeas.map((idea, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={idea}
                          onChange={(e) => updateArrayItem('videosSummary.storyIdeas', index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Enter a story idea..."
                        />
                        <button
                          onClick={() => removeArrayItem('videosSummary.storyIdeas', index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('videosSummary.storyIdeas')}
                      className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Story Idea
                    </button>
                  </div>

                  {/* Creative Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Creative Prompt:
                    </label>
                    <textarea
                      value={customResearch.videosSummary!.creativePrompt}
                      onChange={(e) => setCustomResearch(prev => ({
                        ...prev,
                        videosSummary: { ...prev.videosSummary!, creativePrompt: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={3}
                      placeholder="Enter a creative writing prompt..."
                    />
                  </div>
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomResearch}
                  disabled={!customResearch.query.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  Save Research
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Research History Modal */}
      {showResearchHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">Research History</h2>
              <button
                onClick={() => {
                  setShowResearchHistory(false)
                  setSelectedHistoryItems(new Set())
                  setHistorySearchQuery('')
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              {historyLoading ? (
                <div className="flex flex-col items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-gray-600">Loading research history...</p>
                </div>
              ) : researchHistory.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-600 mb-2">No Research History</h4>
                  <p className="text-gray-500">No saved research found in your database.</p>
                </div>
              ) : (
                <>
                  {/* Search Input */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search research history by title, query, or content..."
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      {historySearchQuery && (
                        <button
                          onClick={() => setHistorySearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <p className="text-gray-600">
                      Found {
                        historySearchQuery 
                          ? researchHistory.filter(item => 
                              item.title?.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                              item.query?.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                              JSON.stringify(item.content || {}).toLowerCase().includes(historySearchQuery.toLowerCase())
                            ).length
                          : researchHistory.length
                      } research items{historySearchQuery ? ` matching "${historySearchQuery}"` : ''}. Select items to add to Current Research.
                    </p>
                    {selectedHistoryItems.size > 0 && (
                      <button
                        onClick={addSelectedHistoryToCurrentResearch}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Selected ({selectedHistoryItems.size})
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {researchHistory
                      .filter(item => {
                        if (!historySearchQuery) return true
                        const searchLower = historySearchQuery.toLowerCase()
                        return (
                          item.title?.toLowerCase().includes(searchLower) ||
                          item.query?.toLowerCase().includes(searchLower) ||
                          JSON.stringify(item.content || {}).toLowerCase().includes(searchLower)
                        )
                      })
                      .map((item) => {
                      const isSelected = selectedHistoryItems.has(item.id)
                      const isAlreadyInCurrent = 
                        researchSummaries.googleResearchSummaries.find((s: any) => s.id === item.id) ||
                        researchSummaries.youtubeResearchSummaries.find((s: any) => s.id === item.id)
                      
                      return (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            isAlreadyInCurrent
                              ? 'border-gray-300 bg-gray-100 opacity-60'
                              : isSelected
                                ? 'border-purple-300 bg-purple-50'
                                : 'border-gray-200 bg-white hover:border-purple-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleHistorySelection(item.id)}
                              disabled={isAlreadyInCurrent}
                              className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded disabled:opacity-50"
                            />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {item.type === 'google' ? (
                                  <Globe className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <FileText className="h-4 w-4 text-red-600" />
                                )}
                                <span className="font-medium text-gray-900">
                                  {item.type === 'google' ? 'Perplexity Research' : 'YouTube Analysis'}
                                </span>
                                {isAlreadyInCurrent && (
                                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                    Already in Current Research
                                  </span>
                                )}
                              </div>
                              
                              <h4 className="font-medium text-gray-800 mb-2">{item.query}</h4>
                              
                              <div className="text-sm text-gray-600 mb-2">
                                {item.type === 'google' ? (
                                  <p>{(item.content.insights || '').slice(0, 150)}...</p>
                                ) : (
                                  <p>{(item.content.videosSummary?.overallTheme || '').slice(0, 150)}...</p>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>
                                  Created: {new Date(item.created_at).toLocaleDateString()}
                                </span>
                                <span>
                                  Source: {item.source || 'Custom'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Research Summaries */}
      {allSummaries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          {loadingFromDatabase ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <h4 className="text-lg font-medium text-gray-600 mb-2">Loading Research...</h4>
              <p className="text-gray-500">Fetching your saved research from database...</p>
            </div>
          ) : (
            <>
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-600 mb-2">No Current Research</h4>
              <p className="text-gray-500 mb-4">
                Add research by performing Perplexity AI research, analyzing YouTube videos, creating custom research, or browsing your saved research history.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowCustomModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Custom Research
                </button>
                <button
                  onClick={() => {
                    setShowResearchHistory(true)
                    loadResearchHistory()
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Browse Research History
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {allSummaries.map((summary: any) => {
            const isExpanded = expandedSummaries.has(summary.id)
            const isSelected = selectedForScript.has(summary.id)
            const isApplied = summary.appliedToScript
            
            return (
              <div key={summary.id} className={`border rounded-lg ${
                isApplied 
                  ? 'border-green-300 bg-green-50' 
                  : isSelected 
                    ? 'border-purple-300 bg-purple-50' 
                    : 'border-gray-200 bg-white'
              }`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleScriptSelection(summary.id)}
                        disabled={isApplied}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded disabled:opacity-50"
                      />
                      
                      <div className="flex items-center gap-2">
                        {summary.type === 'google' ? (
                          <Globe className="h-5 w-5 text-blue-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-red-600" />
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {summary.type === 'google' ? 'Perplexity Research' : 'YouTube Analysis'}:
                          </span>
                          {renderEditableField(`${summary.id}.query`, summary.query, summary.id, summary, 'Research query...')}
                        </div>
                      </div>
                      
                      {isApplied && (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                          ✓ Applied to Script
                        </span>
                      )}
                      
                      {summary.usingMock && (
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs">
                          Mock
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {new Date(summary.timestamp).toLocaleString()}
                      </span>
                      
                      <button
                        onClick={() => saveToResearchHistory(summary)}
                        disabled={savingToHistory.includes(summary.id)}
                        className="text-green-500 hover:text-green-700 disabled:text-green-300 transition-colors"
                        title="Save to Research History"
                      >
                        {savingToHistory.includes(summary.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => toggleSummaryExpansion(summary.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleDeleteResearch(summary.id, summary.type)}
                        className="text-red-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Preview */}
                  <div className="text-sm text-gray-600 mb-2">
                    {summary.type === 'google' ? (
                      <p>{(summary.insights || '').slice(0, 150)}...</p>
                    ) : (
                      <p>{(summary.videosSummary.overallTheme || '').slice(0, 150)}...</p>
                    )}
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {summary.type === 'google' ? (
                        <>
                          {/* Research Summary Data */}
                          {summary.researchSummary && (
                            <>
                              <div>
                                <h5 className="font-semibold text-gray-800 mb-2">Overall Theme</h5>
                                <div className="text-gray-700 bg-gray-50 p-3 rounded">
                                  {renderEditableField(`${summary.id}.researchSummary.overallTheme`, summary.researchSummary.overallTheme || '', summary.id, summary, 'Overall theme...')}
                                </div>
                              </div>
                              
                              <div>
                                <h5 className="font-semibold text-gray-800 mb-2">Key Insights</h5>
                                {renderEditableArray(`${summary.id}.researchSummary.keyInsights`, summary.researchSummary.keyInsights || [], summary.id, summary)}
                              </div>
                              
                              {/* Visual/Audio Cues */}
                              {summary.researchSummary.visualAudioCues && summary.researchSummary.visualAudioCues.length > 0 && (
                                <div>
                                  <h5 className="font-semibold text-gray-800 mb-2">Visual/Audio Cues</h5>
                                  <ul className="space-y-1">
                                    {summary.researchSummary.visualAudioCues.map((cue: string, index: number) => (
                                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className="bg-purple-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                          🎬
                                        </span>
                                        {renderEditableField(`${summary.id}.researchSummary.visualAudioCues.${index}`, cue, summary.id, summary)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {/* Audience Questions */}
                              {summary.researchSummary.audienceQuestions && summary.researchSummary.audienceQuestions.length > 0 && (
                                <div>
                                  <h5 className="font-semibold text-gray-800 mb-2">Audience Questions/Hooks</h5>
                                  <ul className="space-y-1">
                                    {summary.researchSummary.audienceQuestions.map((question: string, index: number) => (
                                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className="bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                          ❓
                                        </span>
                                        {renderEditableField(`${summary.id}.researchSummary.audienceQuestions.${index}`, question, summary.id, summary)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {/* Character Insights */}
                              {summary.researchSummary.characterInsights && summary.researchSummary.characterInsights.length > 0 && (
                                <div>
                                  <h5 className="font-semibold text-gray-800 mb-2">Character Insights</h5>
                                  <ul className="space-y-1">
                                    {summary.researchSummary.characterInsights.map((insight: string, index: number) => (
                                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className="bg-indigo-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                          👤
                                        </span>
                                        {renderEditableField(`${summary.id}.researchSummary.characterInsights.${index}`, insight, summary.id, summary)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {/* Dramatic Elements */}
                              {summary.researchSummary.conflictElements && summary.researchSummary.conflictElements.length > 0 && (
                                <div>
                                  <h5 className="font-semibold text-gray-800 mb-2">Dramatic Elements</h5>
                                  <ul className="space-y-1">
                                    {summary.researchSummary.conflictElements.map((element: string, index: number) => (
                                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className="bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                          ⚡
                                        </span>
                                        {renderEditableField(`${summary.id}.researchSummary.conflictElements.${index}`, element, summary.id, summary)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {/* Story Ideas */}
                              {summary.researchSummary.storyIdeas && summary.researchSummary.storyIdeas.length > 0 && (
                                <div>
                                  <h5 className="font-semibold text-gray-800 mb-2">Story Ideas</h5>
                                  <ul className="space-y-1">
                                    {summary.researchSummary.storyIdeas.map((idea: string, index: number) => (
                                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className="bg-yellow-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                          💡
                                        </span>
                                        {renderEditableField(`${summary.id}.researchSummary.storyIdeas.${index}`, idea, summary.id, summary)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {/* Creative Prompt */}
                              {summary.researchSummary.creativePrompt && (
                                <div>
                                  <h5 className="font-semibold text-gray-800 mb-2">Creative Prompt</h5>
                                  <div className="text-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded border-l-4 border-purple-500">
                                    {renderEditableField(`${summary.id}.researchSummary.creativePrompt`, summary.researchSummary.creativePrompt, summary.id, summary, 'Creative prompt...')}
                                  </div>
                                </div>
                              )}
                              
                              {/* Article Summaries */}
                              {summary.researchSummary.articleSummaries && summary.researchSummary.articleSummaries.length > 0 && (
                                <div>
                                  <h5 className="font-semibold text-gray-800 mb-2">Article Summaries ({summary.researchSummary.articleSummaries.length})</h5>
                                  <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {summary.researchSummary.articleSummaries.map((article: any, index: number) => (
                                      <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                        <div className="flex items-start gap-2 mb-2">
                                          <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                            {index + 1}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <h6 className="font-medium text-gray-800 text-sm mb-1">
                                              {article.title}
                                              {article.url && (
                                                <a 
                                                  href={article.url} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer"
                                                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                                                >
                                                  🔗
                                                </a>
                                              )}
                                            </h6>
                                            <p className="text-xs text-gray-600 mb-2">{article.source} {article.date && `• ${article.date}`}</p>
                                            <p className="text-sm text-gray-700">{article.contextualInfo}</p>
                                            {article.keyPoints && article.keyPoints.length > 0 && (
                                              <div className="mt-2">
                                                <span className="text-xs font-medium text-gray-600">Key Points:</span>
                                                <ul className="text-xs text-gray-600 mt-1 ml-2">
                                                  {article.keyPoints.slice(0, 3).map((point: string, pointIndex: number) => (
                                                    <li key={pointIndex}>• {point}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Actionable Items */}
                              {summary.researchSummary.actionableItems && summary.researchSummary.actionableItems.length > 0 && (
                                <div>
                                  <h5 className="font-semibold text-gray-800 mb-2">Actionable Items</h5>
                                  {renderEditableArray(`${summary.id}.researchSummary.actionableItems`, summary.researchSummary.actionableItems, summary.id, summary)}
                                </div>
                              )}
                            </>
                          )}
                          
                          {/* Fallback to legacy fields if researchSummary doesn't exist */}
                          {!summary.researchSummary && (
                        <>
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">
                              {summary.category === 'Article Content' ? 'Article Content' : 'Research Content'}
                            </h5>
                            <div className="text-gray-700 bg-gray-50 p-3 rounded prose prose-sm max-w-none">
                              {summary.category === 'Article Content' ? (
                                // For scraped articles, make the content editable as markdown
                                renderEditableTextArea(`${summary.id}.insights`, summary.insights || '', summary.id, summary, 'Article content...')
                              ) : summary.scraped_content ? (
                                <ReactMarkdown>{summary.scraped_content}</ReactMarkdown>
                              ) : (
                                renderEditableField(`${summary.id}.insights`, summary.insights || '', summary.id, summary, 'Research insights...')
                              )}
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Key Findings</h5>
                              {renderEditableArray(`${summary.id}.keyFindings`, summary.keyFindings || [], summary.id, summary)}
                            </div>
                            
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Recommendations</h5>
                              {renderEditableArray(`${summary.id}.recommendations`, summary.recommendations || [], summary.id, summary)}
                            </div>
                          </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">Overall Theme</h5>
                            <div className="text-gray-700 bg-gray-50 p-3 rounded">
                              {renderEditableField(`${summary.id}.videosSummary.overallTheme`, summary.videosSummary.overallTheme || '', summary.id, summary, 'Overall theme...')}
                            </div>
                          </div>
                          
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">Key Insights</h5>
                            {renderEditableArray(`${summary.id}.videosSummary.keyInsights`, summary.videosSummary.keyInsights || [], summary.id, summary)}
                          </div>
                          
                          {/* Character Insights */}
                          {summary.videosSummary.characterInsights && summary.videosSummary.characterInsights.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Character Insights</h5>
                              <ul className="space-y-1">
                                {summary.videosSummary.characterInsights.map((insight: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-indigo-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      👤
                                    </span>
                                    {renderEditableField(`${summary.id}.videosSummary.characterInsights.${index}`, insight, summary.id, summary)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Conflict Elements */}
                          {summary.videosSummary.conflictElements && summary.videosSummary.conflictElements.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Conflict Elements</h5>
                              <ul className="space-y-1">
                                {summary.videosSummary.conflictElements.map((conflict: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      ⚡
                                    </span>
                                    {renderEditableField(`${summary.id}.videosSummary.conflictElements.${index}`, conflict, summary.id, summary)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Story Ideas */}
                          {summary.videosSummary.storyIdeas && summary.videosSummary.storyIdeas.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Story Ideas</h5>
                              <ul className="space-y-1">
                                {summary.videosSummary.storyIdeas.map((idea: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      💡
                                    </span>
                                    {renderEditableField(`${summary.id}.videosSummary.storyIdeas.${index}`, idea, summary.id, summary)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Common Patterns */}
                          {summary.videosSummary.commonPatterns && summary.videosSummary.commonPatterns.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Common Patterns</h5>
                              <ul className="space-y-1">
                                {summary.videosSummary.commonPatterns.map((pattern: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      🔄
                                    </span>
                                    {renderEditableField(`${summary.id}.videosSummary.commonPatterns.${index}`, pattern, summary.id, summary)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2">Creative Prompt</h5>
                            <div className="text-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded border border-purple-200">
                              {renderEditableField(`${summary.id}.videosSummary.creativePrompt`, summary.videosSummary.creativePrompt || '', summary.id, summary, 'Creative prompt...')}
                            </div>
                          </div>
                          
                          {/* Actionable Items */}
                          {summary.videosSummary.actionableItems && summary.videosSummary.actionableItems.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-2">Actionable Items</h5>
                              <ul className="space-y-1">
                                {summary.videosSummary.actionableItems.map((item: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="bg-purple-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                      ✓
                                    </span>
                                    {renderEditableField(`${summary.id}.videosSummary.actionableItems.${index}`, item, summary.id, summary)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Video Summaries with Timestamps */}
                          {summary.videosSummary.videoSummaries && summary.videosSummary.videoSummaries.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-800 mb-3">Video Analysis Details</h5>
                              <div className="space-y-4">
                                {summary.videosSummary.videoSummaries.map((videoSummary: any, index: number) => (
                                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <div className="mb-2">
                                      <h4 className="font-medium text-gray-900 mb-1">
                                        {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.title`, videoSummary.title || '', summary.id, summary, 'Video title...')}
                                      </h4>
                                      
                                      <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>Topic: {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.mainTopic`, videoSummary.mainTopic || '', summary.id, summary, 'Main topic...')}</span>
                                        <span>Tone: {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.emotionalTone`, videoSummary.emotionalTone || '', summary.id, summary, 'Emotional tone...')}</span>
                                        {videoSummary.timestamp && (
                                          <div className="flex items-center gap-1">
                                            <span>🕐</span>
                                            {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.timestamp`, videoSummary.timestamp, summary.id, summary, 'HH:MM:SS')}
                                          <a
                                            href={`https://www.youtube.com/watch?v=${videoSummary.videoId}&t=${convertTimestampToSeconds(videoSummary.timestamp)}s`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-red-600 hover:text-red-800 underline flex items-center gap-1"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-6m-7 1l8-8m0 0V8m0 0H8" />
                                            </svg>
                                          </a>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Show ALL timestamps from analysis if available */}
                                    {videoSummary.timestamps && videoSummary.timestamps.length > 0 && (
                                      <div className="mb-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <h5 className="text-sm font-medium text-gray-700">Timestamps ({videoSummary.timestamps.length}):</h5>
                                          <button
                                            onClick={() => addNewTimestamp(summary.id, index, summary)}
                                            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                                          >
                                            <Plus className="h-3 w-3" />
                                            Add Timestamp
                                          </button>
                                        </div>
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                          {videoSummary.timestamps.map((timestamp: any, timestampIndex: number) => (
                                            <div key={timestampIndex} className="bg-white p-2 rounded border text-xs">
                                              <div className="flex items-center gap-2 mb-1">
                                                <div className="flex items-center gap-1">
                                                  <span>🕐</span>
                                                  {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.timestamps.${timestampIndex}.startTime`, timestamp.startTime || '', summary.id, summary, 'HH:MM:SS')}
                                                  <span>-</span>
                                                  {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.timestamps.${timestampIndex}.endTime`, timestamp.endTime || '', summary.id, summary, 'HH:MM:SS')}
                                                </div>
                                                <a
                                                  href={`https://www.youtube.com/watch?v=${videoSummary.videoId}&t=${convertTimestampToSeconds(timestamp.startTime)}s`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-red-600 hover:text-red-800 underline"
                                                >
                                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-6m-7 1l8-8m0 0V8m0 0H8" />
                                                  </svg>
                                                </a>
                                                <span className="text-blue-600 font-medium">
                                                  {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.timestamps.${timestampIndex}.speaker`, timestamp.speaker || '', summary.id, summary, 'Speaker name...')}
                                                </span>
                                              </div>
                                              <p className="text-gray-700 mb-1">
                                                {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.timestamps.${timestampIndex}.description`, timestamp.description || '', summary.id, summary, 'Description...')}
                                              </p>
                                              {timestamp.quote && (
                                                <p className="text-gray-600 italic">
                                                  "{renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.timestamps.${timestampIndex}.quote`, timestamp.quote || '', summary.id, summary, 'Quote...')}"
                                                </p>
                                              )}
                                              <p className="text-gray-500 text-xs">
                                                {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.timestamps.${timestampIndex}.significance`, timestamp.significance || '', summary.id, summary, 'Significance...')}
                                              </p>
                                              <div className="flex justify-end mt-1">
                                                <button
                                                  onClick={() => removeTimestamp(summary.id, index, timestampIndex, summary)}
                                                  className="text-red-600 hover:text-red-800 text-xs flex items-center gap-1"
                                                >
                                                  <X className="h-3 w-3" />
                                                  Remove
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Add timestamps button when no timestamps exist */}
                                    {(!videoSummary.timestamps || videoSummary.timestamps.length === 0) && (
                                      <div className="mb-6">
                                        <button
                                          onClick={() => addNewTimestamp(summary.id, index, summary)}
                                          className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 border border-blue-200 rounded px-2 py-1"
                                        >
                                          <Plus className="h-3 w-3" />
                                          Add First Timestamp
                                        </button>
                                      </div>
                                    )}

                                    {videoSummary.contextualInfo && (
                                      <div className="mb-3">
                                        <p className="text-sm text-gray-700 bg-white p-2 rounded border">
                                          {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.contextualInfo`, videoSummary.contextualInfo || '', summary.id, summary, 'Contextual information...')}
                                        </p>
                                      </div>
                                    )}
                                    
                                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                                        <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-medium text-gray-800">Key Points:</span>
                                          <button
                                            onClick={() => addNewKeyPoint(summary.id, index, summary)}
                                            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                                          >
                                            <Plus className="h-3 w-3" />
                                            Add
                                          </button>
                                        </div>
                                        {videoSummary.keyPoints && videoSummary.keyPoints.length > 0 ? (
                                          <ul className="space-y-1">
                                            {videoSummary.keyPoints.map((point: string, idx: number) => (
                                              <li key={idx} className="text-gray-600 flex items-start gap-1">
                                                <span className="text-blue-600">•</span>
                                                <div className="flex-1 flex items-center gap-1">
                                                  {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.keyPoints.${idx}`, point, summary.id, summary, 'Key point...')}
                                                  <button
                                                    onClick={() => removeKeyPoint(summary.id, index, idx, summary)}
                                                    className="text-red-600 hover:text-red-800 text-xs"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-gray-500 text-xs italic">No key points added yet</p>
                                      )}
                                      </div>
                                      
                                        <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-medium text-gray-800">Key Quotes:</span>
                                          <button
                                            onClick={() => addNewKeyQuote(summary.id, index, summary)}
                                            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                                          >
                                            <Plus className="h-3 w-3" />
                                            Add
                                          </button>
                                        </div>
                                        {videoSummary.keyQuotes && videoSummary.keyQuotes.length > 0 ? (
                                          <ul className="space-y-1">
                                            {videoSummary.keyQuotes.map((quote: any, idx: number) => (
                                              <li key={idx} className="text-gray-600 italic flex items-start gap-1">
                                                <span>"</span>
                                                <div className="flex-1 flex items-center gap-1">
                                                  {renderEditableField(`${summary.id}.videosSummary.videoSummaries.${index}.keyQuotes.${idx}`, typeof quote === 'string' ? quote : quote.quote || quote.text || '', summary.id, summary, 'Quote...')}
                                                  <button
                                                    onClick={() => removeKeyQuote(summary.id, index, idx, summary)}
                                                    className="text-red-600 hover:text-red-800 text-xs"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                                <span>"</span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-gray-500 text-xs italic">No key quotes added yet</p>
                                      )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
} 