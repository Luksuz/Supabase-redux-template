'use client'

import { useState } from 'react'
import { Star, MessageSquare, CheckCircle, XCircle } from 'lucide-react'
import { Button } from './button'
import { Textarea } from './textarea'
import { Card, CardContent } from './card'
import { Badge } from './badge'

interface RatingComponentProps {
  title: string
  currentRating?: number
  currentNotes?: string
  isValidated?: boolean
  onRatingChange: (rating: number, notes: string, isValidated: boolean) => void
  maxRating?: number
  showValidation?: boolean
}

export function RatingComponent({
  title,
  currentRating = 0,
  currentNotes = '',
  isValidated = false,
  onRatingChange,
  maxRating = 10,
  showValidation = false
}: RatingComponentProps) {
  const [rating, setRating] = useState(currentRating)
  const [notes, setNotes] = useState(currentNotes)
  const [validated, setValidated] = useState(isValidated)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSubmit = () => {
    onRatingChange(rating, notes, validated)
    setIsExpanded(false)
  }

  const StarRating = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (value: number) => void; 
    label: string;
  }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-1">
        {[...Array(maxRating)].map((_, index) => {
          const starValue = index + 1
          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange(starValue)}
              className={`w-6 h-6 transition-colors ${
                starValue <= value
                  ? 'text-yellow-400 hover:text-yellow-500'
                  : 'text-gray-300 hover:text-gray-400'
              }`}
            >
              <Star 
                className="w-full h-full" 
                fill={starValue <= value ? 'currentColor' : 'none'}
              />
            </button>
          )
        })}
        <span className="ml-2 text-sm text-gray-600">
          {value}/{maxRating}
        </span>
      </div>
    </div>
  )

  if (!isExpanded) {
    return (
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setIsExpanded(true)}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Star className="h-4 w-4" />
          Rate {title}
        </Button>
        
        {currentRating > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {currentRating}/{maxRating}
            </Badge>
            {isValidated && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Validated
              </Badge>
            )}
            {currentNotes && (
              <Badge variant="outline" className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Has Notes
              </Badge>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Rate {title}</h4>
          <Button
            onClick={() => setIsExpanded(false)}
            variant="ghost"
            size="sm"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>

        <StarRating
          value={rating}
          onChange={setRating}
          label="Overall Quality"
        />

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Comments & Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your comments about this content..."
            className="min-h-[100px]"
          />
        </div>

        {showValidation && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="validated"
              checked={validated}
              onChange={(e) => setValidated(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="validated" className="text-sm text-gray-700">
              Mark as validated for training
            </label>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button
            onClick={() => setIsExpanded(false)}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            size="sm"
            disabled={rating === 0}
          >
            Save Rating
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 