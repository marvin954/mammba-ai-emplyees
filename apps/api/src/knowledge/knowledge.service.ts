import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';
import { OpenAIProvider } from '@nexusos/ai-core';
import { chunkText } from '@nexusos/knowledge';

const EMBED_MODEL = 'text-embedding-3-small';
const CHUNK_MAX_TOKENS = 400;
const CHUNK_OVERLAP = 50;
const DEFAULT_TOP_K = 5;

export interface KnowledgeSearchResult {
  chunkId: string;
  sourceId: string;
  sourceName: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class KnowledgeService {
  private readonly openai: OpenAIProvider | null;

  constructor(private readonly db: PrismaClient) {
    const apiKey = process.env['OPENAI_API_KEY'];
    this.openai = apiKey ? new OpenAIProvider(apiKey) : null;
  }

  // ─── Sources ─────────────────────────────────────────────────────────────────

  async listSources(orgId: string) {
    return this.db.knowledgeSource.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        url: true,
        status: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
    });
  }

  async getSource(orgId: string, sourceId: string) {
    const src = await this.db.knowledgeSource.findFirst({
      where: { id: sourceId, orgId },
      include: { _count: { select: { chunks: true } } },
    });
    if (!src) throw new NotFoundException('Knowledge source not found');
    return src;
  }

  async deleteSource(orgId: string, sourceId: string) {
    await this.getSource(orgId, sourceId);
    await this.db.knowledgeSource.delete({ where: { id: sourceId } });
  }

  // ─── Ingestion ────────────────────────────────────────────────────────────────

  async ingestText(orgId: string, name: string, text: string, metadata: Record<string, unknown> = {}) {
    if (!text.trim()) throw new BadRequestException('Text content is empty');

    const source = await this.db.knowledgeSource.create({
      data: { orgId, name, type: 'text', status: 'processing', metadata: metadata as never },
    });

    try {
      await this.processSource(source.id, orgId, text);
      await this.db.knowledgeSource.update({
        where: { id: source.id },
        data: { status: 'ready' },
      });
    } catch (err) {
      await this.db.knowledgeSource.update({
        where: { id: source.id },
        data: { status: 'error', metadata: { ...metadata, error: String(err) } },
      });
      throw err;
    }

    return source;
  }

  async ingestFile(orgId: string, name: string, fileBuffer: Buffer, mimeType: string) {
    const text = this.extractText(fileBuffer, mimeType);
    return this.ingestText(orgId, name, text, { mimeType });
  }

  private extractText(buf: Buffer, mimeType: string): string {
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      return buf.toString('utf-8');
    }
    // For PDF/DOCX, return raw text extraction (basic UTF-8; production would use pdf-parse)
    return buf.toString('utf-8');
  }

  private async processSource(sourceId: string, orgId: string, text: string) {
    const chunks = chunkText(text, { maxTokens: CHUNK_MAX_TOKENS, overlap: CHUNK_OVERLAP });
    if (chunks.length === 0) return;

    let embeddings: number[][] | null = null;
    if (this.openai) {
      const result = await this.openai.embed({ provider: 'openai' as const, model: EMBED_MODEL, input: chunks, orgId });
      embeddings = result.embeddings;
    }

    // Insert chunks in batches of 50
    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50);
      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j;
        const embedding = embeddings?.[chunkIndex];

        await this.db.$executeRawUnsafe(
          embedding
            ? `INSERT INTO knowledge_chunks ("id","sourceId","orgId","content","embedding","chunkIndex","metadata","createdAt")
               VALUES (gen_random_uuid(),$1,$2,$3,$4::vector,$5,'{}',now())`
            : `INSERT INTO knowledge_chunks ("id","sourceId","orgId","content","chunkIndex","metadata","createdAt")
               VALUES (gen_random_uuid(),$1,$2,$3,$4,'{}',now())`,
          ...(embedding
            ? [sourceId, orgId, batch[j], `[${embedding.join(',')}]`, chunkIndex]
            : [sourceId, orgId, batch[j], chunkIndex]),
        );
      }
    }
  }

  // ─── Search ───────────────────────────────────────────────────────────────────

  async search(orgId: string, query: string, topK = DEFAULT_TOP_K): Promise<KnowledgeSearchResult[]> {
    if (!this.openai) {
      // Fallback: basic keyword search when embeddings are unavailable
      return this.keywordSearch(orgId, query, topK);
    }

    const result = await this.openai.embed({ provider: 'openai' as const, model: EMBED_MODEL, input: [query], orgId });
    const vec = result.embeddings[0];
    if (!vec) return [];

    const vecLiteral = `[${vec.join(',')}]`;

    const rows = await this.db.$queryRawUnsafe<
      Array<{ id: string; sourceId: string; sourceName: string; content: string; similarity: number; metadata: string }>
    >(
      `SELECT kc.id, kc."sourceId", ks.name as "sourceName", kc.content,
              1 - (kc.embedding <=> $1::vector) as similarity,
              kc.metadata::text
       FROM knowledge_chunks kc
       JOIN knowledge_sources ks ON ks.id = kc."sourceId"
       WHERE kc."orgId" = $2
         AND kc.embedding IS NOT NULL
       ORDER BY kc.embedding <=> $1::vector
       LIMIT $3`,
      vecLiteral,
      orgId,
      topK,
    );

    return (rows as Array<{ id: string; sourceId: string; sourceName: string; content: string; similarity: number; metadata: string }>).map((r) => ({
      chunkId: r.id,
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      content: r.content,
      similarity: r.similarity,
      metadata: JSON.parse(r.metadata) as Record<string, unknown>,
    }));
  }

  private async keywordSearch(orgId: string, query: string, topK: number): Promise<KnowledgeSearchResult[]> {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `%${t}%`);
    if (terms.length === 0) return [];

    const chunks = await this.db.knowledgeChunk.findMany({
      where: {
        orgId,
        content: { contains: query.split(' ')[0], mode: 'insensitive' },
      },
      take: topK,
      include: { source: { select: { name: true } } },
    });

    return (chunks as Array<{ id: string; sourceId: string; source: { name: string }; content: string; metadata: Record<string, unknown> }>).map((c) => ({
      chunkId: c.id,
      sourceId: c.sourceId,
      sourceName: c.source.name,
      content: c.content,
      similarity: 0.5,
      metadata: c.metadata as Record<string, unknown>,
    }));
  }
}
