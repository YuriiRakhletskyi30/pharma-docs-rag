import { afterEach, describe, expect, it, vi } from 'vitest';

const ingest = vi.hoisted(() => ({ preparePdf: vi.fn(), saveDocument: vi.fn() }));
vi.mock('@/lib/rag/ingest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rag/ingest')>()),
  ...ingest,
}));

/** The route reads ALLOW_UPLOADS when it loads, so each case imports a fresh copy. */
async function route(allowUploads: boolean) {
  vi.resetModules();
  vi.stubEnv('ALLOW_UPLOADS', String(allowUploads));
  return import('@/app/api/documents/route');
}

function upload(bytes: string, length?: number) {
  const form = new FormData();
  form.append('file', new File([bytes], 'Label.pdf', { type: 'application/pdf' }));
  const req = new Request('http://localhost/api/documents', { method: 'POST', body: form });
  const headers = new Headers(req.headers);
  if (length !== undefined) headers.set('content-length', String(length));
  return new Request(req, { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/documents', () => {
  it('is off unless ALLOW_UPLOADS=true', async () => {
    const { POST } = await route(false);
    expect((await POST(upload('%PDF-1.7', 100))).status).toBe(403);
  });

  it('needs a length, and refuses files that are not PDFs before parsing them', async () => {
    const { POST } = await route(true);
    expect((await POST(upload('%PDF-1.7'))).status).toBe(411);
    expect((await POST(upload('hello, not a pdf', 300))).status).toBe(415);
    expect(ingest.preparePdf).not.toHaveBeenCalled();
  });

  it('answers 413 when the PDF has too many pages', async () => {
    const { POST } = await route(true);
    const { PageLimitError } = await import('@/lib/rag/ingest'); // the class the route sees
    ingest.preparePdf.mockRejectedValueOnce(new PageLimitError('900 pages'));
    expect((await POST(upload('%PDF-1.7 rest', 300))).status).toBe(413);
  });
});
