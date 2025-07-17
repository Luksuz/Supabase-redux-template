'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const user = useAppSelector(state => state.user)

  // Client-side auth check as fallback to middleware
  useEffect(() => {
    if (user.initialized && !user.isLoggedIn) {
      router.push('/auth/login')
    }
  }, [user.initialized, user.isLoggedIn, router])

  // Show loading state while auth is being checked
  if (!user.initialized) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If user is not logged in and auth is initialized, show nothing (redirect will happen)
  if (!user.isLoggedIn) {
    return null
  }

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