'use client'

import { useState, useRef } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { createClient } from '../lib/supabase/client'
import { setOriginalImages, setCurrentImages, setSelectedColor, clearImages, updateMultipleSupabasePaths } from '../lib/features/images/imagesSlice'
import type { ProcessedImage } from '../lib/features/images/imagesSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import * as Progress from '@radix-ui/react-progress'
import * as Separator from '@radix-ui/react-separator'
import { Upload, Image as ImageIcon, Palette, Save, CheckCircle, AlertCircle } from 'lucide-react'

export function ImageProcessor() {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const { originalImages, currentImages, selectedColor, savedImagesCount } = useAppSelector(state => state.images)
  
  // UI-specific states (not stored in Redux)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isApplyingColor, setIsApplyingColor] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
  }

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/zip') {
      setSelectedFile(file)
      dispatch(clearImages()) // Clear Redux state
      setMessage('')
    } else {
      showMessage('Please select a valid ZIP file', 'error')
    }
  }

  // Handle drag and drop events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    const zipFile = files.find(file => file.type === 'application/zip')

    if (zipFile) {
      setSelectedFile(zipFile)
      dispatch(clearImages())
      setMessage('')
      showMessage(`Selected ${zipFile.name} for processing`, 'info')
    } else {
      showMessage('Please drop a valid ZIP file', 'error')
    }
  }

  // Process zip file and extract images
  const handleProcessZip = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    showMessage('Processing zip file...', 'info')

    try {
      const formData = new FormData()
      formData.append('zipFile', selectedFile)

      const response = await fetch('/api/process-images', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to process images')
      }

      const data = await response.json()
      // Store in Redux
      dispatch(setOriginalImages(data.images))
      showMessage(`Successfully processed ${data.images.length} images`, 'success')
    } catch (error) {
      showMessage('Error processing zip file: ' + (error as Error).message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle color selection
  const handleColorChange = (color: string) => {
    dispatch(setSelectedColor(color))
  }

  // Apply color background to non-16:9 images
  const handleApplyColor = async () => {
    if (originalImages.length === 0) return

    setIsApplyingColor(true)
    showMessage('Applying background color...', 'info')

    try {
      const response = await fetch('/api/apply-background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: originalImages.map(img => ({ // Always use original images from Redux
            id: img.id,
            name: img.name,
            dataUrl: img.dataUrl,
          })),
          backgroundColor: selectedColor,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to apply background')
      }

      const data = await response.json()
      dispatch(setCurrentImages(data.images)) // Update current images in Redux
      showMessage('Background applied successfully', 'success')
    } catch (error) {
      showMessage('Error applying background: ' + (error as Error).message, 'error')
    } finally {
      setIsApplyingColor(false)
    }
  }

  // Save images to Supabase storage
  const handleSaveToSupabase = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to save images', 'error')
      return
    }

    if (currentImages.length === 0) return

    setIsSaving(true)
    showMessage('Saving images to Supabase...', 'info')

    try {
      const supabase = createClient()

      const uploadPromises = currentImages.map(async (image) => {
        // Convert data URL to blob
        const response = await fetch(image.dataUrl)
        const blob = await response.blob()
        
        // Create unique filename
        const fileName = `processed_${Date.now()}_${image.name}`
        const filePath = `${user.id}/processed-images/${fileName}`

        const { data, error } = await supabase.storage
          .from('images')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: false
          })

        if (error) {
          throw error
        }

        return { 
          imageId: image.id, 
          supabasePath: data?.path || filePath,
          fileName, 
          filePath 
        }
      })

      const results = await Promise.all(uploadPromises)
      
      // Update Redux with Supabase paths
      dispatch(updateMultipleSupabasePaths(
        results.map(result => ({
          imageId: result.imageId,
          supabasePath: result.supabasePath
        }))
      ))
      
      showMessage(`Successfully saved ${results.length} images to Supabase Storage`, 'success')
    } catch (error) {
      showMessage('Error saving to Supabase: ' + (error as Error).message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Image Processor</h1>
          <p className="text-gray-600">
            Upload a ZIP file to process images to 1280x720 (16:9) format
          </p>
        </div>

        {/* File Upload Card */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload ZIP File
            </CardTitle>
            <CardDescription>
              Select a ZIP file containing images for processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200
                ${isDragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
                }
              `}
            >
              <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
              <div className="space-y-1">
                <p className={`text-sm font-medium ${isDragActive ? 'text-blue-600' : 'text-gray-600'}`}>
                  {isDragActive ? 'Drop your ZIP file here' : 'Drag and drop your ZIP file here'}
                </p>
                <p className="text-xs text-gray-500">
                  or click to browse files
                </p>
              </div>
              
              {/* Hidden file input */}
              <Input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Traditional file input as fallback */}
            <div className="space-y-2">
              <Label htmlFor="zip-file-fallback" className="text-sm">Or select file manually:</Label>
              <Input
                id="zip-file-fallback"
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedFile.name}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button 
                  onClick={handleProcessZip}
                  disabled={isProcessing}
                  size="sm"
                >
                  {isProcessing ? 'Processing...' : 'Process'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Background Settings Card */}
        {currentImages.length > 0 && (
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Background Settings
              </CardTitle>
              <CardDescription>
                Choose a tint color for the background template (white = original background)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="color-picker">Background Tint</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="color-picker"
                        type="color"
                        value={selectedColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Badge variant="outline" className="font-mono">
                        {selectedColor.toUpperCase()}
                      </Badge>
                      {selectedColor === '#ffffff' && (
                        <Badge variant="secondary" className="text-xs">
                          Original
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {selectedColor === '#ffffff' 
                        ? 'Using original background template' 
                        : 'Applying color tint to background template'
                      }
                    </p>
                  </div>
                  <Button 
                    onClick={handleApplyColor}
                    disabled={isApplyingColor}
                    variant="outline"
                    className="mt-6"
                  >
                    {isApplyingColor ? 'Applying...' : 'Apply Background'}
                  </Button>
                </div>
                
                {/* Background Preview */}
                <div className="space-y-2">
                  <Label>Background Preview</Label>
                  <div className="w-full max-w-sm aspect-video bg-gray-100 rounded-lg overflow-hidden border">
                    <img
                      src={`/api/test-background?color=${encodeURIComponent(selectedColor)}&t=${Date.now()}`}
                      alt="Background preview"
                      className="w-full h-full object-cover"
                      key={selectedColor} // Force re-render when color changes
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Preview of how the background will look with the selected tint
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save to Supabase Card */}
        {currentImages.length > 0 && (
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                Save Images
                {savedImagesCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {savedImagesCount} saved
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Save processed images to Supabase Storage
                {savedImagesCount > 0 && (
                  <span className="block text-green-600 font-medium mt-1">
                    {savedImagesCount} of {currentImages.length} images already saved to Supabase
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user.isLoggedIn ? (
                <div className="space-y-3">
                  <Button 
                    onClick={handleSaveToSupabase}
                    disabled={isSaving}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isSaving ? 'Saving...' : `Save ${currentImages.length} Images`}
                  </Button>
                  
                  {savedImagesCount > 0 && (
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>
                          {savedImagesCount === currentImages.length 
                            ? 'All images have been saved to Supabase Storage'
                            : `${savedImagesCount} images saved, ${currentImages.length - savedImagesCount} remaining`
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Please log in to save images</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Message */}
        {message && (
          <Card className={`border ${
            messageType === 'success' ? 'border-green-200 bg-green-50' :
            messageType === 'error' ? 'border-red-200 bg-red-50' :
            'border-blue-200 bg-blue-50'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                {messageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {messageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                {messageType === 'info' && <ImageIcon className="h-4 w-4 text-blue-600" />}
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
        )}

        {/* Image Grid */}
        {currentImages.length > 0 && (
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Processed Images ({currentImages.length})
              </CardTitle>
              <CardDescription>
                All images have been resized to 1280x720 resolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentImages.map((image, index) => (
                  <div key={image.id} className="group">
                    <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-2">
                      <img
                        src={image.dataUrl}
                        alt={image.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900 truncate" title={image.originalName}>
                        {image.originalName}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          1280x720
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 