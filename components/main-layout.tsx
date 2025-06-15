'use client'

import { useState } from 'react'
import { SidebarNavigation } from './sidebar-navigation'
import { ScriptGenerator } from './script-generator'
import { FineTuningExport } from './fine-tuning-export'
import { FineTuningSessions } from '../app/components/fine-tuning-sessions'
import { AudioGeneration } from '../app/components/audio-generation'
import { JobsSidebar } from './jobs-sidebar'
import PromptManager from './prompt-manager'
import YouTubeSearch from '../app/components/youtube-search'
import { TerminologyInfoButton } from './terminology-info'

type NavigationView = 'youtube-search' | 'script-generator' | 'prompt-manager' | 'fine-tuning-export' | 'fine-tuning-sessions' | 'audio-generation' | 'jobs-manager'

export function MainLayout() {
  const [activeView, setActiveView] = useState<NavigationView>('youtube-search')

  const renderContent = () => {
    switch (activeView) {
      case 'youtube-search':
        return <YouTubeSearch />
      case 'script-generator':
        return <ScriptGenerator />
      case 'audio-generation':
        return <AudioGeneration />
      case 'prompt-manager':
        return (
          <div className="p-6">
            <PromptManager />
          </div>
        )
      case 'fine-tuning-export':
        return <FineTuningExport />
      case 'fine-tuning-sessions':
        return <FineTuningSessions />
      case 'jobs-manager':
        return <JobsSidebar />
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
        {/* Global Header with Help Button */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-end sticky top-0 z-40">
          <TerminologyInfoButton />
        </div>
        
        {/* Page Content */}
        <div className="h-full">
          {renderContent()}
        </div>
      </div>
    </div>
  )
} 