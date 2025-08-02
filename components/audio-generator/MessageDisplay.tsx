'use client'

import { CheckCircle, AlertCircle, Volume2 } from "lucide-react"

interface MessageDisplayProps {
  message: string
  messageType: 'success' | 'error' | 'info'
}

export function MessageDisplay({
  message,
  messageType
}: MessageDisplayProps) {
  if (!message) return null

  return (
    <div className={`p-3 rounded-lg border ${
      messageType === 'success' ? 'border-green-200 bg-green-50' :
      messageType === 'error' ? 'border-red-200 bg-red-50' :
      'border-blue-200 bg-blue-50'
    }`}>
      <div className="flex items-center gap-2">
        {messageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
        {messageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
        {messageType === 'info' && <Volume2 className="h-4 w-4 text-blue-600" />}
        <span className={`text-sm ${
          messageType === 'success' ? 'text-green-800' :
          messageType === 'error' ? 'text-red-800' :
          'text-blue-800'
        }`}>
          {message}
        </span>
      </div>
    </div>
  )
} 