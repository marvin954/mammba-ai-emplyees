export interface ChunkOptions {
  maxTokens?: number;
  overlap?: number;
}

// Rough token estimate: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxTokens = options.maxTokens ?? 400;
  const overlap = options.overlap ?? 50;
  const maxChars = maxTokens * 4;
  const overlapChars = overlap * 4;

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;

    if (estimateTokens(candidate) <= maxTokens) {
      current = candidate;
    } else {
      if (current) chunks.push(current.trim());

      // If the paragraph itself is too long, split by sentences
      if (estimateTokens(para) > maxTokens) {
        const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
        let sentChunk = '';
        for (const s of sentences) {
          const next = sentChunk ? `${sentChunk} ${s}` : s;
          if (next.length <= maxChars) {
            sentChunk = next;
          } else {
            if (sentChunk) chunks.push(sentChunk.trim());
            sentChunk = s;
          }
        }
        if (sentChunk) current = sentChunk;
        else current = '';
      } else {
        current = para;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());

  // Apply overlap: prepend tail of previous chunk
  if (overlapChars > 0 && chunks.length > 1) {
    return chunks.map((chunk, i) => {
      if (i === 0) return chunk;
      const prev = chunks[i - 1]!;
      const tail = prev.slice(-overlapChars);
      return `${tail}\n\n${chunk}`;
    });
  }

  return chunks;
}
