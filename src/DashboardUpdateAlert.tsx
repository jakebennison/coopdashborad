import { useEffect, useMemo } from 'react'
import {
  buildReleaseVersionMap,
  formatReleaseLabel,
  getUpdateSummary,
} from './updateNotificationUtils'
import type { UpdateNote } from './types'

type DashboardUpdateAlertProps = {
  unseenUpdates: UpdateNote[]
  allUpdates: UpdateNote[]
  onDismiss: () => void
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
        <p className="record-display-font text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
          What&apos;s new
        </p>
        <h2 id="dashboard-update-title" className="record-display-font mt-3 text-xl font-bold uppercase leading-tight sm:text-2xl">
          Dashboard Update {releaseLabel}
        </h2>

        <div className="dashboard-update-alert__body mt-4">
          {unseenUpdates.map((update) => (
            <article key={update.id} className="dashboard-update-alert__entry">
              <p className="text-sm font-semibold text-ink">{update.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{getUpdateSummary(update.body)}</p>
            </article>
          ))}
        </div>

        <button type="button" onClick={onDismiss} className="btn-primary mt-5 w-full px-5 py-3 text-sm font-semibold">
          Continue to dashboard
        </button>
      </div>
    </div>
  )
}
