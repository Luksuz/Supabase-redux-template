import { NextRequest, NextResponse } from 'next/server'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

export async function POST(request: NextRequest) {
  try {
    const { researchData, title = 'Research Export' } = await request.json()

    if (!researchData || !Array.isArray(researchData)) {
      return NextResponse.json({ error: 'Research data is required and must be an array' }, { status: 400 })
    }

    console.log(`📄 Exporting ${researchData.length} research items to DOCX`)

    // Create document sections
    const docSections = []

    // Title page
    docSections.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        text: `Generated on ${new Date().toLocaleDateString()}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 }
      })
    )

    // Process each research item
    researchData.forEach((item: any, index: number) => {
      // Research item header
      docSections.push(
        new Paragraph({
          text: `${index + 1}. ${item.type === 'google' ? 'Google Research' : 'YouTube Analysis'}: ${item.query}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      )

      // Metadata
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Type: ', bold: true }),
            new TextRun({ text: item.type === 'google' ? 'Google Research' : 'YouTube Analysis' })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Query: ', bold: true }),
            new TextRun({ text: item.query })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Date: ', bold: true }),
            new TextRun({ text: new Date(item.timestamp).toLocaleDateString() })
          ],
          spacing: { after: 200 }
        })
      )

      // Content based on type
      if (item.type === 'google') {
        // Google Research content
        if (item.insights) {
          docSections.push(
            new Paragraph({
              text: 'Insights',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: item.insights,
              spacing: { after: 200 }
            })
          )
        }

        if (item.keyFindings && item.keyFindings.length > 0) {
          docSections.push(
            new Paragraph({
              text: 'Key Findings',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            })
          )
          item.keyFindings.forEach((finding: string) => {
            docSections.push(
              new Paragraph({
                text: `• ${finding}`,
                spacing: { after: 100 }
              })
            )
          })
          docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
        }

        if (item.recommendations && item.recommendations.length > 0) {
          docSections.push(
            new Paragraph({
              text: 'Recommendations',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            })
          )
          item.recommendations.forEach((rec: string) => {
            docSections.push(
              new Paragraph({
                text: `• ${rec}`,
                spacing: { after: 100 }
              })
            )
          })
          docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
        }

        if (item.sources && item.sources.length > 0) {
          docSections.push(
            new Paragraph({
              text: 'Sources',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            })
          )
          item.sources.forEach((source: string, idx: number) => {
            docSections.push(
              new Paragraph({
                text: `${idx + 1}. ${source}`,
                spacing: { after: 100 }
              })
            )
          })
        }
      } else {
        // YouTube Analysis content
        const videosSummary = item.videosSummary
        if (videosSummary) {
          if (videosSummary.overallTheme) {
            docSections.push(
              new Paragraph({
                text: 'Overall Theme',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                text: videosSummary.overallTheme,
                spacing: { after: 200 }
              })
            )
          }

          if (videosSummary.keyInsights && videosSummary.keyInsights.length > 0) {
            docSections.push(
              new Paragraph({
                text: 'Key Insights',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            )
            videosSummary.keyInsights.forEach((insight: string) => {
              docSections.push(
                new Paragraph({
                  text: `• ${insight}`,
                  spacing: { after: 100 }
                })
              )
            })
            docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
          }

          if (videosSummary.characterInsights && videosSummary.characterInsights.length > 0) {
            docSections.push(
              new Paragraph({
                text: 'Character Insights',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            )
            videosSummary.characterInsights.forEach((insight: string) => {
              docSections.push(
                new Paragraph({
                  text: `• ${insight}`,
                  spacing: { after: 100 }
                })
              )
            })
            docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
          }

          if (videosSummary.conflictElements && videosSummary.conflictElements.length > 0) {
            docSections.push(
              new Paragraph({
                text: 'Conflict Elements',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            )
            videosSummary.conflictElements.forEach((element: string) => {
              docSections.push(
                new Paragraph({
                  text: `• ${element}`,
                  spacing: { after: 100 }
                })
              )
            })
            docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
          }

          if (videosSummary.storyIdeas && videosSummary.storyIdeas.length > 0) {
            docSections.push(
              new Paragraph({
                text: 'Story Ideas',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            )
            videosSummary.storyIdeas.forEach((idea: string) => {
              docSections.push(
                new Paragraph({
                  text: `• ${idea}`,
                  spacing: { after: 100 }
                })
              )
            })
            docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
          }

          if (videosSummary.commonPatterns && videosSummary.commonPatterns.length > 0) {
            docSections.push(
              new Paragraph({
                text: 'Common Patterns',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            )
            videosSummary.commonPatterns.forEach((pattern: string) => {
              docSections.push(
                new Paragraph({
                  text: `• ${pattern}`,
                  spacing: { after: 100 }
                })
              )
            })
            docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
          }

          if (videosSummary.creativePrompt) {
            docSections.push(
              new Paragraph({
                text: 'Creative Prompt',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                text: videosSummary.creativePrompt,
                spacing: { after: 200 }
              })
            )
          }

          if (videosSummary.actionableItems && videosSummary.actionableItems.length > 0) {
            docSections.push(
              new Paragraph({
                text: 'Actionable Items',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            )
            videosSummary.actionableItems.forEach((item: string) => {
              docSections.push(
                new Paragraph({
                  text: `• ${item}`,
                  spacing: { after: 100 }
                })
              )
            })
            docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
          }

          if (videosSummary.narrativeThemes && videosSummary.narrativeThemes.length > 0) {
            docSections.push(
              new Paragraph({
                text: 'Narrative Themes',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            )
            videosSummary.narrativeThemes.forEach((theme: string) => {
              docSections.push(
                new Paragraph({
                  text: `• ${theme}`,
                  spacing: { after: 100 }
                })
              )
            })
            docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
          }

          // Individual video summaries if available
          if (videosSummary.videoSummaries && videosSummary.videoSummaries.length > 0) {
            docSections.push(
              new Paragraph({
                text: 'Individual Video Summaries',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            )
            videosSummary.videoSummaries.forEach((video: any, videoIndex: number) => {
              docSections.push(
                new Paragraph({
                  text: `Video ${videoIndex + 1}: ${video.title || 'Untitled'}`,
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 150, after: 100 }
                })
              )
              if (video.summary) {
                docSections.push(
                  new Paragraph({
                    text: video.summary,
                    spacing: { after: 100 }
                  })
                )
              }
              if (video.keyQuotes && video.keyQuotes.length > 0) {
                docSections.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Key Quotes: ', bold: true })
                    ],
                    spacing: { after: 50 }
                  })
                )
                video.keyQuotes.forEach((quote: string) => {
                  docSections.push(
                    new Paragraph({
                      text: `"${quote}"`,
                      spacing: { after: 50 }
                    })
                  )
                })
              }
              docSections.push(new Paragraph({ text: '', spacing: { after: 100 } }))
            })
          }
        }
      }

      // Add separator between research items
      if (index < researchData.length - 1) {
        docSections.push(
          new Paragraph({
            text: '─────────────────────────────────────────────────────────────',
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 }
          })
        )
      }
    })

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {},
        children: docSections
      }]
    })

    // Generate the DOCX file
    const buffer = await Packer.toBuffer(doc)

    // Return the file as a response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx"`,
        'Content-Length': buffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Error exporting research to DOCX:', error)
    return NextResponse.json(
      { error: 'Failed to export research to DOCX: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 