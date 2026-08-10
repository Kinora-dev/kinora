import { feedbackTrackerConfig } from './env'

interface CreateTaskParams {
  title: string
  description: string
  labels: string[]
}

interface KaneoTask {
  id: string
}

interface KaneoLabel {
  id: string
}

async function kaneoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!feedbackTrackerConfig)
    throw new Error('Feedback tracker is not configured')

  const response = await fetch(`${feedbackTrackerConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${feedbackTrackerConfig.apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Feedback tracker request failed (${response.status}): ${body}`)
  }

  return response.json() as Promise<T>
}

function labelColor(name: string) {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899']
  let hash = 0
  for (const char of name)
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]!
}

export async function createFeedbackTask(params: CreateTaskParams) {
  const config = feedbackTrackerConfig
  if (!config)
    throw new Error('Feedback tracker is not configured')

  const task = await kaneoRequest<KaneoTask>(`/api/task/${encodeURIComponent(config.projectId)}`, {
    method: 'POST',
    body: JSON.stringify({
      title: params.title,
      description: params.description,
      status: 'to-do',
      priority: 'no-priority',
    }),
  })

  await Promise.all(params.labels.map(label => kaneoRequest<KaneoLabel>('/api/label', {
    method: 'POST',
    body: JSON.stringify({
      name: label,
      color: labelColor(label),
      workspaceId: config.workspaceId,
      taskId: task.id,
    }),
  })))

  return task
}

export const feedbackEnabled = feedbackTrackerConfig !== null
