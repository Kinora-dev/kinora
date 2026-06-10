import type { Invitation, Member, Organization } from 'better-auth/plugins'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

// better-auth's org endpoints assemble responses at runtime, so the client types `.data` as `any`.
// The schema is stable, so we type it explicitly from the exported shapes (members carry a joined user).
type OrgMember = Member & { user?: { id: string, name?: string | null, email?: string | null, image?: string | null } }
type FullOrg = Organization & { members: OrgMember[], invitations: Invitation[] }
type OrgList = Organization[]
type Role = 'owner' | 'admin' | 'member'

// Shared across the header switcher, settings, and the team card so org state loads once.
const org = ref<FullOrg | null>(null)
const orgs = ref<OrgList>([])
const loading = ref(false)
const inviting = ref(false)
let loaded = false

async function load(): Promise<void> {
  loading.value = true
  const [full, list] = await Promise.all([
    authClient.organization.getFullOrganization(),
    authClient.organization.list(),
  ])
  org.value = (full.data as FullOrg | null) ?? null
  orgs.value = (list.data as OrgList | null) ?? []
  loaded = true
  loading.value = false
}

// Clear the shared cache on sign-out so the next login reloads fresh (avoids a stale switcher).
export function resetOrgState(): void {
  org.value = null
  orgs.value = []
  loaded = false
}

export function useOrg(options?: { autoLoad?: boolean }) {
  const members = computed(() => org.value?.members ?? [])
  const invitations = computed(() => (org.value?.invitations ?? []).filter(i => i.status === 'pending'))

  const myRole = computed<Role | null>(() => {
    const uid = session.user.value?.id
    return (members.value.find(m => m.userId === uid)?.role as Role | undefined) ?? null
  })
  const isAdmin = computed(() => myRole.value === 'owner' || myRole.value === 'admin')
  // Billing maps the Polar customer to the org owner, so only the owner can change the plan.
  const isOwner = computed(() => myRole.value === 'owner')

  async function invite(email: string, role: 'admin' | 'member' = 'member'): Promise<string | null> {
    inviting.value = true
    const { data, error } = await authClient.organization.inviteMember({ email: email.trim(), role })
    inviting.value = false
    if (error || !data) {
      toast.error(error?.message ?? 'Could not send invitation')
      return null
    }
    await load()
    return data.id
  }

  async function removeMember(memberId: string): Promise<void> {
    const { error } = await authClient.organization.removeMember({ memberIdOrEmail: memberId })
    if (error) {
      toast.error(error.message ?? 'Could not remove member')
      return
    }
    toast.success('Member removed')
    await load()
  }

  async function updateRole(memberId: string, role: 'admin' | 'member'): Promise<void> {
    const { error } = await authClient.organization.updateMemberRole({ memberId, role })
    if (error) {
      toast.error(error.message ?? 'Could not update role')
      return
    }
    await load()
  }

  async function cancelInvitation(invitationId: string): Promise<void> {
    const { error } = await authClient.organization.cancelInvitation({ invitationId })
    if (error) {
      toast.error(error.message ?? 'Could not cancel invitation')
      return
    }
    await load()
  }

  async function setActive(organizationId: string): Promise<void> {
    await authClient.organization.setActive({ organizationId })
    // Land on the overview: the current project/run URL may not exist in the new org.
    // Full navigation so every org-scoped query refetches fresh.
    window.location.assign('/')
  }

  if ((options?.autoLoad ?? true) && !loaded && !loading.value)
    onMounted(load)

  return { org, orgs, members, invitations, loading, inviting, myRole, isAdmin, isOwner, invite, removeMember, updateRole, cancelInvitation, setActive, load }
}
