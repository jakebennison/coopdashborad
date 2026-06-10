import { useEffect, useState } from 'react'
import {
  addCommentReply,
  createMatchComment,
  createMatchCommentReply,
  formatCommentTimestamp,
  getAuthorInitial,
  readDefaultCommentAuthor,
  toggleCommentLike,
  toggleReplyLike,
  writeDefaultCommentAuthor,
} from './commentUtils'
import type { Match, MatchComment, MatchCommentReply } from './types'

const inputClass = 'field-input px-4 py-3'
const labelClass = 'record-display-font mb-2 block text-xs font-bold uppercase'
const headingClass = 'record-display-font text-base font-bold uppercase sm:text-lg'
const primaryButtonClass = 'btn-primary px-5 py-3'
const secondaryButtonClass = 'btn-secondary px-5 py-3'

type MatchCommentsProps = {
  match: Match
  onUpdateComments: (comments: MatchComment[]) => void
}

export default function MatchComments({ match, onUpdateComments }: MatchCommentsProps) {
  const comments = match.comments ?? []
  const [author, setAuthor] = useState(readDefaultCommentAuthor)
  const [newComment, setNewComment] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [showComposer, setShowComposer] = useState(false)

  useEffect(() => {
    setReplyingToId(null)
    setReplyDraft('')
    setNewComment('')
    setShowComposer(false)
  }, [match.id])

  const postComment = () => {
    const body = newComment.trim()
    if (!body) return

    writeDefaultCommentAuthor(author)
    onUpdateComments([createMatchComment(body, author), ...comments])
    setNewComment('')
    setShowComposer(false)
  }

  const postReply = (commentId: string) => {
    const body = replyDraft.trim()
    if (!body) return

    writeDefaultCommentAuthor(author)
    onUpdateComments(
      addCommentReply(comments, commentId, createMatchCommentReply(body, author)),
    )
    setReplyingToId(null)
    setReplyDraft('')
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={headingClass}>Match comments</h3>
          <p className="mt-1 text-sm text-muted">
            Share co-op notes, reactions, and follow-ups on this game.
          </p>
        </div>
        <span className="badge-outline">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      <div className="mt-5 grid gap-4">
        {comments.length ? (
          comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              author={author}
              replyingToId={replyingToId}
              replyDraft={replyDraft}
              onToggleLike={() => onUpdateComments(toggleCommentLike(comments, comment.id))}
              onToggleReplyLike={(replyId) =>
                onUpdateComments(toggleReplyLike(comments, comment.id, replyId))
              }
              onReply={() => {
                setReplyingToId(comment.id)
                setReplyDraft('')
              }}
              onCancelReply={() => {
                setReplyingToId(null)
                setReplyDraft('')
              }}
              onReplyDraftChange={setReplyDraft}
              onPostReply={() => postReply(comment.id)}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-ink bg-card px-5 py-8 text-center">
            <p className="font-semibold text-ink">No comments yet</p>
            <p className="mt-1 text-sm text-muted">Be the first to leave a note on this match.</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        {showComposer ? (
          <div className="rounded-2xl border border-ink bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Leave a comment</p>
              <button
                type="button"
                onClick={() => {
                  setShowComposer(false)
                  setNewComment('')
                }}
                className="text-sm font-semibold text-muted transition hover:text-ink"
              >
                Cancel
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
              <label className="block">
                <span className={labelClass}>Your name</span>
                <input
                  className={inputClass}
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Co-op player"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Comment</span>
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  value={newComment}
                  placeholder="What stood out in this match?"
                  onChange={(event) => setNewComment(event.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={postComment}
              disabled={!newComment.trim()}
              className={`${primaryButtonClass} mt-4`}
            >
              Post comment
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className={`${secondaryButtonClass} w-full`}
          >
            Leave a comment
          </button>
        )}
      </div>
    </section>
  )
}

function CommentThread({
  comment,
  author,
  replyingToId,
  replyDraft,
  onToggleLike,
  onToggleReplyLike,
  onReply,
  onCancelReply,
  onReplyDraftChange,
  onPostReply,
}: {
  comment: MatchComment
  author: string
  replyingToId: string | null
  replyDraft: string
  onToggleLike: () => void
  onToggleReplyLike: (replyId: string) => void
  onReply: () => void
  onCancelReply: () => void
  onReplyDraftChange: (value: string) => void
  onPostReply: () => void
}) {
  const isReplying = replyingToId === comment.id

  return (
    <article className="rounded-2xl border border-ink bg-card p-4">
      <CommentBody comment={comment} onToggleLike={onToggleLike} onReply={onReply} />

      {comment.replies.length ? (
        <div className="mt-4 space-y-3 border-l-2 border-ink pl-4">
          {comment.replies.map((reply) => (
            <ReplyBody
              key={reply.id}
              reply={reply}
              onToggleLike={() => onToggleReplyLike(reply.id)}
            />
          ))}
        </div>
      ) : null}

      {isReplying ? (
        <div className="mt-4 rounded-2xl border border-ink bg-card p-4">
          <p className="text-sm font-semibold text-ink">
            Reply as {author.trim() || 'Co-op player'}
          </p>
          <textarea
            className={`${inputClass} mt-3 min-h-20 resize-y`}
            value={replyDraft}
            placeholder={`Reply to ${comment.author}...`}
            onChange={(event) => onReplyDraftChange(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPostReply}
              disabled={!replyDraft.trim()}
              className={primaryButtonClass}
            >
              Post reply
            </button>
            <button
              type="button"
              onClick={onCancelReply}
              className={`${secondaryButtonClass}`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function CommentBody({
  comment,
  onToggleLike,
  onReply,
}: {
  comment: MatchComment | MatchCommentReply
  onToggleLike: () => void
  onReply?: () => void
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink bg-[var(--color-primary-bg)] text-sm font-bold text-[var(--color-primary-text)]">
        {getAuthorInitial(comment.author)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold text-ink">{comment.author}</p>
          <span className="text-xs text-muted">{formatCommentTimestamp(comment.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {comment.body}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold">
          <button
            type="button"
            onClick={onToggleLike}
            className={`transition ${
              comment.likedByMe ? 'text-[#DA291C]' : 'text-muted hover:text-ink'
            }`}
          >
            {comment.likedByMe ? '♥ Liked' : '♡ Like'}
            {comment.likes ? ` · ${comment.likes}` : ''}
          </button>
          {onReply ? (
            <button
              type="button"
              onClick={onReply}
              className="text-muted transition hover:text-ink"
            >
              Reply
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ReplyBody({
  reply,
  onToggleLike,
}: {
  reply: MatchCommentReply
  onToggleLike: () => void
}) {
  return (
    <div className="rounded-xl bg-card p-3">
      <CommentBody comment={reply} onToggleLike={onToggleLike} />
    </div>
  )
}
