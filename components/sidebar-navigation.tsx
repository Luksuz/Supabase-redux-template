'use client'

import { useState } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { ImageIcon, FileText, Key, Volume2, VideoIcon, BarChart3, ChevronRight, Crown } from 'lucide-react'

type NavigationView = 'process-images' | 'script-generator' | 'audio-generator' | 'video-generator' | 'video-status' | 'admin-dashboard'

interface SidebarNavigationProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
}

export function SidebarNavigation({ activeView, onViewChange }: SidebarNavigationProps) {
  const { hasProcessedImages, originalImages, savedImagesCount } = useAppSelector(state => state.images)
  const { hasGeneratedScripts, scripts } = useAppSelector(state => state.scripts)
  const { currentGeneration: audioGeneration } = useAppSelector(state => state.audio)
  const { currentGeneration: videoGeneration, generationHistory, isGeneratingVideo } = useAppSelector(state => state.video)
  const user = useAppSelector(state => state.user)

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
    ...(user.isAdmin ? [{
      id: 'admin-dashboard' as NavigationView,
      label: 'Admin Dashboard',
      icon: Crown,
      description: 'Manage users and system settings',
      hasData: false,
      dataCount: 0,
      isAdmin: true
    }] : [])
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Content Creator</h2>
        <p className="text-sm text-gray-500">Images • Scripts • Audio • Video</p>
      </div>
      
      <nav className="p-4 space-y-2">
        {navigationItems.map((item) => {
          const isActive = activeView === item.id
          const isDisabled = item.disabled
          const Icon = item.icon
          
          return (
            <Card 
              key={item.id}
              className={`
                p-4 cursor-pointer transition-all duration-200 border
                ${isActive 
                  ? 'bg-blue-50 border-blue-200 shadow-sm' 
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }
                ${isDisabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : ''
                }
                ${item.isAdmin
                  ? 'border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50'
                  : ''
                }
              `}
              onClick={() => !isDisabled && onViewChange(item.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon 
                    className={`
                      h-5 w-5 
                      ${isActive 
                        ? 'text-blue-600' 
                        : isDisabled 
                          ? 'text-gray-400' 
                          : 'text-gray-600'
                      }
                      ${item.isAdmin ? 'text-yellow-600' : ''}
                      ${item.isGenerating ? 'animate-pulse' : ''}
                    `} 
                  />
                  <div>
                    <div className={`
                      font-medium 
                      ${isActive 
                        ? 'text-blue-900' 
                        : isDisabled 
                          ? 'text-gray-400' 
                          : 'text-gray-900'
                      }
                      ${item.isAdmin ? 'text-yellow-900' : ''}
                    `}>
                      {item.label}
                      {item.isAdmin && (
                        <Crown className="inline h-4 w-4 ml-1 text-yellow-600" />
                      )}
                    </div>
                    <div className={`
                      text-xs 
                      ${isActive 
                        ? 'text-blue-700' 
                        : isDisabled 
                          ? 'text-gray-400' 
                          : 'text-gray-500'
                      }
                      ${item.isAdmin ? 'text-yellow-700' : ''}
                    `}>
                      {item.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.hasData && (
                    <Badge 
                      variant={isActive ? "default" : "secondary"} 
                      className={`text-xs ${item.isAdmin ? 'bg-yellow-100 text-yellow-800' : ''}`}
                    >
                      {item.dataCount}
                    </Badge>
                  )}
                  {item.isGenerating && (
                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                      Generating
                    </Badge>
                  )}
                  {isActive && (
                    <ChevronRight className={`h-4 w-4 ${item.isAdmin ? 'text-yellow-600' : 'text-blue-600'}`} />
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
            </Card>
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