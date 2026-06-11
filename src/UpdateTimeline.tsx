import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type UpdateDateGroup = {
  date: string
  updates: UpdateNote[]
}

const groupUpdatesByDate = (updates: UpdateNote[]): UpdateDateGroup[] => {
  const groups = new Map<string, UpdateNote[]>()

  for (const update of updates) {
    const dateKey = update.date.slice(0, 10)
    const existing = groups.get(dateKey) ?? []
    existing.push(update)
    groups.set(dateKey, existing)
  }

  return [...groups.entries()]
    .sort(([leftDate], [rightDate]) => rightDate.localeCompare(leftDate))
    .map(([date, dateUpdates]) => ({
      date,
      updates: [...dateUpdates].sort((left, right) => right.id - left.id),
    }))
}

export default function UpdateTimeline() {
  const [updates, setUpdates] = useState<UpdateNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set())
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(dateToInputValue(new Date()))
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const groupedUpdates = useMemo(() => groupUpdatesByDate(updates), [updates])

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
      setExpandedDates((current) => new Set(current).add(saved.date.slice(0, 10)))
      setExpandedId(saved.id)
      closeForm()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save update.')
    } finally {
      setSaving(false)
    }
  }

  const toggleDateGroup = (dateKey: string) => {
    setExpandedDates((current) => {
      const next = new Set(current)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
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
              A shared timeline of dashboard changes, grouped by date. Tap a date to expand its updates.
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
            {groupedUpdates.map((group, groupIndex) => {
              const dateExpanded = expandedDates.has(group.date)

              return (
              <li key={group.date} className={`relative ${groupIndex === 0 ? '' : 'mt-10'}`}>
                <span
                  className="absolute -left-[2.05rem] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-[var(--color-ink)]"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => toggleDateGroup(group.date)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg text-left transition hover:bg-soft"
                  aria-expanded={dateExpanded}
                >
                  <p className="record-display-font text-sm font-bold uppercase text-ink sm:text-base">
                    {formatUpdateDate(group.date)}
                  </p>
                  <span className="shrink-0 text-xs font-semibold text-muted">
                    {group.updates.length} update{group.updates.length === 1 ? '' : 's'} {dateExpanded ? '▲' : '▼'}
                  </span>
                </button>
                {dateExpanded ? (
                <ul className="mt-4 space-y-3">
                  {group.updates.map((update) => {
                    const expanded = expandedId === update.id

                    return (
                      <li
                        key={update.id}
                        className="overflow-hidden rounded-xl border border-ink bg-card"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : update.id)}
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-soft"
                          aria-expanded={expanded}
                        >
                          <h3 className="record-display-font text-base font-bold text-ink sm:text-lg">
                            {update.title}
                          </h3>
                          <span className="shrink-0 text-sm text-muted">{expanded ? '▲' : '▼'}</span>
                        </button>
                        {expanded ? (
                          <div className="border-t border-ink bg-soft px-4 py-4">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                              {update.body}
                            </p>
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
                </ul>
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
