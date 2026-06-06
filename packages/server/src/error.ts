export interface ErrorDetail {
  message: string
}

export function formatErrors(errors: Array<ErrorDetail>): string {
  return JSON.stringify(errors)
}
