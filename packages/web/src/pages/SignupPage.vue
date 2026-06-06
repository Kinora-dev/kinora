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
import { authClient } from '@/lib/auth'
import { session } from '@/lib/session'

const router = useRouter()
const serverError = ref('')

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(
    z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().min(1, 'Email is required').email('Enter a valid email'),
      password: z.string().min(8, 'At least 8 characters'),
      confirmPassword: z.string().min(1, 'Confirm your password'),
    }).refine(d => d.password === d.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
  ),
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  const { error } = await authClient.signUp.email({ name: values.name, email: values.email, password: values.password })
  if (error) {
    serverError.value = error.message ?? 'Sign up failed'
    return
  }
  await session.refresh()
  router.push({ name: 'overview' })
})

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'
</script>

<template>
  <AuthLayout tag="Create your workspace">
    <form class="space-y-4" @submit="onSubmit">
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel :class="labelClass">
            Name
          </FormLabel>
          <FormControl>
            <Input autocomplete="name" placeholder="Ada Lovelace" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

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
            <Input type="password" autocomplete="new-password" placeholder="at least 8 characters" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="confirmPassword">
        <FormItem>
          <FormLabel :class="labelClass">
            Confirm password
          </FormLabel>
          <FormControl>
            <Input type="password" autocomplete="new-password" placeholder="••••••••" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <p v-if="serverError" class="rounded-md border border-fail/30 bg-fail/10 px-3 py-2 text-xs text-fail">
        {{ serverError }}
      </p>

      <Button type="submit" :disabled="isSubmitting" class="w-full bg-signal text-white hover:bg-signal/90 focus-visible:ring-signal/40">
        {{ isSubmitting ? 'Creating…' : 'Create account' }}
      </Button>
    </form>

    <template #footer>
      Already have an account?
      <RouterLink :to="{ name: 'login' }" class="font-medium text-foreground underline-offset-4 hover:underline">
        Sign in
      </RouterLink>
    </template>
  </AuthLayout>
</template>
