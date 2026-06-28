<script setup lang="ts">
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@kinora/ui/alert-dialog'
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { SegmentedControl } from '@kinora/ui/segmented-control'
import { Check, Copy, Mail, ShieldCheck, Trash2, UserPlus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { z } from 'zod'
import { useDemo } from '@/composables/queries'
import { useOrg } from '@/composables/useOrg'
import { session } from '@/lib/session'

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

const ROLES = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const

const { members, invitations, loading, inviting, myRole, isAdmin, invite, removeMember, updateRole, cancelInvitation } = useOrg()
const isDemo = useDemo()

const myUserId = computed(() => session.user.value?.id)

const inviteEmail = ref('')
const inviteRole = ref<'member' | 'admin'>('member')
const inviteLink = ref('')
const copied = ref(false)

const ROLE_HINTS = {
  member: 'View-only: dashboards, runs, and traces.',
  admin: 'Can manage projects, alerts, API tokens, and invite teammates.',
} as const
const emailValid = computed(() => z.email().safeParse(inviteEmail.value.trim()).success)

async function onInvite(): Promise<void> {
  const id = await invite(inviteEmail.value, inviteRole.value)
  if (id) {
    inviteLink.value = `${window.location.origin}/accept-invite/${id}`
    inviteEmail.value = ''
  }
}

async function copyLink(): Promise<void> {
  await navigator.clipboard.writeText(inviteLink.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function initialOf(m: { user?: { name?: string | null, email?: string | null } }): string {
  return (m.user?.name || m.user?.email || '?').charAt(0).toUpperCase()
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Team</CardTitle>
      <CardDescription>Everyone on your plan. Seats are unlimited - invite the whole team.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-5">
      <div v-if="loading" class="py-3 text-center font-mono text-xs text-muted-foreground">
        Loading…
      </div>

      <template v-else>
        <!-- Members -->
        <ul class="flex flex-col divide-y divide-border/70">
          <li v-for="m in members" :key="m.id" class="flex items-center gap-3 py-2.5">
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-signal/15 font-mono text-xs font-semibold text-signal">
              {{ initialOf(m) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ m.user?.name || m.user?.email }}
                <span v-if="m.userId === myUserId" class="text-muted-foreground">(you)</span>
              </p>
              <p class="truncate font-mono text-[11px] text-muted-foreground">
                {{ m.user?.email }}
              </p>
            </div>
            <span
              class="flex items-center gap-1 font-mono text-[11px] tracking-wider uppercase"
              :class="m.role === 'owner' ? 'text-signal' : 'text-muted-foreground'"
            >
              <ShieldCheck v-if="m.role !== 'member'" class="size-3" />
              {{ m.role }}
            </span>

            <!-- Admin controls (not on the owner, not on yourself) -->
            <div v-if="isAdmin && m.role !== 'owner' && m.userId !== myUserId" class="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="font-mono text-[11px] text-muted-foreground"
                :disabled="isDemo"
                @click="updateRole(m.id, m.role === 'admin' ? 'member' : 'admin')"
              >
                {{ m.role === 'admin' ? 'Make member' : 'Make admin' }}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="size-8 text-muted-foreground hover:text-fail"
                    aria-label="Remove member"
                    :disabled="isDemo"
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {{ m.user?.name || m.user?.email }}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      They lose access to this workspace. You can invite them again later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="removeMember(m.id)">
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        </ul>

        <!-- Invite (admins only) -->
        <template v-if="isAdmin">
          <div v-if="inviteLink" class="flex flex-col gap-2 rounded-md border border-signal/30 bg-signal/5 px-4 py-3">
            <p :class="labelClass">
              Share this invite link
            </p>
            <div class="flex items-center gap-2">
              <code class="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">{{ inviteLink }}</code>
              <Button type="button" variant="outline" size="sm" class="shrink-0 font-mono text-xs" @click="copyLink">
                <component :is="copied ? Check : Copy" class="size-3.5" />
                {{ copied ? 'Copied' : 'Copy' }}
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label :class="labelClass" for="invite-email">Invite by email</label>
            <div class="flex flex-wrap items-center gap-2">
              <Input id="invite-email" v-model="inviteEmail" type="email" placeholder="teammate@company.com" class="min-w-48 flex-1" @keydown.enter.prevent="onInvite" />
              <SegmentedControl
                :model-value="inviteRole"
                :options="ROLES"
                @update:model-value="(v) => inviteRole = v as 'member' | 'admin'"
              />
              <Button type="button" size="sm" class="font-mono text-xs" :disabled="inviting || !emailValid || isDemo" @click="onInvite">
                <UserPlus class="size-3.5" />
                {{ inviting ? 'Inviting…' : 'Invite' }}
              </Button>
            </div>
            <p class="font-mono text-[11px] text-muted-foreground">
              <span class="text-foreground">{{ inviteRole }}</span> · {{ ROLE_HINTS[inviteRole] }}
            </p>
          </div>

          <!-- Pending invitations -->
          <div v-if="invitations.length" class="flex flex-col gap-2">
            <span :class="labelClass">Pending invitations</span>
            <ul class="flex flex-col divide-y divide-border/70">
              <li v-for="inv in invitations" :key="inv.id" class="flex items-center gap-3 py-2">
                <Mail class="size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0 flex-1 truncate text-sm">{{ inv.email }}</span>
                <span class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{{ inv.role }}</span>
                <Button type="button" variant="ghost" size="sm" class="font-mono text-[11px] text-muted-foreground hover:text-fail" :disabled="isDemo" @click="cancelInvitation(inv.id)">
                  Cancel
                </Button>
              </li>
            </ul>
          </div>
        </template>

        <p v-else class="font-mono text-[11px] text-muted-foreground">
          Only admins can invite or manage members. Your role: {{ myRole }}.
        </p>
      </template>
    </CardContent>
  </Card>
</template>
