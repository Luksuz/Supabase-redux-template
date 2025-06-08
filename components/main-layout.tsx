'use client'

import { useState } from 'react'
import { SidebarNavigation } from './sidebar-navigation'
import { VideoGenerator } from './video-generator'
import { VideoStatus } from './video-status'

type NavigationView = 'video-generator' | 'video-status' | 'settings'

export function MainLayout() {
  const [activeView, setActiveView] = useState<NavigationView>('video-generator')

  const renderContent = () => {
    switch (activeView) {
      case 'video-generator':
        return <VideoGenerator onNavigate={setActiveView} />
      case 'video-status':
        return <VideoStatus />
      case 'settings':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Settings</h1>
            <p className="text-gray-600">Settings panel coming soon...</p>
          </div>
        )
      default:
        return <VideoGenerator onNavigate={setActiveView} />
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
      <div className="flex-1 overflow-auto p-6">
        {renderContent()}
      </div>
    </div>
  )
} 