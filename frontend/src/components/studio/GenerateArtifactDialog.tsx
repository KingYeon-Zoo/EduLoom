'use client'

import { useState } from 'react'

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
import { useStudioProfiles, useGenerateArtifact } from '@/lib/hooks/use-studio'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType } from '@/lib/types/studio'

interface GenerateArtifactDialogProps {
  resourceType: ResourceType
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerateArtifactDialog({
  resourceType,
  open,
  onOpenChange,
}: GenerateArtifactDialogProps) {
  const { t } = useTranslation()
  const { data: notebooks } = useNotebooks()
  const { profiles } = useStudioProfiles(resourceType)
  const generate = useGenerateArtifact(resourceType)

  const [name, setName] = useState('')
  const [notebookId, setNotebookId] = useState('')
  const [profileName, setProfileName] = useState('')
  const [instructions, setInstructions] = useState('')

  const selectedProfile = profiles.find((p) => p.name === profileName)

  const reset = () => {
    setName('')
    setNotebookId('')
    setProfileName('')
    setInstructions('')
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
            <Label>{t('studio.presetLabel')}</Label>
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
