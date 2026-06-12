import type { MatchComment, MatchCommentReply } from './types'

const mergeCommentReplies = (
  stored: MatchCommentReply[],
  incoming: MatchCommentReply[],
): MatchCommentReply[] => {
  const byId = new Map<string, MatchCommentReply>()

  for (const reply of stored) {
    byId.set(reply.id, reply)
  }

  for (const reply of incoming) {
    const existing = byId.get(reply.id)
    if (!existing) {
      byId.set(reply.id, reply)
      continue
    }

    byId.set(reply.id, {
      ...existing,
      likes: Math.max(existing.likes, reply.likes),
      likedByMe: reply.likedByMe,
    })
  }

  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

const mergeMatchComment = (stored: MatchComment, incoming: MatchComment): MatchComment => ({
  ...stored,
  likes: Math.max(stored.likes, incoming.likes),
  likedByMe: incoming.likedByMe,
  replies: mergeCommentReplies(stored.replies, incoming.replies),
})

export const mergeMatchComments = (
  stored: MatchComment[],
  incoming: MatchComment[],
): MatchComment[] => {
  const byId = new Map<string, MatchComment>()

  for (const comment of stored) {
    byId.set(comment.id, comment)
  }

  for (const comment of incoming) {
    const existing = byId.get(comment.id)
    if (!existing) {
      byId.set(comment.id, comment)
      continue
    }

    byId.set(comment.id, mergeMatchComment(existing, comment))
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
