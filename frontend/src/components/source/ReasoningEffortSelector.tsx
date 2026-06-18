'use client'

import { Brain } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ReasoningEffort } from '@/lib/types/api'

interface ReasoningEffortSelectorProps {
  value?: ReasoningEffort | null
  onChange: (value: ReasoningEffort) => void
  disabled?: boolean
}

// User-facing levels. The backend also accepts "minimal", but the three
// surfaced here cover the demo's needs and keep the control simple.
const EFFORT_LEVELS: ReasoningEffort[] = ['low', 'medium', 'high']

/**
 * Compact selector for the Doubao thinking-strength (reasoning effort) of a
 * chat session. Defaults to "medium" when no value is set.
 */
export function ReasoningEffortSelector({
  value,
  onChange,
  disabled = false,
}: ReasoningEffortSelectorProps) {
  const { t } = useTranslation()
  const current: ReasoningEffort = value ?? 'medium'

  const labelFor = (effort: ReasoningEffort) =>
    ({
      minimal: t('chat.reasoningLow'),
      low: t('chat.reasoningLow'),
      medium: t('chat.reasoningMedium'),
      high: t('chat.reasoningHigh'),
    })[effort]

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v as ReasoningEffort)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="h-8 w-auto gap-1.5" aria-label={t('chat.reasoningEffort')}>
        <Brain className="h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EFFORT_LEVELS.map((effort) => (
          <SelectItem key={effort} value={effort}>
            {labelFor(effort)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
