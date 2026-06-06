<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kinora/ui/form'
import { Input } from '@kinora/ui/input'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { z } from 'zod'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import SocialButtons from '@/components/auth/SocialButtons.vue'
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

const router = useRouter()
const serverError = ref('')

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(z.object({
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password: z.string().min(1, 'Password is required'),
  })),
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  const { error } = await authClient.signIn.email({ email: values.email, password: values.password })
  if (error) {
    serverError.value = error.message ?? 'Sign in failed'
    return
  }
  await session.refresh()
  router.push({ name: 'overview' })
})

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'
</script>

<template>
  <AuthLayout tag="Sign in to continue">
    <SocialButtons />

    <form class="space-y-4" @submit="onSubmit">
      <FormField v-slot="{ componentField }" name="email">
        <FormItem>
          <FormLabel :class="labelClass">
            Email
          </FormLabel>
          <FormControl>
            <Input type="email" autocomplete="email" placeholder="you@team.dev" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="password">
        <FormItem>
          <FormLabel :class="labelClass">
            Password
          </FormLabel>
          <FormControl>
            <Input type="password" autocomplete="current-password" placeholder="••••••••" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <p v-if="serverError" class="rounded-md border border-fail/30 bg-fail/10 px-3 py-2 text-xs text-fail">
        {{ serverError }}
      </p>

      <Button type="submit" :disabled="isSubmitting" class="w-full bg-signal text-white hover:bg-signal/90 focus-visible:ring-signal/40">
        {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
      </Button>
    </form>

    <template #footer>
      No account?
      <RouterLink :to="{ name: 'signup' }" class="font-medium text-foreground underline-offset-4 hover:underline">
        Create one
      </RouterLink>
    </template>
  </AuthLayout>
</template>
