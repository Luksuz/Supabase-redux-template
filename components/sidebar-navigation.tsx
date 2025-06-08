'use client'

import { useState } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Volume2, VideoIcon, BarChart3, Settings } from 'lucide-react'

type NavigationView = 'video-generator' | 'video-status' | 'settings'

interface SidebarNavigationProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
}

export function SidebarNavigation({ activeView, onViewChange }: SidebarNavigationProps) {
  const { uploadedAudio, subtitles } = useAppSelector(state => state.audio)
  const { uploadedVideo, processingMetadata, currentGeneration, generationHistory } = useAppSelector(state => state.video)

  const navigationItems = [
    {
      id: 'video-generator' as NavigationView,
      label: 'Video Generator',
      icon: VideoIcon,
      description: 'Upload audio & video, create videos',
      hasData: !!(uploadedAudio || uploadedVideo || processingMetadata),
      dataCount: (uploadedAudio ? 1 : 0) + (uploadedVideo ? 1 : 0) + (processingMetadata ? 1 : 0)
    },
    {
      id: 'video-status' as NavigationView,
      label: 'Video Status',
      icon: BarChart3,
      description: 'Monitor video generations',
      hasData: generationHistory.length > 0 || !!currentGeneration,
      dataCount: generationHistory.length + (currentGeneration ? 1 : 0),
      disabled: false
    },
    {
      id: 'settings' as NavigationView,
      label: 'Settings',
      icon: Settings,
      description: 'Configure video settings',
      hasData: false,
      dataCount: 0
    }
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Video Creator</h2>
        <p className="text-sm text-gray-500">Audio • Video • Processing</p>
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
                  }`} />
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
                </div>
              </div>
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
                <span>Audio uploaded:</span>
                <span className="font-medium">{uploadedAudio ? '✓' : '✗'}</span>
              </div>
              <div className="flex justify-between">
                <span>Video uploaded:</span>
                <span className="font-medium">{uploadedVideo ? '✓' : '✗'}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtitles generated:</span>
                <span className="font-medium">{subtitles ? '✓' : '✗'}</span>
              </div>
              <div className="flex justify-between">
                <span>Metadata processed:</span>
                <span className="font-medium">{processingMetadata ? '✓' : '✗'}</span>
              </div>
              <div className="flex justify-between">
                <span>Total videos:</span>
                <span className="font-medium">{generationHistory.length + (currentGeneration ? 1 : 0)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
} 