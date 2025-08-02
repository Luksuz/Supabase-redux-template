'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { 
  Plus, 
  Trash2, 
  Video, 
  Wand2, 
  Clock,
  Zap,
  RefreshCw,
  Info
} from 'lucide-react'

interface TextToVideoTabProps {
  defaultDuration: 5 | 10
  isGenerating: boolean
  onGenerate: (prompts: string[], duration: 5 | 10) => Promise<void>
  onDurationChange: (duration: 5 | 10) => void
}

export function TextToVideoTab({
  defaultDuration,
  isGenerating,
  onGenerate,
  onDurationChange
}: TextToVideoTabProps) {
  const [prompts, setPrompts] = useState<string[]>([''])
  const [duration, setDuration] = useState<5 | 10>(defaultDuration)
  const [bulkPrompts, setBulkPrompts] = useState('')
  const [showBulkInput, setShowBulkInput] = useState(false)

  // Handle individual prompt changes
  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts]
    newPrompts[index] = value
    setPrompts(newPrompts)
  }

  // Add new prompt
  const addPrompt = () => {
    setPrompts([...prompts, ''])
  }

  // Remove prompt
  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      setPrompts(prompts.filter((_, i) => i !== index))
    }
  }

  // Process bulk prompts
  const processBulkPrompts = () => {
    const lines = bulkPrompts.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    if (lines.length > 0) {
      setPrompts(lines)
      setBulkPrompts('')
      setShowBulkInput(false)
    }
  }

  // Handle generation
  const handleGenerate = async () => {
    const validPrompts = prompts.filter(p => p.trim().length > 0)
    if (validPrompts.length === 0) return

    onDurationChange(duration)
    await onGenerate(validPrompts, duration)
  }

  // Get example prompts
  const getExamplePrompts = () => {
    const examples = [
      "A cat walking through a flower garden",
      "Ocean waves crashing on a sandy beach at sunset",
      "A person dancing in the rain on a city street",
      "Fireflies glowing in a dark forest at night",
      "A hot air balloon floating over mountains"
    ]
    return examples
  }

  const loadExamplePrompts = () => {
    setPrompts(getExamplePrompts())
  }

  const validPrompts = prompts.filter(p => p.trim().length > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-600" />
            Text to Video Generation
          </CardTitle>
          <CardDescription>
            Generate videos from text descriptions using AI. Each prompt will create a {duration}-second video.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Duration Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-4 w-4 text-green-600" />
            Video Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={duration === 5 ? 'default' : 'outline'}
              onClick={() => setDuration(5)}
              disabled={isGenerating}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-2" />
              5 Seconds
              <Badge variant="secondary" className="ml-2">Fast</Badge>
            </Button>
            <Button
              variant={duration === 10 ? 'default' : 'outline'}
              onClick={() => setDuration(10)}
              disabled={isGenerating}
              className="flex-1"
            >
              <Clock className="h-4 w-4 mr-2" />
              10 Seconds
              <Badge variant="secondary" className="ml-2">Detailed</Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Input Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="h-4 w-4 text-purple-600" />
            Video Prompts
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={!showBulkInput ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowBulkInput(false)}
            >
              Individual Prompts
            </Button>
            <Button
              variant={showBulkInput ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowBulkInput(true)}
            >
              Bulk Input
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadExamplePrompts}
              disabled={isGenerating}
            >
              Load Examples
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showBulkInput ? (
            // Individual prompts
            <div className="space-y-3">
              {prompts.map((prompt, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">
                      Prompt {index + 1}
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        placeholder="Describe the video you want to generate..."
                        value={prompt}
                        onChange={(e) => updatePrompt(index, e.target.value)}
                        disabled={isGenerating}
                      />
                      {prompts.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removePrompt(index)}
                          disabled={isGenerating}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={addPrompt}
                disabled={isGenerating || prompts.length >= 10}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Prompt {prompts.length >= 10 ? '(Max 10)' : ''}
              </Button>
            </div>
          ) : (
            // Bulk input
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Bulk Prompts (one per line)
              </Label>
              <Textarea
                placeholder="Enter multiple prompts, one per line:
A cat walking through a garden
Ocean waves at sunset
Person dancing in the rain"
                value={bulkPrompts}
                onChange={(e) => setBulkPrompts(e.target.value)}
                disabled={isGenerating}
                rows={6}
              />
              <Button
                onClick={processBulkPrompts}
                disabled={isGenerating || !bulkPrompts.trim()}
              >
                Process Bulk Prompts
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation Summary */}
      {validPrompts.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{validPrompts.length} Videos</Badge>
                  <Badge variant="secondary">{duration}s Each</Badge>
                  <Badge variant="secondary">
                    {Math.ceil(validPrompts.length / 5)} Batch{Math.ceil(validPrompts.length / 5) !== 1 ? 'es' : ''}
                  </Badge>
                </div>
                <p className="text-sm text-blue-700">
                  Total generation time: ~{validPrompts.length * 30} seconds + batch delays
                </p>
              </div>
              
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || validPrompts.length === 0}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Generate {validPrompts.length} Video{validPrompts.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips and Info */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 mb-2">Text-to-Video Tips</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Be specific about actions, settings, and visual details</li>
                <li>• Include camera movements like "close-up", "wide shot", "panning"</li>
                <li>• Mention lighting conditions: "sunset", "soft lighting", "dramatic shadows"</li>
                <li>• Videos are processed in batches of 5 with 1-minute delays between batches</li>
                <li>• Longer prompts (10-20 words) typically produce better results</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 