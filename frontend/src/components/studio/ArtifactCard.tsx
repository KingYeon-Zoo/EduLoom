'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Trash2, RotateCw, Loader2, Download, Eye, FileText, Video, Network, Presentation } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const isCompleted = !active && !failed
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Card
        className={`p-4 space-y-3 ${isCompleted ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
        onClick={() => { if (isCompleted) setDialogOpen(true) }}
      >
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
                onClick={(e) => { e.stopPropagation(); onRetry(artifact.id) }}
                title={t('studio.retry')}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onDelete(artifact.id) }}
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

        {isCompleted && (
          <div className="max-h-[200px] overflow-hidden relative">
            <ArtifactBody artifact={artifact} preview />
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            <div className="absolute top-2 right-2">
              <Eye className="h-4 w-4 text-muted-foreground/60" />
            </div>
          </div>
        )}
      </Card>

      {/* Full content dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{artifact.name}</DialogTitle>
            <DialogDescription>
              {artifact.created && new Date(artifact.created).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <ArtifactBody artifact={artifact} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ArtifactBody({ artifact, preview = false }: { artifact: StudioArtifact; preview?: boolean }) {
  const { t } = useTranslation()

  switch (artifact.resource_type) {
    case 'report':
    case 'quiz':
      return (
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {artifact.content ?? ''}
          </ReactMarkdown>
        </div>
      )

    case 'mindmap':
      if (preview) {
        return artifact.content ? (
          <div className="max-h-[200px] overflow-hidden">
            <div style={{ transform: 'scale(0.45)', transformOrigin: 'top left', width: '222%' }}>
              <MermaidDiagram code={artifact.content} id={`${artifact.id}-preview`} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Network className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">{t('studio.clickToViewMindmap') || '思维导图 — 点击查看详情'}</p>
          </div>
        )
      }
      return artifact.content ? (
        <MermaidDiagram code={artifact.content} id={artifact.id} />
      ) : null

    case 'ppt':
      return <PptViewer artifact={artifact} preview={preview} />

    case 'video':
      if (preview) {
        return <VideoThumbnail artifact={artifact} />
      }
      return <VideoPlayer artifact={artifact} />

    default:
      return null
  }
}

function PptViewer({ artifact, preview = false }: { artifact: StudioArtifact; preview?: boolean }) {
  const { t } = useTranslation()
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [deckUrl, setDeckUrl] = useState<string>()
  const [imgError, setImgError] = useState(false)

  const urls = artifact.file_urls
  const imageEndpoints = urls.slice(0, Math.max(0, urls.length - 1))
  const deckEndpoint = urls.length > 0 ? urls[urls.length - 1] : undefined

  useEffect(() => {
    let cancelled = false
    Promise.all(imageEndpoints.map((u) => resolveStudioAssetUrl(u))).then(
      (resolved) => {
        if (!cancelled) setImageUrls(resolved.filter(Boolean) as string[])
      }
    )
    resolveStudioAssetUrl(deckEndpoint).then((u) => {
      if (!cancelled) setDeckUrl(u)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.file_urls])

  if (imageUrls.length === 0 && !deckUrl) {
    if (preview) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Presentation className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">{t('studio.clickToViewPpt') || '课件 — 点击查看详情'}</p>
        </div>
      )
    }
    return null
  }

  if (preview && imageUrls.length > 0) {
    if (imgError) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Presentation className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">{t('studio.clickToViewPpt') || '课件 — 点击查看详情'}</p>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrls[0]}
          alt={`${artifact.name} ${t('studio.slide')} 1`}
          className="w-full rounded border"
          onError={() => setImgError(true)}
        />
        {imageUrls.length > 1 && (
          <p className="text-xs text-muted-foreground text-center">
            +{imageUrls.length - 1} {t('studio.moreSlides') || 'more slides'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {imageUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {imageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`${artifact.name} ${t('studio.slide')} ${i + 1}`}
              className="w-full rounded border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ))}
        </div>
      )}
      {deckUrl && (
        <a href={deckUrl} download>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            {t('studio.downloadPpt')}
          </Button>
        </a>
      )}
    </div>
  )
}

function VideoThumbnail({ artifact }: { artifact: StudioArtifact }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    resolveStudioAssetUrl(artifact.file_urls[0]).then((u) => {
      if (!cancelled) {
        if (u) setUrl(u)
        else setError(true)
      }
    })
    return () => { cancelled = true }
  }, [artifact.file_urls])

  if (error || !url) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Video className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm">{t('studio.clickToPlayVideo') || '点击播放视频'}</p>
      </div>
    )
  }

  return (
    <video
      src={url}
      preload="metadata"
      className="w-full rounded border max-h-[180px] object-cover"
      onError={() => setError(true)}
      muted
    />
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
