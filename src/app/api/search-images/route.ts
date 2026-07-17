import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const { query, count = 3 } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const imageCount = Math.min(Math.max(Number(count) || 3, 1), 5);

    // Call z-ai image-search CLI
    const { stdout } = await execFileAsync('z-ai', [
      'image-search',
      '--query', query,
      '--count', String(imageCount),
      '--no-rank',
    ], {
      timeout: 120000, // 2 min timeout — image search can be slow
    });

    const result = JSON.parse(stdout);

    if (!result.success || !result.results?.length) {
      return NextResponse.json({ images: [] });
    }

    // Extract just the URLs
    const images = result.results.map(
      (r: { original_url: string; caption?: string }) => ({
        url: r.original_url,
        caption: r.caption || '',
      })
    );

    return NextResponse.json({ images });
  } catch (error) {
    console.error('[ImageSearch] Error:', error);
    // Never fail the chat — return empty images on error
    return NextResponse.json({ images: [] });
  }
}