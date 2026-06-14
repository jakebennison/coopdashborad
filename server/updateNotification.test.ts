import assert from 'node:assert/strict'
import test from 'node:test'
import type { UpdateNote } from '../src/types.ts'

const note = (id: number): UpdateNote => ({
  id,
  title: `Update ${id}`,
  body: 'Summary line\n\n• Detail',
  date: '2026-06-12',
  createdAt: '2026-06-12T12:00:00.000Z',
})

test('getUnseenUpdates skips historical backlog on first visit', async () => {
  const storage = new Map<string, string>()
  const originalWindow = globalThis.window

  globalThis.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    },
  } as Window & typeof globalThis

  const { bootstrapLastSeenUpdateId, getUnseenUpdates, readLastSeenUpdateId } = await import(
    '../src/updateNotificationUtils.ts'
  )

  const updates = [note(10), note(11)]
  bootstrapLastSeenUpdateId(updates)
  assert.equal(readLastSeenUpdateId(), 11)
  assert.deepEqual(getUnseenUpdates(updates), [])

  globalThis.window = originalWindow
})

test('getUnseenUpdates returns only notes newer than the last seen id', async () => {
  const storage = new Map<string, string>([['coop26-last-seen-update-id', '11']])
  const originalWindow = globalThis.window

  globalThis.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    },
  } as Window & typeof globalThis

  const { getUnseenUpdates } = await import('../src/updateNotificationUtils.ts')

  const unseen = getUnseenUpdates([note(10), note(11), note(12), note(13)])
  assert.deepEqual(
    unseen.map((entry) => entry.id),
    [13, 12],
  )

  globalThis.window = originalWindow
})
