import { readApiError } from './apiClient'
import type { UpdateNote } from './types'

type UpdatesResponse = {
  updates: UpdateNote[]
  error?: string
}

type UpdateResponse = {
  update: UpdateNote
  error?: string
}

export const fetchUpdateNotes = async (): Promise<UpdateNote[]> => {
  const response = await fetch('/api/updates')

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not load updates.'))
  }

  const data = (await response.json()) as UpdatesResponse
  return data.updates ?? []
}

export const createUpdateNoteRemote = async (note: UpdateNote): Promise<UpdateNote> => {
  const response = await fetch('/api/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not save update.'))
  }

  const data = (await response.json()) as UpdateResponse
  return data.update
}

export const deleteUpdateNoteRemote = async (id: number): Promise<void> => {
  const response = await fetch(`/api/updates/${id}`, { method: 'DELETE' })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not delete update.'))
  }
}
