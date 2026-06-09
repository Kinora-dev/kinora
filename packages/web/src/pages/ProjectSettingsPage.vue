<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import SlackAlertsCard from '@/components/project/SlackAlertsCard.vue'
import { useManifest } from '@/composables/queries'

const props = defineProps<{ projectId: string }>()
const { state: manifest } = useManifest()
const project = computed(() => manifest.value?.projects.find(p => p.id === props.projectId))
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-8">
    <RouterLink
      :to="{ name: 'project', params: { projectId } }"
      class="flex w-fit items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-3.5" /> {{ project?.name ?? 'project' }}
    </RouterLink>

    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Project settings
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Notifications for {{ project?.name ?? 'this project' }}.
      </p>
    </div>

    <SlackAlertsCard :project-id="projectId" />
  </div>
</template>
