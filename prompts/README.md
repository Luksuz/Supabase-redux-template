# Script Generation Prompts Documentation

This directory contains the final prompts used in the script generation system after the major improvements made to address AI-sounding, repetitive content issues.

## Files Overview

### `detailed-script-generation-prompt.txt`
Contains the complete prompt structure used in `/api/generate-detailed-script/route.ts` for generating the actual script content for each section.

**Key Features:**
- Sophisticated system prompt emphasizing authentic, natural communication
- Comprehensive user prompt template with context awareness
- CTA integration instructions
- Quality standards focused on education over manipulation

### `script-sections-generation-prompt.txt`
Contains the prompt structure used in `/api/generate-script-sections/route.ts` for creating script outlines and section structures.

**Key Features:**
- Batch processing prompts for efficient section generation
- Research integration capabilities
- Context continuity between sections
- Quote generation functionality

### `style-guides.txt`
Contains all the improved style guides used throughout the system.

**Includes:**
- Intimate Philosophical Narrative (Advanced)
- Breaking Free Persuasive Style (Advanced)
- Default Backend Style Guide

## Major Improvements Made

### 1. **Eliminated Repetitive Content**
- Removed formulaic phrases like "Your life is a lie"
- Added explicit instructions to avoid repetitive catchphrases
- Focused on varied, natural language patterns

### 2. **Enhanced Authenticity**
- Emphasized conversational, expert-friend tone
- Added respect for audience intelligence
- Focused on building trust through transparency

### 3. **Improved Content Quality**
- Required specific, verifiable information
- Emphasized logical progression over shock tactics
- Added requirements for actionable insights

### 4. **Better Style Guidance**
- Replaced literal examples with principle-based guidance
- Added "what to avoid" sections
- Provided better alternative approaches

### 5. **Natural Flow Requirements**
- Emphasized content that sounds natural when spoken
- Required varied sentence structure and rhythm
- Focused on smooth transitions and narrative continuity

## Before vs After Examples

### Old Approach (Problematic):
```
"Your life is a lie. From the moment you could walk, they've been programming your mind, and you didn't stand a chance..."
```

### New Approach (Improved):
```
"Think about the last time you made a major life decision. How many of the factors you considered—what success looks like, what others would think, what's 'realistic'—actually came from your own experience versus what you absorbed from family, media, and culture?"
```

## Usage Notes

- These prompts are designed to work together as a system
- The style guides are referenced by both API routes
- All prompts emphasize education and empowerment over manipulation
- Quality standards are consistently applied across all generation types

## API Configuration

- **Models**: Configurable (default: gpt-4o-mini)
- **Temperature**: 0.7 for creative but controlled output
- **Processing**: Parallel generation for efficiency
- **Fallbacks**: Multiple model provider support

This documentation serves as a reference for understanding the improved prompt structure and the reasoning behind the changes made to eliminate AI-sounding, repetitive content. 