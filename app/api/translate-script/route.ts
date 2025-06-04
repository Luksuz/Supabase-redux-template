import { NextRequest, NextResponse } from "next/server";
import * as deepl from 'deepl-node';

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage, sourceLanguage } = await request.json();
    
    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: "Missing required fields: text and targetLanguage are required" },
        { status: 400 }
      );
    }

    // Check if DeepL API key is configured
    const authKey = process.env.DEEPL_API_KEY;
    if (!authKey) {
      return NextResponse.json(
        { error: "DeepL API key not configured. Please contact administrator." },
        { status: 500 }
      );
    }

    console.log(`🌐 Translating script to ${targetLanguage}: ${text.length} characters`);

    // Initialize DeepL translator
    const translator = new deepl.Translator(authKey);

    // Translate the text
    const result = await translator.translateText(
      text, 
      sourceLanguage || null, // Auto-detect if no source language specified
      targetLanguage as deepl.TargetLanguageCode
    );

    const translatedText = result.text;
    const detectedSourceLanguage = result.detectedSourceLang || sourceLanguage || 'auto-detected';

    console.log(`✅ Translation completed: ${translatedText.length} characters`);
    console.log(`📊 Detected source language: ${detectedSourceLanguage}`);

    return NextResponse.json({
      success: true,
      originalText: text,
      translatedText,
      sourceLanguage: detectedSourceLanguage,
      targetLanguage,
      meta: {
        originalLength: text.length,
        translatedLength: translatedText.length,
        translatedAt: new Date().toISOString(),
        service: 'DeepL'
      }
    });

  } catch (error: any) {
    console.error('Translation error:', error);
    
    let errorMessage = 'Failed to translate script';
    if (error.message?.includes('Authorization')) {
      errorMessage = 'Invalid DeepL API key. Please contact administrator.';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'Translation quota exceeded. Please try again later or contact administrator.';
    } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
      errorMessage = 'Network error during translation. Please try again.';
    } else if (error.message?.includes('language')) {
      errorMessage = 'Unsupported language combination. Please check the selected languages.';
    } else {
      errorMessage = `Translation failed: ${error.message}`;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 