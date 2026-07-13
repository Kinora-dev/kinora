import { stowlineConfig } from '../lib/env'
import { stowline } from '../lib/stowline'

export type FeedbackType = 'bug' | 'feature'

interface CreateFeedbackParams {
  type: FeedbackType
  title: string
  description: string
  userEmail: string
}

export async function createFeedbackIssue(params: CreateFeedbackParams) {
  if (!stowline || !stowlineConfig)
    throw new Error('Feedback is not configured')

  return stowline.issues.create.mutate({
    projectId: stowlineConfig.projectId,
    title: params.title,
    description: params.description,
    labels: ['user-feedback', params.type],
    status: 'backlog',
    metadata: {
      submittedBy: params.userEmail,
    },
  })
}
