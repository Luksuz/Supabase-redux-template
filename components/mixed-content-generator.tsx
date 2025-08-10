'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { StaggerContainer, StaggerItem, ScaleOnHover } from './animated-page'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { 
  Image, 
  Video, 
  Zap, 
  GripVertical, 
  Trash2, 
  Play, 
  ArrowUp, 
  ArrowDown,
  Shuffle,
  Eye,
  Download
} from 'lucide-react'
import { setSelectedImagesOrder } from '@/lib/features/imageGeneration/imageGenerationSlice'

interface ContentItem {
  id: string
  type: 'animation' | 'image' | 'video'
  title: string
  url: string
  thumbnail?: string
  duration?: number
  order: number
  source: string // Which generator it came from
}

export function MixedContentGenerator() {
  const dispatch = useAppDispatch()
  
  // Get content from all generators
  const { imageSets } = useAppSelector(state => state.imageGeneration)
  const { currentBatch: videoBatch, videoHistory } = useAppSelector(state => state.textImageVideo)
  
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  // Collect all content from different sources
  useEffect(() => {
    const items: ContentItem[] = []
    let orderCounter = 0

    // Add animation results (from all-animation-results set)
    const animationSet = imageSets.find(set => set.id === 'all-animation-results')
    if (animationSet) {
      animationSet.images.forEach((image) => {
        items.push({
          id: `animation-${image.id}`,
          type: 'animation',
          title: image.prompt || 'Animation',
          url: image.url,
          thumbnail: image.url,
          order: orderCounter++,
          source: 'Animation Generator'
        })
      })
    }

    // Add regular images (excluding animation results)
    imageSets
      .filter(set => set.id !== 'all-animation-results')
      .forEach(set => {
        set.images.forEach((image) => {
          items.push({
            id: `image-${image.id}`,
            type: 'image',
            title: image.prompt || `Image from ${set.name}`,
            url: image.url,
            thumbnail: image.url,
            order: orderCounter++,
            source: set.name
          })
        })
      })

    // Add generated videos
    if (videoBatch) {
      videoBatch.videos.forEach((video) => {
        items.push({
          id: `video-${video.id}`,
          type: 'video',
          title: video.prompt || 'Generated Video',
          url: video.url || '',
          thumbnail: video.thumbnail,
          duration: video.duration,
          order: orderCounter++,
          source: 'Text/Image to Video Generator'
        })
      })
    }

    // Add video history items
    videoHistory.forEach((batch, batchIndex) => {
      batch.videos.forEach((video, videoIndex) => {
        items.push({
          id: `history-video-${batchIndex}-${videoIndex}`,
          type: 'video',
          title: video.prompt || 'Historical Video',
          url: video.url || '',
          thumbnail: video.thumbnail,
          duration: video.duration,
          order: orderCounter++,
          source: 'Video History'
        })
      })
    })

    setContentItems(items.sort((a, b) => a.order - b.order))
  }, [imageSets, videoBatch, videoHistory])

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newItems = [...contentItems]
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)
    
    // Update order numbers
    const reorderedItems = newItems.map((item, index) => ({
      ...item,
      order: index
    }))
    
    setContentItems(reorderedItems)
    updateVideoGeneratorOrder(reorderedItems)
  }

  const updateVideoGeneratorOrder = (items: ContentItem[]) => {
    // Create order array for video generator
    const imageOrder = items
      .filter(item => item.type === 'animation' || item.type === 'image')
      .map(item => {
        if (item.type === 'animation') {
          return { 
            id: item.id.replace('animation-', ''), 
            setId: 'all-animation-results',
            type: 'animation' as const
          }
        } else {
          return { 
            id: item.id.replace('image-', ''), 
            setId: item.source,
            type: 'image' as const
          }
        }
      })
    
    dispatch(setSelectedImagesOrder(imageOrder))
  }

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      handleReorder(index, index - 1)
    }
  }

  const handleMoveDown = (index: number) => {
    if (index < contentItems.length - 1) {
      handleReorder(index, index + 1)
    }
  }

  const handleRemove = (id: string) => {
    const newItems = contentItems
      .filter(item => item.id !== id)
      .map((item, index) => ({ ...item, order: index }))
    
    setContentItems(newItems)
    updateVideoGeneratorOrder(newItems)
  }

  const handleShuffle = () => {
    const shuffled = [...contentItems]
      .sort(() => Math.random() - 0.5)
      .map((item, index) => ({ ...item, order: index }))
    
    setContentItems(shuffled)
    updateVideoGeneratorOrder(shuffled)
  }

  const getTypeIcon = (type: ContentItem['type']) => {
    switch (type) {
      case 'animation': return <Zap className="h-4 w-4" />
      case 'image': return <Image className="h-4 w-4" />
      case 'video': return <Video className="h-4 w-4" />
    }
  }

  const getTypeBadgeColor = (type: ContentItem['type']) => {
    switch (type) {
      case 'animation': return 'bg-purple-500'
      case 'image': return 'bg-blue-500'
      case 'video': return 'bg-green-500'
    }
  }

  return (
    <StaggerContainer className="flex-1 p-6 space-y-6">
      {/* Header */}
      <StaggerItem>
        <motion.div 
          className="space-y-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-3xl font-bold text-white">Mixed Content Generator</h1>
          <p className="text-gray-300">
            Organize and arrange all your generated content (animations, images, videos) in the perfect sequence for video creation
          </p>
        </motion.div>
      </StaggerItem>

      {/* Controls */}
      <StaggerItem>
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shuffle className="h-5 w-5" />
              Content Organization
            </CardTitle>
            <CardDescription className="text-gray-300">
              Drag and drop or use buttons to reorder your content. The order here will be applied to the video generator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <ScaleOnHover>
                <Button 
                  onClick={handleShuffle}
                  variant="outline"
                  className="gap-2"
                >
                  <Shuffle className="h-4 w-4" />
                  Shuffle Order
                </Button>
              </ScaleOnHover>
              <ScaleOnHover>
                <Button 
                  onClick={() => updateVideoGeneratorOrder(contentItems)}
                  className="gap-2 glow-button"
                >
                  <Play className="h-4 w-4" />
                  Apply to Video Generator
                </Button>
              </ScaleOnHover>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Content Statistics */}
      <StaggerItem>
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-purple-900/20 border-purple-600">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-400" />
                <div>
                  <div className="text-sm text-purple-300">Animations</div>
                  <div className="text-2xl font-bold text-white">
                    {contentItems.filter(item => item.type === 'animation').length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-900/20 border-blue-600">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Image className="h-5 w-5 text-blue-400" />
                <div>
                  <div className="text-sm text-blue-300">Images</div>
                  <div className="text-2xl font-bold text-white">
                    {contentItems.filter(item => item.type === 'image').length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-900/20 border-green-600">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-green-400" />
                <div>
                  <div className="text-sm text-green-300">Videos</div>
                  <div className="text-2xl font-bold text-white">
                    {contentItems.filter(item => item.type === 'video').length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </StaggerItem>

      {/* Content List */}
      <StaggerItem>
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Content Sequence ({contentItems.length} items)</CardTitle>
            <CardDescription className="text-gray-300">
              Arrange your content in the order you want it to appear in your video
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contentItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="mb-4">
                  <Image className="h-16 w-16 mx-auto opacity-50" />
                </div>
                <p>No content available yet.</p>
                <p className="text-sm mt-2">Generate some animations, images, or videos first!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {contentItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex items-center gap-4 p-4 bg-gray-700 border border-gray-600 rounded-lg"
                    >
                      {/* Drag Handle */}
                      <div className="cursor-move text-gray-400 hover:text-gray-200">
                        <GripVertical className="h-5 w-5" />
                      </div>

                      {/* Order Number */}
                      <div className="flex items-center justify-center w-8 h-8 bg-gray-600 rounded-full text-sm font-bold text-white">
                        {index + 1}
                      </div>

                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-600 flex items-center justify-center">
                        {item.thumbnail ? (
                          <img 
                            src={item.thumbnail} 
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getTypeIcon(item.type)
                        )}
                      </div>

                      {/* Content Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${getTypeBadgeColor(item.type)} text-white text-xs`}>
                            {getTypeIcon(item.type)}
                            <span className="ml-1 capitalize">{item.type}</span>
                          </Badge>
                          <span className="text-xs text-gray-400">from {item.source}</span>
                        </div>
                        <h3 className="font-medium text-white truncate">{item.title}</h3>
                        {item.duration && (
                          <p className="text-xs text-gray-400">{item.duration}s</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <ScaleOnHover scale={1.1}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(item.url, '_blank')}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </ScaleOnHover>
                        
                        <ScaleOnHover scale={1.1}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white disabled:opacity-50"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                        </ScaleOnHover>
                        
                        <ScaleOnHover scale={1.1}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === contentItems.length - 1}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white disabled:opacity-50"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </ScaleOnHover>
                        
                        <ScaleOnHover scale={1.1}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemove(item.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ScaleOnHover>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  )
}
