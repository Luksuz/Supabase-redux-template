'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { 
  Loader2, 
  Edit2, 
  Trash2, 
  Plus, 
  Save, 
  X, 
  FileText, 
  Calendar,
  Target,
  Palette,
  Settings,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  User,
  Hash,
  BookOpen,
  Briefcase
} from 'lucide-react'

interface FineTuningJob {
  id: string
  name: string
  description?: string
  theme: string
  model_name: string
  total_sections: number
  completed_sections: number
  total_training_examples: number
  prompt_used?: string
  created_at: string
  updated_at: string
  sections: FineTuningSection[]
}

interface FineTuningSection {
  id: string
  job_id: string
  title: string
  writing_instructions: string
  target_audience?: string
  tone?: string
  style_preferences?: string
  section_order: number
  is_completed: boolean
  training_examples_count: number
  texts?: any[]
}

export function JobsSidebar() {
  const user = useAppSelector(state => state.user)
  const [jobs, setJobs] = useState<FineTuningJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  
  // Selection states
  const [selectedJob, setSelectedJob] = useState<FineTuningJob | null>(null)
  const [selectedSection, setSelectedSection] = useState<FineTuningSection | null>(null)
  
  // Edit states
  const [editingJob, setEditingJob] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editJobData, setEditJobData] = useState<Partial<FineTuningJob>>({})
  const [editSectionData, setEditSectionData] = useState<Partial<FineTuningSection>>({})
  
  // UI states
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [deletingJob, setDeletingJob] = useState<string | null>(null)
  const [deletingSection, setDeletingSection] = useState<string | null>(null)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const fetchJobs = async () => {
    if (!user.isLoggedIn) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/fine-tuning/jobs')
      const data = await response.json()

      if (response.ok && data.jobs) {
        setJobs(data.jobs)
        // Auto-select first job if none selected
        if (!selectedJob && data.jobs.length > 0) {
          setSelectedJob(data.jobs[0])
        }
      } else {
        showMessage('Failed to fetch jobs', 'error')
      }
    } catch (error) {
      showMessage('Failed to fetch jobs', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const selectJob = (job: FineTuningJob) => {
    setSelectedJob(job)
    setSelectedSection(null)
    // Auto-expand the selected job
    setExpandedJobs(prev => new Set([...prev, job.id]))
  }

  const selectSection = (section: FineTuningSection) => {
    setSelectedSection(section)
    // Find and select the parent job
    const parentJob = jobs.find(job => job.id === section.job_id)
    if (parentJob) {
      setSelectedJob(parentJob)
    }
  }

  const toggleJobExpansion = (jobId: string) => {
    const newExpanded = new Set(expandedJobs)
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId)
    } else {
      newExpanded.add(jobId)
    }
    setExpandedJobs(newExpanded)
  }

  const startEditingJob = (job: FineTuningJob) => {
    setEditingJob(job.id)
    setEditJobData({
      name: job.name,
      description: job.description,
      theme: job.theme
    })
  }

  const startEditingSection = (section: FineTuningSection) => {
    setEditingSection(section.id)
    setEditSectionData({
      title: section.title,
      writing_instructions: section.writing_instructions,
      target_audience: section.target_audience,
      tone: section.tone,
      style_preferences: section.style_preferences
    })
  }

  const saveJobEdit = async () => {
    if (!editingJob || !editJobData.name?.trim() || !editJobData.theme?.trim()) {
      showMessage('Name and theme are required', 'error')
      return
    }

    try {
      const response = await fetch(`/api/fine-tuning/jobs/${editingJob}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editJobData)
      })

      if (response.ok) {
        showMessage('Job updated successfully', 'success')
        setEditingJob(null)
        setEditJobData({})
        fetchJobs()
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to update job', 'error')
      }
    } catch (error) {
      showMessage('Failed to update job', 'error')
    }
  }

  const saveSectionEdit = async () => {
    if (!editingSection || !editSectionData.title?.trim() || !editSectionData.writing_instructions?.trim()) {
      showMessage('Title and writing instructions are required', 'error')
      return
    }

    try {
      const response = await fetch('/api/fine-tuning/sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: editingSection,
          updates: editSectionData
        })
      })

      if (response.ok) {
        showMessage('Section updated successfully', 'success')
        setEditingSection(null)
        setEditSectionData({})
        fetchJobs()
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to update section', 'error')
      }
    } catch (error) {
      showMessage('Failed to update section', 'error')
    }
  }

  const deleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This will also delete all its sections and texts.')) {
      return
    }

    setDeletingJob(jobId)
    try {
      const response = await fetch(`/api/fine-tuning/jobs/${jobId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showMessage('Job deleted successfully', 'success')
        // Clear selection if deleted job was selected
        if (selectedJob?.id === jobId) {
          setSelectedJob(null)
          setSelectedSection(null)
        }
        fetchJobs()
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to delete job', 'error')
      }
    } catch (error) {
      showMessage('Failed to delete job', 'error')
    } finally {
      setDeletingJob(null)
    }
  }

  const deleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section? This will also delete all its texts.')) {
      return
    }

    setDeletingSection(sectionId)
    try {
      const response = await fetch(`/api/fine-tuning/sections/${sectionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showMessage('Section deleted successfully', 'success')
        // Clear section selection if deleted section was selected
        if (selectedSection?.id === sectionId) {
          setSelectedSection(null)
        }
        fetchJobs()
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to delete section', 'error')
      }
    } catch (error) {
      showMessage('Failed to delete section', 'error')
    } finally {
      setDeletingSection(null)
    }
  }

  const cancelEdit = () => {
    setEditingJob(null)
    setEditingSection(null)
    setEditJobData({})
    setEditSectionData({})
  }

  useEffect(() => {
    fetchJobs()
  }, [user.isLoggedIn])

  if (!user.isLoggedIn) {
    return (
      <div className="flex h-full">
        <div className="w-80 bg-white border-r border-gray-200 p-4">
          <Card className="border-2 border-dashed border-gray-200">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-8 w-8 text-gray-400 mb-3" />
              <h3 className="font-medium text-gray-900 mb-1">Authentication Required</h3>
              <p className="text-sm text-gray-500">
                Please log in to view jobs.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="flex-1 bg-gray-50"></div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Job List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Fine-Tuning Jobs</h2>
              <p className="text-sm text-gray-500">{jobs.length} jobs total</p>
            </div>
            <Button
              onClick={fetchJobs}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mx-4 mt-4 p-3 rounded-lg text-sm ${
            messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            messageType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {messageType === 'success' && <CheckCircle className="h-4 w-4" />}
              {messageType === 'error' && <AlertCircle className="h-4 w-4" />}
              {messageType === 'info' && <AlertCircle className="h-4 w-4" />}
              {message}
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : jobs.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-8 w-8 text-gray-400 mb-3" />
                <h3 className="font-medium text-gray-900 mb-1">No Jobs Found</h3>
                <p className="text-sm text-gray-500">
                  Create your first fine-tuning job to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <Card 
                key={job.id} 
                className={`overflow-hidden cursor-pointer transition-all ${
                  selectedJob?.id === job.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => selectJob(job)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-sm font-medium truncate">{job.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {job.sections?.length || 0}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mb-1 truncate">{job.theme}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {job.total_training_examples}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleJobExpansion(job.id)
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        {expandedJobs.has(job.id) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Sections */}
                {expandedJobs.has(job.id) && job.sections && job.sections.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {job.sections
                        .sort((a, b) => a.section_order - b.section_order)
                        .map((section) => (
                          <div 
                            key={section.id} 
                            className={`border rounded-lg p-2 text-xs cursor-pointer transition-all ${
                              selectedSection?.id === section.id 
                                ? 'border-blue-500 bg-blue-100' 
                                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              selectSection(section)
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium truncate">{section.title}</h4>
                                  <Badge variant="outline" className="text-xs h-4">
                                    {section.training_examples_count}
                                  </Badge>
                                </div>
                                <p className="text-gray-600 line-clamp-1">
                                  {section.writing_instructions}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Detailed View */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {selectedSection ? (
          <SectionDetailView 
            section={selectedSection}
            job={selectedJob!}
            onEdit={startEditingSection}
            onDelete={deleteSection}
            editingSection={editingSection}
            editSectionData={editSectionData}
            setEditSectionData={setEditSectionData}
            onSave={saveSectionEdit}
            onCancel={cancelEdit}
            deletingSection={deletingSection}
          />
        ) : selectedJob ? (
          <JobDetailView 
            job={selectedJob}
            onEdit={startEditingJob}
            onDelete={deleteJob}
            editingJob={editingJob}
            editJobData={editJobData}
            setEditJobData={setEditJobData}
            onSave={saveJobEdit}
            onCancel={cancelEdit}
            deletingJob={deletingJob}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Job or Section</h3>
              <p className="text-gray-500">
                Choose a job from the sidebar to view detailed information
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Job Detail View Component
function JobDetailView({ 
  job, 
  onEdit, 
  onDelete, 
  editingJob, 
  editJobData, 
  setEditJobData, 
  onSave, 
  onCancel, 
  deletingJob 
}: {
  job: FineTuningJob
  onEdit: (job: FineTuningJob) => void
  onDelete: (jobId: string) => void
  editingJob: string | null
  editJobData: Partial<FineTuningJob>
  setEditJobData: (data: Partial<FineTuningJob>) => void
  onSave: () => void
  onCancel: () => void
  deletingJob: string | null
}) {
  const isEditing = editingJob === job.id

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Briefcase className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>
            </div>
            <p className="text-gray-600">Manage your fine-tuning job configuration and sections</p>
          </div>
          
          {!isEditing && (
            <div className="flex gap-2">
              <Button onClick={() => onEdit(job)} variant="outline">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Job
              </Button>
              <Button 
                onClick={() => onDelete(job.id)}
                disabled={deletingJob === job.id}
                variant="destructive"
              >
                {deletingJob === job.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Job
              </Button>
            </div>
          )}
        </div>

        {/* Job Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Job Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Job Name *</Label>
                    <Input
                      value={editJobData.name || ''}
                      onChange={(e) => setEditJobData({ ...editJobData, name: e.target.value })}
                      placeholder="Enter job name"
                    />
                  </div>
                  <div>
                    <Label>Theme *</Label>
                    <Input
                      value={editJobData.theme || ''}
                      onChange={(e) => setEditJobData({ ...editJobData, theme: e.target.value })}
                      placeholder="Enter job theme"
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={editJobData.description || ''}
                    onChange={(e) => setEditJobData({ ...editJobData, description: e.target.value })}
                    placeholder="Enter job description (optional)"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={onSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button onClick={onCancel} variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Job Name</Label>
                    <p className="text-lg font-semibold text-gray-900">{job.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Theme</Label>
                    <p className="text-gray-900">{job.theme}</p>
                  </div>
                  {job.description && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Description</Label>
                      <p className="text-gray-900">{job.description}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Hash className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Sections</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{job.total_sections}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">Texts</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{job.total_training_examples}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Created</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900">{new Date(job.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Model</Label>
                    <p className="text-gray-900">{job.model_name}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sections Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Sections Overview</CardTitle>
            <p className="text-sm text-gray-600">
              {job.sections?.length || 0} sections in this job
            </p>
          </CardHeader>
          <CardContent>
            {job.sections && job.sections.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {job.sections
                  .sort((a, b) => a.section_order - b.section_order)
                  .map((section) => (
                    <div key={section.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{section.title}</h4>
                        <Badge variant={section.is_completed ? "default" : "secondary"}>
                          {section.training_examples_count} texts
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {section.writing_instructions}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {section.target_audience && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Target className="h-3 w-3" />
                            <span>{section.target_audience}</span>
                          </div>
                        )}
                        {section.tone && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Palette className="h-3 w-3" />
                            <span>{section.tone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No sections found in this job</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Section Detail View Component
function SectionDetailView({ 
  section, 
  job, 
  onEdit, 
  onDelete, 
  editingSection, 
  editSectionData, 
  setEditSectionData, 
  onSave, 
  onCancel, 
  deletingSection 
}: {
  section: FineTuningSection
  job: FineTuningJob
  onEdit: (section: FineTuningSection) => void
  onDelete: (sectionId: string) => void
  editingSection: string | null
  editSectionData: Partial<FineTuningSection>
  setEditSectionData: (data: Partial<FineTuningSection>) => void
  onSave: () => void
  onCancel: () => void
  deletingSection: string | null
}) {
  const isEditing = editingSection === section.id

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-6 w-6 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Section Details</h1>
            </div>
            <p className="text-gray-600">
              Section from <span className="font-medium">{job.name}</span>
            </p>
          </div>
          
          {!isEditing && (
            <div className="flex gap-2">
              <Button onClick={() => onEdit(section)} variant="outline">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Section
              </Button>
              <Button 
                onClick={() => onDelete(section.id)}
                disabled={deletingSection === section.id}
                variant="destructive"
              >
                {deletingSection === section.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Section
              </Button>
            </div>
          )}
        </div>

        {/* Section Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Section Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label>Section Title *</Label>
                  <Input
                    value={editSectionData.title || ''}
                    onChange={(e) => setEditSectionData({ ...editSectionData, title: e.target.value })}
                    placeholder="Enter section title"
                  />
                </div>
                <div>
                  <Label>Writing Instructions *</Label>
                  <Textarea
                    value={editSectionData.writing_instructions || ''}
                    onChange={(e) => setEditSectionData({ ...editSectionData, writing_instructions: e.target.value })}
                    placeholder="Enter detailed writing instructions"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Target Audience</Label>
                    <Input
                      value={editSectionData.target_audience || ''}
                      onChange={(e) => setEditSectionData({ ...editSectionData, target_audience: e.target.value })}
                      placeholder="e.g., Tech professionals"
                    />
                  </div>
                  <div>
                    <Label>Tone</Label>
                    <Input
                      value={editSectionData.tone || ''}
                      onChange={(e) => setEditSectionData({ ...editSectionData, tone: e.target.value })}
                      placeholder="e.g., Professional, Casual"
                    />
                  </div>
                  <div>
                    <Label>Style Preferences</Label>
                    <Input
                      value={editSectionData.style_preferences || ''}
                      onChange={(e) => setEditSectionData({ ...editSectionData, style_preferences: e.target.value })}
                      placeholder="e.g., Concise, Detailed"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={onSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button onClick={onCancel} variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Section Title</Label>
                  <p className="text-xl font-semibold text-gray-900 mt-1">{section.title}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-500">Writing Instructions</Label>
                  <div className="mt-1 p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap">{section.writing_instructions}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Target Audience</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Target className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900">{section.target_audience || 'Not specified'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Tone</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Palette className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900">{section.tone || 'Not specified'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Style Preferences</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Settings className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900">{section.style_preferences || 'Not specified'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Order</span>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{section.section_order + 1}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Texts</span>
                    </div>
                    <p className="text-xl font-bold text-green-600">{section.training_examples_count}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${section.is_completed ? 'bg-green-50' : 'bg-yellow-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className={`h-4 w-4 ${section.is_completed ? 'text-green-600' : 'text-yellow-600'}`} />
                      <span className={`text-sm font-medium ${section.is_completed ? 'text-green-900' : 'text-yellow-900'}`}>Status</span>
                    </div>
                    <p className={`text-sm font-bold ${section.is_completed ? 'text-green-600' : 'text-yellow-600'}`}>
                      {section.is_completed ? 'Completed' : 'In Progress'}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">Job</span>
                    </div>
                    <p className="text-sm font-bold text-purple-600 truncate">{job.name}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training Texts (if any) */}
        {section.texts && section.texts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Training Texts</CardTitle>
              <p className="text-sm text-gray-600">
                {section.texts.length} training examples for this section
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {section.texts.slice(0, 3).map((text, index) => (
                  <div key={text.id || index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">Text #{index + 1}</h4>
                      {text.quality_score && (
                        <Badge variant="outline">
                          Score: {text.quality_score}/10
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Input</Label>
                        <p className="text-sm text-gray-900 mt-1 line-clamp-3">{text.input_text}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Generated Script</Label>
                        <p className="text-sm text-gray-900 mt-1 line-clamp-3">{text.generated_script}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {section.texts.length > 3 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">
                      And {section.texts.length - 3} more training examples...
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 