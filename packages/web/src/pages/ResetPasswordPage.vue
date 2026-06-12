<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kinora/ui/form'
import { Input } from '@kinora/ui/input'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { z } from 'zod'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import { authClient } from '@/lib/auth'

const route = useRoute()
const router = useRouter()
const serverError = ref('')

// better-auth redirects here with ?token=, or ?error= when the link is invalid/expired.
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const linkError = computed(() => typeof route.query.error === 'string')

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(z.object({
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  }).refine(v => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })),
  initialValues: { password: '', confirm: '' },
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  const { error } = await authClient.resetPassword({ newPassword: values.password, token: token.value })
  if (error) {
    serverError.value = error.message ?? 'Could not reset the password'
    return
  }
  toast.success('Password updated. Sign in with your new password.')
  await router.push({ name: 'login' })
})

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'
</script>

<template>
  <AuthLayout tag="Choose a new password">
    <div v-if="linkError || !token" class="flex flex-col gap-4">
      <p class="text-sm leading-relaxed text-muted-foreground">
        This reset link is invalid or has expired. Request a new one.
      </p>
      <RouterLink to="/forgot-password" class="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Request a new link
      </RouterLink>
    </div>

    <form v-else class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <FormField v-slot="{ componentField }" name="password">
        <FormItem>
          <FormLabel :class="labelClass">
            New password
          </FormLabel>
          <FormControl>
            <Input type="password" placeholder="••••••••" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="confirm">
        <FormItem>
          <FormLabel :class="labelClass">
            Confirm password
          </FormLabel>
          <FormControl>
            <Input type="password" placeholder="••••••••" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <p v-if="serverError" class="font-mono text-xs text-fail">
        {{ serverError }}
      </p>

      <Button type="submit" :disabled="isSubmitting" class="font-mono text-xs">
        {{ isSubmitting ? 'Updating…' : 'Update password' }}
      </Button>
    </form>
  </AuthLayout>
</template>
