<script setup lang="ts">
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@kinora/ui/alert-dialog'
import { Button } from '@kinora/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kinora/ui/card'
import { Input } from '@kinora/ui/input'
import { ArrowLeft } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import AlertChannelsCard from '@/components/project/AlertChannelsCard.vue'
import SlackAlertsCard from '@/components/project/SlackAlertsCard.vue'
import { useDemo, useManifest } from '@/composables/queries'
import { useOrg } from '@/composables/useOrg'
import { useProjectAdmin } from '@/composables/useProjectAdmin'

const props = defineProps<{ projectId: string }>()

const isDemo = useDemo()
const { isAdmin } = useOrg()

const router = useRouter()
const route = useRoute()

// Slack OAuth callback redirects back here with ?slack=connected|error.
onMounted(() => {
  const slack = route.query.slack
  if (slack === 'connected')
    toast.success('Slack connected')
  else if (slack === 'error')
    toast.error('Could not connect Slack')
  if (slack)
    void router.replace({ query: { ...route.query, slack: undefined } })
})

const { state: manifest, execute: refreshManifest } = useManifest()
const project = computed(() => manifest.value?.projects.find(p => p.id === props.projectId))

const { savingGeneral, deleting, saveGeneral, deleteProject } = useProjectAdmin(props.projectId)

const labelClass = 'font-mono text-[11px] tracking-wider text-muted-foreground uppercase'

const name = ref('')
const description = ref('')
watch(project, (p) => {
  if (!p)
    return
  name.value = p.name
  description.value = p.description ?? ''
}, { immediate: true })

async function onSaveGeneral(): Promise<void> {
  if (await saveGeneral({ name: name.value.trim(), description: description.value.trim() }))
    await refreshManifest()
}

const confirmName = ref('')
const canDelete = computed(() => !!project.value && confirmName.value.trim() === project.value.name)

async function onDelete(): Promise<void> {
  if (!canDelete.value)
    return
  if (await deleteProject())
    await router.push({ name: 'overview' })
}
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
        Name, notifications, and danger zone.
      </p>
    </div>

    <p v-if="!isAdmin" class="font-mono text-xs text-muted-foreground">
      Only admins can change project settings. Your role is read-only here.
    </p>

    <!-- General -->
    <Card v-if="isAdmin">
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Display name and description. The project slug used by CI never changes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="onSaveGeneral">
          <div class="grid gap-2">
            <label :class="labelClass" for="project-name">Name</label>
            <Input id="project-name" v-model="name" />
          </div>
          <div class="grid gap-2">
            <label :class="labelClass" for="project-description">Description</label>
            <Input id="project-description" v-model="description" placeholder="What this suite covers" />
          </div>
          <Button type="submit" size="sm" class="w-fit font-mono text-xs" :disabled="savingGeneral || !name.trim() || isDemo">
            {{ savingGeneral ? 'Saving…' : 'Save' }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <SlackAlertsCard v-if="isAdmin" :project-id="projectId" />
    <AlertChannelsCard v-if="isAdmin" :project-id="projectId" />

    <!-- Danger zone -->
    <Card v-if="isAdmin" class="border-fail/30">
      <CardHeader>
        <CardTitle class="text-fail">
          Danger zone
        </CardTitle>
        <CardDescription>Deleting a project removes all its runs, tests, and traces. This cannot be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button type="button" variant="destructive" size="sm" class="w-fit font-mono text-xs" :disabled="isDemo">
              Delete project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {{ project?.name }}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes all runs, tests, and traces for this project. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div class="grid gap-2">
              <label :class="labelClass" for="confirm-name">
                Type <span class="text-foreground normal-case">{{ project?.name }}</span> to confirm
              </label>
              <Input id="confirm-name" v-model="confirmName" :placeholder="project?.name ?? ''" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                class="bg-destructive text-white hover:bg-destructive/90"
                :disabled="!canDelete || deleting || isDemo"
                @click="onDelete"
              >
                {{ deleting ? 'Deleting…' : 'Delete' }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  </div>
</template>
