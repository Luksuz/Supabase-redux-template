'use client'

import { useState } from 'react'
import { SidebarNavigation } from './sidebar-navigation'
import { ImageProcessor } from './image-processor'
import { ScriptGenerator } from './script-generator'
import { AudioGenerator } from './audio-generator'
import { VideoGenerator } from './video-generator'
import { VideoStatus } from './video-status'
import { ApiKeyManager } from './api-key-manager'

type NavigationView = 'process-images' | 'script-generator' | 'audio-generator' | 'video-generator' | 'video-status' | 'api-keys'

export function MainLayout() {
  const [activeView, setActiveView] = useState<NavigationView>('process-images')

  const renderContent = () => {
    switch (activeView) {
      case 'process-images':
        return <ImageProcessor />
      case 'script-generator':
        return <ScriptGenerator />
      case 'audio-generator':
        return <AudioGenerator />
      case 'video-generator':
        return <VideoGenerator />
      case 'video-status':
        return <VideoStatus />
      case 'api-keys':
        return <ApiKeyManager />
      default:
        return <ImageProcessor />
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