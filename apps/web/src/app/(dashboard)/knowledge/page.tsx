'use client';

import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/api';

interface KnowledgeSource {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  _count: { chunks: number };
}

interface SearchResult {
  chunkId: string;
  sourceId: string;
  sourceName: string;
  content: string;
  similarity: number;
}

const STATUS_STYLE: Record<string, string> = {
  ready: 'bg-green-500/20 text-green-400',
  processing: 'bg-yellow-500/20 text-yellow-400',
  error: 'bg-red-500/20 text-red-400',
  pending: 'bg-gray-700 text-gray-400',
};

export default function KnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [textName, setTextName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [showTextForm, setShowTextForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const loadSources = () => {
    if (!orgId) return;
    void apiRequest<KnowledgeSource[]>(`/orgs/${orgId}/knowledge/sources`)
      .then(setSources)
      .catch(() => {});
  };

  useEffect(loadSources, [orgId]);

  async function ingestText() {
    if (!orgId || !textName.trim() || !textContent.trim()) return;
    setUploading(true);
    try {
      await apiRequest(`/orgs/${orgId}/knowledge/ingest/text`, {
        method: 'POST',
        body: JSON.stringify({ name: textName, text: textContent }),
      });
      setTextName('');
      setTextContent('');
      setShowTextForm(false);
      loadSources();
    } catch { alert('Failed to ingest text'); }
    finally { setUploading(false); }
  }

  async function ingestFile(file: File) {
    if (!orgId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await fetch(`${process.env['NEXT_PUBLIC_API_URL'] ?? ''}/orgs/${orgId}/knowledge/ingest/file`, {
        method: 'POST',
        body: form,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
      });
      loadSources();
    } catch { alert('Failed to upload file'); }
    finally { setUploading(false); }
  }

  async function search() {
    if (!orgId || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiRequest<SearchResult[]>(
        `/orgs/${orgId}/knowledge/search?query=${encodeURIComponent(searchQuery)}&topK=5`,
      );
      setResults(data);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  async function deleteSource(sourceId: string) {
    if (!orgId || !confirm('Delete this knowledge source and all its chunks?')) return;
    await apiRequest(`/orgs/${orgId}/knowledge/sources/${sourceId}`, { method: 'DELETE' });
    loadSources();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="mt-1 text-sm text-gray-400">
          Upload documents and text that your AI employees can search and reference
        </p>
      </div>

      {/* Upload section */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Add Knowledge</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowTextForm((v) => !v)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            + Add Text
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload File'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.pdf,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ingestFile(f);
            }}
          />
        </div>

        {showTextForm && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <input
              placeholder="Source name (e.g. Company FAQ)"
              value={textName}
              onChange={(e) => setTextName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              placeholder="Paste text content here…"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => void ingestText()}
                disabled={uploading || !textName.trim() || !textContent.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {uploading ? 'Processing…' : 'Ingest'}
              </button>
              <button
                onClick={() => setShowTextForm(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Sources list */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Sources ({sources.length})
        </h2>
        {sources.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
            No knowledge sources yet. Add text or upload a file above.
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((src) => (
              <div
                key={src.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{src.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {src._count.chunks} chunks · {src.type} ·{' '}
                    {new Date(src.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[src.status] ?? 'bg-gray-700 text-gray-400'}`}>
                    {src.status}
                  </span>
                  <button
                    onClick={() => void deleteSource(src.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Search */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Test Search</h2>
        <div className="flex gap-3">
          <input
            placeholder="Search your knowledge base…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => void search()}
            disabled={searching || !searchQuery.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            {results.map((r) => (
              <div key={r.chunkId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-indigo-400">{r.sourceName}</span>
                  <span className="text-xs text-gray-500">
                    {Math.round(r.similarity * 100)}% match
                  </span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-4">{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
