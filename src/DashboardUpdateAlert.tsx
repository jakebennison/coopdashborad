import { useEffect, useMemo } from 'react'
import {
  buildReleaseVersionMap,
  formatReleaseLabel,
  parseUpdateBody,
} from './updateNotificationUtils'
import type { UpdateNote } from './types'

type DashboardUpdateAlertProps = {
  unseenUpdates: UpdateNote[]
  allUpdates: UpdateNote[]
  onDismiss: () => void
}

function UpdateAlertEntry({ update }: { update: UpdateNote }) {
  const { intro, bullets } = parseUpdateBody(update.body)

  return (
    <article className="dashboard-update-alert__entry">
      <p className="text-sm font-semibold text-ink">{update.title}</p>
      {intro ? <p className="dashboard-update-alert__intro">{intro}</p> : null}
      {bullets.length ? (
        <ul className="dashboard-update-alert__list">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-update-alert__intro">{update.body.trim()}</p>
      )}
    </article>
  )
}

export default function DashboardUpdateAlert({
  unseenUpdates,
  allUpdates,
  onDismiss,
}: DashboardUpdateAlertProps) {
  const versionMap = useMemo(() => buildReleaseVersionMap(allUpdates), [allUpdates])

  const releaseLabel = useMemo(() => {
    const versions = unseenUpdates.map((update) => versionMap.get(update.id) ?? '1.0')
    return formatReleaseLabel(versions)
  }, [unseenUpdates, versionMap])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (!unseenUpdates.length) return null

  return (
    <div className="dashboard-update-alert" role="dialog" aria-modal="true" aria-labelledby="dashboard-update-title">
      <div className="dashboard-update-alert__panel">
        <header className="dashboard-update-alert__header">
          <span className="dashboard-update-alert__eyebrow">Dashboard update</span>
          <h2 id="dashboard-update-title" className="record-display-font dashboard-update-alert__title">
            Update {releaseLabel}
          </h2>
        </header>

        <div className="dashboard-update-alert__body">
          {unseenUpdates.map((update) => (
            <UpdateAlertEntry key={update.id} update={update} />
          ))}
        </div>

        <footer className="dashboard-update-alert__footer">
          <button type="button" onClick={onDismiss} className="btn-primary w-full px-5 py-3 text-sm font-semibold">
            Continue to dashboard
          </button>
        </footer>
      </div>
    </div>
  )
}
