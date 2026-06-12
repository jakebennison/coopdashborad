import type { Match, MatchComment, MatchCommentReply } from './types'

export { mergeMatchComments } from './commentMerge'

export const COMMENT_AUTHOR_STORAGE_KEY = 'psg-coop-comment-author'
export const DEFAULT_COMMENT_AUTHOR = 'Co-op player'

export const createCommentId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const readDefaultCommentAuthor = () => {
  if (typeof window === 'undefined') return DEFAULT_COMMENT_AUTHOR
  return window.localStorage.getItem(COMMENT_AUTHOR_STORAGE_KEY)?.trim() || DEFAULT_COMMENT_AUTHOR
}

export const writeDefaultCommentAuthor = (author: string) => {
  const trimmed = author.trim()
  if (!trimmed || typeof window === 'undefined') return
  window.localStorage.setItem(COMMENT_AUTHOR_STORAGE_KEY, trimmed)
}

export const createMatchComment = (
  body: string,
  author = readDefaultCommentAuthor(),
): MatchComment => ({
  id: createCommentId(),
  author: author.trim() || DEFAULT_COMMENT_AUTHOR,
  body: body.trim(),
  createdAt: new Date().toISOString(),
  likes: 0,
  likedByMe: false,
  replies: [],
})

export const createMatchCommentReply = (
  body: string,
  author = readDefaultCommentAuthor(),
): MatchCommentReply => ({
  id: createCommentId(),
  author: author.trim() || DEFAULT_COMMENT_AUTHOR,
  body: body.trim(),
  createdAt: new Date().toISOString(),
  likes: 0,
  likedByMe: false,
})

export const migrateMatchComments = (match: Match): Match => {
  if (match.comments?.length) {
    return { ...match, comments: match.comments }
  }

  const legacyComment = match.comment?.trim()
  if (legacyComment) {
    return {
      ...match,
      comments: [
        {
          ...createMatchComment(legacyComment),
          createdAt: `${match.date}T12:00:00.000Z`,
        },
      ],
    }
  }

  return { ...match, comments: [] }
}

export const getPrimaryCommentPreview = (match: Match) => match.comments?.[0]?.body ?? null

export const formatCommentTimestamp = (isoDate: string) => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const getAuthorInitial = (author: string) => {
  const trimmed = author.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
}

export const toggleCommentLike = (comments: MatchComment[], commentId: string): MatchComment[] =>
  comments.map((comment) => {
    if (comment.id !== commentId) return comment

    const likedByMe = !comment.likedByMe
    return {
      ...comment,
      likedByMe,
      likes: Math.max(0, comment.likes + (likedByMe ? 1 : -1)),
    }
  })

export const toggleReplyLike = (
  comments: MatchComment[],
  commentId: string,
  replyId: string,
): MatchComment[] =>
  comments.map((comment) => {
    if (comment.id !== commentId) return comment

    return {
      ...comment,
      replies: comment.replies.map((reply) => {
        if (reply.id !== replyId) return reply

        const likedByMe = !reply.likedByMe
        return {
          ...reply,
          likedByMe,
          likes: Math.max(0, reply.likes + (likedByMe ? 1 : -1)),
        }
      }),
    }
  })

export const addCommentReply = (
  comments: MatchComment[],
  commentId: string,
  reply: MatchCommentReply,
): MatchComment[] =>
  comments.map((comment) =>
    comment.id === commentId
      ? { ...comment, replies: [...comment.replies, reply] }
      : comment,
  )
