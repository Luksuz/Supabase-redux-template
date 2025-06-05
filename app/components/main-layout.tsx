'use client'

import React, { useState } from 'react'
import SidebarNavigation from './sidebar-navigation'
import ScriptGenerator from './script-generator'
import ScriptReview from './script-review'

export default function MainLayout() {
  const [currentView, setCurrentView] = useState('script-generator')

  const renderCurrentView = () => {
    switch (currentView) {
      case 'script-generator':
        return <ScriptGenerator />
      case 'script-review':
        return <ScriptReview />
      default:
        return <ScriptGenerator />
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