import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  console.log("=== POST /api/script/approve-sections ===");

  try {
    console.log("Parsing request body...");
    const requestBody = await request.json();
    console.log("Request body received:", requestBody);

    const {
      job_id,
      sections,
      promptUsed
    } = requestBody;

    if (!job_id || !sections || !Array.isArray(sections)) {
      console.log("Validation failed: missing required fields");
      return NextResponse.json({ 
        error: "Job ID and sections array are required" 
      }, { status: 400 });
    }

    console.log(`Saving ${sections.length} approved sections for job ${job_id}...`);

    // Save sections to database
    const sectionsToInsert = sections.map((section: any) => ({
      job_id: job_id,
      title: section.title,
      writing_instructions: section.writingInstructions,
      section_order: sections.indexOf(section),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: insertedSections, error: sectionsError } = await supabase
      .from('fine_tuning_outline_sections')
      .insert(sectionsToInsert)
      .select('*');

    if (sectionsError) {
      console.error('Error saving sections:', sectionsError);
      return NextResponse.json({
        error: 'Failed to save sections to database'
      }, { status: 500 });
    }

    // Update job with prompt used
    if (promptUsed) {
      const { error: jobUpdateError } = await supabase
        .from('fine_tuning_jobs')
        .update({ 
          prompt_used: promptUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      if (jobUpdateError) {
        console.error('Error updating job with prompt:', jobUpdateError);
        // Don't fail the request for this, just log the error
      }
    }

    console.log(`✅ Successfully saved ${insertedSections.length} sections`);

    return NextResponse.json({
      success: true,
      sections: insertedSections,
      message: `${insertedSections.length} sections approved and saved successfully`
    });

  } catch (error) {
    console.error("Unexpected error in approve-sections:", error);
    console.error("Error details:", {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Failed to approve sections: " + (error as Error).message },
      { status: 500 }
    );
  }
} 