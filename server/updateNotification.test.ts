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

const mockWindow = (storage = new Map<string, string>()) => {
  const originalWindow = globalThis.window

  globalThis.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    },
  } as Window & typeof globalThis

  return () => {
    globalThis.window = originalWindow
  }
}

test('getUnseenUpdates skips historical backlog on first visit', async () => {
  const restore = mockWindow()

  const { bootstrapLastSeenUpdateId, getUnseenUpdates, readLastSeenUpdateId } = await import(
    '../src/updateNotificationUtils.ts'
  )

  const updates = [note(10), note(11)]
  bootstrapLastSeenUpdateId(updates)
  assert.equal(readLastSeenUpdateId(), 11)
  assert.deepEqual(getUnseenUpdates(updates), [])

  restore()
})

test('getPendingUpdateAlert still shows forced updates after first-visit bootstrap', async () => {
  const restore = mockWindow()

  const { getPendingUpdateAlert, readLastSeenUpdateId } = await import('../src/updateNotificationUtils.ts')

  const updates = [note(10), note(2026061228), note(30)]
  assert.deepEqual(getPendingUpdateAlert(updates).map((entry) => entry.id), [2026061228])
  assert.equal(readLastSeenUpdateId(), 0)

  restore()
})

test('getPendingUpdateAlert waits for five threshold updates once forced alerts are dismissed', async () => {
  const storage = new Map<string, string>([
    ['coop26-last-seen-update-id', '11'],
    ['coop26-dismissed-forced-update-ids', '[2026061228]'],
  ])
  const restore = mockWindow(storage)

  const { getPendingUpdateAlert } = await import('../src/updateNotificationUtils.ts')

  const threeUnseen = [note(10), note(11), note(12), note(13), note(14)]
  assert.deepEqual(getPendingUpdateAlert(threeUnseen).map((entry) => entry.id), [])

  const fiveUnseen = [...threeUnseen, note(15), note(16)]
  assert.deepEqual(getPendingUpdateAlert(fiveUnseen).map((entry) => entry.id), [16, 15, 14, 13, 12])

  restore()
})

test('parseUpdateBody splits intro text and bullet points', async () => {
  const { parseUpdateBody } = await import('../src/updateNotificationUtils.ts')

  const parsed = parseUpdateBody(`Intro paragraph here.

• First change
• Second change`)

  assert.equal(parsed.intro, 'Intro paragraph here.')
  assert.deepEqual(parsed.bullets, ['First change', 'Second change'])
})
