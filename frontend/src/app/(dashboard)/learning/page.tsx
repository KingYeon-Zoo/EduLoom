'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Compass,
  GraduationCap,
  Users,
  Sparkles,
  Loader2,
  Circle,
  CircleDot,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import {
  useLearningPath,
  useGeneratePath,
  useUpdateStep,
  useAssessments,
  useGenerateAssessment,
  useAgentRoster,
} from '@/lib/hooks/use-learning'
import {
  ACTIVE_PATH_STATUSES,
  AgentInfo,
  AssessmentDimension,
  LearningAssessment,
  PathStep,
  StepStatus,
} from '@/lib/types/learning'
import { RESOURCE_TYPE_META, ResourceType } from '@/lib/types/studio'

const STEP_ICON: Record<StepStatus, typeof Circle> = {
  todo: Circle,
  in_progress: CircleDot,
  done: CheckCircle2,
}

const NEXT_STATUS: Record<StepStatus, StepStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

export default function LearningPage() {
  const { t } = useTranslation()
  const { data: notebooks } = useNotebooks()
  const [notebookId, setNotebookId] = useState('')

  // Default to the first notebook once loaded.
  useEffect(() => {
    if (!notebookId && notebooks && notebooks.length > 0) {
      setNotebookId(notebooks[0].id)
    }
  }, [notebooks, notebookId])

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('learning.title')}
            </h1>
            <p className="text-muted-foreground">{t('learning.description')}</p>
          </header>

          <div className="max-w-sm space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('learning.selectNotebook')}
            </p>
            <Select value={notebookId} onValueChange={setNotebookId}>
              <SelectTrigger>
                <SelectValue placeholder={t('learning.selectNotebookPlaceholder')} />
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

          <Tabs defaultValue="path" className="space-y-6">
            <TabsList className="w-full max-w-xl">
              <TabsTrigger value="path">
                <Compass className="h-4 w-4" />
                {t('learning.tabPath')}
              </TabsTrigger>
              <TabsTrigger value="assessment">
                <GraduationCap className="h-4 w-4" />
                {t('learning.tabAssessment')}
              </TabsTrigger>
              <TabsTrigger value="agents">
                <Users className="h-4 w-4" />
                {t('learning.tabAgents')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="path">
              {notebookId ? (
                <PathTab notebookId={notebookId} />
              ) : (
                <EmptyHint text={t('learning.selectNotebookFirst')} />
              )}
            </TabsContent>
            <TabsContent value="assessment">
              {notebookId ? (
                <AssessmentTab notebookId={notebookId} />
              ) : (
                <EmptyHint text={t('learning.selectNotebookFirst')} />
              )}
            </TabsContent>
            <TabsContent value="agents">
              <AgentsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  )
}

// --------------------------------------------------------------------------
// Path tab
// --------------------------------------------------------------------------
function PathTab({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { path, isLoading } = useLearningPath(notebookId)
  const generate = useGeneratePath(notebookId)
  const updateStep = useUpdateStep(notebookId)

  const isPlanning =
    generate.isPending ||
    (path?.job_status
      ? ACTIVE_PATH_STATUSES.includes(path.job_status)
      : false)

  const steps = path?.steps ?? []
  const doneCount = steps.filter((s) => s.status === 'done').length
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0

  const handleGoGenerate = (step: PathStep) => {
    const type = step.gap_resource_type as ResourceType | undefined
    if (!type) return
    const meta = RESOURCE_TYPE_META[type]
    if (!meta) return
    // Hand the AI's generation hint + notebook to the target studio page.
    try {
      sessionStorage.setItem(
        'studio_prefill',
        JSON.stringify({
          resourceType: type,
          notebookId,
          instructions: step.gap_prompt || step.resource_gap || '',
        })
      )
    } catch {
      // sessionStorage may be unavailable; the page still opens.
    }
    router.push(`${meta.route}?prefill=1`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          {path?.summary && (
            <p className="text-sm text-muted-foreground max-w-2xl">{path.summary}</p>
          )}
          {steps.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              <Progress value={progress} className="w-48" />
              <span className="text-xs text-muted-foreground">
                {doneCount}/{steps.length} · {progress}%
              </span>
            </div>
          )}
        </div>
        <Button onClick={() => generate.mutate()} disabled={isPlanning}>
          {isPlanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('learning.planning')}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {steps.length ? t('learning.replan') : t('learning.plan')}
            </>
          )}
        </Button>
      </div>

      {isLoading && (
        <EmptyHint text={t('common.loading')} />
      )}

      {!isLoading && steps.length === 0 && !isPlanning && (
        <EmptyHint text={t('learning.noPath')} />
      )}

      {isPlanning && steps.length === 0 && (
        <EmptyHint text={t('learning.planningHint')} />
      )}

      <div className="space-y-3">
        {steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => {
            const Icon = STEP_ICON[step.status]
            return (
              <Card key={step.order} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateStep.mutate({
                            order: step.order,
                            status: NEXT_STATUS[step.status],
                          })
                        }
                        className="mt-0.5 text-primary hover:opacity-80 transition"
                        title={t('learning.toggleStatus')}
                        aria-label={t('learning.toggleStatus')}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {step.order + 1}. {step.title}
                        </CardTitle>
                        {step.description && (
                          <CardDescription>{step.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    <StepStatusBadge status={step.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pl-12">
                  {step.objectives.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {step.objectives.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  )}

                  {step.recommended_artifacts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('learning.recommendedResources')}：
                      </span>
                      {step.recommended_artifacts.map((aid) => (
                        <Badge key={aid} variant="secondary" className="font-normal">
                          {aid.split(':').pop()}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {step.resource_gap && step.gap_resource_type && (
                    <div className="flex items-start justify-between gap-3 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">
                          {t('learning.resourceGap')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {step.resource_gap}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1"
                        onClick={() => handleGoGenerate(step)}
                      >
                        {t('learning.goGenerate')}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}

function StepStatusBadge({ status }: { status: StepStatus }) {
  const { t } = useTranslation()
  const variant =
    status === 'done' ? 'default' : status === 'in_progress' ? 'secondary' : 'outline'
  // Static keys (not template-interpolated) so the i18n key scanner sees them.
  const label =
    status === 'done'
      ? t('learning.status.done')
      : status === 'in_progress'
        ? t('learning.status.in_progress')
        : t('learning.status.todo')
  return (
    <Badge variant={variant} className="shrink-0">
      {label}
    </Badge>
  )
}

// --------------------------------------------------------------------------
// Assessment tab
// --------------------------------------------------------------------------
function AssessmentTab({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation()
  const { assessments, isLoading } = useAssessments(notebookId)
  const generate = useGenerateAssessment(notebookId)

  const latest: LearningAssessment | undefined = assessments[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t('learning.assessmentDesc')}
        </p>
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('learning.assessing')}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t('learning.assess')}
            </>
          )}
        </Button>
      </div>

      {isLoading && <EmptyHint text={t('common.loading')} />}
      {!isLoading && !latest && <EmptyHint text={t('learning.noAssessment')} />}

      {latest && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {latest.dimensions.map((d) => (
              <DimensionCard key={d.name} dim={d} />
            ))}
          </div>

          {latest.overall_comment && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {t('learning.overallComment')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {latest.overall_comment}
              </CardContent>
            </Card>
          )}

          {latest.suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {t('learning.suggestions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {latest.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {latest.created && (
            <p className="text-xs text-muted-foreground">
              {t('learning.assessedAt')}：{new Date(latest.created).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function DimensionCard({ dim }: { dim: AssessmentDimension }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{dim.label || dim.name}</CardTitle>
          <span className="text-sm font-semibold tabular-nums">{dim.score}</span>
        </div>
        <Progress value={dim.score} className="mt-1" />
      </CardHeader>
      <CardContent className="space-y-1.5">
        {dim.comment && <p className="text-sm">{dim.comment}</p>}
        {dim.evidence && (
          <p className="text-xs text-muted-foreground">{dim.evidence}</p>
        )}
      </CardContent>
    </Card>
  )
}

// --------------------------------------------------------------------------
// Agents tab
// --------------------------------------------------------------------------
function AgentsTab() {
  const { t } = useTranslation()
  const { agents, isLoading } = useAgentRoster()

  if (isLoading) return <EmptyHint text={t('common.loading')} />

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-2xl">
        {t('learning.agentsDesc')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a: AgentInfo) => (
          <Card key={a.key}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">{a.name}</CardTitle>
                <Badge variant="outline">{a.project}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {a.responsibility}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
