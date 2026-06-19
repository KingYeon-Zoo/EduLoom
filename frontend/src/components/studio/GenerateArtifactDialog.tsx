'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import {
  useStudioProfiles,
  useGenerateArtifact,
  useRecommendProfile,
} from '@/lib/hooks/use-studio'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType } from '@/lib/types/studio'

interface GenerateArtifactDialogProps {
  resourceType: ResourceType
  open: boolean
  onOpenChange: (open: boolean) => void
  initialInstructions?: string
  initialNotebookId?: string
}

export function GenerateArtifactDialog({
  resourceType,
  open,
  onOpenChange,
  initialInstructions,
  initialNotebookId,
}: GenerateArtifactDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { data: notebooks } = useNotebooks()
  const { profiles } = useStudioProfiles(resourceType)
  const generate = useGenerateArtifact(resourceType)
  const recommend = useRecommendProfile(resourceType)

  const [name, setName] = useState('')
  const [notebookId, setNotebookId] = useState('')
  const [profileName, setProfileName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [recommendReason, setRecommendReason] = useState('')

  const selectedProfile = profiles.find((p) => p.name === profileName)

  // Tutoring handoff (Project E): when opened with prefill values from a chat
  // suggestion, populate the notebook + instructions so the user only confirms.
  useEffect(() => {
    if (!open) return
    if (initialNotebookId) setNotebookId(initialNotebookId)
    if (initialInstructions) setInstructions(initialInstructions)
  }, [open, initialNotebookId, initialInstructions])

  const reset = () => {
    setName('')
    setNotebookId('')
    setProfileName('')
    setInstructions('')
    setRecommendReason('')
  }

  const handleRecommend = async () => {
    try {
      const result = await recommend.mutateAsync()
      if (result.recommended_profile_name) {
        setProfileName(result.recommended_profile_name)
      }
      if (result.suggested_instructions) {
        setInstructions(result.suggested_instructions)
      }
      setRecommendReason(result.reason || '')
      toast({ title: t('studio.recommendApplied') })
    } catch {
      toast({ title: t('studio.recommendFailed'), variant: 'destructive' })
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !notebookId || !profileName) return
    await generate.mutateAsync({
      resource_type: resourceType,
      profile_name: profileName,
      name: name.trim(),
      notebook_id: notebookId,
      instructions: instructions.trim() || null,
    })
    reset()
    onOpenChange(false)
  }

  const canSubmit = !!name.trim() && !!notebookId && !!profileName && !generate.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('studio.generateTitle')}</DialogTitle>
          <DialogDescription>{t('studio.generateDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="artifact-name">{t('studio.nameLabel')}</Label>
            <Input
              id="artifact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('studio.namePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('studio.notebookLabel')}</Label>
            <Select value={notebookId} onValueChange={setNotebookId}>
              <SelectTrigger>
                <SelectValue placeholder={t('studio.notebookPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {(notebooks ?? []).map((nb) => (
                  <SelectItem key={nb.id} value={nb.id}>
                    {nb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('studio.presetLabel')}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary"
                onClick={handleRecommend}
                disabled={recommend.isPending}
                title={t('studio.recommend')}
              >
                {recommend.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {recommend.isPending
                  ? t('studio.recommending')
                  : t('studio.recommend')}
              </Button>
            </div>
            <Select value={profileName} onValueChange={setProfileName}>
              <SelectTrigger>
                <SelectValue placeholder={t('studio.presetPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProfile?.description && (
              <p className="text-xs text-muted-foreground">
                {selectedProfile.description}
              </p>
            )}
            {recommendReason && (
              <div className="flex items-start gap-1.5 rounded-md bg-primary/5 px-2.5 py-2 text-xs text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span>
                  <span className="font-medium text-foreground">
                    {t('studio.recommendReasonLabel')}：
                  </span>
                  {recommendReason}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="artifact-instructions">
              {t('studio.instructionsLabel')}
            </Label>
            <Textarea
              id="artifact-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t('studio.instructionsPlaceholder')}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {generate.isPending ? t('studio.generating') : t('studio.generate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
