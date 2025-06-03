'use client'

import { useState } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { ImageIcon, FileText, Key, Volume2, Palette, BarChart3, ChevronRight, Crown } from 'lucide-react'

type NavigationView = 'script-generator' | 'image-generation' | 'audio-generator' | 'admin-dashboard'

interface SidebarNavigationProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
}

export function SidebarNavigation({ activeView, onViewChange }: SidebarNavigationProps) {
  const { hasGeneratedScripts, scripts } = useAppSelector(state => state.scripts)
  const { generatedAudioUrl } = useAppSelector(state => state.simpleAudio)
  const user = useAppSelector(state => state.user)

  const navigationItems = [
    {
      id: 'script-generator' as NavigationView,
      label: 'Script Generator',
      icon: FileText,
      description: 'Generate narration scripts',
      hasData: hasGeneratedScripts,
      dataCount: scripts.filter(s => s.generated).length,
      disabled: false
    },
    {
      id: 'image-generation' as NavigationView,
      label: 'AI Image Generator',
      icon: Palette,
      description: 'Generate images with AI',
      hasData: false, // TODO: Add proper state tracking
      dataCount: 0,
      disabled: false
    },
    {
      id: 'audio-generator' as NavigationView,
      label: 'Audio Generator',
      icon: Volume2,
      description: 'MiniMax & ElevenLabs TTS',
      hasData: !!generatedAudioUrl,
      dataCount: generatedAudioUrl ? 1 : 0,
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
        <p className="text-sm text-gray-500">Scripts • Images • Audio • AI</p>
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
                  {isActive && (
                    <ChevronRight className={`h-4 w-4 ${item.isAdmin ? 'text-yellow-600' : 'text-blue-600'}`} />
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </nav>
    </div>
  )
} 