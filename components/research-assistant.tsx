'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  setResearchQuery,
  startResearchSearch,
  setResearchResults,
  startResearchAnalysis,
  setResearchAnalysis,
  applyResearchToScript,
  setResearchError,
  clearResearch
} from '../lib/features/scripts/scriptsSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Search, Loader2, CheckCircle, AlertCircle, Lightbulb, ExternalLink, ArrowRight, Target, Users, Zap, Trash2 } from 'lucide-react'

export function ResearchAssistant() {
  const dispatch = useAppDispatch()
  const { research, sectionedWorkflow } = useAppSelector(state => state.scripts)
  
  const [localMessage, setLocalMessage] = useState("")
  const [localMessageType, setLocalMessageType] = useState<'success' | 'error' | 'info'>('info')

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setLocalMessage(msg)
    setLocalMessageType(type)
    // Clear message after 5 seconds
    setTimeout(() => setLocalMessage(""), 5000)
  }

  // Conduct research
  const handleResearch = async () => {
    if (!research.query.trim()) {
      showMessage('Please enter a search query', 'error')
      return
    }

    dispatch(startResearchSearch())
    showMessage(`Searching for: "${research.query}"...`, 'info')

    try {
      const response = await fetch('/api/research-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: research.query,
          selectedModel: sectionedWorkflow.selectedModel
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Research failed')
      }

      const data = await response.json()
      
      // Update Redux with search results
      dispatch(setResearchResults(data.searchResults))
      
      // Start analysis
      dispatch(startResearchAnalysis())
      
      // Set analysis results
      dispatch(setResearchAnalysis(data.analysis))
      
      showMessage(
        `Research completed! Found ${data.meta.analyzedResults} relevant results and generated insights.`, 
        'success'
      )
    } catch (error) {
      const errorMessage = (error as Error).message
      dispatch(setResearchError(errorMessage))
      showMessage(`Research failed: ${errorMessage}`, 'error')
    }
  }

  // Apply research insights to script configuration
  const handleApplyInsights = () => {
    if (!research.analysis) {
      showMessage('No research insights to apply', 'error')
      return
    }

    dispatch(applyResearchToScript())
    showMessage('Research insights applied to script configuration!', 'success')
  }

  // Clear research data
  const handleClearResearch = () => {
    dispatch(clearResearch())
    showMessage('Research data cleared', 'info')
  }

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Research Assistant
        </CardTitle>
        <CardDescription>
          Research trending topics and get AI-powered insights for your video script
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="space-y-2">
          <Label htmlFor="research-query">Search Topic</Label>
          <div className="flex gap-2">
            <Input
              id="research-query"
              value={research.query}
              onChange={(e) => dispatch(setResearchQuery(e.target.value))}
              placeholder="e.g., 'hidden secrets of successful people', 'conspiracy theories 2024'..."
              disabled={research.isSearching || research.isAnalyzing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !research.isSearching && !research.isAnalyzing) {
                  handleResearch()
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleResearch}
              disabled={research.isSearching || research.isAnalyzing || !research.query.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {research.isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : research.isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Research
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress indicator */}
        {(research.isSearching || research.isAnalyzing) && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {research.isSearching && 'Searching Google for top 50 results...'}
                {research.isAnalyzing && 'Analyzing search results with AI...'}
              </span>
            </div>
            <div className="text-xs text-blue-600">
              {research.isSearching && 'Fetching trending content and popular discussions'}
              {research.isAnalyzing && 'Extracting key insights and generating content strategy'}
            </div>
          </div>
        )}

        {/* Research Results Summary */}
        {research.searchResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Search Results</h4>
              <Badge variant="outline">
                {research.searchResults.length} results analyzed
              </Badge>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {research.searchResults.slice(0, 5).map((result, index) => (
                <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate flex-1">
                      {result.title}
                    </span>
                    <a 
                      href={result.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-gray-600 truncate">{result.description}</p>
                </div>
              ))}
              {research.searchResults.length > 5 && (
                <p className="text-xs text-gray-500 text-center">
                  ...and {research.searchResults.length - 5} more results analyzed
                </p>
              )}
            </div>
          </div>
        )}

        {/* AI Analysis Results */}
        {research.analysis && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                AI Insights
              </h4>
              <div className="flex gap-2">
                <Button
                  onClick={handleApplyInsights}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Apply to Script
                </Button>
                <Button
                  onClick={handleClearResearch}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Suggested Title */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Suggested Title
                </Label>
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm font-medium text-green-800">
                    {research.analysis.suggestedTitle}
                  </p>
                </div>
              </div>

              {/* Theme */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Theme</Label>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800">{research.analysis.theme}</p>
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Target Audience
                </Label>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                  <p className="text-sm text-purple-800">{research.analysis.targetAudience}</p>
                </div>
              </div>

              {/* Emotional Tone */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Emotional Tone
                </Label>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                  <p className="text-sm text-orange-800">{research.analysis.emotionalTone}</p>
                </div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Key Insights</Label>
              <div className="space-y-1">
                {research.analysis.keyInsights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <Badge variant="outline" className="text-xs mt-0.5">
                      {index + 1}
                    </Badge>
                    <p className="text-sm text-yellow-800 flex-1">{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Instructions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Script Writing Instructions</Label>
              <Textarea
                value={research.analysis.additionalInstructions}
                readOnly
                className="text-sm bg-gray-50"
                rows={4}
              />
            </div>

            {/* Metadata */}
            {research.lastAnalysisAt && (
              <div className="text-xs text-gray-500 border-t pt-2">
                Research completed on {new Date(research.lastAnalysisAt).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {research.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-800">Research Error</span>
            </div>
            <p className="text-red-700 mt-1 text-sm">{research.error}</p>
          </div>
        )}

        {/* Local Message */}
        {localMessage && (
          <div className={`p-3 rounded-lg border ${
            localMessageType === 'success' ? 'border-green-200 bg-green-50' :
            localMessageType === 'error' ? 'border-red-200 bg-red-50' :
            'border-blue-200 bg-blue-50'
          }`}>
            <div className="flex items-center gap-2">
              {localMessageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {localMessageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
              {localMessageType === 'info' && <Search className="h-4 w-4 text-blue-600" />}
              <span className={`text-sm ${
                localMessageType === 'success' ? 'text-green-800' :
                localMessageType === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {localMessage}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 