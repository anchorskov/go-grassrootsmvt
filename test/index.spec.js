import { createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

function makeDbMock() {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              return { success: true, meta: { sql, params } };
            },
          };
        },
      };
    },
  };
}

describe('Worker routes', () => {
  it('GET /roles returns role chooser HTML (unit style)', async () => {
    const request = new Request('http://example.com/roles');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, {}, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Choose your role');
    expect(body).toContain('/mission?role=hand');
  });

  it('GET /help returns support form HTML (integration style)', async () => {
    const response = await SELF.fetch('http://example.com/help');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<form method="post" action="/api/help">');
    expect(body).toContain('No one joins and gets lost');
  });

  it('GET /api/help returns 405 JSON', async () => {
    const request = new Request('http://example.com/api/help');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, {}, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Method not allowed' });
  });

  it('POST /api/help rejects empty message', async () => {
    const request = new Request('http://example.com/api/help', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Test&town=Casper&message=',
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, { go_db: makeDbMock() }, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Message is required' });
  });

  it('POST /api/help rejects overly long message', async () => {
    const longMessage = 'a'.repeat(2001);
    const request = new Request('http://example.com/api/help', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `message=${longMessage}`,
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, { go_db: makeDbMock() }, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('2000');
  });

  it('POST /api/help stores valid request and returns help_id', async () => {
    const request = new Request('http://example.com/api/help', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Test&town=Casper&message=Need%20help%20testing',
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, { go_db: makeDbMock() }, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.help_id).toMatch(/[a-f0-9-]{36}/i);
  });
});
