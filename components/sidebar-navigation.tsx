'use client'

import { useState } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { ImageIcon, FileText, Key, Volume2, VideoIcon, BarChart3, ChevronRight, Crown, Mic, Video, Activity, Settings } from 'lucide-react'

type NavigationView = 'script-generator' | 'image-generator' | 'audio-generator' | 'video-generator' | 'video-status' | 'admin-dashboard'

interface SidebarNavigationProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
}

export function SidebarNavigation({ 
  activeView, 
  onViewChange
}: SidebarNavigationProps) {
  const { hasProcessedImages, originalImages, savedImagesCount } = useAppSelector(state => state.images)
  const { hasGeneratedScripts, scripts, hasFullScript, fullScript } = useAppSelector(state => state.scripts)
  const { currentGeneration: audioGeneration } = useAppSelector(state => state.audio)
  const { currentGeneration: videoGeneration, generationHistory, isGeneratingVideo } = useAppSelector(state => state.video)
  const { generatedImages, isGenerating: isGeneratingImages } = useAppSelector(state => state.imageGeneration)
  const user = useAppSelector(state => state.user)

  const navigationItems = [
    {
      id: 'script-generator' as NavigationView,
      label: 'Script Generator',
      icon: FileText,
      description: 'Generate AI-powered scripts'
    },
    {
      id: 'image-generator' as NavigationView,
      label: 'Image Generator', 
      icon: ImageIcon,
      description: 'Create images from scripts'
    },
    {
      id: 'audio-generator' as NavigationView,
      label: 'Audio Generator',
      icon: Mic,
      description: 'Generate voiceovers'
    },
    {
      id: 'video-generator' as NavigationView,
      label: 'Video Generator',
      icon: Video,
      description: 'Create videos from content'
    },
    {
      id: 'video-status' as NavigationView,
      label: 'Video Status',
      icon: Activity,
      description: 'Track video generation'
    },
    {
      id: 'admin-dashboard' as NavigationView,
      label: 'Admin Dashboard',
      icon: Settings,
      description: 'Manage settings'
    }
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Content Studio</h1>
        <p className="text-sm text-gray-600 mt-1">AI-powered content creation</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
              <div className="flex-1">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs text-gray-500">{item.description}</div>
              </div>
              
              {/* Progress indicators and warnings */}
              {item.id === 'script-generator' && (hasGeneratedScripts || hasFullScript) && (
                <div className="mt-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                  {hasFullScript ? `Full script: "${fullScript?.title}"` : `${scripts.length} scripts generated`}
                </div>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <div>User: {user.email || 'Not logged in'}</div>
          <div className="mt-1">
            Status: {audioGeneration ? '🎵 Audio Ready' : ''} 
            {generatedImages.length > 0 ? ' 🖼️ Images Ready' : ''}
            {videoGeneration ? ' 🎬 Video Ready' : ''}
          </div>
        </div>
      </div>
    </div>
  )
} 