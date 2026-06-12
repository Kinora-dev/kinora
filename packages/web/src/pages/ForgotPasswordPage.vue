<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kinora/ui/form'
import { Input } from '@kinora/ui/input'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { z } from 'zod'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import { authClient } from '@/lib/auth'

const serverError = ref('')
const sent = ref(false)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(z.object({
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  })),
  initialValues: { email: '' },
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  const { error } = await authClient.requestPasswordReset({
    email: values.email,
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) {
    serverError.value = error.message ?? 'Could not send the reset email'
    return
  }
  // Same response whether the account exists or not: no account enumeration.
  sent.value = true
})

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'
</script>

<template>
  <AuthLayout tag="Reset your password">
    <div v-if="sent" class="flex flex-col gap-4">
      <p class="text-sm leading-relaxed text-muted-foreground">
        If an account exists for that address, a reset link is on its way.
        Check your inbox (and spam folder).
      </p>
      <RouterLink to="/login" class="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Back to sign in
      </RouterLink>
    </div>

    <form v-else class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <FormField v-slot="{ componentField }" name="email">
        <FormItem>
          <FormLabel :class="labelClass">
            Email
          </FormLabel>
          <FormControl>
            <Input type="email" placeholder="you@team.dev" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <p v-if="serverError" class="font-mono text-xs text-fail">
        {{ serverError }}
      </p>

      <Button type="submit" :disabled="isSubmitting" class="font-mono text-xs">
        {{ isSubmitting ? 'Sending…' : 'Send reset link' }}
      </Button>

      <p class="text-center text-sm text-muted-foreground">
        Remembered it?
        <RouterLink to="/login" class="text-foreground underline-offset-4 hover:underline">
          Sign in
        </RouterLink>
      </p>
    </form>
  </AuthLayout>
</template>
