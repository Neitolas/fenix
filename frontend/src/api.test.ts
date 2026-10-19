import { afterEach, expect, it, vi } from 'vitest'
import { listAll } from './api'
afterEach(() => vi.unstubAllGlobals())
it('loads beyond 5000 records without truncating inventory', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const page = Number(new URL(url, 'https://example.org').searchParams.get('page'))
      const start = (page - 1) * 200
      return Response.json({
        count: 5201,
        results: Array.from({ length: Math.min(200, 5201 - start) }, (_, i) => ({
          id: start + i + 1,
          serial: `CAM-${start + i + 1}`,
        })),
      })
    }),
  )
  const rows = await listAll('equipment')
  expect(rows).toHaveLength(5201)
  expect(rows.at(-1)?.id).toBe(5201)
})
it('fails clearly when pagination makes no progress', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ count: 2, results: [] })),
  )
  await expect(listAll('equipment')).rejects.toThrow(/leitura/)
})
