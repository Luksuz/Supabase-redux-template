'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { 
  setProvider,
  setAspectRatio,
  setSearchProvider,
  setSearchType,
  setMode,
  setImagesToGenerate,
  initializeMediaCards,
  startStockSearch,
  setStockSearchResults,
  setStockSearchError,
  stopStockSearch,
  searchAllCards,
  startGeneration,
  updateBatch,
  updateProgress,
  updateCardStatus,
  updateCardResult,
  completeGeneration,
  toggleCardSelection,
  selectAllCards,
  deselectAllCards,
  selectStockImage,
  startSaving,
  updateSaveProgress,
  completeSaving,
  setError,
  clearError,
  clearAllCards,
  regenerateImage,
  addCustomImageCard,
  type StockImage
} from '@/lib/features/batchImageGenerator/batchImageGeneratorSlice'
import { 
  setOriginalImages,
  updateMultipleSupabasePaths,
  type ProcessedImage 
} from '@/lib/features/images/imagesSlice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { 
  Images, 
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Search,
  Camera,
  PlayCircle,
  X,
  Save,
  MoreHorizontal,
  RefreshCw,
  Plus,
  Video,
  FileImage,
  RotateCcw,
  Crop,
  FolderDown
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const IMAGE_PROVIDERS = [
  { value: 'dalle-3', label: 'DALL-E 3', description: 'High quality, creative' },
  { value: 'gpt-image-1', label: 'GPT Image 1', description: 'Latest OpenAI model' },
  { value: 'imagen', label: 'Google Imagen', description: 'Google\'s latest image model' },
  { value: 'flux-dev', label: 'Flux Dev', description: 'Open source, detailed' },
  { value: 'leonardo-phoenix', label: 'Leonardo Phoenix', description: 'Artistic, cinematic' },
  { value: 'ideogram-v3', label: 'Ideogram V3', description: 'Turbo mode, fast generation' },
  { value: 'stable-diffusion-v35-medium', label: 'Stable Diffusion V3.5 Medium', description: 'Balanced quality and speed' },
  { value: 'minimax-image-01', label: 'Minimax Image 01', description: 'High quality Chinese model' }
]

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '9:16', label: '9:16 (Portrait)' }
]

// Define search providers with their API key status
const getSearchProviders = () => {
  return [
    { value: 'pexels', label: 'Pexels', disabled: false }, // Pexels has a key
    { 
      value: 'pixabay', 
      label: 'Pixabay', 
      disabled: !process.env.NEXT_PUBLIC_PIXABAY_API_AVAILABLE,
      disabledReason: 'API key not configured'
    },
    { 
      value: 'storyblocks', 
      label: 'Storyblocks', 
      disabled: true,
      disabledReason: 'API keys not configured'
    },
    { value: 'flickr', label: 'Flickr', disabled: false }
  ]
}

export function BatchImageGenerator() {
  const { prompts, hasGeneratedPrompts, chunks } = useAppSelector(state => state.scriptProcessor)
  const { originalImages } = useAppSelector(state => state.images)
  const {
    provider,
    aspectRatio,
    searchProvider,
    searchType,
    mode,
    imagesToGenerate,
    mediaCards,
    isGenerating,
    progress,
    currentBatch,
    totalBatches,
    timeRemaining,
    selectedCount,
    isSaving,
    saveProgress,
    error,
  } = useAppSelector(state => state.batchImageGenerator)
  const dispatch = useAppDispatch()
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [regenerateDialog, setRegenerateDialog] = useState<{promptId: string, currentPrompt: string} | null>(null)
  const [newPrompt, setNewPrompt] = useState("")
  const [customImageDialog, setCustomImageDialog] = useState(false)
  const [customMode, setCustomMode] = useState<'search' | 'ai'>('ai')
  const [customProvider, setCustomProvider] = useState(provider)
  const [customSearchProvider, setCustomSearchProvider] = useState(searchProvider)
  const [customPrompt, setCustomPrompt] = useState("")
  const [customSearchQuery, setCustomSearchQuery] = useState("")
  
  // Search again dialog state
  const [searchAgainDialog, setSearchAgainDialog] = useState<{promptId: string, currentQuery: string} | null>(null)
  const [searchAgainQuery, setSearchAgainQuery] = useState("")
  const [searchAgainProvider, setSearchAgainProvider] = useState(searchProvider)
  const [searchAgainType, setSearchAgainType] = useState(searchType)
  
  // Custom AI generation state
  const [selectedPromptId, setSelectedPromptId] = useState<string>("custom")
  const [customImageCount, setCustomImageCount] = useState(1)
  
  // Resize state
  const [resizingCard, setResizingCard] = useState<string | null>(null)

  // Check if API keys are available for search providers
  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, boolean>>({
    pixabay: false,
    storyblocks: false // Always disabled
  })

  // Check API key availability on component mount
  useEffect(() => {
    const checkApiKeys = async () => {
      try {
        // Check Pixabay API key
        const pixabayResponse = await fetch('/api/search-pixabay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' })
        })
        const pixabayAvailable = pixabayResponse.status !== 500

        // Storyblocks is disabled
        setApiKeyStatus({
          pixabay: pixabayAvailable,
          storyblocks: false // Always disabled
        })
      } catch (error) {
        console.warn('Error checking API key status:', error)
      }
    }

    checkApiKeys()
  }, [])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(""), 5000)
  }

  // Debug: Monitor mediaCards state changes
  useEffect(() => {
    const searchingCards = mediaCards.filter((card: any) => card.isSearching)
    if (searchingCards.length > 0) {
      console.log('🔍 Cards currently searching:', searchingCards.map((card: any) => ({
        promptId: card.promptId,
        isSearching: card.isSearching,
        sourceType: card.sourceType,
        sceneNumber: card.sceneNumber
      })))
    }
  }, [mediaCards])

  // Helper function for retrying image generation with fallback
  const retryImageGeneration = async (
    requestBody: any,
    promptId: string,
    maxAttempts: number = 3,
    onProgress?: (attempt: number) => void
  ): Promise<string> => {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (onProgress) {
          onProgress(attempt)
        }
        
        if (attempt > 1) {
          showMessage(`Retrying image generation (attempt ${attempt}/${maxAttempts})...`, 'info')
        }
        
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `API error: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.imageUrls && data.imageUrls[0]) {
          if (attempt > 1) {
            showMessage(`Image generated successfully on attempt ${attempt}!`, 'success')
          }
          return data.imageUrls[0]
        } else {
          throw new Error('No image URL received')
        }
      } catch (error) {
        lastError = error as Error
        console.warn(`Image generation attempt ${attempt} failed:`, lastError.message)
        
        // Don't retry on certain user errors
        if (lastError.message.includes('invalid prompt') || 
            lastError.message.includes('content policy') ||
            lastError.message.includes('unauthorized')) {
          throw lastError
        }
        
        // If this is the last attempt, throw the error
        if (attempt === maxAttempts) {
          throw lastError
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))
      }
    }
    
    throw lastError || new Error('Max retry attempts reached')
  }

  // Helper function to convert image URL to dataUrl
  const convertUrlToDataUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.warn('Failed to convert URL to dataUrl:', error)
      return url // Fallback to original URL
    }
  }

  // Helper function to download a single image
  const downloadImage = async (imageUrl: string, fileName: string) => {
    try {
      showMessage(`Downloading ${fileName}...`, 'info')
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      showMessage(`${fileName} downloaded successfully!`, 'success')
    } catch (error) {
      console.error('Download failed:', error)
      showMessage(`Failed to download ${fileName}: ${(error as Error).message}`, 'error')
    }
  }

  // Helper function to download all selected images as a zip
  const downloadSelectedImages = async () => {
    const selectedCards = mediaCards.filter((card: any) => card.isSelected && card.selectedImageUrl)
    
    if (selectedCards.length === 0) {
      showMessage('No images selected for download', 'error')
      return
    }

    try {
      // Import JSZip dynamically to avoid bundling it if not used
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      
      showMessage(`Preparing ${selectedCards.length} images for download...`, 'info')
      
      // Sort by selection order to maintain user's intended sequence
      selectedCards.sort((a: any, b: any) => (a.selectionOrder || 0) - (b.selectionOrder || 0))
      
      const downloadPromises = selectedCards.map(async (card: any, index: number) => {
        try {
          const response = await fetch(card.selectedImageUrl)
          const blob = await response.blob()
          
          // Generate filename based on selection order
          const fileExtension = card.selectedImageType === 'video' ? 'mp4' : 'jpg'
          const fileName = `scene-${card.selectionOrder || index + 1}-${card.sceneNumber}.${fileExtension}`
          
          zip.file(fileName, blob)
          return { success: true, fileName }
        } catch (error) {
          console.error(`Failed to download image for scene ${card.sceneNumber}:`, error)
          return { success: false, fileName: `scene-${card.sceneNumber}`, error }
        }
      })
      
      const results = await Promise.all(downloadPromises)
      const successCount = results.filter(r => r.success).length
      
      if (successCount === 0) {
        showMessage('Failed to download any images', 'error')
        return
      }
      
      if (successCount < selectedCards.length) {
        showMessage(`${successCount}/${selectedCards.length} images added to zip. Proceeding with available images.`, 'info')
      }
      
      // Generate and download the zip file
      showMessage('Creating zip file...', 'info')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = window.URL.createObjectURL(zipBlob)
      
      const link = document.createElement('a')
      link.href = zipUrl
      link.download = `generated-images-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(zipUrl)
      
      showMessage(`Successfully downloaded ${successCount} images as a zip file!`, 'success')
      
    } catch (error) {
      console.error('Zip download failed:', error)
      showMessage(`Failed to create zip download: ${(error as Error).message}`, 'error')
    }
  }

  // Search all media cards
  const handleSearchAll = async () => {
    if (!hasGeneratedPrompts || prompts.length === 0) {
      showMessage('No prompts available for search', 'error')
      return
    }
    
    // Randomly select prompts based on imagesToGenerate count
    let selectedPrompts = [...prompts] // Start with all prompts
    if (imagesToGenerate < prompts.length) {
      // Randomly shuffle and take the first N prompts
      selectedPrompts = [...prompts].sort(() => Math.random() - 0.5).slice(0, imagesToGenerate)
    }

    // Create unique search ID for this batch
    const searchId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Create search cards with unique IDs for this search
    const searchCardData = selectedPrompts.map((prompt: any, index: number) => {
      const chunk = chunks.find((c: any) => c.id === prompt.chunkId)
      return {
        promptId: `${searchId}-${prompt.chunkId}-search`, // Unique ID for this search
        prompt: prompt.prompt,
        searchQuery: prompt.searchQuery,
        sceneNumber: chunk ? chunk.chunkIndex + 1 : index + 1,
        sourceType: 'search' as const
      }
    })
    
    // Append new cards to existing ones instead of replacing
    dispatch(initializeMediaCards(searchCardData))
    
    const searchPromises = selectedPrompts.map(async (prompt: any) => {
      if (!prompt.searchQuery) return
      
      const searchPromptId = `${searchId}-${prompt.chunkId}-search`
      dispatch(startStockSearch({ promptId: searchPromptId }))
      
      try {
        const response = await fetch(`/api/search-${searchProvider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: prompt.searchQuery, type: searchType }),
        })
        
        const data = await response.json()
        
        if (response.ok) {
          dispatch(setStockSearchResults({ 
            promptId: searchPromptId, 
            results: data.results || [],
          }))
        } else {
          throw new Error(data.error || `${searchProvider} search failed`)
        }
      } catch (error) {
        dispatch(setStockSearchError({ 
          promptId: searchPromptId, 
          error: (error as Error).message 
        }))
      }
    })
    
    await Promise.allSettled(searchPromises)
    showMessage(`Search completed! ${selectedPrompts.length} searches using ${searchProvider} (Total results: ${mediaCards.length})`, 'success')
  }

  // Generate images using AI
  const handleGenerateImages = useCallback(async () => {
    if (!hasGeneratedPrompts || prompts.length === 0) {
      showMessage('No prompts available for image generation', 'error')
      return
    }

    // Randomly select prompts based on imagesToGenerate count
    let selectedPrompts = [...prompts] // Start with all prompts
    if (imagesToGenerate < prompts.length) {
      // Randomly shuffle and take the first N prompts
      selectedPrompts = [...prompts].sort(() => Math.random() - 0.5).slice(0, imagesToGenerate)
    }

    // Create unique generation ID for this batch
    const generationId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Create AI generation cards with unique IDs for this generation
    const aiCardData = selectedPrompts.map((prompt: any, index: number) => {
      const chunk = chunks.find((c: any) => c.id === prompt.chunkId)
      return {
        promptId: `${generationId}-${prompt.chunkId}-ai`, // Unique ID for this generation
        prompt: prompt.prompt,
        searchQuery: prompt.searchQuery,
        sceneNumber: chunk ? chunk.chunkIndex + 1 : index + 1,
        sourceType: 'ai' as const
      }
    })
    
    // Append new cards to existing ones instead of replacing
    dispatch(initializeMediaCards(aiCardData))

    const batchSize = 5
    const batches = []
    
    // Split selected prompts into batches of 5
    for (let i = 0; i < selectedPrompts.length; i += batchSize) {
      batches.push(selectedPrompts.slice(i, i + batchSize))
    }
    
    dispatch(startGeneration({ totalBatches: batches.length }))
    dispatch(clearError())

    try {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        
        const remainingBatches = batches.length - batchIndex - 1
        const timeRemainingText = remainingBatches > 0 
          ? `${remainingBatches} minute${remainingBatches !== 1 ? 's' : ''} remaining`
          : "Final batch processing..."

        dispatch(updateBatch({ 
          batchNumber: batchIndex + 1, 
          timeRemaining: timeRemainingText 
        }))

        // Mark batch cards as generating (using generation-specific IDs)
        batch.forEach((prompt: any) => {
          const aiPromptId = `${generationId}-${prompt.chunkId}-ai`
          dispatch(updateCardStatus({ 
            promptId: aiPromptId, 
            status: 'generating' 
          }))
        })

        // Process batch in parallel
        const batchPromises = batch.map(async (prompt: any) => {
          const aiPromptId = `${generationId}-${prompt.chunkId}-ai`
          try {
            const requestBody = {
              provider: provider,
              prompt: prompt.prompt,
              aspectRatio: aspectRatio,
              userId: 'script-processor-user'
            }

            const imageUrl = await retryImageGeneration(
              requestBody,
              aiPromptId,
              3,
              (attempt) => {
                if (attempt > 1) {
                  dispatch(updateCardStatus({ 
                    promptId: aiPromptId, 
                    status: 'generating'
                  }))
                }
              }
            )
            
            dispatch(updateCardResult({
              promptId: aiPromptId,
              imageUrl: imageUrl,
              status: 'completed',
              mediaType: 'image'
            }))
          } catch (error) {
            dispatch(updateCardResult({
              promptId: aiPromptId,
              imageUrl: null,
              status: 'error',
              error: (error as Error).message
            }))
          }
        })

        await Promise.all(batchPromises)

        // Update progress
        const completedImages = (batchIndex + 1) * batchSize
        const totalImages = selectedPrompts.length
        const progressPercent = Math.min(Math.round((completedImages / totalImages) * 100), 100)
        dispatch(updateProgress(progressPercent))

        // Wait 1 minute before next batch (except for last batch)
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 60000))
        }
      }

      dispatch(completeGeneration())
      const completedCount = mediaCards.filter((card: any) => card.promptId.startsWith(generationId) && card.status === 'completed').length
      showMessage(`Generation complete! ${completedCount}/${selectedPrompts.length} images generated successfully (Total images: ${mediaCards.length})`, 'success')

    } catch (error) {
      dispatch(setError((error as Error).message))
      showMessage('Failed to generate images: ' + (error as Error).message, 'error')
    }
  }, [prompts, chunks, hasGeneratedPrompts, provider, aspectRatio, imagesToGenerate, dispatch, mediaCards])

  // Save selected images to Supabase
  const handleSaveSelected = async () => {
    const selectedCards = mediaCards.filter((card: any) => card.isSelected && card.selectedImageUrl)
    
    if (selectedCards.length === 0) {
      showMessage('No images selected for saving', 'error')
      return
    }

    // Sort by selection order to maintain user's intended sequence
    selectedCards.sort((a: any, b: any) => (a.selectionOrder || 0) - (b.selectionOrder || 0))

    dispatch(startSaving())
    
    try {
      const savePromises = selectedCards.map(async (card: any, index: number) => {
        // Extract original chunk ID by removing the suffix (-search or -ai)
        const originalChunkId = card.promptId.replace(/-(?:search|ai)$/, '')
        
        let savedUrl: string
        
        // For videos, use the original URL directly without uploading to Supabase
        if (card.selectedImageType === 'video') {
          savedUrl = card.selectedImageUrl
          console.log(`📹 Using direct video URL for scene ${card.sceneNumber}: ${savedUrl}`)
          
          // Update progress immediately for videos since there's no upload
          const progress = Math.round(((index + 1) / selectedCards.length) * 100)
          dispatch(updateSaveProgress({ 
            progress, 
            savedUrl: savedUrl, 
            promptId: card.promptId
          }))
          
          return { success: true, card, savedUrl: savedUrl, selectionOrder: card.selectionOrder }
        } else {
          // For images, upload to Supabase as before
          const response = await fetch('/api/upload-from-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assetUrl: card.selectedImageUrl,
              promptId: originalChunkId, // Use original chunk ID
              bucket: 'audio'
            })
          })
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Upload failed for scene ${card.sceneNumber}`)
          }
          
          const data = await response.json()
          savedUrl = data.publicUrl
          
          const progress = Math.round(((index + 1) / selectedCards.length) * 100)
          dispatch(updateSaveProgress({ 
            progress, 
            savedUrl: savedUrl, 
            promptId: card.promptId // Keep the unique card ID for updating the card
          }))
          
          return { success: true, card, savedUrl: savedUrl, selectionOrder: card.selectionOrder }
        }
      })
      
      const results = await Promise.all(savePromises)
      dispatch(completeSaving())
      
      const successCount = results.filter((r: any) => r.success).length
      const videoCount = results.filter((r: any) => r.success && r.card.selectedImageType === 'video').length
      const imageCount = successCount - videoCount
      
      if (videoCount > 0 && imageCount > 0) {
        showMessage(`Successfully processed ${successCount} items: ${imageCount} images uploaded to Supabase, ${videoCount} videos linked directly!`, 'success')
      } else if (videoCount > 0) {
        showMessage(`Successfully linked ${videoCount} video${videoCount > 1 ? 's' : ''} directly!`, 'success')
      } else {
        showMessage(`Successfully uploaded ${imageCount} image${imageCount > 1 ? 's' : ''} to Supabase!`, 'success')
      }
      
      // Sync saved images with the images slice for video generator compatibility
      if (successCount > 0) {
        try {
          const savedImagesPromises = results.filter(r => r.success).map(async (result: any, index: number): Promise<ProcessedImage> => {
            const card = result.card
            const imageId = card.promptId.replace(/-(?:search|ai)$/, '') // Use original chunk ID
            
            // Try to convert the URL to dataUrl for better compatibility
            let dataUrl = card.selectedImageUrl
            try {
              dataUrl = await convertUrlToDataUrl(card.selectedImageUrl)
            } catch (error) {
              console.warn('Failed to convert to dataUrl, using original URL:', error)
            }
            
            return {
              id: imageId,
              name: `scene-${index + 1}.jpg`, // Use selection index for naming
              originalName: `scene-${index + 1}.jpg`,
              dataUrl: dataUrl,
              processed: true,
              chapter: Math.ceil((index + 1) / 10), // Group by selection order, not scene number
              imageNumber: index + 1, // Use selection index
              sortOrder: index + 1, // Critical: Use selection order for video generation
              supabasePath: result.savedUrl, // Store the complete public URL directly
              savedToSupabase: true,
              mediaType: card.selectedImageType || 'image' // Preserve media type for Shotstack
            }
          })
          
          const savedImages = await Promise.all(savedImagesPromises)
          
          // Merge with existing images, replacing any with the same ID
          const existingImages = originalImages.filter(img => 
            !savedImages.some(newImg => newImg.id === img.id)
          )
          const mergedImages = [...existingImages, ...savedImages].sort((a, b) => 
            (a.sortOrder || 0) - (b.sortOrder || 0)
          )
          
          // Update the images slice with the merged images
          dispatch(setOriginalImages(mergedImages))
          
          console.log(`📸 Synced ${savedImages.length} images to video generator in selection order:`, savedImages.map(img => `${img.name} (order: ${img.sortOrder})`))
          const videoCount = savedImages.filter(img => img.name.includes('video') || img.supabasePath?.includes('video')).length
          const imageCount = savedImages.length - videoCount
          
          if (videoCount > 0 && imageCount > 0) {
            showMessage(`Media synced with video generator! ${mergedImages.length} total items (${imageCount} images, ${videoCount} videos) available in selection order.`, 'success')
          } else {
            showMessage(`Media synced with video generator! ${mergedImages.length} total items available in selection order.`, 'success')
          }
        } catch (error) {
          console.error('Error syncing images:', error)
          showMessage('Images saved but sync with video generator failed', 'error')
        }
      }
      
    } catch (error) {
      dispatch(setError((error as Error).message))
      showMessage('Failed to save images: ' + (error as Error).message, 'error')
    }
  }

  // Handle card selection toggle
  const handleCardClick = (promptId: string) => {
    const card = mediaCards.find((c: any) => c.promptId === promptId)
    if (card && card.selectedImageUrl) {
      dispatch(toggleCardSelection({ promptId }))
    }
  }

  // Handle select all toggle
  const handleSelectAll = () => {
    const hasUnselectedCards = mediaCards.some((card: any) => card.selectedImageUrl && !card.isSelected)
    if (hasUnselectedCards) {
      dispatch(selectAllCards())
    } else {
      dispatch(deselectAllCards())
    }
  }

  // Regenerate AI image with new prompt
  const handleRegenerateImage = async (promptId: string, newPrompt: string) => {
    if (!newPrompt.trim()) {
      showMessage('Please enter a prompt', 'error')
      return
    }

    // Update the card state first
    dispatch(regenerateImage({ promptId, newPrompt: newPrompt.trim() }))
    
    try {
      const requestBody = {
        provider: provider,
        prompt: newPrompt.trim(),
        aspectRatio: aspectRatio,
        userId: 'script-processor-user'
      }

      const imageUrl = await retryImageGeneration(
        requestBody,
        promptId,
        3,
        (attempt) => {
          if (attempt > 1) {
            dispatch(updateCardStatus({ 
              promptId: promptId, 
              status: 'generating'
            }))
          }
        }
      )
      
      dispatch(updateCardResult({
        promptId: promptId,
        imageUrl: imageUrl,
        status: 'completed',
        mediaType: 'image'
      }))
      showMessage('Image regenerated successfully!', 'success')
    } catch (error) {
      dispatch(updateCardResult({
        promptId: promptId,
        imageUrl: null,
        status: 'error',
        error: (error as Error).message
      }))
      showMessage('Failed to regenerate image: ' + (error as Error).message, 'error')
    }
    
    // Close dialog
    setRegenerateDialog(null)
    setNewPrompt("")
  }

  // Regenerate AI image with same prompt
  const handleRegenerateSamePrompt = async (card: any) => {
    if (!card.prompt) {
      showMessage('No prompt available for regeneration', 'error')
      return
    }

    // Update the card state to show generating
    dispatch(updateCardStatus({ 
      promptId: card.promptId, 
      status: 'generating' 
    }))
    
    try {
      const requestBody = {
        provider: provider,
        prompt: card.prompt,
        aspectRatio: aspectRatio,
        userId: 'script-processor-user'
      }

      const imageUrl = await retryImageGeneration(
        requestBody,
        card.promptId,
        3,
        (attempt) => {
          if (attempt > 1) {
            dispatch(updateCardStatus({ 
              promptId: card.promptId, 
              status: 'generating'
            }))
          }
        }
      )
      
      dispatch(updateCardResult({
        promptId: card.promptId,
        imageUrl: imageUrl,
        status: 'completed',
        mediaType: 'image'
      }))
      showMessage('Image regenerated successfully!', 'success')
    } catch (error) {
      dispatch(updateCardResult({
        promptId: card.promptId,
        imageUrl: null,
        status: 'error',
        error: (error as Error).message
      }))
      showMessage('Failed to regenerate image: ' + (error as Error).message, 'error')
    }
  }

  // Create custom image
  const handleCreateCustomImage = async () => {
    if (customMode === 'ai' && !customPrompt.trim() && selectedPromptId === "custom") {
      showMessage('Please enter a prompt or select from available prompts for AI generation', 'error')
      return
    }
    if (customMode === 'search' && !customSearchQuery.trim()) {
      showMessage('Please enter a search query', 'error')
      return
    }

    if (customMode === 'ai' && selectedPromptId && selectedPromptId !== "custom") {
      // Handle multiple images from selected prompt
      const selectedPrompt = prompts.find((p: any) => p.chunkId === selectedPromptId)
      if (!selectedPrompt) {
        showMessage('Selected prompt not found', 'error')
        return
      }

      const customIds: string[] = []
      const generationPromises: Promise<void>[] = []

      // Create multiple custom cards
      for (let i = 0; i < customImageCount; i++) {
        const customId = `custom-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`
        customIds.push(customId)

        // Add the custom card
        dispatch(addCustomImageCard({
          prompt: selectedPrompt.prompt,
          sourceType: 'ai',
          customProvider: customProvider,
          customId: customId
        }))

        // Create generation promise
        const generationPromise = (async () => {
          try {
            dispatch(updateCardStatus({ promptId: customId, status: 'generating' }))
            
            const requestBody = {
              provider: customProvider,
              prompt: selectedPrompt.prompt,
              aspectRatio: aspectRatio,
              userId: 'script-processor-user'
            }

            const imageUrl = await retryImageGeneration(
              requestBody,
              customId,
              3,
              (attempt) => {
                if (attempt > 1) {
                  dispatch(updateCardStatus({ 
                    promptId: customId, 
                    status: 'generating'
                  }))
                }
              }
            )
            
            dispatch(updateCardResult({
              promptId: customId,
              imageUrl: imageUrl,
              status: 'completed',
              mediaType: 'image'
            }))
          } catch (error) {
            dispatch(updateCardResult({
              promptId: customId,
              imageUrl: null,
              status: 'error',
              error: (error as Error).message
            }))
          }
        })()

        generationPromises.push(generationPromise)
      }

      // Wait for all generations to complete
      try {
        await Promise.all(generationPromises)
        showMessage(`Generated ${customImageCount} custom images successfully!`, 'success')
      } catch (error) {
        showMessage(`Custom image generation completed with some errors`, 'error')
      }
    } else {
      // Original single image generation logic
      const customId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Add the custom card first
      dispatch(addCustomImageCard({
        prompt: customMode === 'ai' ? customPrompt.trim() : undefined,
        searchQuery: customMode === 'search' ? customSearchQuery.trim() : undefined,
        sourceType: customMode,
        customProvider: customMode === 'ai' ? customProvider : undefined,
        customSearchProvider: customMode === 'search' ? customSearchProvider : undefined,
        customId: customId
      }))

      try {
        if (customMode === 'ai') {
          // Generate AI image
          dispatch(updateCardStatus({ promptId: customId, status: 'generating' }))
          
          const requestBody = {
            provider: customProvider,
            prompt: customPrompt.trim(),
            aspectRatio: aspectRatio,
            userId: 'script-processor-user'
          }

          const imageUrl = await retryImageGeneration(
            requestBody,
            customId,
            3,
            (attempt) => {
              if (attempt > 1) {
                dispatch(updateCardStatus({ 
                  promptId: customId, 
                  status: 'generating'
                }))
              }
            }
          )
          
          dispatch(updateCardResult({
            promptId: customId,
            imageUrl: imageUrl,
            status: 'completed',
            mediaType: 'image'
          }))
          showMessage('Custom image generated successfully!', 'success')
        } else {
          // Search stock media
          dispatch(startStockSearch({ promptId: customId }))
          
          const response = await fetch(`/api/search-${customSearchProvider}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: customSearchQuery.trim(), type: searchType }),
          })
          
          const data = await response.json()
          
          if (response.ok) {
            dispatch(setStockSearchResults({ 
              promptId: customId, 
              results: data.results || [],
              replaceSelected: true
            }))
            showMessage('Stock search completed successfully!', 'success')
          } else {
            throw new Error(data.error || `${customSearchProvider} search failed`)
          }
        }
      } catch (error) {
        if (customMode === 'ai') {
          dispatch(updateCardResult({
            promptId: customId,
            imageUrl: null,
            status: 'error',
            error: (error as Error).message
          }))
        } else {
          dispatch(setStockSearchError({ 
            promptId: customId, 
            error: (error as Error).message 
          }))
        }
        showMessage('Failed to create custom image: ' + (error as Error).message, 'error')
      }
    }
    
    // Close dialog and reset form
    setCustomImageDialog(false)
    setCustomPrompt("")
    setCustomSearchQuery("")
    setSelectedPromptId("custom")
    setCustomImageCount(1)
  }

  // Search again for a specific card
  const handleSearchAgain = async () => {
    if (!searchAgainDialog || !searchAgainQuery.trim()) {
      showMessage('Please enter a search query', 'error')
      return
    }

    const { promptId } = searchAgainDialog
    console.log('🔍 Starting search again for card:', promptId)
    
    try {
      dispatch(startStockSearch({ promptId }))
      console.log('🔍 Dispatched startStockSearch for:', promptId)
      
      const response = await fetch(`/api/search-${searchAgainProvider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchAgainQuery.trim(), 
          type: searchAgainType 
        }),
      })
      
      const data = await response.json()
      console.log('🔍 Search API response:', {
        provider: searchAgainProvider,
        ok: response.ok,
        status: response.status,
        resultsCount: data.results?.length || 0,
        error: data.error
      })
      
      if (response.ok && data.results) {
        console.log('✅ Search successful, dispatching setStockSearchResults for:', promptId)
        dispatch(setStockSearchResults({ 
          promptId: promptId, 
          results: data.results,
          replaceSelected: true
        }))
        showMessage(`Search completed! Found ${data.results.length} new results from ${searchAgainProvider}`, 'success')
      } else {
        console.log('❌ Search failed, dispatching setStockSearchError for:', promptId)
        const errorMessage = data.error || `${searchAgainProvider} search failed with status ${response.status}`
        dispatch(setStockSearchError({ 
          promptId: promptId, 
          error: errorMessage
        }))
        
        // Provide more specific error messages
        if (searchAgainProvider === 'pixabay' && response.status === 400) {
          showMessage('Pixabay search failed. Try simplifying your search terms (remove special characters)', 'error')
        } else if (searchAgainProvider === 'pixabay' && !process.env.NEXT_PUBLIC_PIXABAY_API_AVAILABLE) {
          showMessage('Pixabay API key not configured. Please use Pexels or Flickr instead.', 'error')
        } else {
          showMessage(`Search failed: ${errorMessage}`, 'error')
        }
      }
    } catch (error) {
      console.log('❌ Search exception, dispatching setStockSearchError for:', promptId, error)
      dispatch(setStockSearchError({ 
        promptId: promptId, 
        error: (error as Error).message 
      }))
      showMessage('Search failed: ' + (error as Error).message, 'error')
    } finally {
      // Safety: Ensure searching state is always reset after a delay
      setTimeout(() => {
        console.log('🔄 Safety: Ensuring search state is cleared for:', promptId)
        dispatch(stopStockSearch({ promptId }))
      }, 1000)
    }
    
    // Close dialog and reset
    setSearchAgainDialog(null)
    setSearchAgainQuery("")
  }

  // Resize image to portrait
  const handleResizeImage = async (promptId: string, imageUrl: string) => {
    setResizingCard(promptId)
    
    try {
      const response = await fetch('/api/resize-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          operation: 'portrait' // Convert to portrait orientation
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to resize image')
      }
      
      const data = await response.json()
      
      // Update the card with the resized image
      dispatch(updateCardResult({
        promptId: promptId,
        imageUrl: data.resizedImageUrl,
        status: 'completed',
        mediaType: 'image',
        isPortrait: true
      }))
      
      showMessage('Image resized to portrait successfully!', 'success')
    } catch (error) {
      showMessage('Failed to resize image: ' + (error as Error).message, 'error')
    } finally {
      setResizingCard(null)
    }
  }

  const completedCards = mediaCards.filter((card: any) => card.selectedImageUrl).length
  const allCardsHaveImages = completedCards > 0

  if (!hasGeneratedPrompts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Batch Image Generator
          </CardTitle>
          <CardDescription>
            Please generate script prompts first using the Script Processor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please generate script prompts first using the Script Processor
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {(message || error) && (
        <Alert className={
          error ? 'border-red-200 bg-red-50' :
          messageType === 'error' ? 'border-red-200 bg-red-50' : 
          messageType === 'success' ? 'border-green-200 bg-green-50' : 
          'border-blue-200 bg-blue-50'
        }>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || message}</AlertDescription>
        </Alert>
      )}

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Batch Image Generator
          </CardTitle>
          <CardDescription>
            {mode === 'generate' 
              ? `Generate up to ${imagesToGenerate} images from ${prompts.length} available prompts using AI in batches of 5 per minute. Download individual images or bulk download as ZIP.`
              : `Search stock media for up to ${imagesToGenerate} scenes from ${prompts.length} available prompts. Download individual media or bulk download as ZIP.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode selector */}
          <div className="flex items-center gap-6 mb-4">
            <RadioGroup value={mode} onValueChange={(v: string) => dispatch(setMode(v as any))} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="generate" id="mode-generate"/>
                <Label htmlFor="mode-generate">AI Generation</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="search" id="mode-search"/>
                <Label htmlFor="mode-search">Stock Search</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'generate' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Image Provider</Label>
                <Select value={provider} onValueChange={(value: string) => dispatch(setProvider(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div>
                          <div className="font-medium">{p.label}</div>
                          <div className="text-xs text-gray-500">{p.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

      
              
              <div className="space-y-2">
                <Label>Images to Generate</Label>
                <Input
                  type="number"
                  value={imagesToGenerate.toString()}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      dispatch(setImagesToGenerate(1))
                    } else {
                      const parsed = parseInt(value, 10)
                      if (!isNaN(parsed)) {
                        dispatch(setImagesToGenerate(parsed))
                      }
                    }
                  }}
                  min={1}
                  max={200}
                />
                <p className="text-xs text-gray-500">
                  {imagesToGenerate < prompts.length 
                    ? `Will randomly select ${imagesToGenerate} prompts from ${prompts.length} available`
                    : `Will generate ${imagesToGenerate} images from available prompts`
                  }
                </p>
              </div>
            </div>
          )}

          {mode === 'search' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock Provider</Label>
                <Select value={searchProvider} onValueChange={(v: string) => dispatch(setSearchProvider(v as any))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pexels">Pexels</SelectItem>
                    <SelectItem 
                      value="pixabay" 
                      disabled={!apiKeyStatus.pixabay}
                    >
                      Pixabay {!apiKeyStatus.pixabay && '(API key required)'}
                    </SelectItem>
                    <SelectItem 
                      value="storyblocks" 
                      disabled={true}
                    >
                      Storyblocks (disabled)
                    </SelectItem>
                    <SelectItem value="flickr">Flickr</SelectItem>
                  </SelectContent>
                </Select>
                {searchProvider === 'pixabay' && !apiKeyStatus.pixabay && (
                  <p className="text-xs text-orange-600">
                    PIXABAY_API_KEY environment variable not configured
                  </p>
                )}
                {searchProvider === 'storyblocks' && (
                  <p className="text-xs text-orange-600">
                    Storyblocks is disabled
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Media Type</Label>
                <Select value={searchType} onValueChange={(v: string) => dispatch(setSearchType(v as any))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video" disabled={searchProvider === 'flickr'}>
                      Video {searchProvider === 'flickr' && '(not supported by Flickr)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {mode === 'generate' ? (
            <Button
                onClick={handleGenerateImages}
              disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Batch {currentBatch}/{totalBatches}...
                </>
              ) : (
                <>
                  <Images className="h-4 w-4 mr-2" />
                  Generate {imagesToGenerate} Images
                </>
              )}
            </Button>
            ) : (
              <Button
                onClick={handleSearchAll}
                disabled={mediaCards.some((card: any) => card.isSearching)}
                className="bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {mediaCards.some((card: any) => card.isSearching) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search {imagesToGenerate} Scenes
                  </>
                )}
              </Button>
            )}

            {allCardsHaveImages && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2"
                >
                  {selectedCount === 0 ? (
                    <>
                      <span className="h-4 w-4 border border-gray-300 rounded-sm"></span>
                      Select All
                    </>
                  ) : selectedCount === completedCards ? (
                    <>
                      <span className="h-4 w-4 bg-blue-600 border border-blue-600 rounded-sm flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                      Deselect All
                    </>
                  ) : (
                    <>
                      <span className="h-4 w-4 bg-blue-600 border border-blue-600 rounded-sm flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                      Select All ({selectedCount} selected)
                    </>
                  )}
                </Button>

                {selectedCount > 0 && (
                  <>
                    <Button
                      onClick={handleSaveSelected}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving... {saveProgress}%
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Selected ({selectedCount})
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={downloadSelectedImages}
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      <FolderDown className="h-4 w-4 mr-2" />
                      Download Selected ({selectedCount})
                    </Button>
                  </>
                )}
              </>
            )}

            <Button
              variant="outline" 
              onClick={() => setCustomImageDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Custom Image
            </Button>
          </div>

          {/* Progress display */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {progress}%</span>
                {timeRemaining && <span>{timeRemaining}</span>}
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Media Cards Grid */}
      {mediaCards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Media Cards ({completedCards}/{mediaCards.length} ready)
              </div>
              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <Badge variant="secondary">
                    {selectedCount} selected
                      </Badge>
                    )}
                  <Badge variant="outline">
                  {completedCards} completed
                  </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mediaCards.map((card: any) => (
                <Card 
                  key={card.promptId} 
                  className={`relative cursor-pointer transition-all duration-200 ${
                    card.isSelected 
                      ? 'border-2 border-green-500 bg-green-50' 
                      : card.selectedImageUrl 
                        ? 'border-2 border-blue-500 hover:border-blue-600' 
                        : 'hover:border-gray-300'
                  }`}
                  onClick={() => handleCardClick(card.promptId)}
                >
                  {/* Selection indicator */}
                  {card.isSelected && card.selectionOrder && (
                    <div className="absolute top-2 left-2 z-10 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      {card.selectionOrder}
                    </div>
                  )}

                  {/* Save indicator */}
                  {card.isSaved && (
                    <div className="absolute top-2 right-2 z-10 bg-blue-600 text-white rounded-full p-1">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  )}

                    <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span>
                        {card.promptId.startsWith('custom-') 
                          ? `Custom Image ${card.sceneNumber}`
                          : `Scene ${card.sceneNumber}`
                        }
                      </span>
                      <div className="flex gap-1">
                        <Badge variant={card.sourceType === 'search' ? 'secondary' : 'default'} className="text-xs">
                          {card.sourceType === 'search' ? 'Stock' : 'AI'}
                        </Badge>
                        {card.selectedImageType === 'video' && (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                            Video
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2">{card.prompt}</CardDescription>
                    {card.searchQuery && card.sourceType === 'search' && (
                      <CardDescription className="text-xs text-blue-600">
                        Search: {card.searchQuery}
                      </CardDescription>
                    )}
                    </CardHeader>
                  
                  <CardContent>
                    {card.selectedImageUrl ? (
                      card.selectedImageType === 'video' ? (
                        <video 
                          src={card.selectedImageUrl} 
                          controls 
                          className="w-full aspect-video object-cover rounded-md" 
                        />
                      ) : (
                        <img 
                          src={card.selectedImageUrl} 
                          alt={`Scene ${card.sceneNumber}`}
                          className={`w-full object-cover rounded-md ${
                            card.isPortrait ? 'aspect-[9/16]' : 'aspect-video'
                          }`}
                        />
                      )
                    ) : (
                      <div className={`flex items-center justify-center bg-gray-100 rounded-md ${
                        card.isPortrait ? 'aspect-[9/16]' : 'aspect-video'
                      }`}>
                        {card.status === 'pending' && <Clock className="h-8 w-8 text-gray-400" />}
                        {card.status === 'generating' && <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />}
                        {card.isSearching && <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />}
                        {card.status === 'error' && <AlertCircle className="h-8 w-8 text-red-500" />}
                        {!card.isSearching && card.status === 'pending' && mode === 'search' && (
                          <Camera className="h-8 w-8 text-gray-400" />
                              )}
                            </div>
                    )}

                    {card.error && (
                      <p className="text-xs text-red-500 mt-2">{card.error}</p>
                    )}
                    </CardContent>

                  {/* Show alternative options for stock search only */}
                  {card.sourceType === 'search' && card.stockResults.length > 1 && (
                      <CardFooter>
                        <Dialog.Root
                        open={selectedCard === card.promptId}
                        onOpenChange={(isOpen) => setSelectedCard(isOpen ? card.promptId : null)}
                        >
                          <Dialog.Trigger asChild>
                          <Button variant="outline" size="sm" className="w-full">
                            <MoreHorizontal className="h-4 w-4 mr-2" />
                            Choose Different ({card.stockResults.length} options)
                            </Button>
                          </Dialog.Trigger>
                          <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                            <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
                            <Dialog.Title className="text-lg font-semibold">
                              Choose Media for Scene {card.sceneNumber}
                            </Dialog.Title>
                              
                              <div className="max-h-[60vh] overflow-y-auto">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {card.stockResults.map((stockImage: any) => (
                                  <div 
                                    key={stockImage.id} 
                                    className="cursor-pointer group relative" 
                                    onClick={() => {
                                      dispatch(selectStockImage({ promptId: card.promptId, stockImage }))
                                      setSelectedCard(null)
                                    }}
                                  >
                                      <div className="relative aspect-video rounded-lg overflow-hidden">
                                      {stockImage.type === 'video' ? (
                                        <video 
                                          src={stockImage.url} 
                                          loop 
                                          muted 
                                          playsInline 
                                          className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                                        />
                                      ) : (
                                        <img 
                                          src={stockImage.thumbnail} 
                                          alt={stockImage.photographer}
                                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                        )}
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                        {stockImage.type === 'video' && (
                                          <PlayCircle className="text-white h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                        )}
                                        </div>
                                      </div>
                                    <p className="text-xs text-gray-500 mt-1 truncate">by {stockImage.photographer}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            
                              <Dialog.Close asChild>
                                <button
                                  className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                                  aria-label="Close"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </Dialog.Close>
                            </Dialog.Content>
                          </Dialog.Portal>
                        </Dialog.Root>
                      </CardFooter>
                    )}

                  {/* Show search again and resize buttons for search cards with completed results */}
                  {card.sourceType === 'search' && card.selectedImageUrl && (
                    <CardFooter className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 w-full">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSearchAgainDialog({ 
                              promptId: card.promptId, 
                              currentQuery: card.searchQuery || '' 
                            })
                            setSearchAgainQuery(card.searchQuery || '')
                            setSearchAgainProvider(searchProvider)
                            setSearchAgainType(searchType)
                          }}
                          disabled={card.isSearching}
                        >
                          {card.isSearching ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Search Again
                            </>
                          )}
                        </Button>
                        
                        {/* Resize button - only for images, not videos */}
                        {card.selectedImageType === 'image' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleResizeImage(card.promptId, card.selectedImageUrl)
                            }}
                            disabled={resizingCard === card.promptId}
                          >
                            {resizingCard === card.promptId ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Resizing...
                              </>
                            ) : (
                              <>
                                <Crop className="h-4 w-4 mr-2" />
                                Resize to Portrait
                              </>
                            )}
                          </Button>
                        )}
                        
                        {/* Download button */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full border-green-600 text-green-600 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            const fileExtension = card.selectedImageType === 'video' ? 'mp4' : 'jpg'
                            const fileName = `scene-${card.sceneNumber}.${fileExtension}`
                            downloadImage(card.selectedImageUrl, fileName)
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download {card.selectedImageType === 'video' ? 'Video' : 'Image'}
                        </Button>
                      </div>
                    </CardFooter>
                  )}

                  {/* Show regenerate button for completed AI cards */}
                  {card.sourceType === 'ai' && (card.status === 'completed' || card.status === 'error') && (
                    <CardFooter className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 w-full">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRegenerateSamePrompt(card)
                          }}
                          disabled={card.status === 'generating'}
                        >
                          {card.status === 'generating' ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Regenerating...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              {card.status === 'error' ? 'Retry Generation' : 'Regenerate'}
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRegenerateDialog({ promptId: card.promptId, currentPrompt: card.prompt })
                            setNewPrompt(card.prompt)
                          }}
                          disabled={card.status === 'generating'}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {card.status === 'error' ? 'Retry with New Prompt' : 'Regenerate with New Prompt'}
                        </Button>
                        
                        {/* Resize button - only for images, not videos */}
                        {card.selectedImageUrl && card.selectedImageType === 'image' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleResizeImage(card.promptId, card.selectedImageUrl)
                            }}
                            disabled={resizingCard === card.promptId}
                          >
                            {resizingCard === card.promptId ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Resizing...
                              </>
                            ) : (
                              <>
                                <Crop className="h-4 w-4 mr-2" />
                                Resize to Portrait
                              </>
                            )}
                          </Button>
                        )}
                        
                        {/* Download button - only show for completed images */}
                        {card.selectedImageUrl && card.status === 'completed' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full border-green-600 text-green-600 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              const fileExtension = card.selectedImageType === 'video' ? 'mp4' : 'jpg'
                              const fileName = `scene-${card.sceneNumber}.${fileExtension}`
                              downloadImage(card.selectedImageUrl, fileName)
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download {card.selectedImageType === 'video' ? 'Video' : 'Image'}
                          </Button>
                        )}
                      </div>
                    </CardFooter>
                  )}
                  </Card>
              ))}

              {/* Add Custom Image Placeholder Card */}
              <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors cursor-pointer bg-gray-50/50 hover:bg-gray-100/50">
                <CardContent 
                  className="flex flex-col items-center justify-center h-full min-h-[300px] p-6"
                  onClick={() => setCustomImageDialog(true)}
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="rounded-full bg-gray-200 p-4">
                      <Plus className="h-8 w-8 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700 mb-2">Add Custom Image</h3>
                      <p className="text-sm text-gray-500 max-w-xs">
                        Generate an AI image or search for stock media with your own prompt
                      </p>
                    </div>
                    <Button variant="outline" className="mt-2">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Image
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Image Dialog */}
      <Dialog.Root
        open={customImageDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setCustomImageDialog(false)
            setCustomPrompt("")
            setCustomSearchQuery("")
            setSelectedPromptId("custom")
            setCustomImageCount(1)
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
            <Dialog.Title className="text-lg font-semibold">
              Create Custom Image
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Choose how you want to create your custom image.
            </Dialog.Description>
            
            <div className="space-y-4">
              {/* Mode Selection */}
              <div>
                <Label>Creation Mode</Label>
                <RadioGroup value={customMode} onValueChange={(v: string) => setCustomMode(v as any)} className="flex gap-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ai" id="custom-ai"/>
                    <Label htmlFor="custom-ai">AI Generation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="search" id="custom-search"/>
                    <Label htmlFor="custom-search">Stock Search</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* AI Generation Mode */}
              {customMode === 'ai' && (
                <div className="space-y-4">
                  <div>
                    <Label>AI Provider</Label>
                    <Select value={customProvider} onValueChange={setCustomProvider}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMAGE_PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <div>
                              <div className="font-medium">{p.label}</div>
                              <div className="text-xs text-gray-500">{p.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Option to choose from available prompts */}
                  {hasGeneratedPrompts && prompts.length > 0 && (
                    <div>
                      <Label>Choose from Available Prompts</Label>
                      <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select a prompt from your script..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="custom">
                            <em>Use custom prompt instead</em>
                          </SelectItem>
                          {prompts.map((prompt: any, index: number) => {
                            const chunk = chunks.find((c: any) => c.id === prompt.chunkId)
                            const sceneNumber = chunk ? chunk.chunkIndex + 1 : index + 1
                            return (
                              <SelectItem key={prompt.chunkId} value={prompt.chunkId}>
                                <div className="flex flex-col items-start">
                                  <div className="font-medium">Scene {sceneNumber}</div>
                                  <div className="text-xs text-gray-500 line-clamp-2 max-w-xs">
                                    {prompt.prompt.length > 160 
                                      ? `${prompt.prompt.substring(0, 160)}...` 
                                      : prompt.prompt
                                    }
                                  </div>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Number of images input when using selected prompt */}
                  {selectedPromptId && selectedPromptId !== "custom" && (
                    <div>
                      <Label htmlFor="custom-image-count">Number of Images to Generate</Label>
                      <Input
                        id="custom-image-count"
                        type="number"
                        value={customImageCount.toString()}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '') {
                            setCustomImageCount(1)
                          } else {
                            const parsed = parseInt(value, 10)
                            if (!isNaN(parsed)) {
                              setCustomImageCount(Math.max(1, Math.min(10, parsed)))
                            }
                          }
                        }}
                        min={1}
                        max={10}
                        className="mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Generate 1-10 different variations of the selected scene
                      </p>
                    </div>
                  )}
                  
                  {/* Manual prompt input (only show if no prompt selected) */}
                  {selectedPromptId === "custom" && (
                    <div>
                      <Label htmlFor="custom-prompt">Custom Prompt</Label>
                      <Textarea
                        id="custom-prompt"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Describe the image you want to generate..."
                        className="min-h-[100px] mt-2"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Stock Search Mode */}
              {customMode === 'search' && (
                <div className="space-y-4">
                  <div>
                    <Label>Search Provider</Label>
                    <Select value={customSearchProvider} onValueChange={(v: string) => setCustomSearchProvider(v as any)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pexels">Pexels</SelectItem>
                        <SelectItem 
                          value="pixabay" 
                          disabled={!apiKeyStatus.pixabay}
                        >
                          Pixabay {!apiKeyStatus.pixabay && '(API key required)'}
                        </SelectItem>
                        <SelectItem 
                          value="storyblocks" 
                          disabled={true}
                        >
                          Storyblocks (disabled)
                        </SelectItem>
                        <SelectItem value="flickr">Flickr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="custom-search-query">Search Query</Label>
                    <Textarea
                      id="custom-search-query"
                      value={customSearchQuery}
                      onChange={(e) => setCustomSearchQuery(e.target.value)}
                      placeholder="Enter your search terms..."
                      className="min-h-[60px] mt-2"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.Close>
                <Button 
                  onClick={handleCreateCustomImage}
                  disabled={
                    (customMode === 'ai' && !customPrompt.trim() && selectedPromptId === "custom") ||
                    (customMode === 'search' && !customSearchQuery.trim())
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {customMode === 'ai' && selectedPromptId && selectedPromptId !== "custom"
                    ? `Generate ${customImageCount} Image${customImageCount > 1 ? 's' : ''}`
                    : 'Create'
                  }
                </Button>
              </div>
            </div>
            
            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Regenerate Dialog */}
      <Dialog.Root
        open={regenerateDialog !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setRegenerateDialog(null)
            setNewPrompt("")
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
            <Dialog.Title className="text-lg font-semibold">
              Regenerate AI Image
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Modify the prompt to regenerate the image with different content.
            </Dialog.Description>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-prompt">Prompt</Label>
                <Textarea
                  id="new-prompt"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Enter your new prompt..."
                  className="min-h-[100px] mt-2"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.Close>
                <Button 
                  onClick={() => regenerateDialog && handleRegenerateImage(regenerateDialog.promptId, newPrompt)}
                  disabled={!newPrompt.trim()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </div>
            
            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      
      {/* Search Again Dialog */}
      <Dialog.Root
        open={searchAgainDialog !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSearchAgainDialog(null)
            setSearchAgainQuery("")
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
            <Dialog.Title className="text-lg font-semibold">
              Search Again
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Enter a new search query to find different stock media for this scene.
            </Dialog.Description>
            
            <div className="space-y-4">
              {/* Search Provider */}
              <div>
                <Label>Search Provider</Label>
                <Select value={searchAgainProvider} onValueChange={(v: string) => setSearchAgainProvider(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pexels">Pexels</SelectItem>
                    <SelectItem 
                      value="pixabay" 
                      disabled={!apiKeyStatus.pixabay}
                    >
                      Pixabay {!apiKeyStatus.pixabay && '(API key required)'}
                    </SelectItem>
                    <SelectItem 
                      value="storyblocks" 
                      disabled={true}
                    >
                      Storyblocks (disabled)
                    </SelectItem>
                    <SelectItem value="flickr">Flickr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Media Type */}
              <div>
                <Label>Media Type</Label>
                <Select value={searchAgainType} onValueChange={(v: string) => setSearchAgainType(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video" disabled={searchAgainProvider === 'flickr'}>
                      Video {searchAgainProvider === 'flickr' && '(not supported by Flickr)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Search Query */}
              <div>
                <Label htmlFor="search-again-query">Search Query</Label>
                <Textarea
                  id="search-again-query"
                  value={searchAgainQuery}
                  onChange={(e) => setSearchAgainQuery(e.target.value)}
                  placeholder="Enter your search terms..."
                  className="min-h-[60px] mt-2"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.Close>
                <Button 
                  onClick={handleSearchAgain}
                  disabled={!searchAgainQuery.trim()}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
            
            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
} 