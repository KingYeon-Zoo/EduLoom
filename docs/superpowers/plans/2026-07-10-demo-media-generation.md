# 现场演示媒体生成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 demo 分支中用持久化前端计时任务替代昂贵的视频和播客生成，并在 40 秒/100 秒后展示本地预生成媒体。

**Architecture:** 新增一个持久化 Zustand 演示任务存储和纯函数映射层，页面基于 `startedAt` 推导进度，不依赖后台计时器。视频与播客确认处理器优先创建本地任务并返回，API 模块再增加第二道 HTTP 阻断保护；现有查询结果与演示记录只在前端合并。

**Tech Stack:** Next.js 16、React 19、TypeScript、Zustand、TanStack Query、Vitest、Testing Library、Tailwind CSS。

## Global Constraints

- `POST /api/studio/generate` 在 `resource_type === 'video'` 时不得产生 HTTP 请求。
- `POST /api/podcasts/generate` 在此分支中不得产生 HTTP 请求。
- 视频持续时间固定为 `40_000` 毫秒，播客持续时间固定为 `100_000` 毫秒。
- 动画关闭或页面跳转后任务必须继续；刷新后按 `startedAt` 恢复。
- 演示媒体必须从 `/demo-assets/` 由 Next.js 静态服务直接提供。
- 不修改笔记本聊天和 AI 推荐链路。
- 所有新增用户文案同时加入 `zh-CN` 与 `en-US`。

---

### Task 1: 演示任务领域模型与持久化存储

**Files:**
- Create: `frontend/src/lib/demo-media.ts`
- Create: `frontend/src/lib/demo-media.test.ts`
- Create: `frontend/src/lib/stores/demo-media-store.ts`
- Create: `frontend/src/lib/stores/demo-media-store.test.ts`

**Interfaces:**
- Produces: `DemoMediaType`, `DemoMediaTask`, `DemoMediaProgress`, `DEMO_MEDIA_CONFIG`, `createDemoMediaTask(type, now, title?)`, `getDemoMediaProgress(task, now)`, `toDemoStudioArtifact(task, now)`, `toDemoPodcastEpisode(task, now)`。
- Produces: `useDemoMediaStore`，包含 `tasks`、`dismissedTaskIds`、`startTask`、`dismissProgress`、`clearTask`、`reset`。

- [ ] **Step 1: 写计时与映射失败测试**

```ts
expect(DEMO_MEDIA_CONFIG.video.durationMs).toBe(40_000)
expect(DEMO_MEDIA_CONFIG.podcast.durationMs).toBe(100_000)
expect(getDemoMediaProgress(task, task.startedAt + 20_000)).toMatchObject({
  completed: false,
  remainingMs: 20_000,
  progress: 0.5,
})
expect(toDemoStudioArtifact(task, task.startedAt).job_status).toBe('running')
expect(toDemoStudioArtifact(task, task.startedAt + 40_000).job_status).toBe('completed')
```

- [ ] **Step 2: 运行测试确认因模块不存在而失败**

Run: `cd frontend && npm test -- src/lib/demo-media.test.ts`

Expected: FAIL，提示无法解析 `@/lib/demo-media`。

- [ ] **Step 3: 实现领域模型和映射函数**

```ts
export const DEMO_MEDIA_CONFIG = {
  video: {
    durationMs: 40_000,
    assetUrl: '/demo-assets/梯度下降.mp4',
    defaultTitle: '机器学习与深度学习 · 梯度下降动画讲解',
  },
  podcast: {
    durationMs: 100_000,
    assetUrl: '/demo-assets/机器学习与深度学习深度漫谈.mp3',
    defaultTitle: '机器学习与深度学习 · 深度漫谈',
  },
} as const

export function getDemoMediaProgress(task: DemoMediaTask, now: number) {
  const elapsedMs = Math.max(0, now - task.startedAt)
  const remainingMs = Math.max(0, task.durationMs - elapsedMs)
  return {
    completed: remainingMs === 0,
    remainingMs,
    progress: Math.min(1, elapsedMs / task.durationMs),
  }
}
```

映射函数输出 `demo-video`/`demo-podcast` 前缀记录、`running|completed` 状态与本地资源 URL。

- [ ] **Step 4: 运行计时测试确认通过**

Run: `cd frontend && npm test -- src/lib/demo-media.test.ts`

Expected: PASS。

- [ ] **Step 5: 写存储失败测试**

```ts
useDemoMediaStore.getState().startTask('video', 1_000, '测试视频')
const task = useDemoMediaStore.getState().tasks.video
expect(task?.startedAt).toBe(1_000)
useDemoMediaStore.getState().dismissProgress('video')
expect(useDemoMediaStore.getState().dismissedTaskIds.video).toBe(task?.id)
expect(useDemoMediaStore.getState().tasks.video).toEqual(task)
```

- [ ] **Step 6: 运行存储测试确认失败**

Run: `cd frontend && npm test -- src/lib/stores/demo-media-store.test.ts`

Expected: FAIL，提示 store 模块不存在。

- [ ] **Step 7: 用 Zustand persist 实现存储**

```ts
export const useDemoMediaStore = create<DemoMediaState>()(
  persist(
    (set) => ({
      tasks: {},
      dismissedTaskIds: {},
      startTask: (type, now = Date.now(), title) => set((state) => ({
        tasks: { ...state.tasks, [type]: createDemoMediaTask(type, now, title) },
        dismissedTaskIds: { ...state.dismissedTaskIds, [type]: undefined },
      })),
      dismissProgress: (type) => set((state) => ({
        dismissedTaskIds: {
          ...state.dismissedTaskIds,
          [type]: state.tasks[type]?.id,
        },
      })),
      clearTask: (type) => set((state) => ({
        tasks: { ...state.tasks, [type]: undefined },
        dismissedTaskIds: { ...state.dismissedTaskIds, [type]: undefined },
      })),
      reset: () => set({ tasks: {}, dismissedTaskIds: {} }),
    }),
    { name: 'eduloom-demo-media-v1' },
  ),
)
```

- [ ] **Step 8: 运行 Task 1 全部测试并提交**

Run: `cd frontend && npm test -- src/lib/demo-media.test.ts src/lib/stores/demo-media-store.test.ts`

Expected: PASS。

Commit: `git commit -m "feat: add persistent demo media tasks"`

---

### Task 2: HTTP 生成请求的第二道阻断保护

**Files:**
- Modify: `frontend/src/lib/api/studio.ts`
- Modify: `frontend/src/lib/api/podcasts.ts`
- Create: `frontend/src/lib/api/demo-generation-guard.test.ts`

**Interfaces:**
- `studioApi.generate(payload)`：视频 payload 在调用 `apiClient.post` 前抛出 `Demo video generation is disabled`；其他资源保持原行为。
- `podcastsApi.generatePodcast(payload)`：在调用 `apiClient.post` 前抛出 `Demo podcast generation is disabled`。
- `resolveStudioAssetUrl` 与 `resolvePodcastAssetUrl`：`/demo-assets/` 路径原样返回，不拼接 API 主机。

- [ ] **Step 1: 写失败测试证明 HTTP 当前会被调用**

```ts
await expect(studioApi.generate(videoPayload)).rejects.toThrow('disabled')
await expect(podcastsApi.generatePodcast(podcastPayload)).rejects.toThrow('disabled')
expect(postSpy).not.toHaveBeenCalled()
expect(await resolveStudioAssetUrl('/demo-assets/video.mp4')).toBe('/demo-assets/video.mp4')
expect(await resolvePodcastAssetUrl('/demo-assets/audio.mp3')).toBe('/demo-assets/audio.mp3')
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npm test -- src/lib/api/demo-generation-guard.test.ts`

Expected: FAIL，`apiClient.post` 被调用或路径被拼接。

- [ ] **Step 3: 增加同步前置守卫与静态路径特判**

```ts
if (payload.resource_type === 'video') {
  throw new Error('Demo video generation is disabled')
}
```

```ts
generatePodcast: async (_payload: PodcastGenerationRequest) => {
  throw new Error('Demo podcast generation is disabled')
}
```

两个 resolver 在 HTTP URL 判断之后、`getApiUrl()` 之前增加：

```ts
if (path.startsWith('/demo-assets/')) return path
```

- [ ] **Step 4: 运行守卫测试确认通过并提交**

Run: `cd frontend && npm test -- src/lib/api/demo-generation-guard.test.ts`

Expected: PASS，HTTP spy 调用次数为 0。

Commit: `git commit -m "feat: block paid media generation in demo"`

---

### Task 3: 可关闭但不中断任务的生成动画

**Files:**
- Create: `frontend/src/components/demo/DemoGenerationProgress.tsx`
- Create: `frontend/src/components/demo/DemoGenerationProgress.test.tsx`
- Modify: `frontend/src/lib/locales/zh-CN/index.ts`
- Modify: `frontend/src/lib/locales/en-US/index.ts`

**Interfaces:**
- Produces: `<DemoGenerationProgress type="video" | "podcast" />`，从 store 读取任务，每秒更新一次当前时间；完成或已关闭时不渲染。

- [ ] **Step 1: 写组件失败测试**

```tsx
render(<DemoGenerationProgress type="video" />)
expect(screen.getByText(/后台继续/)).toBeInTheDocument()
expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
fireEvent.click(screen.getByRole('button', { name: /关闭/ }))
expect(useDemoMediaStore.getState().tasks.video).toBeDefined()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npm test -- src/components/demo/DemoGenerationProgress.test.tsx`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现动画、倒计时和关闭行为**

组件使用 `Video`/`Mic2`/`X`/`Check` 图标、渐变边框、三个脉冲节点、ARIA progressbar 和 `motion-reduce:animate-none`。计时 effect 每秒刷新 `now`，并监听 `visibilitychange` 立即校准。

阶段索引：`Math.min(2, Math.floor(progress * 3))`；剩余时间格式化为 `m:ss`。关闭按钮只调用 `dismissProgress(type)`。

- [ ] **Step 4: 添加中英文翻译键**

```ts
demoGeneration: {
  videoTitle: '正在生成教学视频',
  podcastTitle: '正在生成智能播客',
  backgroundHint: '可以关闭此动画，任务仍将在后台继续',
  remaining: '预计剩余 {time}',
  stages: ['分析学习资料', '编排内容结构', '合成媒体成品'],
  close: '关闭生成动画',
}
```

英文文件提供同构键和值。

- [ ] **Step 5: 运行组件测试和 locale 测试并提交**

Run: `cd frontend && npm test -- src/components/demo/DemoGenerationProgress.test.tsx src/lib/locales/index.test.ts`

Expected: PASS。

Commit: `git commit -m "feat: add dismissible demo generation progress"`

---

### Task 4: 视频确认流程和工作区集成

**Files:**
- Modify: `frontend/src/components/studio/GenerateArtifactDialog.tsx`
- Modify: `frontend/src/lib/hooks/use-studio.ts`
- Modify: `frontend/src/components/studio/ArtifactsTab.tsx`
- Modify: `frontend/src/components/studio/StudioPageShell.tsx`
- Create: `frontend/src/components/studio/demo-video-flow.test.tsx`

**Interfaces:**
- `GenerateArtifactDialog`：视频点击确认后调用 `startTask('video', Date.now(), title)` 并立即 return；视频按钮无需名称、预设或上下文即可点击。
- `useArtifacts('video')`：返回 `[toDemoStudioArtifact(task, now), ...apiArtifacts]`。
- `ArtifactsTab`：`demo-` 记录删除时调用 `clearTask('video')`，真实记录仍调用 API mutation。
- `StudioPageShell`：视频工作区渲染 `<DemoGenerationProgress type="video" />`。

- [ ] **Step 1: 写失败测试证明视频确认不会调用 mutation**

```tsx
fireEvent.click(screen.getByRole('button', { name: '生成' }))
expect(generateMutateAsync).not.toHaveBeenCalled()
expect(useDemoMediaStore.getState().tasks.video).toBeDefined()
```

测试将笔记本、profile、context hooks 最小化 mock；即使表单为空，生成按钮仍可点击。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npm test -- src/components/studio/demo-video-flow.test.tsx`

Expected: FAIL，按钮 disabled 或真实 mutation 被调用。

- [ ] **Step 3: 在提交处理器最前面加入本地任务分支**

```ts
if (resourceType === 'video') {
  startTask('video', Date.now(), name.trim() || t('demoGeneration.defaultVideoName'))
  success(t('common.success'), t('demoGeneration.startedInBackground'))
  resetState()
  onOpenChange(false)
  return
}
```

`canSubmit` 对视频只检查 `!isSubmitting`；其他资源保持原验证逻辑。

- [ ] **Step 4: 合并演示 artifact、进度动画和本地删除路径**

`useArtifacts` 每秒更新当前时间，仅视频类型读取演示 task；映射记录放在 API 列表前。`ArtifactsTab` 根据 `artifact.id.startsWith('demo-')` 分流删除。`StudioPageShell` 在 header 与列表之间插入动画组件。

- [ ] **Step 5: 运行视频流程测试并提交**

Run: `cd frontend && npm test -- src/components/studio/demo-video-flow.test.tsx src/lib/demo-media.test.ts`

Expected: PASS。

Commit: `git commit -m "feat: simulate video generation in demo"`

---

### Task 5: 播客确认流程和工作区集成

**Files:**
- Modify: `frontend/src/components/podcasts/GeneratePodcastDialog.tsx`
- Modify: `frontend/src/lib/hooks/use-podcasts.ts`
- Modify: `frontend/src/components/podcasts/EpisodesTab.tsx`
- Modify: `frontend/src/app/(feature)/podcasts/page.tsx`
- Create: `frontend/src/components/podcasts/demo-podcast-flow.test.tsx`

**Interfaces:**
- `GeneratePodcastDialog`：确认后调用 `startTask('podcast', Date.now(), title)` 并立即 return，不验证 profile、名称或 context。
- `usePodcastEpisodes()`：返回 `[toDemoPodcastEpisode(task, now), ...apiEpisodes]`。
- `EpisodesTab`：演示记录删除时调用 `clearTask('podcast')`，真实记录继续调用后端。
- 播客页面渲染 `<DemoGenerationProgress type="podcast" />`。

- [ ] **Step 1: 写失败测试证明播客确认不会调用 mutation**

```tsx
fireEvent.click(screen.getByRole('button', { name: '生成' }))
expect(generateMutateAsync).not.toHaveBeenCalled()
expect(useDemoMediaStore.getState().tasks.podcast?.durationMs).toBe(100_000)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npm test -- src/components/podcasts/demo-podcast-flow.test.tsx`

Expected: FAIL，当前提交路径要求 profile/name/context。

- [ ] **Step 3: 在播客提交处理器最前面创建本地任务并返回**

```ts
startTask(
  'podcast',
  Date.now(),
  episodeName.trim() || t('demoGeneration.defaultPodcastName'),
)
success(t('common.success'), t('demoGeneration.startedInBackground'))
resetState()
onOpenChange(false)
return
```

- [ ] **Step 4: 合并演示 episode、进度动画和本地删除路径**

`usePodcastEpisodes` 每秒推导状态；`EpisodesTab` 使用 `demo-` ID 分流删除；播客页在 header 下方插入动画组件。演示 episode 的 `audio_file` 为 `/demo-assets/机器学习与深度学习深度漫谈.mp3`，`audio_url` 保持空值以走公开静态资源分支。

- [ ] **Step 5: 运行播客流程测试并提交**

Run: `cd frontend && npm test -- src/components/podcasts/demo-podcast-flow.test.tsx src/lib/demo-media.test.ts`

Expected: PASS。

Commit: `git commit -m "feat: simulate podcast generation in demo"`

---

### Task 6: 提交演示媒体并完成验证

**Files:**
- Create: `frontend/public/demo-assets/梯度下降.mp4`
- Create: `frontend/public/demo-assets/机器学习与深度学习深度漫谈.mp3`

**Interfaces:**
- 浏览器静态路径 `/demo-assets/梯度下降.mp4` 返回可播放 MP4。
- 浏览器静态路径 `/demo-assets/机器学习与深度学习深度漫谈.mp3` 返回可播放 MP3。

- [ ] **Step 1: 复制并校验媒体文件**

Run:

```bash
mkdir -p frontend/public/demo-assets
cp 梯度下降.mp4 frontend/public/demo-assets/梯度下降.mp4
cp data/podcasts/episodes/81802a4e-48d6-4598-b519-bbad392742f9/audio/81802a4e-48d6-4598-b519-bbad392742f9.mp3 frontend/public/demo-assets/机器学习与深度学习深度漫谈.mp3
file frontend/public/demo-assets/*
```

Expected: 一个 MPEG-4 视频和一个 MPEG Layer III 音频文件。

- [ ] **Step 2: 运行完整前端测试、lint 和 build**

Run:

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: 全部命令退出码为 0。

- [ ] **Step 3: 浏览器验证视频路径**

目标流程：机器学习笔记本聊天推荐 → 视频配置 → 确认 → 动画/生成中卡片 → 关闭动画并导航 → 40 秒后视频播放。

验证浏览器网络日志不包含 `POST /api/studio/generate`。

- [ ] **Step 4: 浏览器验证播客路径**

目标流程：播客页 → 任意配置 → 确认 → 动画/生成中卡片 → 关闭动画并导航 → 100 秒后音频播放。

验证浏览器网络日志不包含 `POST /api/podcasts/generate`。

- [ ] **Step 5: 检查改动并提交**

Run: `git diff --check && git status --short && git diff --stat main...HEAD`

Expected: 无空白错误，只有设计、计划、前端代码、测试、翻译和两份演示媒体。

Commit: `git commit -m "chore: add demo media assets"`
