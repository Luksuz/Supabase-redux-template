'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { 
  startTranslation,
  setTranslationResult,
  clearTranslation,
  setTranslationError
} from '../lib/features/scripts/scriptsSlice'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { 
  Languages, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  FileText,
  Copy,
  Download,
  Trash2,
  Globe
} from 'lucide-react'

// Supported DeepL target languages
const DEEPL_LANGUAGES = [
  { code: 'AR', name: 'Arabic' },
  { code: 'BG', name: 'Bulgarian' },
  { code: 'CS', name: 'Czech' },
  { code: 'DA', name: 'Danish' },
  { code: 'DE', name: 'German' },
  { code: 'EL', name: 'Greek' },
  { code: 'EN', name: 'English' },
  { code: 'EN-GB', name: 'English (British)' },
  { code: 'EN-US', name: 'English (American)' },
  { code: 'ES', name: 'Spanish' },
  { code: 'ET', name: 'Estonian' },
  { code: 'FI', name: 'Finnish' },
  { code: 'FR', name: 'French' },
  { code: 'HU', name: 'Hungarian' },
  { code: 'ID', name: 'Indonesian' },
  { code: 'IT', name: 'Italian' },
  { code: 'JA', name: 'Japanese' },
  { code: 'KO', name: 'Korean' },
  { code: 'LT', name: 'Lithuanian' },
  { code: 'LV', name: 'Latvian' },
  { code: 'NB', name: 'Norwegian (Bokmål)' },
  { code: 'NL', name: 'Dutch' },
  { code: 'PL', name: 'Polish' },
  { code: 'PT', name: 'Portuguese' },
  { code: 'PT-BR', name: 'Portuguese (Brazilian)' },
  { code: 'PT-PT', name: 'Portuguese (European)' },
  { code: 'RO', name: 'Romanian' },
  { code: 'RU', name: 'Russian' },
  { code: 'SK', name: 'Slovak' },
  { code: 'SL', name: 'Slovenian' },
  { code: 'SV', name: 'Swedish' },
  { code: 'TR', name: 'Turkish' },
  { code: 'UK', name: 'Ukrainian' },
  { code: 'ZH', name: 'Chinese (Simplified)' }
]

export function ScriptTranslator() {
  const dispatch = useAppDispatch()
  const { sectionedWorkflow } = useAppSelector(state => state.scripts)
  const [targetLanguage, setTargetLanguage] = useState('ES') // Default to Spanish
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    // Clear message after 5 seconds
    setTimeout(() => setMessage(""), 5000)
  }

  // Check if there's a script to translate
  const hasScript = sectionedWorkflow.fullScript.trim().length > 0
  const scriptToTranslate = sectionedWorkflow.fullScript

  // Handle translation
  const handleTranslate = async () => {
    if (!hasScript) {
      showMessage('No script available to translate. Please generate a script first.', 'error')
      return
    }

    if (!targetLanguage) {
      showMessage('Please select a target language.', 'error')
      return
    }

    dispatch(startTranslation({
      text: scriptToTranslate,
      targetLanguage: targetLanguage
    }))

    showMessage(`Translating script to ${DEEPL_LANGUAGES.find(l => l.code === targetLanguage)?.name}...`, 'info')

    try {
      const response = await fetch('/api/translate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: scriptToTranslate,
          targetLanguage: targetLanguage
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to translate script')
      }

      const data = await response.json()
      
      dispatch(setTranslationResult({
        translatedText: data.translatedText,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage
      }))
      
      const targetLangName = DEEPL_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage
      showMessage(
        `Translation completed! Script translated to ${targetLangName} (${data.meta.translatedLength} characters)`, 
        'success'
      )
    } catch (error) {
      dispatch(setTranslationError())
      const errorMessage = (error as Error).message
      showMessage(`Translation failed: ${errorMessage}`, 'error')
    }
  }

  // Copy translated script to clipboard
  const copyTranslatedScript = async () => {
    try {
      await navigator.clipboard.writeText(sectionedWorkflow.translation.translatedScript)
      showMessage('Translated script copied to clipboard!', 'success')
    } catch (error) {
      showMessage('Failed to copy script', 'error')
    }
  }

  // Download translated script
  const downloadTranslatedScript = () => {
    const targetLangName = DEEPL_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage
    const content = `=== TRANSLATED SCRIPT: ${sectionedWorkflow.videoTitle} ===
Original Language: ${sectionedWorkflow.translation.sourceLanguage}
Target Language: ${targetLangName} (${sectionedWorkflow.translation.targetLanguage})
Translated on: ${sectionedWorkflow.translation.translatedAt ? new Date(sectionedWorkflow.translation.translatedAt).toLocaleString() : 'Unknown'}
Original Length: ${sectionedWorkflow.translation.originalScript.length} characters
Translated Length: ${sectionedWorkflow.translation.translatedScript.length} characters
Translation Service: DeepL

=== TRANSLATED CONTENT ===

${sectionedWorkflow.translation.translatedScript}

=== ORIGINAL CONTENT ===

${sectionedWorkflow.translation.originalScript}
`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sectionedWorkflow.videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-translated-${targetLanguage.toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showMessage(`Downloaded translated script!`, 'success')
  }

  // Clear translation
  const handleClearTranslation = () => {
    dispatch(clearTranslation())
    showMessage('Translation cleared', 'info')
  }

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Script Translator
        </CardTitle>
        <CardDescription>
          Translate your generated script to different languages using DeepL
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Translation Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="targetLanguage" className="flex items-center gap-1 mb-2">
                <Globe className="h-3 w-3" />
                Target Language
              </Label>
              <Select
                value={targetLanguage}
                onValueChange={setTargetLanguage}
                disabled={sectionedWorkflow.translation.isTranslating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEEPL_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-col justify-end">
              <Button
                onClick={handleTranslate}
                disabled={!hasScript || sectionedWorkflow.translation.isTranslating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sectionedWorkflow.translation.isTranslating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <Languages className="h-4 w-4 mr-2" />
                    Translate Script
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Script Status */}
          <div className="flex items-center gap-2">
            {hasScript ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Script available for translation ({scriptToTranslate.split(/\s+/).length.toLocaleString()} words)
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-800">
                  No script available. Please generate a script first.
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-3 rounded-lg border ${
            messageType === 'success' ? 'bg-green-50 border-green-200' :
            messageType === 'error' ? 'bg-red-50 border-red-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {messageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {messageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
              {messageType === 'info' && <Loader2 className="h-4 w-4 text-blue-600" />}
              <span className={`text-sm ${
                messageType === 'success' ? 'text-green-800' :
                messageType === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {message}
              </span>
            </div>
          </div>
        )}

        {/* Translation Result */}
        {sectionedWorkflow.translation.translatedScript && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Translation Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={copyTranslatedScript}
                  size="sm"
                  variant="outline"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  onClick={downloadTranslatedScript}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                <Button
                  onClick={handleClearTranslation}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Translation Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-center">
                <div className="text-sm font-medium text-green-800">Source Language</div>
                <div className="text-xs text-green-600">{sectionedWorkflow.translation.sourceLanguage}</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-green-800">Target Language</div>
                <div className="text-xs text-green-600">
                  {DEEPL_LANGUAGES.find(l => l.code === sectionedWorkflow.translation.targetLanguage)?.name || sectionedWorkflow.translation.targetLanguage}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-green-800">Translated</div>
                <div className="text-xs text-green-600">
                  {sectionedWorkflow.translation.translatedAt ? new Date(sectionedWorkflow.translation.translatedAt).toLocaleString() : 'Unknown'}
                </div>
              </div>
            </div>

            {/* Translated Content */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">Translated Script:</Label>
                <Badge variant="outline" className="text-xs">
                  {sectionedWorkflow.translation.translatedScript.split(/\s+/).length.toLocaleString()} words
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {sectionedWorkflow.translation.translatedScript.length.toLocaleString()} characters
                </Badge>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg max-h-96 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {sectionedWorkflow.translation.translatedScript}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!hasScript && (
          <div className="text-center py-8">
            <Languages className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Script to Translate</h3>
            <p className="text-gray-600 mb-4">
              Generate a script first, then come back here to translate it
            </p>
            <Badge variant="outline" className="text-gray-500">
              Use the "Generate Full Script" button in the Script Sections tab
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 