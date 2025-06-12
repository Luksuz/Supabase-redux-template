'use client'

import { useState } from 'react'
import { SidebarNavigation } from './sidebar-navigation'
import { ScriptGenerator } from './script-generator'
import YouTubeSearch from '../app/components/youtube-search'

type NavigationView = 'youtube-search' | 'script-generator'

export function MainLayout() {
  const [activeView, setActiveView] = useState<NavigationView>('youtube-search')

  const renderContent = () => {
    switch (activeView) {
      case 'youtube-search':
        return <YouTubeSearch />
      case 'script-generator':
        return <ScriptGenerator />
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