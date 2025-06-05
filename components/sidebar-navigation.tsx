'use client'

import { useState } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { FileText, ChevronRight } from 'lucide-react'

type NavigationView = 'script-generator'

interface SidebarNavigationProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
}

export function SidebarNavigation({ activeView, onViewChange }: SidebarNavigationProps) {
  const { currentJob } = useAppSelector(state => state.scripts)

  const navigationItems = [
    {
      id: 'script-generator' as NavigationView,
      label: 'Script Generator',
      icon: FileText,
      description: 'Generate structured scripts',
      hasData: !!currentJob,
      dataCount: currentJob?.sections.filter(s => s.texts.length > 0).length || 0,
      disabled: false
    }
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Script Generator</h2>
        <p className="text-sm text-gray-500">AI-powered script generation</p>
      </div>
      
      <nav className="p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id
          const isDisabled = item.disabled
          
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onViewChange(item.id)}
              disabled={isDisabled}
              className={`
                w-full text-left p-3 rounded-lg transition-all duration-200
                ${isActive 
                  ? 'bg-blue-50 border border-blue-200 text-blue-900' 
                  : isDisabled
                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${
                    isActive ? 'text-blue-600' : 
                    isDisabled ? 'text-gray-400' : 
                    'text-gray-500'
                  }`} />
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.hasData && (
                    <Badge variant="secondary" className="text-xs">
                      {item.dataCount}
                    </Badge>
                  )}
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-blue-600" />
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </nav>
      
      {/* Status Summary */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <Card className="p-3 bg-gray-50">
          <div className="text-sm space-y-2">
            <div className="font-medium text-gray-700">Status Summary</div>
            <div className="text-gray-500 space-y-1">
              {currentJob ? (
                <>
                  <div className="flex justify-between">
                    <span>Current project:</span>
                    <span className="font-medium text-blue-600 truncate ml-2" title={currentJob.theme}>
                      {currentJob.theme}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sections:</span>
                    <span className="font-medium">{currentJob.sections.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Scripts generated:</span>
                    <span className="font-medium text-green-600">
                      {currentJob.sections.filter(s => s.texts.length > 0).length}
                    </span>
                  </div>
                  {currentJob.sections.some(s => s.isGeneratingScript) && (
                    <div className="flex justify-between">
                      <span>Generating:</span>
                      <span className="font-medium text-orange-600">
                        {currentJob.sections.filter(s => s.isGeneratingScript).length}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-2">
                  <span>No active job</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
} 