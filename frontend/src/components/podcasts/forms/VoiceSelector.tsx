'use client'

import { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDoubaoVoices } from '@/lib/hooks/use-podcasts'

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

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
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
            <SelectItem key={v.id} value={v.id}>
              {v.name}
              <span className="ml-2 text-xs text-muted-foreground">
                {v.gender === 'male' ? '男' : '女'}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM}>自定义音色…</SelectItem>
        </SelectContent>
      </Select>
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
