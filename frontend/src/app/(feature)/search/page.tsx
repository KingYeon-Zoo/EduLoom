'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/hooks/use-translation'
import { AppShell } from '@/components/layout/AppShell'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Search, ChevronDown, AlertCircle, Settings, Save, MessageCircleQuestion } from 'lucide-react'
import { useSearch } from '@/lib/hooks/use-search'
import { useAsk } from '@/lib/hooks/use-ask'
import { useModelDefaults, useModels } from '@/lib/hooks/use-models'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StreamingResponse } from '@/components/search/StreamingResponse'
import { AdvancedModelsDialog } from '@/components/search/AdvancedModelsDialog'
import { SaveToNotebooksDialog } from '@/components/search/SaveToNotebooksDialog'

export default function SearchPage() {
  const { t } = useTranslation()
  // URL params
  const searchParams = useSearchParams()
  const urlQuery = searchParams?.get('q') || ''
  const rawMode = searchParams?.get('mode')
  const urlMode = rawMode === 'search' ? 'search' : 'ask'

  // Tab state (controlled)
  const [activeTab, setActiveTab] = useState<'ask' | 'search'>(
    urlMode === 'search' ? 'search' : 'ask'
  )

  // Search state
  const [searchQuery, setSearchQuery] = useState(urlMode === 'search' ? urlQuery : '')
  const [searchType, setSearchType] = useState<'text' | 'vector'>('text')
  const [searchSources, setSearchSources] = useState(true)
  const [searchNotes, setSearchNotes] = useState(true)

  // Ask state
  const [askQuestion, setAskQuestion] = useState(urlMode === 'ask' ? urlQuery : '')

  // Advanced models dialog
  const [showAdvancedModels, setShowAdvancedModels] = useState(false)
  const [customModels, setCustomModels] = useState<{
    strategy: string
    answer: string
    finalAnswer: string
  } | null>(null)

  // Save to notebooks dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Hooks
  const searchMutation = useSearch()
  const ask = useAsk()
  const { data: modelDefaults, isLoading: modelsLoading } = useModelDefaults()
  const { data: availableModels } = useModels()
  const { openModal } = useModalManager()

  const modelNameById = useMemo(() => {
    if (!availableModels) {
      return new Map<string, string>()
    }
    return new Map(availableModels.map((model) => [model.id, model.name]))
  }, [availableModels])

  const resolveModelName = (id?: string | null) => {
    if (!id) return t('searchPage.notSet')
    return modelNameById.get(id) ?? id
  }

  const hasEmbeddingModel = !!modelDefaults?.default_embedding_model

  // Track if we've already auto-triggered from URL params
  const hasAutoTriggeredRef = useRef(false)
  const lastUrlParamsRef = useRef({ q: '', mode: '' })

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return

    searchMutation.mutate({
      query: searchQuery,
      type: searchType,
      limit: 100,
      search_sources: searchSources,
      search_notes: searchNotes,
      minimum_score: 0.2
    })
  }, [searchQuery, searchType, searchSources, searchNotes, searchMutation])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleAsk = useCallback(() => {
    if (!askQuestion.trim() || !modelDefaults?.default_chat_model) return

    const models = customModels || {
      strategy: modelDefaults.default_chat_model,
      answer: modelDefaults.default_chat_model,
      finalAnswer: modelDefaults.default_chat_model
    }

    ask.sendAsk(askQuestion, models)
  }, [askQuestion, modelDefaults, customModels, ask])

  // Auto-trigger search/ask when arriving with URL params
  useEffect(() => {
    // Skip if already triggered or no query
    if (hasAutoTriggeredRef.current || !urlQuery) return

    // Wait for models to load before triggering ask
    if (urlMode === 'ask' && modelsLoading) return

    if (urlMode === 'search') {
      handleSearch()
      hasAutoTriggeredRef.current = true
    } else if (urlMode === 'ask' && modelDefaults?.default_chat_model) {
      handleAsk()
      hasAutoTriggeredRef.current = true
    }
  }, [urlQuery, urlMode, modelsLoading, modelDefaults, handleSearch, handleAsk])

  // Handle URL param changes while on page (e.g., from command palette again)
  useEffect(() => {
    const currentQ = searchParams?.get('q') || ''
    const rawCurrentMode = searchParams?.get('mode')
    const currentMode = rawCurrentMode === 'search' ? 'search' : 'ask'

    // Check if URL params have changed
    if (currentQ !== lastUrlParamsRef.current.q || currentMode !== lastUrlParamsRef.current.mode) {
      lastUrlParamsRef.current = { q: currentQ, mode: currentMode }

      if (currentQ) {
        // Update state based on mode
        if (currentMode === 'search') {
          setSearchQuery(currentQ)
          setActiveTab('search')
          // Reset trigger flag so we auto-trigger with new params
          hasAutoTriggeredRef.current = false
        } else {
          setAskQuestion(currentQ)
          setActiveTab('ask')
          hasAutoTriggeredRef.current = false
        }
      }
    }
  }, [searchParams])

  return (
    <AppShell>
      <div className="flex flex-col h-full p-4 md:p-6">
        {/* Fixed top: header + mode tabs */}
        <div className="flex-shrink-0 space-y-4 pb-4">
          <h1 className="text-xl md:text-2xl font-bold">{t('searchPage.askAndSearch')}</h1>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('searchPage.chooseAMode')}</p>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ask' | 'search')}>
            <TabsList aria-label={t('common.accessibility.searchKB')} className="w-full max-w-md">
              <TabsTrigger value="ask" className="cursor-pointer">
                <MessageCircleQuestion className="h-4 w-4" />
                {t('searchPage.askBeta')}
              </TabsTrigger>
              <TabsTrigger value="search" className="cursor-pointer">
                <Search className="h-4 w-4" />
                {t('searchPage.search')}
              </TabsTrigger>
            </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Visual separator between header and content */}
        <Separator className="mb-4" />

        {/* Unified container: Output Zone + Input Zone */}
        <div className="flex-1 min-h-0 flex flex-col border border-border/50 rounded-xl bg-card/50 overflow-hidden">
          {/* Output Zone — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
            {activeTab === 'ask' ? (
              ask.isStreaming || ask.finalAnswer ? (
                <div className="space-y-4">
                  <StreamingResponse
                    isStreaming={ask.isStreaming}
                    strategy={ask.strategy}
                    answers={ask.answers}
                    finalAnswer={ask.finalAnswer}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center space-y-2">
                    <MessageCircleQuestion className="h-12 w-12 mx-auto opacity-20" />
                    <p className="text-sm">{t('searchPage.askPlaceholder')}</p>
                  </div>
                </div>
              )
            ) : (
              searchMutation.data ? (
                <div className="space-y-4">
                  {/* Search Results */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">
                        {t('searchPage.resultsFound').replace('{count}', searchMutation.data.total_count.toString())}
                      </h3>
                      <Badge variant="outline">{searchMutation.data.search_type === 'text' ? t('searchPage.textSearch') : t('searchPage.vectorSearch')}</Badge>
                    </div>
                    {searchMutation.data.results.length === 0 ? (
                      <Card>
                        <CardContent className="pt-6 text-center text-muted-foreground">
                          {t('searchPage.noResultsFor').replace('{query}', searchQuery)}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {searchMutation.data.results.map((result, index) => {
                          if (!result.parent_id) {
                            console.warn('Search result with null parent_id:', result)
                            return null
                          }
                          const [type, id] = result.parent_id.split(':')
                          const modalType = type === 'source_insight' ? 'insight' : type as 'source' | 'note' | 'insight'
                          return (
                            <Card key={index}>
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <button
                                      onClick={() => openModal(modalType, id)}
                                      className="text-primary hover:underline font-medium"
                                    >
                                      {result.title}
                                    </button>
                                    <Badge variant="secondary" className="ml-2">
                                      {result.final_score.toFixed(2)}
                                    </Badge>
                                  </div>
                                </div>
                                {result.matches && result.matches.length > 0 && (
                                  <Collapsible className="mt-3">
                                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                                      <ChevronDown className="h-4 w-4" />
                                      {t('searchPage.matches').replace('{count}', result.matches.length.toString())}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2 space-y-1">
                                      {result.matches.map((match, i) => (
                                        <div key={i} className="text-sm pl-6 py-1 border-l-2 border-muted">
                                          {match}
                                        </div>
                                      ))}
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Search className="h-12 w-12 mx-auto opacity-20" />
                    <p className="text-sm">{t('searchPage.searchPlaceholder')}</p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Input Zone — fixed at bottom */}
          <div className="flex-shrink-0 border-t p-4 md:p-5 bg-card">
            {activeTab === 'ask' ? (
              <div className="space-y-3">
                {/* Row 1: Title — synced with Search options row */}
                <div className="min-h-[56px] flex flex-col justify-center">
                  <h3 className="text-lg font-semibold leading-tight">{t('searchPage.askYourKb')}</h3>
                  <p className="text-sm text-muted-foreground">{t('searchPage.askYourKbDesc')}</p>
                </div>
                {/* Row 2: Textarea + Ask button — synced with Search input row */}
                <div className="flex gap-2 items-end min-h-[68px]">
                  <Textarea
                    id="ask-question"
                    name="ask-question"
                    placeholder={t('searchPage.enterQuestionPlaceholder')}
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !ask.isStreaming && askQuestion.trim()) {
                        e.preventDefault()
                        handleAsk()
                      }
                    }}
                    disabled={ask.isStreaming}
                    rows={2}
                    className="flex-1 min-h-[68px] max-h-[136px] resize-none overflow-y-auto"
                    aria-label={t('common.accessibility.enterQuestion')}
                  />
                  <Button
                    onClick={handleAsk}
                    disabled={ask.isStreaming || !askQuestion.trim()}
                    className="flex-shrink-0 h-[68px]"
                  >
                    {ask.isStreaming ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        {t('searchPage.processing')}
                      </>
                    ) : (
                      t('searchPage.ask')
                    )}
                  </Button>
                </div>
                {/* Row 3: Hint + actions — synced with Search hint row */}
                <div className="flex items-center justify-between gap-2 flex-wrap min-h-[24px]">
                  <p className="text-xs text-muted-foreground">{t('searchPage.pressToSubmit')}</p>
                  <div className="flex items-center gap-2">
                    {!hasEmbeddingModel ? (
                      <span className="text-xs text-amber-600 dark:text-amber-500">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        {t('searchPage.noEmbeddingModel')}
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAdvancedModels(true)}
                        disabled={ask.isStreaming}
                        className="h-auto py-1 px-2"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        {t('searchPage.selectModel')}
                      </Button>
                    )}
                    {ask.finalAnswer && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveDialog(true)}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {t('searchPage.saveToNotebooks')}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Advanced Models Dialog */}
                <AdvancedModelsDialog
                  open={showAdvancedModels}
                  onOpenChange={setShowAdvancedModels}
                  defaultModels={{
                    strategy: customModels?.strategy || modelDefaults?.default_chat_model || '',
                    answer: customModels?.answer || modelDefaults?.default_chat_model || '',
                    finalAnswer: customModels?.finalAnswer || modelDefaults?.default_chat_model || ''
                  }}
                  onSave={setCustomModels}
                />

                {/* Save to Notebooks Dialog */}
                {ask.finalAnswer && (
                  <SaveToNotebooksDialog
                    open={showSaveDialog}
                    onOpenChange={setShowSaveDialog}
                    question={askQuestion}
                    answer={ask.finalAnswer}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Row 1: Search Options — synced with Ask title row */}
                <div className="flex flex-wrap gap-6 min-h-[56px] items-center">
                  {/* Search Type */}
                  <div className="space-y-2 flex-1 min-w-0" role="group" aria-labelledby="search-type-label">
                    <span id="search-type-label" className="text-lg font-semibold leading-tight">{t('searchPage.searchType')}</span>
                    {!hasEmbeddingModel && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t('searchPage.vectorSearchWarning')}</span>
                      </div>
                    )}
                    <RadioGroup
                      name="search-type"
                      value={searchType}
                      onValueChange={(value: 'text' | 'vector') => setSearchType(value)}
                      disabled={modelsLoading || searchMutation.isPending}
                      className="flex items-center gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="text" id="text" />
                        <Label htmlFor="text" className="font-normal cursor-pointer">
                          {t('searchPage.textSearch')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="vector"
                          id="vector"
                          disabled={!hasEmbeddingModel || searchMutation.isPending}
                        />
                        <Label
                          htmlFor="vector"
                          className={`font-normal ${!hasEmbeddingModel ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {t('searchPage.vectorSearch')}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Search Locations */}
                  <div className="space-y-2 flex-1 min-w-0" role="group" aria-labelledby="search-in-label">
                    <span id="search-in-label" className="text-lg font-semibold leading-tight">{t('searchPage.searchIn')}</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="sources"
                          name="sources"
                          checked={searchSources}
                          onCheckedChange={(checked) => setSearchSources(checked as boolean)}
                          disabled={searchMutation.isPending}
                        />
                        <Label htmlFor="sources" className="font-normal cursor-pointer">
                          {t('searchPage.searchSources')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="notes"
                          name="notes"
                          checked={searchNotes}
                          onCheckedChange={(checked) => setSearchNotes(checked as boolean)}
                          disabled={searchMutation.isPending}
                        />
                        <Label htmlFor="notes" className="font-normal cursor-pointer">
                          {t('searchPage.searchNotes')}
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Search Input — synced with Ask textarea row */}
                <div className="flex flex-col sm:flex-row gap-2 min-h-[68px]">
                  <Input
                    id="search-query"
                    name="search-query"
                    placeholder={t('searchPage.enterSearchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={searchMutation.isPending}
                    className="flex-1 h-[68px]"
                    aria-label={t('common.accessibility.enterSearch')}
                    autoComplete="off"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={searchMutation.isPending || !searchQuery.trim()}
                    aria-label={t('common.accessibility.searchKBBtn')}
                    className="w-full sm:w-auto h-[68px]"
                  >
                    {searchMutation.isPending ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    {t('searchPage.search')}
                  </Button>
                </div>
                {/* Row 3: Hint — synced with Ask hint row */}
                <p className="text-xs text-muted-foreground min-h-[24px] flex items-center">{t('searchPage.pressToSearch')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
