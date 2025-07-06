'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Slider } from '../ui/slider'
import { Checkbox } from '../ui/checkbox'
import { ScrollArea } from '../ui/scroll-area'
import { FileText, Sparkles, RefreshCw, Trash2 } from 'lucide-react'
import type { ExtractedScene } from '@/types/image-generation'

interface SceneExtractionProps {
  scriptInput: string
  onScriptInputChange: (value: string) => void
  numberOfScenesToExtract: number
  onNumberOfScenesChange: (value: number) => void
  isExtractingScenes: boolean
  sceneExtractionError: string | null
  extractedScenes: ExtractedScene[]
  selectedScenes: number[]
  onToggleSceneSelection: (index: number) => void
  onExtractScenes: () => void
  onClearError: () => void
  scriptSourceInfo: {
    source: string
    count: number
    type: string
  }
}

export function SceneExtraction({
  scriptInput,
  onScriptInputChange,
  numberOfScenesToExtract,
  onNumberOfScenesChange,
  isExtractingScenes,
  sceneExtractionError,
  extractedScenes,
  selectedScenes,
  onToggleSceneSelection,
  onExtractScenes,
  onClearError,
  scriptSourceInfo
}: SceneExtractionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-600" />
          Scene Extraction
        </CardTitle>
        <CardDescription>
          Extract scenes from scripts for image generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Script Source Information */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-gray-800">Script Source</span>
          </div>
          {scriptSourceInfo.source !== 'none' ? (
            <div className="space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{scriptSourceInfo.type}</span> 
                <span className="text-muted-foreground"> ({scriptSourceInfo.count.toLocaleString()} characters)</span>
              </p>
              {scriptSourceInfo.source === 'sections' && (
                <p className="text-xs text-blue-600">Using image generation prompts from script sections</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-700">No script detected. Please paste a custom script below.</p>
          )}
        </div>

        {/* Custom Script Input */}
        <div className="space-y-2">
          <Label htmlFor="script-input">Custom Script (Optional)</Label>
          <Textarea
            id="script-input"
            placeholder="Paste your script here to override the detected script sources..."
            value={scriptInput}
            onChange={(e) => onScriptInputChange(e.target.value)}
            disabled={isExtractingScenes}
            className="min-h-[120px]"
          />
          <p className="text-xs text-muted-foreground">
            This will take priority over the detected script sources above.
          </p>
        </div>

        {/* Number of Scenes Slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Number of Scenes to Extract</Label>
            <Badge variant="outline">{numberOfScenesToExtract}</Badge>
          </div>
          <Slider
            value={[numberOfScenesToExtract]}
            onValueChange={(value) => onNumberOfScenesChange(value[0])}
            min={1}
            max={200}
            step={1}
            disabled={isExtractingScenes}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 scene</span>
            <span>100 scenes</span>
          </div>
        </div>

        {/* Extract Scenes Button */}
        <Button 
          className="w-full" 
          onClick={onExtractScenes}
          disabled={isExtractingScenes || scriptSourceInfo.source === 'none'}
          size="lg"
        >
          {isExtractingScenes ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Extracting {numberOfScenesToExtract} Scenes...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              Extract {numberOfScenesToExtract} Scenes
            </>
          )}
        </Button>

        {/* Scene Extraction Error */}
        {sceneExtractionError && (
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-red-800">Scene Extraction Error</p>
                  <p className="text-sm text-red-600">{sceneExtractionError}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={onClearError}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extracted Scenes */}
        {extractedScenes.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Extracted Scenes ({extractedScenes.length})</Label>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => selectedScenes.forEach((_, i) => onToggleSceneSelection(i))}
                  disabled={selectedScenes.length === 0}
                >
                  Clear
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const allIndices = Array.from({length: extractedScenes.length}, (_, i) => i)
                    allIndices.forEach(i => {
                      if (!selectedScenes.includes(i)) {
                        onToggleSceneSelection(i)
                      }
                    })
                  }}
                  disabled={selectedScenes.length === extractedScenes.length}
                >
                  Select All
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-96 border rounded-md p-4">
              <div className="space-y-4">
                {extractedScenes.map((scene: ExtractedScene, index: number) => (
                  <div key={index} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id={`scene-${index}`} 
                        checked={selectedScenes.includes(index)}
                        onCheckedChange={() => onToggleSceneSelection(index)}
                      />
                      <Label 
                        htmlFor={`scene-${index}`} 
                        className="font-medium cursor-pointer"
                      >
                        {scene.summary}
                      </Label>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <div className="italic pl-4 border-l-2 border-muted-foreground/30">{scene.imagePrompt}</div>
                    </div>
                    
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium">View Original Text</summary>
                      <div className="mt-2 p-2 bg-muted/30 rounded text-muted-foreground max-h-32 overflow-y-auto">
                        {scene.originalText}
                      </div>
                    </details>
                    
                    {scene.error && (
                      <div className="text-sm text-red-500">
                        Error: {scene.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 