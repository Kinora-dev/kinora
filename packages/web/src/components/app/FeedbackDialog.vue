<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kinora/ui/dialog'
import { Input } from '@kinora/ui/input'
import { Label } from '@kinora/ui/label'
import { SegmentedControl } from '@kinora/ui/segmented-control'
import { Textarea } from '@kinora/ui/textarea'
import { Bug, Lightbulb } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { trpc } from '@/lib/trpc'

const open = defineModel<boolean>('open', { required: true })

const TYPE_OPTIONS = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'feature', label: 'Feature', icon: Lightbulb },
] as const

const type = ref<'bug' | 'feature'>('bug')
const title = ref('')
const description = ref('')
const submitting = ref(false)

// Fresh form every time the dialog opens.
watch(open, (isOpen) => {
  if (isOpen) {
    type.value = 'bug'
    title.value = ''
    description.value = ''
  }
})

async function submit(): Promise<void> {
  if (!title.value.trim() || !description.value.trim())
    return
  submitting.value = true
  try {
    await trpc.feedback.create.mutate({
      type: type.value,
      title: title.value.trim(),
      description: description.value.trim(),
    })
    toast.success('Thanks! Your feedback was sent.')
    open.value = false
  }
  catch (error: any) {
    toast.error(error?.message ?? 'Could not send feedback')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Send feedback</DialogTitle>
        <DialogDescription>
          Report a bug or request a feature. It lands straight in our tracker.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-2">
          <Label>Type</Label>
          <SegmentedControl v-model="type" :options="TYPE_OPTIONS" />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="feedback-title">Title</Label>
          <Input
            id="feedback-title"
            v-model="title"
            :placeholder="type === 'bug' ? 'Trace viewer fails to load' : 'Filter runs by branch'"
            maxlength="200"
            required
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="feedback-description">Description</Label>
          <Textarea
            id="feedback-description"
            v-model="description"
            :placeholder="type === 'bug' ? 'What happened, and what did you expect?' : 'What would you like to be able to do?'"
            class="min-h-28"
            maxlength="5000"
            required
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="submitting || !title.trim() || !description.trim()">
            {{ submitting ? 'Sending...' : 'Send feedback' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
