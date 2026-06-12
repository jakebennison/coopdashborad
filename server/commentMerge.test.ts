import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeMatchComments } from '../src/commentMerge.ts'
import type { MatchComment } from '../src/types.ts'

const comment = (
  id: string,
  body: string,
  createdAt: string,
  replies: MatchComment['replies'] = [],
): MatchComment => ({
  id,
  author: 'Player',
  body,
  createdAt,
  likes: 0,
  likedByMe: false,
  replies,
})

test('mergeMatchComments keeps existing comments when a stale save only sends one new comment', () => {
  const stored = [
    comment('1', 'First comment', '2026-06-12T10:00:00.000Z'),
    comment('2', 'Second comment', '2026-06-12T09:00:00.000Z'),
  ]
  const incoming = [comment('3', 'Third comment', '2026-06-12T11:00:00.000Z')]

  const merged = mergeMatchComments(stored, incoming)

  assert.equal(merged.length, 3)
  assert.deepEqual(
    merged.map((entry) => entry.id),
    ['3', '1', '2'],
  )
})

test('mergeMatchComments merges replies on the same comment thread', () => {
  const stored = [
    comment('1', 'Root comment', '2026-06-12T10:00:00.000Z', [
      {
        id: 'r1',
        author: 'Player',
        body: 'Existing reply',
        createdAt: '2026-06-12T10:05:00.000Z',
        likes: 0,
        likedByMe: false,
      },
    ]),
  ]
  const incoming = [
    comment('1', 'Root comment', '2026-06-12T10:00:00.000Z', [
      {
        id: 'r2',
        author: 'Player 2',
        body: 'New reply',
        createdAt: '2026-06-12T10:10:00.000Z',
        likes: 0,
        likedByMe: false,
      },
    ]),
  ]

  const merged = mergeMatchComments(stored, incoming)

  assert.equal(merged.length, 1)
  assert.deepEqual(
    merged[0].replies.map((reply) => reply.id),
    ['r1', 'r2'],
  )
})
