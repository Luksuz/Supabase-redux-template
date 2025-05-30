'use client'

import { useState, useRef } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { createClient } from '../lib/supabase/client'
import { setOriginalImages, setCurrentImages, setSelectedColor, clearImages, updateMultipleSupabasePaths } from '../lib/features/images/imagesSlice'
import { startImageSaving, updateImageSavingProgress, finishImageSaving, clearImageSavingProgress } from '../lib/features/progress/progressSlice'
import type { ProcessedImage } from '../lib/features/images/imagesSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import * as Separator from '@radix-ui/react-separator'
import { Upload, Image as ImageIcon, Palette, Save, CheckCircle, AlertCircle } from 'lucide-react'

export function ImageProcessor() {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const { originalImages, currentImages, selectedColor, savedImagesCount } = useAppSelector(state => state.images)
  const { imageSaving: savingProgress } = useAppSelector(state => state.progress)
  
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

    if (currentImages.length === 0) {
      showMessage('No images to save', 'error')
      return
    }

    console.log(`🔄 Starting Supabase upload for ${currentImages.length} images`)
    console.log('📋 User state:', { isLoggedIn: user.isLoggedIn, id: user.id, email: user.email })

    setIsSaving(true)
    
    // Initialize progress
    dispatch(startImageSaving({
      total: currentImages.length
    }))
    
    showMessage('Initializing upload to Supabase...', 'info')

    try {
      const supabase = createClient()
      console.log('🔌 Supabase client created')
      
      // Test Supabase connection first
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
      if (bucketError) {
        console.error('❌ Failed to list buckets:', bucketError)
        throw new Error(`Cannot connect to Supabase storage: ${bucketError.message}`)
      }
      
      console.log('📂 Available buckets:', buckets?.map(b => b.name))
      
      // Check if images bucket exists
      const imagesBucket = buckets?.find(b => b.name === 'images')
      if (!imagesBucket) {
        console.error('❌ Images bucket not found')
        throw new Error('Images storage bucket not found. Please contact an administrator.')
      }
      
      console.log('✅ Images bucket found:', imagesBucket)
      
      const results: Array<{ imageId: string; supabasePath: string }> = []

      // Process images sequentially to show clear progress
      for (let i = 0; i < currentImages.length; i++) {
        const image = currentImages[i]
        console.log(`📤 Processing image ${i + 1}/${currentImages.length}: ${image.originalName}`)
        
        try {
          // Update progress - starting current image
          dispatch(updateImageSavingProgress({
            currentImage: `Uploading ${image.originalName}...`
          }))

          console.log(`🖼️ Converting data URL to blob for: ${image.originalName}`)
          
          // Convert data URL to blob
          const response = await fetch(image.dataUrl)
          if (!response.ok) {
            throw new Error(`Failed to convert image data URL: ${response.status}`)
          }
          
          const blob = await response.blob()
          console.log(`📊 Blob created - size: ${blob.size} bytes, type: ${blob.type}`)
          
          // Generate UUID for unique filename
          const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = Math.random() * 16 | 0
              const v = c == 'x' ? r : (r & 0x3 | 0x8)
              return v.toString(16)
            })
          }
          
          // Create unique filename with UUID
          const uuid = generateUUID()
          const fileExtension = 'jpg' // All processed images are JPEGs
          const fileName = `${uuid}.${fileExtension}`
          const filePath = `${user.id}/processed-images/${fileName}`

          console.log(`🎯 Uploading to path: ${filePath}`)

          const { data, error } = await supabase.storage
            .from('images')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: false
            })

          if (error) {
            console.error(`❌ Upload error for ${image.originalName}:`, error)
            throw error
          }

          console.log(`✅ Upload successful for ${image.originalName}:`, data)

          results.push({ 
            imageId: image.id, 
            supabasePath: data?.path || filePath
          })

          // Update progress - completed current image
          dispatch(updateImageSavingProgress({
            completed: i + 1,
            completedImages: [...savingProgress.completedImages, image.originalName],
            currentImage: `Uploaded ${image.originalName}`
          }))

          console.log(`📈 Progress updated: ${i + 1}/${currentImages.length}`)

        } catch (error) {
          console.error(`❌ Error uploading ${image.originalName}:`, error)
          
          // Update progress even for failed uploads
          dispatch(updateImageSavingProgress({
            completed: i + 1,
            completedImages: [...savingProgress.completedImages, `${image.originalName} (failed)`],
            currentImage: `Failed to upload ${image.originalName}: ${(error as Error).message}`
          }))
          
          // Continue with other images instead of stopping completely
          showMessage(`Warning: Failed to upload ${image.originalName}: ${(error as Error).message}`, 'error')
        }
      }
      
      console.log(`🎉 Upload process completed. Successful uploads: ${results.length}/${currentImages.length}`)
      
      // Update Redux with successful uploads only
      if (results.length > 0) {
        dispatch(updateMultipleSupabasePaths(results))
        console.log('📋 Redux state updated with Supabase paths')
      }
      
      if (results.length === currentImages.length) {
        showMessage(`Successfully saved all ${results.length} images to Supabase Storage`, 'success')
      } else if (results.length > 0) {
        showMessage(`Saved ${results.length}/${currentImages.length} images to Supabase Storage`, 'success')
      } else {
        showMessage(`Failed to save any images to Supabase Storage`, 'error')
      }
      
    } catch (error) {
      console.error('💥 Critical error in Supabase upload:', error)
      showMessage('Error saving to Supabase: ' + (error as Error).message, 'error')
    } finally {
      console.log('🏁 Upload process finished, cleaning up...')
      setIsSaving(false)
      dispatch(finishImageSaving())
      // Clear progress after completion
      setTimeout(() => {
        dispatch(clearImageSavingProgress())
      }, 3000)
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

        {/* Saving Progress Card - Only show when saving */}
        {savingProgress.isActive && savingProgress.total > 0 && (
          <Card className="bg-purple-50 border border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5 animate-pulse text-purple-600" />
                Saving to Supabase ({savingProgress.completed}/{savingProgress.total})
              </CardTitle>
              <CardDescription>
                Uploading images to Supabase Storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Upload Progress</span>
                  <span className="font-medium text-purple-600">
                    {Math.round((savingProgress.completed / savingProgress.total) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(savingProgress.completed / savingProgress.total) * 100} 
                  className="h-2" 
                />
                <div className="text-xs text-gray-500">
                  {savingProgress.completed} of {savingProgress.total} images uploaded
                </div>
              </div>

              {/* Current Status */}
              {savingProgress.currentImage && (
                <div className="flex items-center gap-2 text-sm">
                  <Save className="h-4 w-4 text-purple-500" />
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium">{savingProgress.currentImage}</span>
                </div>
              )}

              {/* Completed Images List */}
              {savingProgress.completedImages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Recently Uploaded:</div>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {savingProgress.completedImages.slice(-5).map((imageName, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{imageName}</span>
                      </div>
                    ))}
                    {savingProgress.completedImages.length > 5 && (
                      <div className="text-xs text-gray-400">
                        ...and {savingProgress.completedImages.length - 5} more
                      </div>
                    )}
                  </div>
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
                All images have been resized to 1280x720 resolution and sorted by chapter/image order
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          1280x720
                        </Badge>
                        {image.chapter && image.imageNumber && (
                          <Badge variant="outline" className="text-xs">
                            Ch.{image.chapter} Img.{image.imageNumber}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          #{image.sortOrder || index + 1}
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