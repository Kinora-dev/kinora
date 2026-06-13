import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import { artifact, member, organization, project } from '../db/schemas/index'
import { logger } from './logger'
import { storage } from './storage'

// Deleting the user cascades member/session/account but NOT the orgs they own (no userId FK on
// organization), and storage blobs are never covered by FK cascade. Drop both here before delete.
export async function purgeUserOwnedData(userId: string): Promise<void> {
  const owned = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, 'owner')))
  const orgIds = owned.map(o => o.organizationId)
  if (orgIds.length === 0)
    return

  const projects = await db.select({ id: project.id }).from(project).where(inArray(project.organizationId, orgIds))
  const projectIds = projects.map(p => p.id)
  if (projectIds.length > 0) {
    const blobs = await db.select({ key: artifact.storageKey }).from(artifact).where(inArray(artifact.projectId, projectIds))
    for (const blob of blobs) {
      try {
        await storage.delete(blob.key)
      }
      catch (error) {
        logger.error({ error, key: blob.key }, 'account purge: blob delete failed')
      }
    }
  }

  // Cascades project -> run/test/artifact + subscription/member/invitation.
  await db.delete(organization).where(inArray(organization.id, orgIds))
}
