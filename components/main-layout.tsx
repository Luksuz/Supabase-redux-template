'use client'

import { useState } from 'react'
import { SidebarNavigation } from './sidebar-navigation'
import { ScriptGenerator } from './script-generator'
import { FineTuningExport } from './fine-tuning-export'
import PromptManager from './prompt-manager'
import YouTubeSearch from '../app/components/youtube-search'

type NavigationView = 'youtube-search' | 'script-generator' | 'prompt-manager' | 'fine-tuning-export'

export function MainLayout() {
  const [activeView, setActiveView] = useState<NavigationView>('youtube-search')

  const renderContent = () => {
    switch (activeView) {
      case 'youtube-search':
        return <YouTubeSearch />
      case 'script-generator':
        return <ScriptGenerator />
      case 'prompt-manager':
        return (
          <div className="p-6">
            <PromptManager />
          </div>
        )
      case 'fine-tuning-export':
        return <FineTuningExport />
      default:
        return <YouTubeSearch />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <SidebarNavigation 
        activeView={activeView} 
        onViewChange={setActiveView} 
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  )
} 