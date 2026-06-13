<script setup lang="ts">
import type { ColorMode } from '@kinora/ui/theme'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@kinora/ui/alert-dialog'
import { Badge } from '@kinora/ui/badge'
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kinora/ui/form'
import { Input } from '@kinora/ui/input'
import { colorMode } from '@kinora/ui/theme'
import { toTypedSchema } from '@vee-validate/zod'
import { CircleAlert, CircleCheck, Monitor, Moon, Sun } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { z } from 'zod'
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

// Social-only users have no password credential: email/password editing is hidden for them.
const hasPassword = computed(() => session.user.value?.hasPassword ?? false)

const themeOptions = [
  { value: 'auto', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const

function setTheme(value: ColorMode): void {
  colorMode.value = value
}

const emailInput = ref(session.user.value?.email ?? '')
const emailError = ref('')
const emailSaving = ref(false)
const emailValid = computed(() => z.email().safeParse(emailInput.value.trim()).success)
const canSaveEmail = computed(() => emailValid.value && emailInput.value.trim() !== (session.user.value?.email ?? ''))

async function updateEmail(): Promise<void> {
  emailError.value = ''
  const next = emailInput.value.trim()
  emailSaving.value = true
  const { error } = await authClient.changeEmail({ newEmail: next })
  emailSaving.value = false
  if (error) {
    emailError.value = error.message ?? 'Could not update email'
    return
  }
  await session.refresh()
  toast.success('Email updated')
}

// No SMTP on the server: hide verification UI entirely (can't verify or resend).
const mailerEnabled = computed(() => session.user.value?.mailerEnabled ?? false)
const emailVerified = computed(() => session.user.value?.emailVerified ?? false)
const resending = ref(false)

const COOLDOWN_SECONDS = 30
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | undefined

function startCooldown(): void {
  cooldown.value = COOLDOWN_SECONDS
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = undefined
    }
  }, 1000)
}

onUnmounted(() => {
  if (cooldownTimer)
    clearInterval(cooldownTimer)
})

async function resendVerification(): Promise<void> {
  const email = session.user.value?.email
  if (!email || resending.value || cooldown.value > 0)
    return
  resending.value = true
  const { error } = await authClient.sendVerificationEmail({ email, callbackURL: `${window.location.origin}/settings/account` })
  resending.value = false
  if (error) {
    toast.error(error.message ?? 'Could not send verification email')
    return
  }
  startCooldown()
  toast.success('Verification email sent')
}

// --- Password ---
const { handleSubmit: submitPassword, isSubmitting: pwSubmitting, resetForm: resetPw, setFieldError: setPwError, meta: pwMeta } = useForm({
  validationSchema: toTypedSchema(
    z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'At least 8 characters'),
      confirmPassword: z.string().min(1, 'Confirm your password'),
    }).refine(d => d.newPassword === d.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
  ),
  initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
})

const onPassword = submitPassword(async (values) => {
  const { error } = await authClient.changePassword({
    currentPassword: values.currentPassword,
    newPassword: values.newPassword,
    revokeOtherSessions: true,
  })
  if (error) {
    setPwError('currentPassword', error.message ?? 'Could not change password')
    return
  }
  resetPw()
  toast.success('Password changed')
})

// --- Delete account ---
const router = useRouter()
const deleting = ref(false)
const deletePassword = ref('')
const deleteConfirm = ref('')

// social-only users have none, so confirm by typing their email instead.
const canDelete = computed(() => hasPassword.value
  ? deletePassword.value.length > 0
  : deleteConfirm.value.trim() === (session.user.value?.email ?? ''))

async function deleteAccount(): Promise<void> {
  deleting.value = true
  const { error } = await authClient.deleteUser(hasPassword.value ? { password: deletePassword.value } : {})
  deleting.value = false
  if (error) {
    toast.error(error.message ?? 'Could not delete account')
    return
  }
  session.setUser(null)
  router.push('/login')
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Appearance -->
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Light, dark, or match your system.</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex gap-2">
          <Button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            variant="outline"
            size="sm"
            class="font-mono text-xs"
            :class="colorMode === opt.value ? 'border-signal/60 text-signal' : 'text-muted-foreground'"
            @click="setTheme(opt.value)"
          >
            <component :is="opt.icon" class="size-3.5" />
            {{ opt.label }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Email -->
    <Card v-if="hasPassword">
      <CardHeader>
        <div class="flex items-center gap-2.5">
          <CardTitle>Email</CardTitle>
          <Badge v-if="mailerEnabled && emailVerified" variant="outline" class="border-pass/40 text-pass">
            <CircleCheck />
            Verified
          </Badge>
          <Badge v-else-if="mailerEnabled" variant="outline" class="border-flaky/40 text-flaky">
            <CircleAlert />
            Not verified
          </Badge>
        </div>
        <CardDescription>The address you sign in with.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="updateEmail">
          <div class="grid gap-2">
            <label :class="labelClass" for="settings-email">Email</label>
            <Input id="settings-email" v-model="emailInput" type="email" autocomplete="email" />
            <p v-if="emailError" class="text-sm text-destructive">
              {{ emailError }}
            </p>
          </div>
          <Button type="submit" :disabled="emailSaving || !canSaveEmail" size="sm" class="self-start font-mono text-xs">
            {{ emailSaving ? 'Saving…' : 'Update email' }}
          </Button>
        </form>

        <div v-if="mailerEnabled && !emailVerified" class="mt-5 flex flex-col gap-2 border-t border-border pt-5">
          <p class="text-sm text-muted-foreground">
            Verify your email to secure address and password changes.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="resending || cooldown > 0"
            class="self-start font-mono text-xs"
            @click="resendVerification"
          >
            {{ cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Password -->
    <Card v-if="hasPassword">
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Changing it signs out your other sessions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit="onPassword">
          <FormField v-slot="{ componentField }" name="currentPassword">
            <FormItem>
              <FormLabel :class="labelClass">
                Current password
              </FormLabel>
              <FormControl>
                <Input type="password" autocomplete="current-password" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="newPassword">
            <FormItem>
              <FormLabel :class="labelClass">
                New password
              </FormLabel>
              <FormControl>
                <Input type="password" autocomplete="new-password" placeholder="at least 8 characters" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="confirmPassword">
            <FormItem>
              <FormLabel :class="labelClass">
                Confirm new password
              </FormLabel>
              <FormControl>
                <Input type="password" autocomplete="new-password" placeholder="••••••••" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <Button type="submit" :disabled="pwSubmitting || !pwMeta.valid" size="sm" class="self-start font-mono text-xs">
            {{ pwSubmitting ? 'Saving…' : 'Change password' }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <!-- Danger zone -->
    <Card class="border-fail/30">
      <CardHeader>
        <CardTitle class="text-fail">
          Danger zone
        </CardTitle>
        <CardDescription>Deleting your account removes your workspace and all its projects, runs, and traces. This cannot be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button type="button" variant="destructive" size="sm" class="w-fit font-mono text-xs">
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your workspace and every project, run, and trace in it. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div class="grid gap-2">
              <template v-if="hasPassword">
                <label :class="labelClass" for="delete-password">Enter your password to confirm</label>
                <Input id="delete-password" v-model="deletePassword" type="password" autocomplete="current-password" />
              </template>
              <template v-else>
                <label :class="labelClass" for="delete-confirm">
                  Type <span class="text-foreground normal-case">{{ session.user.value?.email }}</span> to confirm
                </label>
                <Input id="delete-confirm" v-model="deleteConfirm" :placeholder="session.user.value?.email ?? ''" />
              </template>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                class="bg-destructive text-white hover:bg-destructive/90"
                :disabled="!canDelete || deleting"
                @click="deleteAccount"
              >
                {{ deleting ? 'Deleting…' : 'Delete account' }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  </div>
</template>
