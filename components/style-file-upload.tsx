'use client'

import { useState, useRef } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  startAnalyzingUploadedStyle,
  setUploadedStyle,
  clearUploadedStyle
} from '../lib/features/scripts/scriptsSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export function StyleFileUpload() {
  const dispatch = useAppDispatch()
  const { sectionedWorkflow } = useAppSelector(state => state.scripts)
  const [isDragOver, setIsDragOver] = useState(false)
  const [localMessage, setLocalMessage] = useState("")
  const [localMessageType, setLocalMessageType] = useState<'success' | 'error' | 'info'>('info')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setLocalMessage(msg)
    setLocalMessageType(type)
    // Clear message after 5 seconds
    setTimeout(() => setLocalMessage(""), 5000)
  }

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const fileName = file.name.toLowerCase()
    const isValidType = fileName.endsWith('.txt') || fileName.endsWith('.docx')
    
    if (!isValidType) {
      showMessage('Please upload a .txt or .docx file', 'error')
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showMessage('File size must be less than 10MB', 'error')
      return
    }

    dispatch(startAnalyzingUploadedStyle())
    showMessage(`Analyzing writing style from: ${file.name}...`, 'info')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('selectedModel', sectionedWorkflow.selectedModel)

      const response = await fetch('/api/analyze-script-style', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze script style')
      }

      const data = await response.json()
      
      dispatch(setUploadedStyle({
        style: data.analyzedStyle,
        fileName: data.fileName
      }))
      
      showMessage(
        `Style analysis completed! Extracted style guide from ${data.fileName}`, 
        'success'
      )
    } catch (error) {
      const errorMessage = (error as Error).message
      showMessage(`Analysis failed: ${errorMessage}`, 'error')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleClearStyle = () => {
    dispatch(clearUploadedStyle())
    showMessage('Uploaded style cleared', 'info')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Script Style Analyzer
        </CardTitle>
        <CardDescription>
          Upload a script file (.txt or .docx) to extract and analyze its writing style
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        {!sectionedWorkflow.uploadedStyle && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-400 bg-blue-50'
                  : sectionedWorkflow.isAnalyzingStyle
                  ? 'border-gray-300 bg-gray-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {sectionedWorkflow.isAnalyzingStyle ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-blue-800">Analyzing writing style...</p>
                  <p className="text-xs text-blue-600">Extracting style patterns and characteristics</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">
                    Drop your script file here or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports .txt and .docx files up to 10MB
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={sectionedWorkflow.isAnalyzingStyle}
                variant="outline"
              >
                <FileText className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        )}

        {/* Uploaded Style Display */}
        {sectionedWorkflow.uploadedStyle && sectionedWorkflow.uploadedStyleFileName && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Style Extracted</span>
              </div>
              <Button
                onClick={handleClearStyle}
                size="sm"
                variant="outline"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">{sectionedWorkflow.uploadedStyleFileName}</span>
                <Badge variant="outline" className="text-xs">
                  Style Guide Active
                </Badge>
              </div>
              <div className="max-h-40 overflow-y-auto">
                <p className="text-sm text-green-700 whitespace-pre-wrap">
                  {sectionedWorkflow.uploadedStyle.substring(0, 300)}
                  {sectionedWorkflow.uploadedStyle.length > 300 && '...'}
                </p>
              </div>
              <div className="mt-2 text-xs text-green-600">
                This style guide will be used instead of the default feeder script style for generating sections and scripts.
              </div>
            </div>
          </div>
        )}

        {/* Local Message */}
        {localMessage && (
          <div className={`p-3 rounded-lg border ${
            localMessageType === 'success' ? 'border-green-200 bg-green-50' :
            localMessageType === 'error' ? 'border-red-200 bg-red-50' :
            'border-blue-200 bg-blue-50'
          }`}>
            <div className="flex items-center gap-2">
              {localMessageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {localMessageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
              {localMessageType === 'info' && <Upload className="h-4 w-4 text-blue-600" />}
              <span className={`text-sm ${
                localMessageType === 'success' ? 'text-green-800' :
                localMessageType === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {localMessage}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 