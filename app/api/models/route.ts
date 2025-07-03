import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    const models = await openai.models.list();

    console.log(models);

    // Only include these popular models (manually added)
    const popularModels = [
      { id: 'gpt-4o-mini', owned_by: 'openai' },
      { id: 'gpt-4o', owned_by: 'openai' },
      { id: 'gpt-4.1-mini', owned_by: 'openai' },
      { id: 'gpt-4.1-nano', owned_by: 'openai' },
      { id: 'gpt-4.1', owned_by: 'openai' },
    ];

    const anthropicModels = [
        { id: 'claude-opus-4-20250514', owned_by: 'anthropic' },
        { id: 'claude-sonnet-4-20250514', owned_by: 'anthropic' },
        { id: 'claude-3-7-sonnet-20250219', owned_by: 'anthropic' },
        { id: 'claude-3-5-haiku-20241022', owned_by: 'anthropic' },
        { id: 'claude-3-5-sonnet-20240620', owned_by: 'anthropic' },
        { id: 'claude-3-haiku-20240307', owned_by: 'anthropic' },
    ];

    // Only include models owned by 'organization-owner'
    const orgModels = models.data
      .filter(model => model.owned_by === 'pletfree-creations-ltd')
      .map(model => ({ id: model.id, owned_by: model.owned_by }));

    // Combine and deduplicate by id
    const combined = [...popularModels, ...anthropicModels, ...orgModels];
    const uniqueModels = combined.filter(
      (model, idx, arr) => arr.findIndex(m => m.id === model.id) === idx
    );

    return NextResponse.json(uniqueModels);
  } catch (error) {
    console.error('Error fetching OpenAI models:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
} 