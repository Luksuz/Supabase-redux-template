'use client'

import { Card, CardContent } from '../ui/card'
import { CheckCircle, AlertCircle, VideoIcon } from 'lucide-react'

interface VideoStatusMessageProps {
  message: string
  messageType: 'success' | 'error' | 'info'
}

export function VideoStatusMessage({ message, messageType }: VideoStatusMessageProps) {
  if (!message) {
    return null
  }

  return (
    <Card className={`border ${
      messageType === 'success' ? 'border-green-200 bg-green-50' :
      messageType === 'error' ? 'border-red-200 bg-red-50' :
      'border-blue-200 bg-blue-50'
    }`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2">
          {messageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
          {messageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
          {messageType === 'info' && <VideoIcon className="h-4 w-4 text-blue-600" />}
          <span className={`text-sm ${
            messageType === 'success' ? 'text-green-800' :
            messageType === 'error' ? 'text-red-800' :
            'text-blue-800'
          }`}>
            {message}
          </span>
        </div>
      </CardContent>
    </Card>
  )
} 