'use client'

import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Cpu, Info, Clock } from 'lucide-react'
import { ImageProvider } from '@/types/image-generation'
import { MODEL_INFO } from '@/data/image'

interface ModelSelectionProps {
  selectedModel: ImageProvider
  onModelChange: (model: ImageProvider) => void
  selectedScenes: number[]
}

export function ModelSelection({ selectedModel, onModelChange, selectedScenes }: ModelSelectionProps) {
  const currentModel = MODEL_INFO[selectedModel]
  const estimatedBatches = selectedScenes.length > 0 ? Math.ceil(selectedScenes.length / currentModel.batchSize) : 0

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
      <CardHeader>
        <CardTitle className="flex text-black items-center gap-2">
          <Cpu className="h-5 w-5 text-purple-600" />
          AI Model Selection
        </CardTitle>
        <CardDescription>
          Choose your preferred AI model for image generation. Each model processes images in optimized batches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.entries(MODEL_INFO).map(([key, info]) => (
            <div
              key={key}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedModel === key
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => onModelChange(key as ImageProvider)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-black">{info.name}</h3>
                  {selectedModel === key && (
                    <Badge className="bg-purple-600 text-black">Selected</Badge>
                  )}
                </div>
                <p className="text-sm text-black">{info.description}</p>
                <div className="flex flex-wrap gap-1">
                  {info.features.map((feature, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs text-black border-black">
                      {feature}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-black">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-black" />
                    Batch size: {info.batchSize}
                  </span>
                  {info.rateLimit && (
                    <span className="text-black">{info.rateLimit}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Batch Processing Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800">Batch Processing</p>
              <p className="text-sm text-blue-700">
                {currentModel.name} processes images in batches of {currentModel.batchSize}. 
                {selectedScenes.length > 0 && (
                  <span className="font-medium">
                    {' '}Your {selectedScenes.length} selected scenes will be processed in {estimatedBatches} batch{estimatedBatches !== 1 ? 'es' : ''}.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 