<script setup lang="ts">
import { Button } from '@kinora/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@kinora/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@kinora/ui/popover'
import { cn } from '@kinora/ui/utils'
import { Check, ChevronsUpDown } from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps<{
  options: string[]
  allLabel: string
  searchPlaceholder: string
  triggerClass?: string
}>()

// 'all' or a concrete option.
const model = defineModel<string>({ required: true })
const open = ref(false)

function select(value: string) {
  model.value = value
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        :class="cn('h-9 justify-between gap-2 font-mono text-xs font-normal', props.triggerClass)"
      >
        <span class="truncate">{{ model === 'all' ? props.allLabel : model }}</span>
        <ChevronsUpDown class="size-3.5 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-72 p-0" align="end">
      <Command>
        <CommandInput :placeholder="props.searchPlaceholder" class="font-mono text-xs" />
        <CommandList class="max-h-72">
          <CommandEmpty class="py-4 text-center font-mono text-xs text-muted-foreground">
            No match.
          </CommandEmpty>
          <CommandGroup>
            <CommandItem value="all" class="font-mono text-xs" @select="() => select('all')">
              <Check :class="cn('size-3.5 shrink-0', model === 'all' ? 'opacity-100' : 'opacity-0')" />
              {{ props.allLabel }}
            </CommandItem>
            <CommandItem
              v-for="o in props.options"
              :key="o"
              :value="o"
              class="font-mono text-xs"
              @select="() => select(o)"
            >
              <Check :class="cn('size-3.5 shrink-0', model === o ? 'opacity-100' : 'opacity-0')" />
              <span class="truncate">{{ o }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
