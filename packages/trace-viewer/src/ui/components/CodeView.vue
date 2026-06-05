<script setup lang="ts">
import type { DecorationSet } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { EditorState, StateField } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { Decoration, EditorView } from '@codemirror/view'
import { useMutationObserver } from '@vueuse/core'
import { basicSetup } from 'codemirror'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ code: string, lang?: string, highlightLine?: number }>()

const el = ref<HTMLElement | null>(null)
let view: EditorView | undefined

const isDark = ref(false)
function readDark(): void {
  isDark.value = document.documentElement.classList.contains('dark')
}

// Sit on the panel background, use our mono font, mark the failing line.
const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: '12px' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid var(--border)' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-targetLine': { backgroundColor: 'color-mix(in oklch, var(--signal) 16%, transparent)' },
})

function langExtension() {
  const ts = props.lang === 'ts' || props.lang === 'tsx'
  const jsx = props.lang === 'tsx' || props.lang === 'jsx'
  return javascript({ typescript: ts, jsx })
}

function targetDeco(state: EditorState): DecorationSet {
  const line = props.highlightLine
  if (!line || line < 1 || line > state.doc.lines)
    return Decoration.none
  const l = state.doc.line(line)
  return Decoration.set([Decoration.line({ class: 'cm-targetLine' }).range(l.from)])
}

const targetField = StateField.define<DecorationSet>({
  create: state => targetDeco(state),
  update: (deco, tr) => (tr.docChanged ? targetDeco(tr.state) : deco),
  provide: f => EditorView.decorations.from(f),
})

function buildState(): EditorState {
  return EditorState.create({
    doc: props.code,
    extensions: [
      basicSetup,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      EditorView.contentAttributes.of({ tabindex: '0' }),
      langExtension(),
      targetField,
      ...(isDark.value ? [oneDark] : []),
      baseTheme,
    ],
  })
}

function scrollToTarget(): void {
  const line = props.highlightLine
  if (!view || !line || line > view.state.doc.lines)
    return
  const pos = view.state.doc.line(line).from
  view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
}

onMounted(() => {
  readDark()
  view = new EditorView({ state: buildState(), parent: el.value! })
  scrollToTarget()
  useMutationObserver(document.documentElement, readDark, { attributes: true, attributeFilter: ['class'] })
})

watch([() => props.code, () => props.lang, () => props.highlightLine, isDark], () => {
  view?.setState(buildState())
  scrollToTarget()
})

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="el" class="h-full overflow-hidden text-xs" />
</template>
