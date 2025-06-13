'use client'

import { useState, useEffect } from 'react'
import { Prompt } from '../types/prompt'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Trash2, Edit, Plus, Copy, Eye } from 'lucide-react'

interface PromptManagerProps {
  onSelectPrompt?: (prompt: Prompt) => void
  selectedPromptId?: string
  showSelector?: boolean
}

export default function PromptManager({ onSelectPrompt, selectedPromptId, showSelector = false }: PromptManagerProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [formData, setFormData] = useState({ title: '', prompt: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null)

  // Simple toast replacement
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    alert(`${type === 'success' ? '✅' : '❌'} ${message}`)
  }

  // Fetch prompts
  const fetchPrompts = async () => {
    try {
      const response = await fetch('/api/prompts')
      const data = await response.json()
      
      if (data.success) {
        setPrompts(data.prompts)
      } else {
        showToast('Failed to fetch prompts', 'error')
      }
    } catch (error) {
      console.error('Error fetching prompts:', error)
      showToast('Failed to fetch prompts', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrompts()
  }, [])

  // Create or update prompt
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = editingPrompt ? `/api/prompts/${editingPrompt.id}` : '/api/prompts'
      const method = editingPrompt ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        showToast(editingPrompt ? 'Prompt updated!' : 'Prompt created!')
        setIsDialogOpen(false)
        setEditingPrompt(null)
        setFormData({ title: '', prompt: '' })
        fetchPrompts()
      } else {
        showToast(data.error || 'Failed to save prompt', 'error')
      }
    } catch (error) {
      console.error('Error saving prompt:', error)
      showToast('Failed to save prompt', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete prompt
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return

    try {
      const response = await fetch(`/api/prompts/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        showToast('Prompt deleted!')
        fetchPrompts()
      } else {
        showToast(data.error || 'Failed to delete prompt', 'error')
      }
    } catch (error) {
      console.error('Error deleting prompt:', error)
      showToast('Failed to delete prompt', 'error')
    }
  }

  // Copy prompt to clipboard
  const handleCopy = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      showToast('Prompt copied to clipboard!')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      showToast('Failed to copy prompt', 'error')
    }
  }

  // Open edit dialog
  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setFormData({ title: prompt.title, prompt: prompt.prompt })
    setIsDialogOpen(true)
  }

  // Open create dialog
  const handleCreate = () => {
    setEditingPrompt(null)
    setFormData({ title: '', prompt: '' })
    setIsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading prompts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prompt Manager</h2>
          <p className="text-muted-foreground">Create and manage your script generation prompts</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Prompt
        </Button>
      </div>

      {prompts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-2">No prompts yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first prompt to get started with custom script generation
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Prompt
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {prompts.map((prompt) => (
            <Card 
              key={prompt.id} 
              className={`relative ${selectedPromptId === prompt.id ? 'ring-2 ring-blue-500' : ''} ${
                showSelector ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
              }`}
              onClick={showSelector && onSelectPrompt ? () => onSelectPrompt(prompt) : undefined}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{prompt.title}</CardTitle>
                    <CardDescription className="text-sm">
                      Created {new Date(prompt.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  {selectedPromptId === prompt.id && showSelector && (
                    <Badge variant="secondary" className="ml-2">Selected</Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {prompt.prompt.substring(0, 150)}...
                </p>
              </CardContent>

              <CardFooter className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setViewingPrompt(prompt)
                  }}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopy(prompt.prompt)
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {!showSelector && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(prompt)
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(prompt.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
            </DialogTitle>
            <DialogDescription>
              {editingPrompt ? 'Update your prompt details' : 'Create a new prompt for script generation'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter prompt title..."
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="prompt">Prompt Content</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="Enter your prompt content..."
                required
                rows={12}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Write your complete prompt including instructions, style guide, and any placeholders.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingPrompt ? 'Update Prompt' : 'Create Prompt'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingPrompt} onOpenChange={() => setViewingPrompt(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewingPrompt?.title}</DialogTitle>
            <DialogDescription>
              Created {viewingPrompt ? new Date(viewingPrompt.created_at).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-auto">
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md">
              {viewingPrompt?.prompt}
            </pre>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => viewingPrompt && handleCopy(viewingPrompt.prompt)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Prompt
            </Button>
            <Button onClick={() => setViewingPrompt(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 