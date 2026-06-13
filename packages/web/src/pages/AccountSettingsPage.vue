<script setup lang="ts">
import type { ColorMode } from '@kinora/ui/theme'
import { Badge } from '@kinora/ui/badge'
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kinora/ui/form'
import { Input } from '@kinora/ui/input'
import { colorMode } from '@kinora/ui/theme'
import { toTypedSchema } from '@vee-validate/zod'
import { CircleAlert, CircleCheck, Monitor, Moon, Sun } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { computed, ref } from 'vue'
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

// --- Email (plain ref: a single field, sidesteps the vee-validate/Input prefill binding quirk) ---
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

async function resendVerification(): Promise<void> {
  const email = session.user.value?.email
  if (!email)
    return
  resending.value = true
  const { error } = await authClient.sendVerificationEmail({ email, callbackURL: '/settings/account' })
  resending.value = false
  if (error) {
    toast.error(error.message ?? 'Could not send verification email')
    return
  }
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
            :disabled="resending"
            class="self-start font-mono text-xs"
            @click="resendVerification"
          >
            {{ resending ? 'Sending…' : 'Resend verification email' }}
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
  </div>
</template>
