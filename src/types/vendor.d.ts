declare module 'mammoth/mammoth.browser' {
  export function convertToMarkdown(
    input: { arrayBuffer: ArrayBuffer },
    options?: { styleMap?: string[] },
  ): Promise<{ value?: string }>
}

declare module 'pdfjs-dist/build/pdf' {
  export const GlobalWorkerOptions: { workerSrc: string }
  export function getDocument(options: { data: ArrayBuffer }): { promise: any }
}

