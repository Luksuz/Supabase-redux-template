'use client'

import { useState } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { ImageIcon, FileText, Key, Volume2, VideoIcon, BarChart3, ChevronRight } from 'lucide-react'

type NavigationView = 'process-images' | 'script-generator' | 'audio-generator' | 'video-generator' | 'video-status' | 'api-keys'

interface SidebarNavigationProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
}

export function SidebarNavigation({ activeView, onViewChange }: SidebarNavigationProps) {
  const { hasProcessedImages, originalImages, savedImagesCount } = useAppSelector(state => state.images)
  const { hasGeneratedScripts, scripts } = useAppSelector(state => state.scripts)
  const { currentGeneration: audioGeneration } = useAppSelector(state => state.audio)
  const { currentGeneration: videoGeneration, generationHistory, isGeneratingVideo } = useAppSelector(state => state.video)

  const navigationItems = [
    {
      id: 'process-images' as NavigationView,
      label: 'Process Images',
      icon: ImageIcon,
      description: 'Upload and process ZIP files',
      hasData: hasProcessedImages,
      dataCount: originalImages.length
    },
    {
      id: 'script-generator' as NavigationView,
      label: 'Script Generator',
      icon: FileText,
      description: 'Generate narration scripts',
      hasData: hasGeneratedScripts,
      dataCount: scripts.filter(s => s.generated).length,
      disabled: !hasProcessedImages
    },
    {
      id: 'audio-generator' as NavigationView,
      label: 'Audio Generator',
      icon: Volume2,
      description: 'Convert scripts to audio',
      hasData: !!audioGeneration,
      dataCount: audioGeneration ? 1 : 0,
      disabled: !hasGeneratedScripts
    },
    {
      id: 'video-generator' as NavigationView,
      label: 'Video Generator',
      icon: VideoIcon,
      description: 'Create videos with Shotstack',
      hasData: !!videoGeneration,
      dataCount: videoGeneration ? 1 : 0,
      disabled: !audioGeneration?.audioUrl,
      isGenerating: isGeneratingVideo
    },
    {
      id: 'video-status' as NavigationView,
      label: 'Video Status',
      icon: BarChart3,
      description: 'Monitor video generations',
      hasData: generationHistory.length > 0 || !!videoGeneration,
      dataCount: generationHistory.length + (videoGeneration ? 1 : 0),
      disabled: false
    },
    {
      id: 'api-keys' as NavigationView,
      label: 'API Keys',
      icon: Key,
      description: 'Manage WellSaid Labs API keys',
      hasData: false,
      dataCount: 0
    }
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Content Creator</h2>
        <p className="text-sm text-gray-500">Images • Scripts • Audio • Video</p>
      </div>
      
      <nav className="p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id
          const isDisabled = item.disabled
          
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onViewChange(item.id)}
              disabled={isDisabled}
              className={`
                w-full text-left p-3 rounded-lg transition-all duration-200
                ${isActive 
                  ? 'bg-blue-50 border border-blue-200 text-blue-900' 
                  : isDisabled
                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${
                    isActive ? 'text-blue-600' : 
                    isDisabled ? 'text-gray-400' : 
                    'text-gray-500'
                  } ${item.isGenerating ? 'animate-pulse' : ''}`} />
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.hasData && (
                    <Badge variant="secondary" className="text-xs">
                      {item.dataCount}
                    </Badge>
                  )}
                  {item.isGenerating && (
                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                      Generating
                    </Badge>
                  )}
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-blue-600" />
                  )}
                </div>
              </div>
              
              {/* Helper hints for disabled items */}
              {item.id === 'script-generator' && !hasProcessedImages && (
                <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  Process images first to enable script generation
                </div>
              )}
              
              {item.id === 'audio-generator' && !hasGeneratedScripts && (
                <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  Generate scripts first to enable audio generation
                </div>
              )}
              
              {item.id === 'video-generator' && !audioGeneration?.audioUrl && (
                <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  Generate audio first to enable video creation
                </div>
              )}
            </button>
          )
        })}
      </nav>
      
      {/* Status Summary */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <Card className="p-3 bg-gray-50">
          <div className="text-sm space-y-2">
            <div className="font-medium text-gray-700">Status Summary</div>
            <div className="text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Images processed:</span>
                <span className="font-medium">{originalImages.length}</span>
              </div>
              {savedImagesCount > 0 && (
                <div className="flex justify-between">
                  <span>Saved to Supabase:</span>
                  <span className="font-medium text-green-600">{savedImagesCount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Scripts generated:</span>
                <span className="font-medium">{scripts.filter(s => s.generated).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Audio generations:</span>
                <span className="font-medium">{audioGeneration ? 1 : 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Video generations:</span>
                <span className="font-medium">{generationHistory.length + (videoGeneration ? 1 : 0)}</span>
              </div>
              {isGeneratingVideo && (
                <div className="flex justify-between">
                  <span>Video processing:</span>
                  <span className="font-medium text-orange-600">Active</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
} 