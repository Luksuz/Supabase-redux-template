'use client'

import { useState } from 'react'
import { useAppSelector } from '../lib/hooks'
import { SidebarNavigation } from './sidebar-navigation'
import { ImageGenerator } from './image-generator'
import ScriptGenerator from './script-generator'
import { AudioGenerator } from './audio-generator'
import { VideoGenerator } from './video-generator'
import { VideoStatus } from './video-status'
import { AdminDashboard } from './admin-dashboard'

type NavigationView = 'script-generator' | 'image-generator' | 'audio-generator' | 'video-generator' | 'video-status' | 'admin-dashboard'

export function MainLayout() {
  // Start with script generator as the default view
  const [activeView, setActiveView] = useState<NavigationView>('script-generator')

  const renderContent = () => {
    switch (activeView) {
      case 'script-generator':
        return <ScriptGenerator />
      case 'image-generator':
        return <ImageGenerator />
      case 'audio-generator':
        return <AudioGenerator />
      case 'video-generator':
        return <VideoGenerator />
      case 'video-status':
        return <VideoStatus />
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