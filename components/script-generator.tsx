'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  createNewJob, 
  startGeneratingSections, 
  setSections, 
  updateSection, 
  startGeneratingScript,
  addGeneratedText,
  startGeneratingAllScripts,
  setLoading,
  setError,
  updateSectionRating,
  updateTextRating,
  type FineTuningSection,
  setCurrentJob
} from '../lib/features/scripts/scriptsSlice'
import { initializeAuth, loginUser, logoutUser } from '../lib/features/user/userSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { RatingComponent } from './ui/rating'
import { FileText, Loader2, Edit3, Play, Download, Copy, CheckCircle, AlertCircle, User, LogOut, Lock } from 'lucide-react'

export function ScriptGenerator() {
  const dispatch = useAppDispatch()
  const { currentJob } = useAppSelector(state => state.scripts)
  const user = useAppSelector(state => state.user)
  
  // Form inputs
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [theme, setTheme] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [tone, setTone] = useState('')
  const [stylePreferences, setStylePreferences] = useState('')
  
  // Auth form inputs
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  
  // UI states
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [showAuthForm, setShowAuthForm] = useState(false)

  // Initialize auth on component mount
  useEffect(() => {
    if (!user.initialized) {
      dispatch(initializeAuth())
    }
  }, [dispatch, user.initialized])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  // Handle authentication
  const handleLogin = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      showMessage('Please enter both email and password', 'error')
      return
    }

    try {
      await dispatch(loginUser({ email: authEmail, password: authPassword })).unwrap()
      showMessage('Successfully logged in!', 'success')
      setShowAuthForm(false)
      setAuthEmail('')
      setAuthPassword('')
    } catch (error: any) {
      showMessage(error.message || 'Login failed', 'error')
    }
  }

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap()
      showMessage('Successfully logged out', 'success')
    } catch (error: any) {
      showMessage(error.message || 'Logout failed', 'error')
    }
  }

  // Create new job and generate sections (requires authentication)
  const handleCreateJob = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to create fine-tuning jobs', 'error')
      setShowAuthForm(true)
      return
    }

    if (!name.trim() || !theme.trim()) {
      showMessage('Please enter both name and theme', 'error')
      return
    }

    try {
      dispatch(setLoading(true))
      
      // Create job in database
      const response = await fetch('/api/fine-tuning/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), theme: theme.trim() })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Use the actual job returned from the API (with UUID) instead of creating a new one in Redux
        dispatch(setCurrentJob(data.job))
        showMessage('Job created successfully! Now configure sections.', 'success')
      } else {
        if (response.status === 401) {
          showMessage('Please log in to create jobs', 'error')
          setShowAuthForm(true)
        } else {
          dispatch(setError(data.error || 'Failed to create job'))
          showMessage(data.error || 'Failed to create job', 'error')
        }
      }
    } catch (error) {
      dispatch(setError('Failed to create job'))
      showMessage('Failed to create job', 'error')
    } finally {
      dispatch(setLoading(false))
    }
  }

  // Generate sections (requires authentication)
  const handleGenerateSections = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to generate sections', 'error')
      setShowAuthForm(true)
      return
    }

    if (!currentJob) return

    dispatch(startGeneratingSections())
    showMessage('Generating script sections...', 'info')

    try {
      const response = await fetch('/api/script/generate-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: currentJob.theme,
          target_audience: targetAudience,
          tone: tone,
          style_preferences: stylePreferences
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate sections')
      }

      const data = await response.json()
      
      // Save sections to database
      const sectionsResponse = await fetch('/api/fine-tuning/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: currentJob.id,
          sections: data.sections.map((section: any) => ({
            ...section,
            target_audience: targetAudience,
            tone: tone,
            style_preferences: stylePreferences
          }))
        })
      })

      const sectionsData = await sectionsResponse.json()

      if (sectionsResponse.ok) {
        dispatch(setSections(sectionsData.sections.map((section: any) => ({
          ...section,
          texts: []
        }))))
        
        showMessage(
          `Generated ${sectionsData.sections.length} sections successfully! ${data.usingMock ? '(Using mock data - Set OPENAI_API_KEY for AI generation)' : ''}`,
          'success'
        )
      } else {
        if (sectionsResponse.status === 401) {
          showMessage('Session expired. Please log in again.', 'error')
          setShowAuthForm(true)
        } else {
          dispatch(setError(sectionsData.error || 'Failed to save sections'))
          showMessage(sectionsData.error || 'Failed to save sections', 'error')
        }
      }
    } catch (error) {
      dispatch(setError('Failed to generate sections'))
      showMessage(`Failed to generate sections: ${(error as Error).message}`, 'error')
    }
  }

  // Generate full script for a single section (requires authentication)
  const handleGenerateScript = async (section: FineTuningSection) => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to generate scripts', 'error')
      setShowAuthForm(true)
      return
    }

    if (!currentJob) return

    dispatch(startGeneratingScript(section.id))
    
    try {
      const response = await fetch('/api/script/generate-full-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: section.title,
          writingInstructions: section.writing_instructions,
          theme: currentJob.theme,
          targetAudience: section.target_audience,
          tone: section.tone,
          stylePreferences: section.style_preferences
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate script')
      }

      const data = await response.json()
      
      // Save text to database
      const textResponse = await fetch('/api/fine-tuning/texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline_section_id: section.id,
          input_text: `Theme: ${currentJob.theme}\nTitle: ${section.title}\nInstructions: ${section.writing_instructions}`,
          generated_script: data.script,
          text_order: section.texts?.length || 0
        })
      })

      const textData = await textResponse.json()

      if (textResponse.ok) {
        dispatch(addGeneratedText({
          sectionId: section.id,
          text: {
            input_text: textData.text.input_text,
            generated_script: textData.text.generated_script,
            text_order: textData.text.text_order,
            is_validated: false,
            character_count: textData.text.generated_script.length,
            word_count: textData.text.generated_script.split(' ').length
          }
        }))
        
        showMessage(
          `Generated script for "${section.title}"! ${data.usingMock ? '(Mock data)' : ''}`,
          'success'
        )
      } else {
        if (textResponse.status === 401) {
          showMessage('Session expired. Please log in again.', 'error')
          setShowAuthForm(true)
        } else {
          dispatch(setError(textData.error || 'Failed to save generated text'))
          showMessage(textData.error || 'Failed to save generated text', 'error')
        }
      }
    } catch (error) {
      dispatch(setError('Failed to generate script'))
      showMessage(`Failed to generate script: ${(error as Error).message}`, 'error')
    }
  }

  // Generate all scripts at once (requires authentication)
  const handleGenerateAllScripts = async () => {
    if (!user.isLoggedIn) {
      showMessage('Please log in to generate scripts', 'error')
      setShowAuthForm(true)
      return
    }

    if (!currentJob?.sections) return

    dispatch(startGeneratingAllScripts())
    showMessage('Generating all scripts in parallel...', 'info')

    const promises = currentJob.sections.map(async (section: FineTuningSection) => {
      try {
        const response = await fetch('/api/script/generate-full-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: section.title,
            writingInstructions: section.writing_instructions,
            theme: currentJob.theme,
            targetAudience: section.target_audience,
            tone: section.tone,
            stylePreferences: section.style_preferences
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to generate script for ${section.title}`)
        }

        const data = await response.json()
        
        // Save text to database
        const textResponse = await fetch('/api/fine-tuning/texts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outline_section_id: section.id,
            input_text: `Theme: ${currentJob.theme}\nTitle: ${section.title}\nInstructions: ${section.writing_instructions}`,
            generated_script: data.script,
            text_order: section.texts?.length || 0
          })
        })

        const textData = await textResponse.json()

        if (textResponse.ok) {
          dispatch(addGeneratedText({
            sectionId: section.id,
            text: {
              input_text: textData.text.input_text,
              generated_script: textData.text.generated_script,
              text_order: textData.text.text_order,
              is_validated: false,
              character_count: textData.text.generated_script.length,
              word_count: textData.text.generated_script.split(' ').length
            }
          }))
          return { sectionId: section.id, success: true }
        } else {
          return { sectionId: section.id, error: textData.error, success: false }
        }
      } catch (error) {
        return { sectionId: section.id, error: (error as Error).message, success: false }
      }
    })

    const results = await Promise.all(promises)
    
    let successCount = 0
    results.forEach((result: any) => {
      if (result.success) {
        successCount++
      }
    })

    showMessage(
      `Generated ${successCount}/${results.length} scripts successfully!`,
      successCount === results.length ? 'success' : 'error'
    )
  }

  // Copy script to clipboard
  const copyScript = async (script: string) => {
    try {
      await navigator.clipboard.writeText(script)
      showMessage('Script copied to clipboard!', 'success')
    } catch (error) {
      showMessage('Failed to copy script', 'error')
    }
  }

  // Download all scripts
  const downloadAllScripts = () => {
    if (!currentJob) return
    
    const allScripts = currentJob.sections
      .filter((s: FineTuningSection) => s.texts && s.texts.length > 0)
      .map((s: FineTuningSection) => `=== ${s.title} ===\n\n${s.texts?.[0]?.generated_script || ''}\n\n`)
      .join('')
    
    const blob = new Blob([allScripts], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentJob.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_scripts.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showMessage('Scripts downloaded!', 'success')
  }

  // Handle section rating
  const handleSectionRating = async (
    sectionId: string,
    quality_score: number,
    rating_notes: string,
    isValidated: boolean
  ) => {
    try {
      const updates = {
        quality_score,
        rating_notes
      }

      const response = await fetch('/api/fine-tuning/sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, updates })
      })

      if (response.ok) {
        dispatch(updateSectionRating({ sectionId, ...updates }))
        showMessage('Section rating saved successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to save section rating', 'error')
      }
    } catch (error) {
      showMessage('Failed to save section rating', 'error')
    }
  }

  // Handle text rating
  const handleTextRating = async (
    textId: string,
    quality_score: number,
    validation_notes: string,
    is_validated: boolean
  ) => {
    try {
      const response = await fetch('/api/fine-tuning/texts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text_id: textId, 
          quality_score, 
          validation_notes, 
          is_validated 
        })
      })

      if (response.ok) {
        dispatch(updateTextRating({ textId, quality_score, validation_notes, is_validated }))
        showMessage('Text rating saved successfully!', 'success')
      } else {
        const data = await response.json()
        showMessage(data.error || 'Failed to save text rating', 'error')
      }
    } catch (error) {
      showMessage('Failed to save text rating', 'error')
    }
  }

  const hasGeneratedScripts = currentJob?.sections.some((s: FineTuningSection) => s.texts && s.texts.length > 0)

  // Show loading screen during auth initialization
  if (!user.initialized) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Initializing authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fine-Tuning Script Generator</h1>
          <p className="text-gray-600 mt-1">Create training data for your custom script generation model</p>
        </div>
        <div className="flex items-center gap-4">
          {/* User Status */}
          {user.isLoggedIn ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full text-sm">
                <User className="h-4 w-4 text-green-600" />
                <span className="text-green-800">{user.email}</span>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                disabled={user.loading}
                className="flex items-center gap-2"
              >
                {user.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full text-sm">
                <Lock className="h-4 w-4 text-red-600" />
                <span className="text-red-800">Not Authenticated</span>
              </div>
              <Button
                onClick={() => setShowAuthForm(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Login
              </Button>
            </div>
          )}
          
          {/* Download Button */}
          {hasGeneratedScripts && user.isLoggedIn && (
            <Button onClick={downloadAllScripts} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download All Scripts
            </Button>
          )}
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg ${
          messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          messageType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {messageType === 'success' && <CheckCircle className="h-4 w-4" />}
            {messageType === 'error' && <AlertCircle className="h-4 w-4" />}
            {messageType === 'info' && <FileText className="h-4 w-4" />}
            {message}
          </div>
        </div>
      )}

      {/* Authentication Form */}
      {showAuthForm && !user.isLoggedIn && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Login Required
            </CardTitle>
            <CardDescription>
              Please log in to create and manage fine-tuning jobs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="authEmail">Email</Label>
              <Input
                id="authEmail"
                type="email"
                placeholder="your@email.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authPassword">Password</Label>
              <Input
                id="authPassword"
                type="password"
                placeholder="Your password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleLogin}
                disabled={user.loading || !authEmail.trim() || !authPassword.trim()}
                className="flex-1"
              >
                {user.loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
              <Button 
                onClick={() => setShowAuthForm(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
            {user.error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {user.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job Creation Form */}
      {!currentJob && user.isLoggedIn && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Create New Fine-Tuning Job
            </CardTitle>
            <CardDescription>
              Define your job name, theme, and description to start generating training data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Job Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Marketing Copy Generator"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme">Theme *</Label>
                <Input
                  id="theme"
                  placeholder="e.g., Product descriptions, Blog posts"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this fine-tuning job will accomplish..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <Button 
              onClick={handleCreateJob}
              disabled={!name.trim() || !theme.trim()}
              className="w-full flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Create Fine-Tuning Job
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current Job Display */}
      {currentJob && user.isLoggedIn && (
        <>
          {/* Job Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{currentJob.name}</CardTitle>
                  <CardDescription>Theme: {currentJob.theme}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {currentJob.sectionsGenerated && (
                    <Badge variant="secondary">{currentJob.sections.length} sections</Badge>
                  )}
                  {currentJob.isGeneratingSections && (
                    <Badge variant="secondary">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Generating
                    </Badge>
                  )}
                </div>
              </div>
              {currentJob.description && (
                <p className="text-sm text-gray-600 mt-2">
                  {currentJob.description}
                </p>
              )}
            </CardHeader>
          </Card>

          {/* Section Configuration */}
          {!currentJob.sectionsGenerated && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Configure Script Sections
                </CardTitle>
                <CardDescription>
                  Set target audience, tone, and style preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetAudience">Target Audience</Label>
                    <Input
                      id="targetAudience"
                      placeholder="e.g., Young professionals"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tone">Tone</Label>
                    <Input
                      id="tone"
                      placeholder="e.g., Professional, Casual"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stylePreferences">Style Preferences</Label>
                    <Input
                      id="stylePreferences"
                      placeholder="e.g., Short sentences, bullet points"
                      value={stylePreferences}
                      onChange={(e) => setStylePreferences(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateSections}
                  disabled={currentJob.isGeneratingSections}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {currentJob.isGeneratingSections ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Sections...
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-4 w-4" />
                      Generate Script Sections
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Sections */}
          {currentJob.sectionsGenerated && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5" />
                    Script Sections
                  </CardTitle>
                  <Button 
                    onClick={handleGenerateAllScripts}
                    disabled={currentJob.sections.some((s: FineTuningSection) => s.isGeneratingScript)}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Generate All Scripts
                  </Button>
                </div>
                <CardDescription>
                  Review and edit sections, then generate training scripts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentJob.sections.map((section: FineTuningSection) => (
                    <div key={section.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Input
                            value={section.title}
                            onChange={(e) => dispatch(updateSection({ 
                              sectionId: section.id, 
                              updates: { title: e.target.value }
                            }))}
                            className="font-medium text-lg border-none p-0 focus:ring-0"
                            placeholder="Section title"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {section.texts && section.texts.length > 0 && (
                            <Button
                              onClick={() => copyScript(section.texts[0].generated_script)}
                              variant="outline"
                              size="sm"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            onClick={() => handleGenerateScript(section)}
                            disabled={section.isGeneratingScript}
                            size="sm"
                          >
                            {section.isGeneratingScript ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      <Textarea
                        value={section.writing_instructions}
                        onChange={(e) => dispatch(updateSection({ 
                          sectionId: section.id, 
                          updates: { writing_instructions: e.target.value }
                        }))}
                        placeholder="Writing instructions for this section..."
                        className="min-h-[80px]"
                      />
                      
                      {/* Section Rating */}
                      <div className="mt-3">
                        <RatingComponent
                          title="Section"
                          currentRating={section.quality_score || 0}
                          currentNotes={section.rating_notes || ''}
                          isValidated={false}
                          showValidation={false}
                          onRatingChange={(rating, notes, validated) => {
                            handleSectionRating(section.id, rating, notes, validated)
                          }}
                        />
                      </div>
                      
                      {section.texts && section.texts.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">Generated Script</span>
                            <Badge variant="secondary">{section.texts.length} version(s)</Badge>
                          </div>
                          <div className="bg-white rounded p-3 text-sm whitespace-pre-wrap border">
                            {section.texts[0].generated_script}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            {section.texts[0].character_count} characters • {section.texts[0].word_count} words
                          </div>
                          
                          {/* Text Rating */}
                          <div className="mt-3">
                            <RatingComponent
                              title="Generated Text"
                              currentRating={section.texts[0].quality_score || 0}
                              currentNotes={section.texts[0].validation_notes || ''}
                              isValidated={section.texts[0].is_validated || false}
                              showValidation={true}
                              onRatingChange={(rating, notes, validated) => {
                                if (section.texts[0].id) {
                                  handleTextRating(section.texts[0].id, rating, notes, validated)
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty State */}
      {!currentJob && user.isLoggedIn && (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Start Your First Fine-Tuning Job</h3>
            <p className="text-gray-500 mb-4">
              Create a fine-tuning job to generate training data for your custom script generation model.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Unauthenticated State */}
      {!user.isLoggedIn && !showAuthForm && (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lock className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-500 mb-4">
              Please log in to access the fine-tuning script generator.
            </p>
            <Button 
              onClick={() => setShowAuthForm(true)}
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Login to Continue
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 