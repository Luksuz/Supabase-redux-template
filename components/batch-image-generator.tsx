'use client'

import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { 
  setProvider,
  setAspectRatio,
  startGeneration,
  updateBatch,
  updateProgress,
  updateImageStatus,
  updateImageResult,
  completeGeneration,
  setError,
  clearError,
  startStockSearch,
  setStockSearchResult,
  setStockSearchError,
  prepareForNewSearch,
  type GeneratedImage,
  type StockImage
} from '@/lib/features/batchImageGenerator/batchImageGeneratorSlice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { 
  Images, 
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Zap,
  Search,
  Camera,
  PlayCircle,
  X
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const IMAGE_PROVIDERS = [
  { value: 'minimax', label: 'MiniMax (Fast)', description: 'Best for quick generation' },
  { value: 'dalle-3', label: 'DALL-E 3', description: 'High quality, creative' },
  { value: 'gpt-image-1', label: 'GPT Image 1', description: 'Latest OpenAI model' },
  { value: 'imagen', label: 'Google Imagen', description: 'Google\'s latest image model' },
  { value: 'flux-dev', label: 'Flux Dev', description: 'Open source, detailed' },
  { value: 'leonardo-phoenix', label: 'Leonardo Phoenix', description: 'Artistic, cinematic' }
]

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '9:16', label: '9:16 (Portrait)' }
]

export function BatchImageGenerator() {
  const { prompts, hasGeneratedPrompts, chunks } = useAppSelector(state => state.scriptProcessor)
  const {
    provider,
    aspectRatio,
    generatedImages,
    isGenerating,
    progress,
    currentBatch,
    totalBatches,
    timeRemaining,
    totalGenerated,
    totalErrors,
    error,
    stockSearchResults,
  } = useAppSelector(state => state.batchImageGenerator)
  const dispatch = useAppDispatch()
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [activeSearch, setActiveSearch] = useState<{promptId: string, query: string} | null>(null)
  const [searchProvider, setSearchProvider] = useState<'pexels' | 'pixabay' | 'storyblocks'>('pexels');
  const [searchType, setSearchType] = useState<'image' | 'video'>('image');
  const [mode, setMode] = useState<'generate' | 'search'>('generate')
  // Track which promptIds have images that still need uploading
  const [pendingUploads, setPendingUploads] = useState<Record<string, {url: string, type: 'image' | 'video'}>>({});
  const [selectedThumb, setSelectedThumb] = useState<{promptId: string, assetId: string} | null>(null);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(""), 5000)
  }

  // Calculate estimated time
  const calculateEstimatedTime = (totalPrompts: number) => {
    const batchSize = 5
    const batchesNeeded = Math.ceil(totalPrompts / batchSize)
    const minutesNeeded = batchesNeeded
    
    if (minutesNeeded < 1) return "Less than 1 minute"
    if (minutesNeeded === 1) return "About 1 minute"
    return `About ${minutesNeeded} minutes`
  }

  const handleSearch = async () => {
    if (!activeSearch) return;
    const { promptId, query } = activeSearch;

    dispatch(startStockSearch({ promptId }));
    const provider = searchProvider;
    try {
      const response = await fetch(`/api/search-${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, type: searchType }),
      });
      const data = await response.json();
      if (response.ok) {
        dispatch(setStockSearchResult({ promptId, provider, results: data.results }));
      } else {
        throw new Error(data.error || `${provider} search failed`);
      }
    } catch (e: any) {
      dispatch(setStockSearchError({ promptId, error: e.message }));
    }
  };

  const handleSelectStockImage = (promptId: string, stockImage: StockImage) => {
    // Immediately update preview in grid
    dispatch(updateImageResult({
      promptId,
      imageUrl: stockImage.url, // temporary external URL
      status: 'completed',
      mediaType: stockImage.type
    }));

    setPendingUploads(prev => ({ ...prev, [promptId]: { url: stockImage.url, type: stockImage.type } }));
    setActiveSearch(null); // Close dialog on selection
  };

  const getStockResultsForProvider = (promptId: string) => {
    const results = stockSearchResults[promptId];
    if (!results) return [];
    
    if (searchProvider === 'pexels') {
      return results.pexels || [];
    }
    if (searchProvider === 'pixabay') {
      return results.pixabay || [];
    }
    if (searchProvider === 'storyblocks') {
      return results.storyblocks || [];
    }
    
    return [];
  }

  // Helper to fetch stock for all prompts
  const fetchTopResults = async (force?: boolean) => {
    if (!hasGeneratedPrompts) return;
    for (const prompt of prompts) {
      if (!prompt.searchQuery) continue;
      const existing = stockSearchResults[prompt.chunkId]?.[searchProvider];
      if (!force && existing && existing.length > 0) continue; // already fetched unless force refresh

      const promptId = prompt.chunkId;
      const query = prompt.searchQuery;

      dispatch(startStockSearch({ promptId }));
      try {
        const response = await fetch(`/api/search-${searchProvider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, type: searchType }),
        });
        const data = await response.json();
        if (response.ok) {
          dispatch(setStockSearchResult({ promptId, provider: searchProvider, results: data.results }));
        } else {
          throw new Error(data.error || `${searchProvider} search failed`);
        }
      } catch (e: any) {
        dispatch(setStockSearchError({ promptId, error: e.message }));
      }
    }
  };

  // Auto fetch when provider/type changes
  useEffect(() => {
    // This is intentionally left blank to disable auto-fetching.
    // Search is now triggered manually by the search button.
  }, []);

  // Process images in batches of 5 per minute
  const generateImages = useCallback(async () => {
    if (mode !== 'generate') return;
    if (!hasGeneratedPrompts || prompts.length === 0) {
      showMessage('No prompts available for image generation', 'error')
      return
    }

    const batchSize = 5
    const batches = []
    
    // Split prompts into batches of 5
    for (let i = 0; i < prompts.length; i += batchSize) {
      batches.push(prompts.slice(i, i + batchSize))
    }
    
    // Initialize generated images state
    const initialImages: GeneratedImage[] = prompts.map((prompt: any) => ({
      promptId: prompt.chunkId,
      prompt: prompt.prompt,
      imageUrl: null,
      status: 'pending'
    }))

    dispatch(startGeneration({ 
      totalBatches: batches.length, 
      initialImages 
    }))
    dispatch(clearError())

    try {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        
        // Calculate time remaining
        const remainingBatches = batches.length - batchIndex - 1
        const timeRemainingText = remainingBatches > 0 
          ? `${remainingBatches} minute${remainingBatches !== 1 ? 's' : ''} remaining`
          : "Final batch processing..."

        dispatch(updateBatch({ 
          batchNumber: batchIndex + 1, 
          timeRemaining: timeRemainingText 
        }))

        console.log(`🚀 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} images)`)

        // Mark batch images as generating
        batch.forEach((prompt: any) => {
          dispatch(updateImageStatus({ 
            promptId: prompt.chunkId, 
            status: 'generating' 
          }))
        })

        // Process batch in parallel
        const batchPromises = batch.map(async (prompt: any) => {
          try {
            const response = await fetch('/api/generate-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                provider: provider,
                prompt: prompt.prompt,
                minimaxAspectRatio: aspectRatio,
                userId: 'script-processor-user'
              }),
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || `API error: ${response.status}`)
            }

            const data = await response.json()
            
            if (data.imageUrls && data.imageUrls[0]) {
              console.log(`✅ Generated image for prompt: ${prompt.prompt.substring(0, 30)}...`)
              dispatch(updateImageResult({
                promptId: prompt.chunkId,
                imageUrl: data.imageUrls[0],
                status: 'completed',
                mediaType: 'image'
              }))
            } else {
              throw new Error('No image URL received')
            }
          } catch (error) {
            console.error(`❌ Error generating image for prompt ${prompt.chunkId}:`, error)
            dispatch(updateImageResult({
              promptId: prompt.chunkId,
              imageUrl: null,
              status: 'error',
              error: (error as Error).message
            }))
          }
        })

        // Wait for batch to complete
        await Promise.all(batchPromises)

        // Update progress
        const completedImages = (batchIndex + 1) * batchSize
        const totalImages = prompts.length
        const progressPercent = Math.min(Math.round((completedImages / totalImages) * 100), 100)
        dispatch(updateProgress(progressPercent))

        // Wait 1 minute before next batch (except for last batch)
        if (batchIndex < batches.length - 1) {
          console.log(`⏳ Waiting 1 minute before next batch...`)
          await new Promise(resolve => setTimeout(resolve, 60000)) // 60 seconds
        }
      }

      dispatch(completeGeneration())
      showMessage(`Image generation complete! Generated ${totalGenerated}/${prompts.length} images successfully`, 'success')

    } catch (error) {
      console.error('💥 Batch generation error:', error)
      dispatch(setError((error as Error).message))
      showMessage('Failed to generate images: ' + (error as Error).message, 'error')
    }
  }, [prompts, hasGeneratedPrompts, provider, aspectRatio, totalGenerated, dispatch, mode])

  // Download all images
  const downloadImages = () => {
    const completedImages = generatedImages.filter((img: any) => img.imageUrl && img.status === 'completed')
    
    completedImages.forEach((img: any, index: number) => {
      if (img.imageUrl) {
        const link = document.createElement('a')
        link.href = img.imageUrl
        link.download = `scene-${index + 1}-image.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    })
    
    showMessage(`Downloaded ${completedImages.length} images`, 'success')
  }

  // Save all unsaved selections to Supabase
  const saveAllSelections = async () => {
    const selectionsToSave = Object.entries(pendingUploads);
    if (selectionsToSave.length === 0) {
      showMessage('Nothing to save', 'info');
      return;
    }

    showMessage(`Saving ${selectionsToSave.length} items...`, 'info');

    const savePromises = selectionsToSave.map(([promptId, asset]) => 
      fetch('/api/upload-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            assetUrl: asset.url,
            promptId: promptId,
            bucket: 'audio'
        })
      }).then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(()=>({}));
          throw new Error(errorData.error || `Upload failed for ${promptId}`);
        }
        const data = await response.json();
        dispatch(updateImageResult({
          promptId,
          imageUrl: data.publicUrl,
          status: 'completed',
          mediaType: asset.type
        }));
        return { success: true, promptId };
      }).catch((e) => {
        console.error('Failed to save asset', promptId, e);
        return { success: false, promptId };
      })
    );
    
    const results = await Promise.all(savePromises);
    const failedCount = results.filter(r => !r.success).length;

    if (failedCount === 0) {
      showMessage('All images saved!', 'success');
      setPendingUploads({});
    } else {
      showMessage(`Failed to save ${failedCount} item(s). See console for details.`, 'error');
      const successfulPromptIds = results.filter(r => r.success).map(r => r.promptId);
      setPendingUploads(current => {
          const nextUnsaved = {...current};
          for(const id of successfulPromptIds){
              delete nextUnsaved[id];
          }
          return nextUnsaved;
      });
    }
  };

  const handleNewSearch = () => {
    const promptIds = Object.keys(pendingUploads)
    dispatch(prepareForNewSearch({ promptIds }))
    setPendingUploads({})
    fetchTopResults(true)
  }

  if (!hasGeneratedPrompts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Batch Image Generator
          </CardTitle>
          <CardDescription>
            Generate images from your script prompts
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

  const completedCount = totalGenerated
  const errorCount = totalErrors
  const estimatedTime = calculateEstimatedTime(prompts.length)

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
            Generate images from {prompts.length} script prompts in batches of 5 per minute
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode selector */}
          <div className="flex items-center gap-6 mb-4">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="flex gap-6">
              <div className="flex items-center space-x-2"><RadioGroupItem value="generate" id="mode-generate"/><Label htmlFor="mode-generate">AI Generation</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="search" id="mode-search"/><Label htmlFor="mode-search">Stock Search</Label></div>
            </RadioGroup>
          </div>

          {mode === 'generate' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Image Provider</Label>
                <Select value={provider} onValueChange={(value) => dispatch(setProvider(value))}>
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
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={(value) => dispatch(setAspectRatio(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ratio) => (
                      <SelectItem key={ratio.value} value={ratio.value}>
                        {ratio.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {mode === 'search' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock Provider</Label>
                <Select value={searchProvider} onValueChange={(v) => setSearchProvider(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pexels">Pexels</SelectItem>
                    <SelectItem value="pixabay">Pixabay</SelectItem>
                    <SelectItem value="storyblocks">Storyblocks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Media Type</Label>
                <Select value={searchType} onValueChange={(v) => setSearchType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleNewSearch} className="gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </Button>
                {Object.keys(pendingUploads).length > 0 && (
                  <Button variant="secondary" onClick={saveAllSelections} className="gap-2">
                    <Download className="h-4 w-4" />
                    Save All
                  </Button>
                )}
              </div>
            </div>
          )}

          {mode === 'generate' && (
            <Button
              onClick={generateImages}
              disabled={isGenerating}
              className="w-full bg-purple-600 hover:bg-purple-700"
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
                  Generate {prompts.length} Images
                </>
              )}
            </Button>
          )}

          {isGenerating && mode === 'generate' && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <div className="flex justify-between text-sm text-gray-500">
                <span>Progress: {progress}%</span>
                {timeRemaining && <span>{timeRemaining}</span>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {(mode === 'generate' ? generatedImages.length > 0 : prompts.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {mode === 'generate' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Search className="h-5 w-5 text-blue-600" />}
                {mode === 'generate' ? 'Generated Images' : 'Stock Media Selections'}
              </div>
              <div className="flex items-center gap-2">
                {mode === 'generate' ? (
                  <>
                    <Badge variant="outline">
                      {completedCount} completed
                    </Badge>
                    {errorCount > 0 && (
                      <Badge variant="destructive">
                        {errorCount} errors
                      </Badge>
                    )}
                    {completedCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadImages}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download All
                      </Button>
                    )}
                  </>
                ) : (
                  <Badge variant="outline">
                    {Object.keys(pendingUploads).length} selected
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prompts.map((prompt: any) => {
                const img = generatedImages.find(gi => gi.promptId === prompt.chunkId) || {
                  promptId: prompt.chunkId,
                  prompt: prompt.prompt,
                  imageUrl: null,
                  status: 'pending'
                };
                const chunk = chunks.find((c: any) => c.id === prompt.chunkId);
                const currentStockResults = stockSearchResults[img.promptId];
                
                return (
                  <Card key={img.promptId} className={`flex flex-col ${img.imageUrl || pendingUploads[prompt.chunkId] ? 'border-2 border-blue-500' : ''}`}>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Scene: {chunk ? chunk.chunkIndex + 1 : 'N/A'}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2">{prompt.prompt}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      {(() => {
                        // Priority 1: Display selected and saved media (from generatedImages)
                        if (img.imageUrl) {
                          if (img.mediaType === 'video') {
                            return <video src={img.imageUrl} controls className="rounded-md object-cover aspect-video w-full" />;
                          }
                          return <img src={img.imageUrl} alt={prompt.prompt} className="rounded-md object-cover aspect-video" />;
                        }
                        
                        // Priority 2: Display unsaved selection preview from pendingUploads
                        const pendingAsset = pendingUploads[prompt.chunkId];
                        if (pendingAsset) {
                          if (pendingAsset.type === 'video') {
                             return <video src={pendingAsset.url} controls className="rounded-md object-cover aspect-video w-full" />;
                          }
                          return <img src={pendingAsset.url} alt={prompt.prompt} className="rounded-md object-cover aspect-video" />;
                        }
                        
                        // Priority 3: Show top stock result thumbnail (clickable)
                        const topStock = getStockResultsForProvider(prompt.chunkId)[0];
                        if (mode === 'search' && topStock) {
                          return (
                            <div
                              onClick={() => handleSelectStockImage(prompt.chunkId, topStock)}
                              className="relative rounded-md object-cover aspect-video cursor-pointer hover:opacity-90 group"
                            >
                              <img
                                src={topStock.thumbnail}
                                alt={topStock.photographer}
                                className="w-full h-full object-cover rounded-md"
                              />
                              {topStock.type === 'video' && (
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                      <PlayCircle className="text-white h-8 w-8 opacity-70 group-hover:opacity-100" />
                                  </div>
                              )}
                            </div>
                          );
                        }

                        if (mode === 'generate') {
                          return (
                            <div className="flex items-center justify-center bg-gray-100 rounded-md aspect-video">
                              {img.status === 'pending' && <Clock className="h-8 w-8 text-gray-400" />}
                              {img.status === 'generating' && <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />}
                              {img.status === 'error' && <AlertCircle className="h-8 w-8 text-red-500" />}
                            </div>
                          );
                        }

                        // Fallback for search mode when no stock results are available yet
                        return (
                          <div className="flex items-center justify-center bg-gray-100 rounded-md aspect-video">
                            {currentStockResults?.isSearching 
                              ? <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                              : <Camera className="h-8 w-8 text-gray-400" />}
                          </div>
                        );
                      })() as ReactNode}
                    </CardContent>

                    {/* Search query display */}
                    {prompt && (prompt as any).searchQuery && (
                      <div className="px-4 pb-2 -mt-2">
                        <span className="text-xs text-gray-500 truncate">Search: {(prompt as any).searchQuery}</span>
                      </div>
                    )}

                    {mode === 'search' && (prompt as any)?.searchQuery && (
                      <CardFooter>
                        <Dialog.Root
                          open={activeSearch?.promptId === img.promptId}
                          onOpenChange={(isOpen) => {
                            if (!isOpen) {
                              setActiveSearch(null);
                            }
                          }}
                        >
                          <Dialog.Trigger asChild>
                            <Button variant="outline" className="w-full" onClick={() => setActiveSearch({promptId: img.promptId, query: (prompt as any)?.searchQuery || ''})}>
                              <Search className="h-4 w-4 mr-2"/>
                              Find Stock Media
                            </Button>
                          </Dialog.Trigger>
                          <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                            <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
                              <Dialog.Title className="text-lg font-semibold">Stock Media for Scene {chunk ? chunk.chunkIndex + 1 : 'N/A'}</Dialog.Title>
                              <p className="text-sm text-gray-500">Search query: <span className="font-mono bg-gray-100 p-1 rounded">{(prompt as any)?.searchQuery ?? 'N/A'}</span></p>
                              
                              <div className="max-h-[60vh] overflow-y-auto">
                                {currentStockResults?.isSearching && <div className="text-center p-8"><Loader2 className="h-12 w-12 animate-spin mx-auto"/></div>}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {getStockResultsForProvider(img.promptId).map((item: StockImage) => (
                                    <div key={item.id} className="cursor-pointer group" onClick={() => handleSelectStockImage(img.promptId, item)}>
                                      <div className="relative aspect-video rounded-lg overflow-hidden">
                                        {item.type === 'video' ? (
                                          <video src={item.url} loop muted playsInline className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                        ) : (
                                          <img src={item.thumbnail} alt={item.photographer} className="w-full h-full object-cover transition-transform group-hover:scale-105"/>
                                        )}
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                          {item.type === 'video' && <PlayCircle className="text-white h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"/>}
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1 truncate">by {item.photographer}</p>
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
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Select All Top Results button in Search mode */}
      {mode === 'search' && (
        <div className="flex justify-end mb-2">
          <Button variant="secondary" size="sm" onClick={() => {
            prompts.forEach((p:any) => {
              const top = getStockResultsForProvider(p.chunkId)[0];
              if (top) handleSelectStockImage(p.chunkId, top);
            });
          }}>
            Select All Top Results
          </Button>
        </div>
      )}
    </div>
  )
} 