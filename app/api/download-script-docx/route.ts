import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export async function POST(request: NextRequest) {
  try {
    const { title, fullScript, sections, totalWords } = await request.json();
    
    if (!title || !fullScript) {
      return NextResponse.json(
        { error: "Missing required fields: title and fullScript are required" },
        { status: 400 }
      );
    }

    // Create document sections
    const documentSections = [];

    // Title page
    documentSections.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({
        text: `Generated on: ${new Date().toLocaleString()}`,
      }),
      new Paragraph({
        text: `Total Words: ${totalWords || fullScript.split(/\s+/).filter((word: string) => word.length > 0).length}`,
      }),
      new Paragraph({
        text: `Total Sections: ${sections?.length || 1}`,
      }),
      new Paragraph({
        text: "", // Empty line
      })
    );

    // Add full script
    documentSections.push(
      new Paragraph({
        text: "Complete Script",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        text: "", // Empty line
      })
    );

    // Split the script into paragraphs and add them
    const scriptParagraphs = fullScript.split('\n\n');
    scriptParagraphs.forEach((paragraph: string) => {
      if (paragraph.trim()) {
        documentSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: paragraph.trim(),
              })
            ],
          })
        );
      }
    });

    // Add section breakdown if available
    if (sections && sections.length > 0) {
      documentSections.push(
        new Paragraph({
          text: "", // Empty line
        }),
        new Paragraph({
          text: "", // Empty line
        }),
        new Paragraph({
          text: "Section Breakdown",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: "", // Empty line
        })
      );

      sections.forEach((section: any, index: number) => {
        if (section.detailedContent && !section.error) {
          documentSections.push(
            new Paragraph({
              text: `Section ${index + 1}: ${section.title}`,
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: `Word Count: ${section.wordCount || 0} words`,
            }),
            new Paragraph({
              text: `Writing Instructions: ${section.writingInstructions}`,
            }),
            new Paragraph({
              text: `Image Generation Prompt: ${section.image_generation_prompt}`,
            }),
            new Paragraph({
              text: "", // Empty line
            })
          );

          // Add section content
          const sectionParagraphs = section.detailedContent.split('\n\n');
          sectionParagraphs.forEach((paragraph: string) => {
            if (paragraph.trim()) {
              documentSections.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: paragraph.trim(),
                    })
                  ],
                })
              );
            }
          });

          documentSections.push(
            new Paragraph({
              text: "", // Empty line
            })
          );
        }
      });
    }

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: documentSections,
        },
      ],
    });

    // Generate the document buffer
    const buffer = await Packer.toBuffer(doc);

    // Create filename
    const filename = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-script-${new Date().toISOString().split('T')[0]}.docx`;

    // Return the file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error generating DOCX:', error);
    return NextResponse.json(
      { error: 'Failed to generate DOCX: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 