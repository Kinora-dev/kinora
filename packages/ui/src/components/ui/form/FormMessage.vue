<script setup lang="ts">
import { useFormField } from './useFormField'

const { error, formMessageId } = useFormField()
</script>

<template>
  <p v-if="error" :id="formMessageId" data-slot="form-message" class="text-sm text-destructive">
    {{ error }}
  </p>
</template>
