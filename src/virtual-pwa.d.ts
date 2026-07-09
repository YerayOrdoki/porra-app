declare module 'virtual:pwa-register' {
  type RegisterSWOptions = { immediate?: boolean } & Record<string, any>
  export function registerSW(options?: RegisterSWOptions): void
  export default registerSW
}
