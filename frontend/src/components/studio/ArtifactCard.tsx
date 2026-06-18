'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Trash2, RotateCw, Loader2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MermaidDiagram } from './MermaidDiagram'
import { resolveStudioAssetUrl } from '@/lib/api/studio'
import { useTranslation } from '@/lib/hooks/use-translation'
import { StudioArtifact, ArtifactStatus } from '@/lib/types/studio'

const STATUS_STYLES: Record<string, string> = {
  running: 'bg-amber-100 text-amber-800 border-amber-200',
  processing: 'bg-amber-100 text-amber-800 border-amber-200',
  pending: 'bg-blue-100 text-blue-800 border-blue-200',
  submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  error: 'bg-red-100 text-red-800 border-red-200',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  running: 'studio.status.running',
  processing: 'studio.status.processing',
  pending: 'studio.status.pending',
  submitted: 'studio.status.submitted',
  completed: 'studio.status.completed',
  failed: 'studio.status.failed',
  error: 'studio.status.error',
  unknown: 'studio.status.unknown',
}

function isActive(status?: ArtifactStatus | null) {
  return (
    status === 'running' ||
    status === 'processing' ||
    status === 'pending' ||
    status === 'submitted'
  )
}

interface ArtifactCardProps {
  artifact: StudioArtifact
  onDelete: (id: string) => void
  onRetry: (id: string) => void
}

export function ArtifactCard({ artifact, onDelete, onRetry }: ArtifactCardProps) {
  const { t } = useTranslation()
  const status = artifact.job_status ?? 'unknown'
  const active = isActive(status)
  const failed = status === 'failed' || status === 'error'

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium truncate">{artifact.name}</h3>
          {artifact.created && (
            <p className="text-xs text-muted-foreground">
              {new Date(artifact.created).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={STATUS_STYLES[status] ?? ''}>
            {active && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {t(STATUS_LABEL_KEYS[status] ?? 'studio.status.unknown')}
          </Badge>
          {failed && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onRetry(artifact.id)}
              title={t('studio.retry')}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(artifact.id)}
            title={t('common.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {failed && artifact.error_message && (
        <p className="text-sm text-destructive whitespace-pre-wrap">
          {artifact.error_message}
        </p>
      )}

      {active && (
        <p className="text-sm text-muted-foreground">{t('studio.inProgress')}</p>
      )}

      {!active && !failed && <ArtifactBody artifact={artifact} />}
    </Card>
  )
}

function ArtifactBody({ artifact }: { artifact: StudioArtifact }) {
  switch (artifact.resource_type) {
    case 'report':
      return (
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {artifact.content ?? ''}
          </ReactMarkdown>
        </div>
      )
    case 'mindmap':
      return artifact.content ? (
        <MermaidDiagram code={artifact.content} id={artifact.id} />
      ) : null
    case 'infographic':
      return <ImageGallery artifact={artifact} />
    case 'video':
      return <VideoPlayer artifact={artifact} />
    default:
      return null
  }
}

function ImageGallery({ artifact }: { artifact: StudioArtifact }) {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all(artifact.file_urls.map((u) => resolveStudioAssetUrl(u))).then(
      (resolved) => {
        if (!cancelled) setUrls(resolved.filter(Boolean) as string[])
      }
    )
    return () => {
      cancelled = true
    }
  }, [artifact.file_urls])

  if (urls.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-3">
      {urls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt={`${artifact.name} ${i + 1}`}
          className="w-full rounded border"
        />
      ))}
    </div>
  )
}

function VideoPlayer({ artifact }: { artifact: StudioArtifact }) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    let cancelled = false
    resolveStudioAssetUrl(artifact.file_urls[0]).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [artifact.file_urls])

  if (!url) return null
  return (
    <video controls className="w-full rounded border" src={url}>
      <track kind="captions" />
    </video>
  )
}
