'use client'

import { useState, useRef } from 'react'
import { useAppSelector } from '../lib/hooks'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { 
  Languages, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Upload,
  Copy,
  Download,
  Trash2,
  Globe,
  FileText,
  X
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

export function DocumentTranslator() {
  const { sectionedWorkflow } = useAppSelector(state => state.scripts)
  const [inputText, setInputText] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('ES') // Default to Spanish
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationResult, setTranslationResult] = useState<{
    translatedText: string
    sourceLanguage: string
    targetLanguage: string
    originalText: string
    translatedAt: string
  } | null>(null)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(""), 5000)
  }

  // Import script from Script Generator
  const importFromScriptGenerator = () => {
    const script = sectionedWorkflow.fullScript
    if (script && script.trim().length > 0) {
      setInputText(script)
      showMessage('Script imported from Script Generator!', 'success')
    } else {
      showMessage('No script available in Script Generator', 'error')
    }
  }

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadedFileName(file.name)

    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    if (fileExtension === 'txt') {
      // Handle .txt file
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        setInputText(text)
        showMessage(`Loaded ${file.name} (${text.length} characters)`, 'success')
      }
      reader.readAsText(file)
    } else if (fileExtension === 'docx') {
      // Handle .docx file using the backend API
      const formData = new FormData()
      formData.append('file', file)

      try {
        showMessage('Processing DOCX file...', 'info')
        const response = await fetch('/api/extract-docx-text', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to process DOCX file')
        }

        const data = await response.json()
        setInputText(data.text)
        showMessage(`Loaded ${file.name} (${data.length} characters)`, 'success')
      } catch (error) {
        showMessage('Failed to process DOCX file: ' + (error as Error).message, 'error')
        setUploadedFileName(null)
      }
    } else {
      showMessage('Please upload a .txt or .docx file', 'error')
      setUploadedFileName(null)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Clear uploaded file
  const clearUploadedFile = () => {
    setUploadedFileName(null)
    setInputText('')
    showMessage('Content cleared', 'info')
  }

  // Handle translation
  const handleTranslate = async () => {
    if (!inputText || inputText.trim().length === 0) {
      showMessage('Please enter or upload text to translate', 'error')
      return
    }

    if (!targetLanguage) {
      showMessage('Please select a target language', 'error')
      return
    }

    setIsTranslating(true)
    showMessage(`Translating to ${DEEPL_LANGUAGES.find(l => l.code === targetLanguage)?.name}...`, 'info')

    try {
      const response = await fetch('/api/translate-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          targetLang: targetLanguage
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to translate document')
      }

      const data = await response.json()
      
      setTranslationResult({
        translatedText: data.translatedText,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        originalText: inputText,
        translatedAt: new Date().toISOString()
      })
      
      const targetLangName = DEEPL_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage
      showMessage(
        `Translation completed! Document translated to ${targetLangName} (${data.translatedLength} characters)`, 
        'success'
      )
    } catch (error) {
      const errorMessage = (error as Error).message
      showMessage(`Translation failed: ${errorMessage}`, 'error')
    } finally {
      setIsTranslating(false)
    }
  }

  // Copy translated text to clipboard
  const copyTranslatedText = async () => {
    if (!translationResult) return
    try {
      await navigator.clipboard.writeText(translationResult.translatedText)
      showMessage('Translated text copied to clipboard!', 'success')
    } catch (error) {
      showMessage('Failed to copy text', 'error')
    }
  }

  // Download translated text
  const downloadTranslatedText = () => {
    if (!translationResult) return

    const targetLangName = DEEPL_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage
    const content = `=== TRANSLATED DOCUMENT ===
Original Language: ${translationResult.sourceLanguage}
Target Language: ${targetLangName} (${translationResult.targetLanguage})
Translated on: ${new Date(translationResult.translatedAt).toLocaleString()}
Original Length: ${translationResult.originalText.length} characters
Translated Length: ${translationResult.translatedText.length} characters
Translation Service: DeepL

=== TRANSLATED CONTENT ===

${translationResult.translatedText}

=== ORIGINAL CONTENT ===

${translationResult.originalText}
`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const fileName = uploadedFileName 
      ? uploadedFileName.replace(/\.(txt|docx)$/i, '') 
      : 'document'
    a.download = `${fileName}-translated-${targetLanguage.toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showMessage(`Downloaded translated document!`, 'success')
  }

  // Clear translation
  const handleClearTranslation = () => {
    setTranslationResult(null)
    showMessage('Translation cleared', 'info')
  }

  // Clear all
  const handleClearAll = () => {
    setInputText('')
    setTranslationResult(null)
    setUploadedFileName(null)
    showMessage('All content cleared', 'info')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Languages className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Document Translator</h1>
          </div>
          <p className="text-gray-600">
            Translate documents independently using DeepL - Upload files, paste text, or import from Script Generator
          </p>
        </div>

        {/* Status Message */}
        {message && (
          <Card className={`${
            messageType === 'success' ? 'bg-green-50 border-green-200' :
            messageType === 'error' ? 'bg-red-50 border-red-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                {messageType === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {messageType === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                {messageType === 'info' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
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

        {/* Input Section */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Source Document
            </CardTitle>
            <CardDescription>
              Upload a file, paste text, or import from Script Generator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Import & Upload Controls */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={importFromScriptGenerator}
                variant="outline"
                disabled={isTranslating}
              >
                <FileText className="h-4 w-4 mr-2" />
                Import from Script Generator
              </Button>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={isTranslating}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File (.txt, .docx)
              </Button>
              
              {(inputText || uploadedFileName) && (
                <Button
                  onClick={clearUploadedFile}
                  variant="outline"
                  size="sm"
                  disabled={isTranslating}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* File Info Badge */}
            {uploadedFileName && (
              <Badge variant="outline" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                {uploadedFileName}
              </Badge>
            )}

            {/* Text Input */}
            <div className="space-y-2">
              <Label htmlFor="inputText">Text to Translate</Label>
              <Textarea
                id="inputText"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter or paste text here, or use the buttons above to upload a file or import from Script Generator..."
                className="min-h-[300px] font-mono text-sm"
                disabled={isTranslating}
              />
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Badge variant="outline">
                  {inputText.split(/\s+/).filter(w => w.length > 0).length.toLocaleString()} words
                </Badge>
                <Badge variant="outline">
                  {inputText.length.toLocaleString()} characters
                </Badge>
              </div>
            </div>

            {/* Translation Controls */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="targetLanguage" className="flex items-center gap-1 mb-2">
                  <Globe className="h-3 w-3" />
                  Target Language
                </Label>
                <Select
                  value={targetLanguage}
                  onValueChange={setTargetLanguage}
                  disabled={isTranslating}
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
              
              <Button
                onClick={handleTranslate}
                disabled={!inputText || inputText.trim().length === 0 || isTranslating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <Languages className="h-4 w-4 mr-2" />
                    Translate
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Translation Result */}
        {translationResult && (
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-800">Translation Complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={copyTranslatedText}
                    size="sm"
                    variant="outline"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    onClick={downloadTranslatedText}
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
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Translation Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-center">
                  <div className="text-sm font-medium text-green-800">Source Language</div>
                  <div className="text-xs text-green-600">{translationResult.sourceLanguage}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-green-800">Target Language</div>
                  <div className="text-xs text-green-600">
                    {DEEPL_LANGUAGES.find(l => l.code === translationResult.targetLanguage)?.name || translationResult.targetLanguage}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-green-800">Translated</div>
                  <div className="text-xs text-green-600">
                    {new Date(translationResult.translatedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Translated Content */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-gray-700">Translated Document:</Label>
                  <Badge variant="outline" className="text-xs">
                    {translationResult.translatedText.split(/\s+/).length.toLocaleString()} words
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {translationResult.translatedText.length.toLocaleString()} characters
                  </Badge>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg max-h-96 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {translationResult.translatedText}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

