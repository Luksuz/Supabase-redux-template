"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Upload, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppDispatch, useAppSelector } from "../lib/hooks";
import { 
  setScriptSections, 
  updateScriptSection, 
  setFullScript, 
  setIsGeneratingScript, 
  setScriptGenerationError,
  clearFullScript 
} from "../lib/features/scripts/scriptsSlice";

export interface ScriptSection {
  title: string;
  writingInstructions: string;
  image_generation_prompt: string;
}

const ScriptGenerator: React.FC = () => {
  const dispatch = useAppDispatch();
  
  // Get state from Redux
  const { 
    scriptSections, 
    fullScript, 
    hasScriptSections, 
    hasFullScript, 
    isGeneratingScript, 
    scriptGenerationError 
  } = useAppSelector(state => state.scripts);

  // Store form values in state
  const [title, setTitle] = useState("");
  const [wordCount, setWordCount] = useState(1000);
  const [theme, setTheme] = useState("");
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [inspirationalTranscript, setInspirationalTranscript] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scriptWordCount, setScriptWordCount] = useState(0);
  const [uploadedScript, setUploadedScript] = useState("");
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");
  
  // Store form values in localStorage to persist between renders
  useEffect(() => {
    // Load saved values from localStorage on initial component mount
    const savedTitle = localStorage.getItem('scriptGenerator.title');
    const savedWordCount = localStorage.getItem('scriptGenerator.wordCount');
    const savedTheme = localStorage.getItem('scriptGenerator.theme');
    const savedAdditionalPrompt = localStorage.getItem('scriptGenerator.additionalPrompt');
    const savedForbiddenWords = localStorage.getItem('scriptGenerator.forbiddenWords');
    
    if (savedTitle) setTitle(savedTitle);
    if (savedWordCount) setWordCount(parseInt(savedWordCount));
    if (savedTheme) setTheme(savedTheme);
    if (savedAdditionalPrompt) setAdditionalPrompt(savedAdditionalPrompt);
    if (savedForbiddenWords) setForbiddenWords(savedForbiddenWords);
  }, []);
  
  // Save form values to localStorage when they change
  useEffect(() => {
    localStorage.setItem('scriptGenerator.title', title);
    localStorage.setItem('scriptGenerator.wordCount', wordCount.toString());
    localStorage.setItem('scriptGenerator.theme', theme);
    localStorage.setItem('scriptGenerator.additionalPrompt', additionalPrompt);
    localStorage.setItem('scriptGenerator.forbiddenWords', forbiddenWords);
  }, [title, wordCount, theme, additionalPrompt, forbiddenWords]);

  // Calculate word count when full script changes
  const updateScriptWordCount = (script: string) => {
    if (!script) {
      setScriptWordCount(0);
      return;
    }
    // Clean the markdown to count only actual words
    const cleanText = script.replace(/[#*_~`]/g, '');
    const words = cleanText.trim().split(/\s+/);
    setScriptWordCount(words.length);
  };

  // Update word count when full script changes from Redux
  useEffect(() => {
    if (fullScript?.scriptWithMarkdown) {
      updateScriptWordCount(fullScript.scriptWithMarkdown);
    } else {
      setScriptWordCount(0);
    }
  }, [fullScript?.scriptWithMarkdown]);

  const handleGenerateOutline = async () => {
    try {
      setIsLoading(true);
      dispatch(clearFullScript());
      
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          title, 
          wordCount, 
          theme, 
          additionalPrompt, 
          inspirationalTranscript, 
          forbiddenWords 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate script outline");
      }
      
      const data = await response.json();
      
      // Store sections in Redux
      if (data.sections) {
        dispatch(setScriptSections(data.sections));
      }
      
      // After receiving outline sections, immediately generate the full script
      if (data.sections && data.sections.length > 0) {
        await generateFullScriptDirectly(data.sections);
      }
    } catch (error) {
      console.error("Error generating script outline:", error);
      dispatch(setScriptGenerationError((error as Error).message));
    } finally {
      setIsLoading(false);
    }
  };

  // Function to generate full script using the sections directly
  const generateFullScriptDirectly = async (sections: ScriptSection[]) => {
    try {
      dispatch(setIsGeneratingScript(true));
      
      const response = await fetch("/api/generate-full-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title, 
          theme, 
          sections: sections,
          additionalPrompt,
          forbiddenWords
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate full script");
      }
      
      const data = await response.json();
      
      // Process the script - clean it up for the audio component
      if (data.scriptWithMarkdown) {
        // Keep original for display
        const scriptWithMarkdown = data.scriptWithMarkdown;
        
        // Create cleaned version for audio
        let scriptCleaned = data.scriptCleaned || data.scriptWithMarkdown;
        
        // Enhanced cleaning process to eliminate all title and header patterns
        
        // Save original length for logging
        const originalLength = scriptCleaned.length;
        
        // Remove exact title match
        scriptCleaned = scriptCleaned.replace(new RegExp(`^(?:${title}|\\s*${title}\\s*)$`, 'im'), '');
        
        // Remove any title-looking text at the beginning (capitalized words)
        scriptCleaned = scriptCleaned.replace(/^([A-Z][a-z]*\s*){1,7}$/m, '');
        
        // Remove common opening lines that might be title-related
        scriptCleaned = scriptCleaned.replace(/^(Title:|Script:|Written by:).*$/gim, '');
        
        // Remove markdown headers
        scriptCleaned = scriptCleaned.replace(/^#{1,6}\s+.*$/gm, '');
        
        // Remove chapter/section headers
        scriptCleaned = scriptCleaned.replace(/^(?:Chapter|Section|Part)\s+\d+[\s:.-]*.*$/gim, '');
        
        // Remove ALL CAPS titles (expanded pattern)
        scriptCleaned = scriptCleaned.replace(/^[A-Z][A-Z\s\d:,.!?-]{4,}$/gm, '');
        
        // Remove any remaining title lines
        scriptCleaned = scriptCleaned.replace(new RegExp(`^\\s*${title}\\s*$`, 'gim'), '');
        
        // Remove common greetings at the beginning that shouldn't be in the script
        scriptCleaned = scriptCleaned.replace(/^(Hi!|Hello!|Greetings!|Welcome!)\s*/i, '');
        
        // Handle specific pattern seen in the example
        scriptCleaned = scriptCleaned.replace(/^A Chance Encounter\\nHi!\\n/i, '');
        
        // Clean up any title followed immediately by greeting
        scriptCleaned = scriptCleaned.replace(/^[A-Z][a-zA-Z\s]+\\n(Hi!|Hello!)/i, '');
        
        // Remove excessive line breaks at the beginning
        scriptCleaned = scriptCleaned.replace(/^\s*\n+/, '');
        
        // Clean up multiple line breaks
        scriptCleaned = scriptCleaned.replace(/\n{2,}/g, '\n\n');
        
        // Trim whitespace
        scriptCleaned = scriptCleaned.trim();
        
        console.log("Script cleaned for audio. Original length:", originalLength, 
                    "Cleaned length:", scriptCleaned.length,
                    "First 100 chars:", scriptCleaned.substring(0, 100));
        
        // Store in Redux
        dispatch(setFullScript({
          scriptWithMarkdown: scriptWithMarkdown,
          scriptCleaned: scriptCleaned,
          title: title,
          theme: theme,
          wordCount: data.wordCount || scriptWordCount
        }));
      }
    } catch (error) {
      console.error("Error generating full script:", error);
      dispatch(setScriptGenerationError((error as Error).message));
    } finally {
      dispatch(setIsGeneratingScript(false));
    }
  };

  const handleGenerateFullScript = async () => {
    if (scriptSections.length === 0) return;
    await generateFullScriptDirectly(scriptSections);
  };

  const handleUpdateSection = (index: number, updatedSection: ScriptSection) => {
    dispatch(updateScriptSection({ index, section: updatedSection }));
  };

  const handleDownloadDocx = async () => {
    if (!fullScript?.scriptWithMarkdown) return;
    
    try {
      const response = await fetch("/api/download-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          title, 
          content: fullScript.scriptWithMarkdown
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate DOCX");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading DOCX:", error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedScript(event.target.result as string);
        // Store uploaded script in Redux
        dispatch(setFullScript({
          scriptWithMarkdown: event.target.result as string,
          scriptCleaned: event.target.result as string,
          title: title || "Uploaded Script",
          theme: theme,
          wordCount: 0
        }));
      }
    };
    reader.readAsText(file);
  };

  const handleRegenerateSegment = async (sectionIndex?: number) => {
    // Use provided index or fall back to selectedSegmentIndex
    const index = sectionIndex !== undefined ? sectionIndex : selectedSegmentIndex;
    
    if (index === null || !scriptSections[index]) return;
    
    try {
      const currentSection = scriptSections[index];
      
      // Verify title and theme are available for context in API route
      if (!title || !theme) {
        console.error(`❌ Cannot regenerate section - missing title or theme`);
        alert("Please enter a title and theme before regenerating sections.");
        return;
      }
      
      console.log(`🔄 Starting regeneration for section ${index + 1}: "${currentSection.title}"`);
      console.log(`📄 Using title: "${title}" and theme: "${theme}"`);
      
      // Show prompt dialog
      const promptText = window.prompt(
        `Enter instructions for regenerating section "${currentSection.title}":`,
        `Improve section ${index + 1} to make it more detailed and engaging.`
      );
      
      // If user cancels, return early
      if (promptText === null) {
        console.log(`⏱️ Regeneration cancelled by user for section ${index + 1}`);
        return;
      }
      
      // Use the prompt from dialog
      const regenerationPrompt = promptText.trim();
      console.log(`📝 User provided prompt for section ${index + 1}: "${regenerationPrompt}"`);
      
      console.log(`🔄 Sending regeneration request to API for section ${index + 1}`);
      const response = await fetch("/api/regenerate-segment", {
        method: "POST",
              headers: {
          "Content-Type": "application/json",
              },
              body: JSON.stringify({
          sectionIndex: index,
          currentSection,
          additionalPrompt: regenerationPrompt,
          forbiddenWords,
          title, // Add title to the request for context
          theme  // Add theme to the request for context
        }),
      });

            if (!response.ok) {
        throw new Error(`Failed to regenerate segment. Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Regeneration successful for section ${index + 1}. New title: "${data.updatedSection.title}"`);
      
      // Update the section in Redux
      dispatch(updateScriptSection({ index, section: data.updatedSection }));
      
      // Clear the regenerate prompt and selected segment
      setRegeneratePrompt("");
      setSelectedSegmentIndex(null);
    } catch (error) {
      console.error(`❌ Error regenerating segment ${index !== null ? index + 1 : 'unknown'}:`, error);
    }
  };

  // Function to split text into 500-word segments for display
  const splitIntoSegments = (text: string, wordsPerSegment = 500): string[] => {
    if (!text) return [];
    
    const words = text.split(/\s+/);
    const segments: string[] = [];
    
    for (let i = 0; i < words.length; i += wordsPerSegment) {
      segments.push(words.slice(i, i + wordsPerSegment).join(' '));
    }
    
    return segments;
  };
  
  const scriptSegments = splitIntoSegments(fullScript?.scriptWithMarkdown || '');

  // Update the handleRegenerateScriptSegment function to better handle regeneration prompts
  const handleRegenerateScriptSegment = async (segmentIndex: number, segmentContent: string, prompt?: string) => {
    try {
      console.log(`🔄 Starting regeneration for script segment ${segmentIndex + 1}`);
      // Verify title and theme are available
      if (!title || !theme) {
        console.error(`❌ Cannot regenerate script segment - missing title or theme`);
        alert("Please enter a title and theme before regenerating script segments.");
        return;
      }

      console.log(`📄 Using title: "${title}" and theme: "${theme}"`);
      dispatch(setIsGeneratingScript(true));
      
      // Use the provided prompt or fall back to the current regeneratePrompt state
      const regenerationPrompt = prompt || regeneratePrompt;
      console.log(`📝 Using prompt for script segment ${segmentIndex + 1}: "${regenerationPrompt}"`);
      
      console.log(`🔄 Sending regeneration request to API for script segment ${segmentIndex + 1}`);
      const response = await fetch("/api/regenerate-script-segment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          segmentIndex, 
          segmentContent,
          title,
          theme,
          additionalPrompt: regenerationPrompt,
          forbiddenWords
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to regenerate script segment. Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Successfully regenerated script segment ${segmentIndex + 1}. Word count: ${data.wordCount || 'unknown'}`);
      
      // Replace this segment in the full script
      if (fullScript && data.regeneratedContent) {
        // Split the script into segments
        const segments = splitIntoSegments(fullScript.scriptWithMarkdown);
        
        // Replace the specified segment
        segments[segmentIndex] = data.regeneratedContent;
        
        // Rejoin the segments
        const updatedScript = segments.join(' ');
        
        // Update the full script in Redux
        dispatch(setFullScript({
          scriptWithMarkdown: updatedScript,
          scriptCleaned: updatedScript,
          title: fullScript.title,
          theme: fullScript.theme,
          wordCount: updatedScript.split(/\s+/).length
        }));
        
        console.log(`📊 Updated full script after segment regeneration. Total length: ${updatedScript.split(/\s+/).length} words`);
      }
      
      // Clear the regenerate prompt and selected segment
      setRegeneratePrompt("");
      setSelectedSegmentIndex(null);
    } catch (error) {
      console.error(`❌ Error regenerating script segment ${segmentIndex + 1}:`, error);
      dispatch(setScriptGenerationError((error as Error).message));
    } finally {
      dispatch(setIsGeneratingScript(false));
    }
  };

  // Add a new direct regeneration function that includes a prompt dialog
  const handleDirectRegeneration = async (segmentIndex: number, segmentContent: string) => {
    console.log(`🔄 Initiating direct regeneration for segment ${segmentIndex + 1}`);
    
    // Verify title is available
    if (!title) {
      console.error(`❌ Cannot regenerate script segment - missing title`);
      alert("Please enter a title before regenerating script segments.");
      return;
    }
    
    // Show prompt dialog
    const prompt = window.prompt("Enter instructions for rewriting this segment:", `Rewrite segment ${segmentIndex + 1} to make it more engaging and impactful.`);
    
    // If user cancels, return early
    if (prompt === null) {
      console.log(`⏱️ Direct regeneration cancelled by user for segment ${segmentIndex + 1}`);
      return;
    }
    
    console.log(`📝 User provided prompt for direct regeneration of segment ${segmentIndex + 1}: "${prompt}"`);
    
    // Regenerate with the prompt
    await handleRegenerateScriptSegment(segmentIndex, segmentContent, prompt);
  };

  return (
    <div className="space-y-8">
      <Tabs defaultValue="form">
        <TabsList className="mb-4">
          <TabsTrigger value="form">Basic Settings</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
        </TabsList>
        
        <TabsContent value="form" className="w-full space-y-6 p-6 bg-card rounded-lg border shadow-sm">
            <div className="space-y-2">
            <h2 className="text-2xl font-bold">Script Generator</h2>
            <p className="text-muted-foreground">
              Create a script using AI. Fill in the details below.
                </p>
              </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
              <Label htmlFor="title" className="flex justify-between">
                <span>Title</span>
                {!title && <span className="text-red-500 text-xs">Required for regeneration</span>}
              </Label>
              <Input
                id="title"
                placeholder="Enter a title for your script"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={!title ? "border-red-300 focus-visible:ring-red-500" : ""}
              />
                    </div>

          <div className="space-y-2">
              <Label htmlFor="wordCount">Word Count</Label>
              <Input
                id="wordCount"
                type="number"
                min={1000}
                max={100000}
                step={1000}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                This will generate {Math.max(1, Math.floor(wordCount / 800))} script sections
            </p>
          </div>

          <div className="space-y-2">
              <Label htmlFor="theme" className="flex justify-between">
                <span>Story Theme</span>
              </Label>
              <Input
                id="theme"
                placeholder="E.g., Mystery, Romance, Sci-Fi"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalPrompt">Additional Instructions (Optional)</Label>
            <Textarea
              id="additionalPrompt"
              placeholder="Add any specific instructions for the AI to follow when generating your script"
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
              <Button 
              className="flex-1" 
              onClick={handleGenerateOutline}
              disabled={isLoading || isGeneratingScript || !title}
            >
              {isLoading ? "Generating..." : "Generate Script"}
              </Button>

            {fullScript && (
              <Button 
                variant="outline"
                onClick={handleDownloadDocx}
                className="flex-1 gap-2"
              >
                <Download size={16} />
                Download DOCX
              </Button>
            )}
          </div>

          {/* Error Display */}
          {scriptGenerationError && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <p className="font-semibold">Error:</p>
              <p className="text-sm">{scriptGenerationError}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="advanced" className="w-full space-y-6 p-6 bg-card rounded-lg border shadow-sm">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Advanced Options</h2>
            <p className="text-muted-foreground">
              Fine-tune your script generation with these advanced settings.
            </p>
            </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inspirationalTranscript">Inspirational Video Transcript</Label>
              <Textarea
                id="inspirationalTranscript"
                placeholder="Paste a transcript from a video that you'd like to use as inspiration"
                value={inspirationalTranscript}
                onChange={(e) => setInspirationalTranscript(e.target.value)}
                className="min-h-[150px]"
              />
                </div>

            <div className="space-y-2">
              <Label htmlFor="forbiddenWords">Forbidden Words (comma-separated)</Label>
              <Input
                id="forbiddenWords"
                placeholder="Words to avoid in the generated script, separated by commas"
                value={forbiddenWords}
                onChange={(e) => setForbiddenWords(e.target.value)}
              />
                      </div>
                      
            <div className="space-y-2">
              <Label htmlFor="uploadScript">Upload Existing Script</Label>
                          <div className="flex items-center gap-2">
                <Input
                  id="uploadScript"
                  type="file"
                  accept=".txt,.md,.docx"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
                <Button variant="outline" className="gap-2">
                  <Upload size={16} />
                  Upload
                                </Button>
                            </div>
                          </div>
                        </div>
        </TabsContent>
      </Tabs>

      {/* Full Script Section - Modified to take full width */}
      <div className="w-full space-y-6">
        <div className="space-y-2 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Full Script</h2>
            <p className="text-muted-foreground">
              The complete script based on your outline.
            </p>
                              </div>
          {fullScript && (
            <div className="text-sm font-medium bg-primary/10 px-3 py-1 rounded-full">
              Word Count: {scriptWordCount}
                              </div>
                            )}
                          </div>
        
        {!fullScript ? (
          <div className="h-[300px] flex items-center justify-center border rounded-lg bg-muted/50">
            <p className="text-muted-foreground">
              {isGeneratingScript || isLoading
                ? "Generating your script..." 
                : "Click 'Generate Script' to create your content"}
            </p>
                              </div>
                            ) : (
          <div className="space-y-6">
            <div className="border rounded-lg p-4 bg-card shadow-sm overflow-y-auto max-h-[600px]">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h1 className="text-xl font-bold mb-4">{fullScript.title}</h1>
                {/* Modified to remove headers from the markdown rendering */}
                <ReactMarkdown
                  components={{
                    // Remove h1, h2, h3 headers from the output
                    h1: () => null,
                    h2: () => null,
                    h3: () => null
                  }}
                >
                  {fullScript.scriptWithMarkdown}
                </ReactMarkdown>
                          </div>
            </div>
            
            {scriptSegments.length > 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Script Segments</h3>
                <p className="text-sm text-muted-foreground">
                  The script is divided into segments of approximately 500 words each for easier editing.
                </p>
                
                {scriptSegments.map((segment, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-card shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">Segment {index + 1}</h4>
                                <Button
                                  size="sm"
                        variant="outline"
                        onClick={() => handleDirectRegeneration(index, segment)}
                        disabled={isGeneratingScript}
                      >
                        <RefreshCw size={14} className="mr-2" />
                                      Regenerate
                                </Button>
                              </div>
                    <div className="text-sm whitespace-pre-wrap">{segment}</div>
                            </div>
                ))}
                          </div>
                        )}
                      </div>
        )}
                    </div>
                  </div>
  );
};

export default ScriptGenerator; 