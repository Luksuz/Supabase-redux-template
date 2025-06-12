'use client'

import React, { useState } from 'react'
import SidebarNavigation from './sidebar-navigation'
import ScriptGenerator from './script-generator'
import ScriptReview from './script-review'
import YouTubeSearch from './youtube-search'

export default function MainLayout() {
  const [currentView, setCurrentView] = useState('youtube-search')

  const renderCurrentView = () => {
    switch (currentView) {
      case 'youtube-search':
        return <YouTubeSearch />
      case 'script-generator':
        return <ScriptGenerator />
      case 'script-review':
        return <ScriptReview />
      default:
        return <YouTubeSearch />
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarNavigation 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />
      {renderCurrentView()}
    </div>
  )
} 