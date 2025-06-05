'use client'

import React from 'react'
import { useAppSelector } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { FileText, Star, BarChart3 } from 'lucide-react'

interface SidebarNavigationProps {
  currentView: string
  onViewChange: (view: string) => void
}

export default function SidebarNavigation({ currentView, onViewChange }: SidebarNavigationProps) {
  const { jobs } = useAppSelector((state) => state.scripts)

  // Calculate stats for badges
  const totalTexts = jobs.reduce((total, job) => 
    total + job.sections.reduce((sectionTotal, section) => 
      sectionTotal + (section.texts?.length || 0), 0), 0)
  
  const unvalidatedTexts = jobs.reduce((total, job) => 
    total + job.sections.reduce((sectionTotal, section) => 
      sectionTotal + (section.texts?.filter(text => !text.is_validated).length || 0), 0), 0)

  const menuItems = [
    {
      id: 'script-generator',
      label: 'Script Generator',
      icon: FileText,
      description: 'Create fine-tuning jobs and generate training data',
      badge: jobs.length > 0 ? jobs.length.toString() : null
    },
    {
      id: 'script-review',
      label: 'Script Review',
      icon: Star,
      description: 'Review and rate generated scripts',
      badge: unvalidatedTexts > 0 ? unvalidatedTexts.toString() : null,
      badgeVariant: 'urgent' as const
    }
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Fine-Tuning Studio</h2>
        <p className="text-sm text-gray-600 mt-1">Create and curate training data</p>
      </div>
      
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start h-auto p-3 ${
                  isActive 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => onViewChange(item.id)}
              >
                <div className="flex items-center w-full">
                  <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <span className={`px-2 py-1 text-xs rounded-full ml-2 ${
                          item.badgeVariant === 'urgent'
                            ? 'bg-red-100 text-red-800'
                            : isActive
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${
                      isActive ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </Button>
            )
          })}
        </div>

        {/* Stats Section */}
        {totalTexts > 0 && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Training Data Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Scripts:</span>
                <span className="font-medium">{totalTexts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Validated:</span>
                <span className="font-medium text-green-600">{totalTexts - unvalidatedTexts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pending Review:</span>
                <span className="font-medium text-red-600">{unvalidatedTexts}</span>
              </div>
            </div>
          </div>
        )}
      </nav>
    </div>
  )
} 