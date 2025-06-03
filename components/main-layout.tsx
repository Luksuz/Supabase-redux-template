'use client'

import { useState } from 'react'
import { SidebarNavigation } from './sidebar-navigation'
import { AIImageGenerator } from './ai-image-generator'
import { SimpleAudioGenerator } from './simple-audio-generator'
import { ScriptGenerator } from './script-generator'
import { AdminDashboard } from './admin-dashboard'

type NavigationView = 'script-generator' | 'image-generation' | 'audio-generator' | 'admin-dashboard'

export function MainLayout() {
  const [activeView, setActiveView] = useState<NavigationView>('script-generator')

  const renderContent = () => {
    switch (activeView) {
      case 'script-generator':
        return <ScriptGenerator />
      case 'image-generation':
        return <AIImageGenerator />
      case 'audio-generator':
        return <SimpleAudioGenerator />
      case 'admin-dashboard':
        return <AdminDashboard />
      default:
        return <ScriptGenerator />
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