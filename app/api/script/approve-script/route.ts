import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  console.log("=== POST /api/script/approve-script ===");

  try {
    console.log("Parsing request body...");
    const requestBody = await request.json();
    console.log("Request body received:", requestBody);

    const {
      outline_section_id,
      input_text,
      generated_script
    } = requestBody;

    if (!outline_section_id || !input_text || !generated_script) {
      console.log("Validation failed: missing required fields");
      return NextResponse.json({ 
        error: "Section ID, input text, and generated script are required" 
      }, { status: 400 });
    }

    console.log(`Saving approved script for section ${outline_section_id}...`);

    // Save generated text to database
    // Note: character_count and word_count are GENERATED ALWAYS columns and will be calculated automatically
    const textToInsert = {
      outline_section_id: outline_section_id,
      input_text: input_text,
      generated_script: generated_script,
      text_order: 0 // Default order for new texts
    };

    const { data: insertedText, error: textError } = await supabase
      .from('fine_tuning_texts')
      .insert(textToInsert)
      .select('*')
      .single();

    if (textError) {
      console.error('Error saving generated text:', textError);
      return NextResponse.json({
        error: 'Failed to save generated text to database'
      }, { status: 500 });
    }

    console.log(`✅ Successfully saved approved script for section ${outline_section_id}`);

    return NextResponse.json({
      success: true,
      text: insertedText,
      message: "Script approved and saved successfully"
    });

  } catch (error) {
    console.error("Unexpected error in approve-script:", error);
    console.error("Error details:", {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Failed to approve script: " + (error as Error).message },
      { status: 500 }
    );
  }
} 