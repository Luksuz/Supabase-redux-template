'use client'

import { useState } from 'react'
import { SidebarNavigation } from './sidebar-navigation'
import { ScriptProcessor } from './script-processor'
import { BatchImageGenerator } from './batch-image-generator'
import { AudioGenerator } from './audio-generator'
import { VideoGenerator } from './video-generator'
import { VideoStatus } from './video-status'
import { AdminDashboard } from './admin-dashboard'

type NavigationView = 'script-processor' | 'batch-image-generator' | 'audio-generator' | 'video-generator' | 'video-status' | 'admin-dashboard'

export function MainLayout() {
  const [activeView, setActiveView] = useState<NavigationView>('script-processor')

  const renderContent = () => {
    switch (activeView) {
      case 'script-processor':
        return <ScriptProcessor />
      case 'batch-image-generator':
        return <BatchImageGenerator />
      case 'audio-generator':
        return <AudioGenerator />
      case 'video-generator':
        return <VideoGenerator />
      case 'video-status':
        return <VideoStatus />
      case 'admin-dashboard':
        return <AdminDashboard />
      default:
        return <ScriptProcessor />
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