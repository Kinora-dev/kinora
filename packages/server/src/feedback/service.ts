import { createFeedbackTask } from '../lib/feedback-tracker'

export type FeedbackType = 'bug' | 'feature'

interface CreateFeedbackParams {
  type: FeedbackType
  title: string
  description: string
  userEmail: string
}

export async function createFeedbackIssue(params: CreateFeedbackParams) {
  return createFeedbackTask({
    title: params.title,
    description: `${params.description}\n\nSubmitted by: ${params.userEmail}`,
    labels: ['user-feedback', params.type],
  })
}
