'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Lock } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import {
  useStudioProfiles,
  useCreateStudioProfile,
  useUpdateStudioProfile,
  useDeleteStudioProfile,
} from '@/lib/hooks/use-studio'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType, StudioProfile } from '@/lib/types/studio'

export function StudioTemplatesTab({ resourceType }: { resourceType: ResourceType }) {
  const { t } = useTranslation()
  const { profiles, isLoading } = useStudioProfiles(resourceType)
  const createProfile = useCreateStudioProfile(resourceType)
  const updateProfile = useUpdateStudioProfile(resourceType)
  const deleteProfile = useDeleteStudioProfile(resourceType)

  const [editing, setEditing] = useState<StudioProfile | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDescription('')
    setPrompt('')
    setDialogOpen(true)
  }

  const openEdit = (p: StudioProfile) => {
    setEditing(p)
    setName(p.name)
    setDescription(p.description ?? '')
    setPrompt(p.default_prompt)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) return
    const payload = {
      name: name.trim(),
      resource_type: resourceType,
      description: description.trim() || null,
      default_prompt: prompt.trim(),
      config: editing?.config ?? {},
    }
    if (editing) {
      await updateProfile.mutateAsync({ profileId: editing.id, payload })
    } else {
      await createProfile.mutateAsync(payload)
    }
    setDialogOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('studio.templatesDesc')}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('studio.newPreset')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{p.name}</h3>
                    {p.builtin && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        {t('studio.builtin')}
                      </Badge>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  )}
                </div>
                {!p.builtin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteProfile.mutate(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {p.default_prompt}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('studio.editPreset') : t('studio.newPreset')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="preset-name">{t('studio.presetName')}</Label>
              <Input
                id="preset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-desc">{t('studio.presetDescription')}</Label>
              <Input
                id="preset-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-prompt">{t('studio.presetPrompt')}</Label>
              <Textarea
                id="preset-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || !prompt.trim()}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
