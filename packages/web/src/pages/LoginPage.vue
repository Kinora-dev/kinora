<script setup lang="ts">
import { Badge } from '@kinora/ui/badge'
import { Button } from '@kinora/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kinora/ui/form'
import { Input } from '@kinora/ui/input'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import SocialButtons from '@/components/auth/SocialButtons.vue'
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

const router = useRouter()
const route = useRoute()
const serverError = ref('')
const lastMethod = authClient.getLastUsedLoginMethod()

// Honor ?redirect= (e.g. an invite link); internal paths only.
function destination(): string | { name: string } {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') ? r : { name: 'overview' }
}

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(z.object({
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password: z.string().min(1, 'Password is required'),
  })),
  initialValues: { email: '', password: '' },
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  const { data, error } = await authClient.signIn.email({ email: values.email, password: values.password })
  if (error || !data) {
    serverError.value = error?.message ?? 'Sign in failed'
    return
  }
  // Set the user from the sign-in response so the redirect never races the session cookie
  // (a re-fetched /me can return null before the cookie settles -> guard bounces to /login).
  session.setUserFromAuth(data.user, true)
  router.push(destination())
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

      <div class="relative">
        <Button type="submit" :disabled="isSubmitting" class="w-full bg-signal text-white hover:bg-signal/90 focus-visible:ring-signal/40">
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
        </Button>
        <Badge v-if="lastMethod === 'email'" class="absolute -top-2 -right-2 border-signal/30 bg-background px-1.5 py-0.5 text-[9px] leading-none tracking-wider text-signal shadow-sm">
          Last used
        </Badge>
      </div>
    </form>

    <template #footer>
      No account?
      <RouterLink :to="{ name: 'signup' }" class="font-medium text-foreground underline-offset-4 hover:underline">
        Create one
      </RouterLink>
    </template>
  </AuthLayout>
</template>
