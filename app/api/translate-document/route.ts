import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang, sourceLang, formality } = await request.json();

    if (!text || !targetLang) {
      return NextResponse.json(
        { error: "Missing required fields: text and targetLang are required" },
        { status: 400 }
      );
    }

    if (!process.env.DEEPL_API_KEY) {
      return NextResponse.json(
        { error: "DeepL API key not found" },
        { status: 500 }
      );
    }

    console.log(`🌍 Starting document translation to ${targetLang}`);

    // Step 1: Create TXT file blob from text
    const textBuffer = Buffer.from(text, 'utf-8');
    const fileBlob = new Blob([textBuffer], { type: 'text/plain' });
    console.log(`📄 Created TXT document (${textBuffer.length} bytes)`);

    // Step 2: Upload document to DeepL
    const uploadFormData = new FormData();
    uploadFormData.append('target_lang', targetLang);
    if (sourceLang) {
      uploadFormData.append('source_lang', sourceLang);
    }
    if (formality) {
      uploadFormData.append('formality', formality);
    }
    uploadFormData.append('file', fileBlob, 'script.txt');

    const uploadResponse = await fetch('https://api.deepl.com/v2/document', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        // Don't set Content-Type header - let FormData handle it automatically
      },
      body: uploadFormData
    });

    console.log(JSON.stringify(uploadResponse, null, 2))

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ DeepL upload failed:', errorText);
      throw new Error(`DeepL upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const { document_id, document_key } = uploadData;
    console.log(`📤 Document uploaded, ID: ${document_id}`);

    // Step 3: Poll for translation completion
    let translationComplete = false;
    let attempts = 0;
    const maxAttempts = 60; // Maximum 5 minutes of polling
    
    while (!translationComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      const statusResponse = await fetch(`https://api.deepl.com/v2/document/${document_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ document_key })
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('❌ DeepL status check failed:', errorText);
        throw new Error(`DeepL status check failed: ${statusResponse.status} ${errorText}`);
      }

      const statusData = await statusResponse.json();
      console.log(`🔄 Translation status: ${statusData.status} (attempt ${attempts})`);

      if (statusData.status === 'done') {
        translationComplete = true;
        console.log(`✅ Translation completed, billed characters: ${statusData.billed_characters}`);
      } else if (statusData.status === 'error') {
        throw new Error(`DeepL translation error: ${statusData.message}`);
      } else if (statusData.status === 'translating' && statusData.seconds_remaining) {
        console.log(`⏳ Translation in progress, estimated ${statusData.seconds_remaining} seconds remaining`);
      }
    }

    if (!translationComplete) {
      throw new Error('Translation timed out after 5 minutes');
    }

    // Step 4: Download translated document
    const downloadResponse = await fetch(`https://api.deepl.com/v2/document/${document_id}/result`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ document_key })
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      console.error('❌ DeepL download failed:', errorText);
      throw new Error(`DeepL download failed: ${downloadResponse.status} ${errorText}`);
    }

    const translatedBuffer = await downloadResponse.arrayBuffer();
    console.log(`📥 Downloaded translated document (${translatedBuffer.byteLength} bytes)`);

    // Step 5: Extract text from translated TXT file
    const translatedText = Buffer.from(translatedBuffer).toString('utf-8');

    console.log(`✅ Translation completed successfully (${translatedText.length} characters)`);

    return NextResponse.json({
      success: true,
      translatedText: translatedText,
      originalLength: text.length,
      translatedLength: translatedText.length,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang || 'auto-detected'
    });

  } catch (error) {
    console.error('❌ Error in document translation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to translate document', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 