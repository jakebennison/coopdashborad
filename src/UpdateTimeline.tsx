import { useEffect, useState, type FormEvent } from 'react'
import { createUpdateNoteRemote, deleteUpdateNoteRemote, fetchUpdateNotes } from './updatesApi'
import type { UpdateNote } from './types'

const panelClass = 'card'
const headingClass = 'record-display-font text-base font-bold uppercase sm:text-lg'
const inputClass = 'field-input px-4 py-3'
const labelClass = 'record-display-font mb-2 block text-xs font-bold uppercase'
const secondaryButtonClass = 'btn-secondary px-4 py-2'
const primaryButtonClass = 'btn-primary px-5 py-3'

const dateToInputValue = (date: Date) => date.toISOString().slice(0, 10)

const formatUpdateDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function UpdateTimeline() {
  const [updates, setUpdates] = useState<UpdateNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(dateToInputValue(new Date()))
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const loadUpdates = async () => {
    setLoading(true)
    try {
      const loaded = await fetchUpdateNotes()
      setUpdates(loaded)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load updates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUpdates()
  }, [])

  const resetForm = () => {
    setTitle('')
    setDate(dateToInputValue(new Date()))
    setBody('')
    setError(null)
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
  }

  const submitUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !body.trim()) {
      setError('Add a title and update notes.')
      return
    }

    setSaving(true)
    try {
      const saved = await createUpdateNoteRemote({
        id: Date.now(),
        title: title.trim(),
        body: body.trim(),
        date,
        createdAt: new Date().toISOString(),
      })
      setUpdates((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)])
      setExpandedId(saved.id)
      closeForm()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save update.')
    } finally {
      setSaving(false)
    }
  }

  const removeUpdate = async (id: number) => {
    try {
      await deleteUpdateNoteRemote(id)
      setUpdates((current) => current.filter((entry) => entry.id !== id))
      if (expandedId === id) setExpandedId(null)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete update.')
    }
  }

  return (
    <main className="grid gap-6">
      <section className={`${panelClass} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="record-display-font text-xs font-bold uppercase text-muted">Changelog</p>
            <h2 className={`${headingClass} mt-1`}>Tool updates</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              A shared timeline of dashboard changes. Tap an entry to read what was updated.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-lg border border-ink/20 bg-card px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-ink hover:text-ink"
          >
            + Add update
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-ink bg-danger px-4 py-3 text-sm font-medium text-[#EE5D50]">
          {error}
        </div>
      ) : null}

      {showForm ? (
        <section className={`${panelClass} p-6`}>
          <form className="grid gap-4" onSubmit={submitUpdate}>
            <div className="flex items-center justify-between gap-3">
              <h3 className={headingClass}>New update entry</h3>
              <button type="button" onClick={closeForm} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
            <label className="block">
              <span className={labelClass}>Title</span>
              <input
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Screenshot archive added"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Date</span>
              <input
                className={inputClass}
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Notes</span>
              <textarea
                className={`${inputClass} min-h-32 resize-y`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="What changed in this update?"
              />
            </label>
            <button type="submit" disabled={saving} className={`${primaryButtonClass} w-fit`}>
              {saving ? 'Saving…' : 'Save update'}
            </button>
          </form>
        </section>
      ) : null}

      <section className={`${panelClass} p-6 sm:p-8`}>
        {loading ? (
          <p className="text-sm text-muted">Loading updates…</p>
        ) : updates.length ? (
          <ol className="relative ml-3 border-l border-ink/20 pl-8">
            {updates.map((update, index) => {
              const expanded = expandedId === update.id

              return (
                <li key={update.id} className={`relative ${index === 0 ? '' : 'mt-8'}`}>
                  <span
                    className={`absolute -left-[2.05rem] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-card ${
                      expanded ? 'bg-[var(--color-ink)]' : ''
                    }`}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : update.id)}
                    className="w-full text-left"
                    aria-expanded={expanded}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {formatUpdateDate(update.date)}
                        </p>
                        <h3 className="record-display-font mt-1 text-lg font-bold text-ink sm:text-xl">
                          {update.title}
                        </h3>
                      </div>
                      <span className="text-sm text-muted">{expanded ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {expanded ? (
                    <div className="mt-4 rounded-xl border border-ink bg-soft px-4 py-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{update.body}</p>
                      <button
                        type="button"
                        onClick={() => void removeUpdate(update.id)}
                        className="mt-4 text-xs font-semibold text-[#EE5D50] transition hover:underline"
                      >
                        Delete entry
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink px-6 py-10 text-center">
            <p className="font-semibold text-ink">No updates yet</p>
            <p className="mt-1 text-sm text-muted">Use + Add update to log the first changelog entry.</p>
          </div>
        )}
      </section>
    </main>
  )
}
