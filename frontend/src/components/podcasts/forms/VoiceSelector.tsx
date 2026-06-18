'use client'

import { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDoubaoVoices } from '@/lib/hooks/use-podcasts'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const CUSTOM = '__custom__'

interface VoiceSelectorProps {
  label?: string
  value: string
  onChange: (value: string) => void
}

/**
 * Picks a Doubao voice: a dropdown of the built-in catalog plus a "custom"
 * option that reveals a free-text input for any voice_type ID. When the
 * current value isn't a built-in voice, custom mode is shown automatically.
 */
export function VoiceSelector({ label, value, onChange }: VoiceSelectorProps) {
  const { data, isLoading } = useDoubaoVoices()
  const voices = data?.voices ?? []

  const isBuiltin = useMemo(
    () => voices.some((v) => v.id === value),
    [voices, value]
  )
  // Treat a non-empty, non-builtin value as custom. While loading we can't
  // tell, so default to builtin to avoid flicker.
  const isCustom = !isLoading && !!value && !isBuiltin

  const selectValue = isCustom ? CUSTOM : value

  const currentVoice = useMemo(
    () => voices.find((v) => v.id === value),
    [voices, value]
  )

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v === CUSTOM) {
                onChange('') // clear so the user types a custom ID
              } else {
                onChange(v)
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? '加载音色…' : '选择音色'} />
            </SelectTrigger>
            <SelectContent>
              {voices.map((v) => (
                <SelectItem key={v.id} value={v.id} title={v.description}>
                  {v.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {v.gender === 'male' ? '男' : '女'}
                  </span>
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>自定义音色…</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {currentVoice && currentVoice.description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-muted-foreground hover:text-foreground cursor-help p-1 shrink-0">
                  <Info className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-3">
                <p className="text-xs font-semibold mb-1">{currentVoice.name}</p>
                <p className="text-xs text-muted-foreground leading-normal">{currentVoice.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {isCustom ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="zh_female_xxx_uranus_bigtts"
          autoComplete="off"
        />
      ) : null}
    </div>
  )
}
