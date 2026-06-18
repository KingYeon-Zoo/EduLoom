'use client'

import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
})

interface MermaidDiagramProps {
  code: string
  id: string
}

/** Render a Mermaid diagram from source text. Falls back to showing the
 * raw code if the diagram fails to parse. */
export function MermaidDiagram({ code, id }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const safeId = `mermaid-${id.replace(/[^a-zA-Z0-9]/g, '')}`

    async function render() {
      if (!code?.trim()) return
      try {
        const { svg } = await mermaid.render(safeId, code)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [code, id])

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return <div ref={ref} className="flex justify-center overflow-x-auto" />
}
