'use client'

import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { 
  loadJobs,
  updateTextRating,
  setLoading,
  setError,
  type FineTuningJob,
  type FineTuningSection,
  type FineTuningText
} from '@/lib/features/scripts/scriptsSlice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Star, StarIcon, CheckCircle, XCircle, FileText, Filter } from 'lucide-react'

interface ReviewItemProps {
  text: FineTuningText
  section: FineTuningSection
  job: FineTuningJob
  onRatingUpdate: (textId: string, rating: number, validated: boolean, notes?: string) => void
}

function ReviewItem({ text, section, job, onRatingUpdate }: ReviewItemProps) {
  const [rating, setRating] = useState(text.quality_score || 0)
  const [validated, setValidated] = useState(text.is_validated)
  const [notes, setNotes] = useState(text.validation_notes || '')
  const [hoveredStar, setHoveredStar] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitRating = async () => {
    if (rating === 0) return

    setIsSubmitting(true)
    try {
      await onRatingUpdate(text.id, rating, validated, notes)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasChanges = 
    rating !== (text.quality_score || 0) ||
    validated !== text.is_validated ||
    notes !== (text.validation_notes || '')

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <div>
            <span className="text-blue-600">{job.name}</span>
            <span className="text-gray-400 mx-2">→</span>
            <span>{section.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {text.is_validated ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-gray-400" />
            )}
            {text.quality_score && (
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {text.quality_score}/10
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Context */}
        <div>
          <Label className="text-sm font-medium text-gray-600">Input Context</Label>
          <div className="mt-1 p-3 bg-gray-50 rounded border text-sm">
            {text.input_text}
          </div>
        </div>

        {/* Generated Script */}
        <div>
          <Label className="text-sm font-medium text-gray-600">Generated Script</Label>
          <div className="mt-1 p-4 bg-white border rounded">
            <p className="text-sm whitespace-pre-wrap">{text.generated_script}</p>
            <div className="mt-3 text-xs text-gray-500 border-t pt-2">
              {text.character_count} characters • {text.word_count} words
            </div>
          </div>
        </div>

        {/* Rating Section */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quality Rating */}
            <div>
              <Label className="text-sm font-medium">Quality Rating</Label>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`w-6 h-6 ${
                      star <= (hoveredStar || rating)
                        ? 'text-yellow-400'
                        : 'text-gray-300'
                    } hover:text-yellow-400 transition-colors`}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star className="w-full h-full fill-current" />
                  </button>
                ))}
                <span className="ml-2 text-sm text-gray-600">
                  {hoveredStar || rating}/10
                </span>
              </div>
            </div>

            {/* Validation Status */}
            <div>
              <Label className="text-sm font-medium">Validation Status</Label>
              <Select 
                value={validated ? 'approved' : 'rejected'} 
                onValueChange={(value) => setValidated(value === 'approved')}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Approved
                    </div>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Needs Work
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <Label className="text-sm font-medium">Review Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add specific feedback about quality, accuracy, style, etc."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Submit Button */}
          {hasChanges && (
            <div className="mt-4">
              <Button
                onClick={handleSubmitRating}
                disabled={rating === 0 || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Saving...' : 'Save Rating & Review'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ScriptReview() {
  const dispatch = useAppDispatch()
  const { jobs, isLoading, error } = useAppSelector((state) => state.scripts)

  const [filterStatus, setFilterStatus] = useState<'all' | 'validated' | 'unvalidated'>('all')
  const [filterRating, setFilterRating] = useState<'all' | 'high' | 'medium' | 'low' | 'unrated'>('all')

  useEffect(() => {
    loadJobsFromDB()
  }, [])

  const loadJobsFromDB = async () => {
    try {
      dispatch(setLoading(true))
      const response = await fetch('/api/fine-tuning/jobs')
      const data = await response.json()
      
      if (response.ok) {
        dispatch(loadJobs(data.jobs))
      } else {
        dispatch(setError(data.error || 'Failed to load jobs'))
      }
    } catch (error) {
      dispatch(setError('Failed to load jobs'))
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleRatingUpdate = async (textId: string, quality_score: number, is_validated: boolean, validation_notes?: string) => {
    try {
      const response = await fetch('/api/fine-tuning/texts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_id: textId,
          quality_score,
          is_validated,
          validation_notes
        })
      })

      const data = await response.json()

      if (response.ok) {
        dispatch(updateTextRating({
          textId,
          quality_score,
          is_validated,
          validation_notes
        }))
      } else {
        dispatch(setError(data.error || 'Failed to update rating'))
      }
    } catch (error) {
      dispatch(setError('Failed to update rating'))
    }
  }

  // Collect all texts from all jobs and sections
  const allTexts: Array<{
    text: FineTuningText
    section: FineTuningSection
    job: FineTuningJob
  }> = []

  jobs.forEach(job => {
    job.sections.forEach(section => {
      if (section.texts) {
        section.texts.forEach(text => {
          allTexts.push({ text, section, job })
        })
      }
    })
  })

  // Apply filters
  const filteredTexts = allTexts.filter(({ text }) => {
    // Status filter
    if (filterStatus === 'validated' && !text.is_validated) return false
    if (filterStatus === 'unvalidated' && text.is_validated) return false

    // Rating filter
    const rating = text.quality_score || 0
    if (filterRating === 'unrated' && rating > 0) return false
    if (filterRating === 'high' && rating < 8) return false
    if (filterRating === 'medium' && (rating < 5 || rating >= 8)) return false
    if (filterRating === 'low' && rating >= 5) return false

    return true
  })

  // Sort by creation date (newest first)
  filteredTexts.sort((a, b) => 
    new Date(b.text.created_at).getTime() - new Date(a.text.created_at).getTime()
  )

  const stats = {
    total: allTexts.length,
    validated: allTexts.filter(({ text }) => text.is_validated).length,
    avgRating: allTexts.length > 0 
      ? allTexts.reduce((sum, { text }) => sum + (text.quality_score || 0), 0) / allTexts.length
      : 0
  }

  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Script Review & Rating</h1>
          <p className="text-gray-600">Review and rate generated scripts to improve training data quality</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Scripts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.validated}</p>
                <p className="text-sm text-gray-600">Validated</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.avgRating.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Validation Status</Label>
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scripts</SelectItem>
                    <SelectItem value="validated">Validated Only</SelectItem>
                    <SelectItem value="unvalidated">Unvalidated Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rating Filter</Label>
                <Select value={filterRating} onValueChange={(value: any) => setFilterRating(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="unrated">Unrated</SelectItem>
                    <SelectItem value="high">High (8-10)</SelectItem>
                    <SelectItem value="medium">Medium (5-7)</SelectItem>
                    <SelectItem value="low">Low (1-4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Items */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              Scripts to Review ({filteredTexts.length})
            </h2>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Loading scripts...</p>
              </CardContent>
            </Card>
          ) : filteredTexts.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {allTexts.length === 0 
                    ? "No scripts have been generated yet. Create some fine-tuning jobs first!"
                    : "No scripts match your current filters."
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTexts.map(({ text, section, job }) => (
                <ReviewItem
                  key={text.id}
                  text={text}
                  section={section}
                  job={job}
                  onRatingUpdate={handleRatingUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 