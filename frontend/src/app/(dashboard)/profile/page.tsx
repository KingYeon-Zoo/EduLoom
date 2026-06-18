'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { RefreshCw, Sparkles, Trash2, Pencil, Plus, Check, X } from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'
import {
  useLearnerProfile,
  useUpdateLearnerProfile,
  useExtractLearnerProfile,
  useResetLearnerProfile,
} from '@/lib/hooks/use-learner-profile'
import {
  ProfileEntry,
  ProfileDimensions,
  PROFILE_DIMENSION_ORDER,
} from '@/lib/types/learner-profile'

export default function LearnerProfilePage() {
  const { t } = useTranslation()
  const { data, isLoading, refetch } = useLearnerProfile()
  const updateMutation = useUpdateLearnerProfile()
  const extractMutation = useExtractLearnerProfile()
  const resetMutation = useResetLearnerProfile()

  const [extractOpen, setExtractOpen] = useState(false)
  const [conversation, setConversation] = useState('')

  const dimensions = data?.dimensions ?? {}
  const labels = data?.labels ?? {}
  // Stable display order; fall back to whatever keys the backend returned.
  const dimKeys =
    PROFILE_DIMENSION_ORDER.filter((k) => k in dimensions).length > 0
      ? PROFILE_DIMENSION_ORDER
      : Object.keys(dimensions)

  const handleSaveDimension = (dim: string, entries: ProfileEntry[]) => {
    updateMutation.mutate({ dimensions: { [dim]: entries } })
  }

  const handleExtract = () => {
    if (!conversation.trim()) return
    extractMutation.mutate(
      { conversation, session_id: 'manual' },
      {
        onSuccess: () => {
          setExtractOpen(false)
          setConversation('')
        },
      }
    )
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">{t('learnerProfile.title')}</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExtractOpen(true)}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {t('learnerProfile.reanalyze')}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t('learnerProfile.reset')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('learnerProfile.reset')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('learnerProfile.resetConfirm')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('learnerProfile.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => resetMutation.mutate()}>
                        {t('learnerProfile.reset')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t('learnerProfile.subtitle')}
            </p>

            {isLoading ? (
              <p className="text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dimKeys.map((dim) => (
                  <DimensionCard
                    key={dim}
                    dim={dim}
                    label={labels[dim] ?? t(`learnerProfile.dimensions.${dim}`)}
                    entries={dimensions[dim] ?? []}
                    onSave={(entries) => handleSaveDimension(dim, entries)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={extractOpen} onOpenChange={setExtractOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('learnerProfile.extractDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('learnerProfile.extractDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            value={conversation}
            onChange={(e) => setConversation(e.target.value)}
            placeholder={t('learnerProfile.conversationPlaceholder')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtractOpen(false)}>
              {t('learnerProfile.cancel')}
            </Button>
            <Button
              onClick={handleExtract}
              disabled={!conversation.trim() || extractMutation.isPending}
            >
              {t('learnerProfile.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

interface DimensionCardProps {
  dim: string
  label: string
  entries: ProfileEntry[]
  onSave: (entries: ProfileEntry[]) => void
}

function DimensionCard({ label, entries, onSave }: DimensionCardProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProfileEntry[]>(entries)

  // Reset local draft whenever we enter edit mode.
  const startEdit = () => {
    setDraft(entries.map((e) => ({ ...e })))
    setEditing(true)
  }

  const commit = () => {
    // Drop empty-content rows before saving.
    onSave(draft.filter((e) => e.content.trim()))
    setEditing(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
        {editing ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={commit}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" onClick={startEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            {draft.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Input
                  value={entry.content}
                  onChange={(e) => {
                    const next = [...draft]
                    next[idx] = { ...next[idx], content: e.target.value }
                    setDraft(next)
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDraft(draft.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft([
                  ...draft,
                  { content: '', confidence: 0.6, provenance: 'manual' },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('learnerProfile.addEntry')}
            </Button>
          </>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('learnerProfile.empty')}
          </p>
        ) : (
          entries.map((entry, idx) => (
            <div key={idx} className="space-y-1 border-b last:border-b-0 pb-2 last:pb-0">
              <p className="text-sm">{entry.content}</p>
              <div className="flex items-center gap-2">
                <Progress
                  value={Math.round((entry.confidence ?? 0) * 100)}
                  className="h-1.5 w-24"
                />
                <span className="text-xs text-muted-foreground">
                  {t('learnerProfile.confidence')}{' '}
                  {(entry.confidence ?? 0).toFixed(2)}
                </span>
                {entry.provenance && entry.provenance !== 'unknown' && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t('learnerProfile.source')}: {entry.provenance}
                  </Badge>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
