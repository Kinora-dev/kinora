// Minimal subset of Playwright's @protocol/channels, only the types the trace
// engine references. Full SerializedValue is treated opaque (the engine never
// inspects its shape).

export type StackFrame = {
  file: string
  line: number
  column: number
  function?: string
}

export type ClientSideCallMetadata = {
  id: number
  stack?: StackFrame[]
}

export type Point = {
  x: number
  y: number
}

export type SerializedValue = unknown

export type SerializedError = {
  error?: {
    message: string
    name: string
    stack?: string
  }
  value?: SerializedValue
}
