'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import mermaid from 'mermaid'
import { ZoomIn, ZoomOut, Maximize2, Download, ChevronRight, ChevronLeft, Network } from 'lucide-react'

// 初始化 mermaid，用于非 mindmap 的原生图渲染
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
  suppressErrorRendering: true,
})

interface MermaidDiagramProps {
  code: string
  id: string
  interactive?: boolean
}

/** 
 * 双引擎 Mermaid 渲染器：
 * - 针对以 mindmap 开头的代码：使用类似 NotebookLM 的 React 交互式脑图渲染器，支持缩放、平移、折叠、导出
 * - 针对其他 Mermaid 图（流程图、时序图等）：继续使用原生的 Mermaid SVG 渲染
 */
export function MermaidDiagram({ code, id, interactive = true }: MermaidDiagramProps) {
  const isMindmap = useMemo(() => {
    return code?.trim().toLowerCase().startsWith('mindmap')
  }, [code])

  if (isMindmap) {
    return <InteractiveMindmap code={code} id={id} interactive={interactive} />
  }

  return <MermaidNativeDiagram code={code} id={id} />
}

// ============================================================================
// 1. 原生 Mermaid 渲染引擎（非 mindmap 的回退方案）
// ============================================================================
function MermaidNativeDiagram({ code, id }: { code: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const safeId = `mermaid-${id.replace(/[^a-zA-Z0-9]/g, '')}`

    async function render() {
      if (!code?.trim()) return
      try {
        const { svg } = await mermaid.render(safeId, code)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(null)
        }
      } catch (e) {
        // 清除 Mermaid 生成的临时 DOM
        const tmpEl = document.getElementById(`d${safeId}`)
        if (tmpEl) tmpEl.remove()
        const errEl = document.getElementById(safeId)
        if (errEl) errEl.remove()

        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [code, id])

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return <div ref={ref} className="flex justify-center overflow-x-auto" />
}

// ============================================================================
// 2. 交互式脑图引擎 (NotebookLM 风格)
// ============================================================================
interface MindmapNode {
  id: string
  text: string
  children: MindmapNode[]
  depth: number
  expanded: boolean
  x?: number
  y?: number
  subtreeHeight?: number
}

interface RenderNode {
  id: string
  text: string
  depth: number
  expanded: boolean
  hasChildren: boolean
  x: number
  y: number
  w: number
  h: number
}

interface RenderLink {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  depth: number
}

// 清洗 Mermaid mindmap 的节点文本
function cleanNodeText(rawText: string): string {
  let text = rawText.trim()
  
  // 1. 去除列表前缀如 "* ", "- ", "+ "
  text = text.replace(/^[*+-]\s+/, '')
  
  // 2. 剥离可能存在的 ID（例如 root((软件项目)) 中的 root）
  const idPattern = /^[a-zA-Z0-9_-]+\s*([\[\({"+].*)$/
  const idMatch = text.match(idPattern)
  if (idMatch) {
    text = idMatch[1].trim()
  }
  
  // 3. 循环剥离最外层的包裹符号：(( )), ( ), [ ], { }, " ", ' '
  let changed = true
  while (changed) {
    const original = text
    if (text.startsWith('(') && text.endsWith(')')) {
      text = text.slice(1, -1).trim()
    } else if (text.startsWith('[') && text.endsWith(']')) {
      text = text.slice(1, -1).trim()
    } else if (text.startsWith('{') && text.endsWith('}')) {
      text = text.slice(1, -1).trim()
    } else if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1).trim()
    } else if (text.startsWith("'") && text.endsWith("'")) {
      text = text.slice(1, -1).trim()
    }
    if (text === original) {
      changed = false
    }
  }
  
  // 4. 清理残留的 Mermaid 特殊修饰（如 ::icon(fa fa-book) 等）
  text = text.replace(/::icon\(.*\)/g, '').trim()
  
  return text || '未命名节点'
}

function parseMermaidToTree(code: string): MindmapNode | null {
  const lines = code.split('\n')
  const flatNodes: { text: string; indent: number }[] = []
  
  for (const line of lines) {
    if (!line.trim()) continue
    if (line.trim().toLowerCase() === 'mindmap') continue
    if (line.trim().startsWith('::')) continue
    
    // 计算缩进层级
    const indent = line.match(/^\s*/)?.[0].length || 0
    const text = cleanNodeText(line)
    flatNodes.push({ text, indent })
  }
  
  if (flatNodes.length === 0) return null
  
  // 构建树形结构，使用栈记录路径上的节点
  const rootNode: MindmapNode = {
    id: 'mindmap-node-0',
    text: flatNodes[0].text,
    children: [],
    depth: 0,
    expanded: true // 根节点始终展开
  }
  
  const stack: { node: MindmapNode; indent: number }[] = [{ node: rootNode, indent: flatNodes[0].indent }]
  let counter = 1
  
  for (let i = 1; i < flatNodes.length; i++) {
    const item = flatNodes[i]
    const node: MindmapNode = {
      id: `mindmap-node-${counter++}`,
      text: item.text,
      children: [],
      depth: 0,
      expanded: false
    }
    
    // 寻找缩进小于当前节点的最新父节点
    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop()
    }
    
    if (stack.length > 0) {
      const parent = stack[stack.length - 1].node
      parent.children.push(node)
      node.depth = parent.depth + 1
      // 默认仅展开深度为 0 和 1 的节点 (深度 0 的子节点——也就是一级标题是可见的；一级标题的 expanded 为 false，子节点默认不可见)
      node.expanded = node.depth < 1
      stack.push({ node, indent: item.indent })
    } else {
      // 容错处理：若缩进异常挂在根节点下
      rootNode.children.push(node)
      node.depth = 1
      node.expanded = false
      stack.push({ node, indent: item.indent })
    }
  }
  
  return rootNode
}

function InteractiveMindmap({ code, id, interactive }: { code: string; id: string; interactive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 树状数据状态
  const [tree, setTree] = useState<MindmapNode | null>(null)
  
  // 交互视口状态
  const [pan, setPan] = useState({ x: 80, y: 250 })
  const [scale, setScale] = useState(1)
  const [hasInitialized, setHasInitialized] = useState(false)
  
  // 拖拽辅助
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)

  // 当代码变更时解析树
  useEffect(() => {
    const parsed = parseMermaidToTree(code)
    setTree(parsed)
    setHasInitialized(false) // 切换代码重置自适应状态
  }, [code])

  // 折叠与展开开关
  const toggleNodeExpand = (nodeId: string) => {
    if (!tree) return
    const newTree = { ...tree }
    const toggle = (curr: MindmapNode): boolean => {
      if (curr.id === nodeId) {
        curr.expanded = !curr.expanded
        return true
      }
      for (const child of curr.children) {
        if (toggle(child)) return true
      }
      return false
    }
    toggle(newTree)
    setTree(newTree)
  }

  // 常量配置
  const COLUMN_GAP = 250 // 列宽 + 列间距

  // 水平脑图布局算法
  const { visibleNodes, visibleLinks } = useMemo(() => {
    if (!tree) return { visibleNodes: [], visibleLinks: [] }
    
    // 深拷贝避免状态变动问题
    const treeCopy = JSON.parse(JSON.stringify(tree)) as MindmapNode
    
    // 1. 自下而上递归计算子树高度
    const computeHeights = (node: MindmapNode) => {
      // 布局计算的平均节点估算高度设为 56，垂直间距为 12
      const calcH = 56
      const calcGap = 12
      if (!node.expanded || node.children.length === 0) {
        node.subtreeHeight = calcH + calcGap
        return
      }
      let total = 0
      for (const child of node.children) {
        computeHeights(child)
        total += child.subtreeHeight!
      }
      node.subtreeHeight = Math.max(calcH + calcGap, total)
    }
    computeHeights(treeCopy)
    
    // 2. 自上而下递归计算节点 (x, y) 坐标
    const computePositions = (node: MindmapNode, x: number, centerY: number) => {
      node.x = x
      node.y = centerY
      if (!node.expanded || node.children.length === 0) return
      
      let currentY = centerY - node.subtreeHeight! / 2
      for (const child of node.children) {
        const childCenterY = currentY + child.subtreeHeight! / 2
        computePositions(child, x + COLUMN_GAP, childCenterY)
        currentY += child.subtreeHeight!
      }
    }
    computePositions(treeCopy, 0, 0) // 根节点置于 (0, 0) 为坐标原点
    
    // 3. 收集所有可见的节点和曲线连线
    const nodes: RenderNode[] = []
    const links: RenderLink[] = []
    
    const collect = (node: MindmapNode) => {
      const hasChildren = node.children.length > 0
      // 非叶子节点（有子节点）宽度为 180，高度为 44；叶子节点（无子节点，即最后一栏）宽度为 240，高度为 56（为多行换行提供充足空间）
      const w = hasChildren ? 180 : 240
      const h = hasChildren ? 44 : 56
      
      nodes.push({
        id: node.id,
        text: node.text,
        depth: node.depth,
        expanded: node.expanded,
        hasChildren,
        x: node.x!,
        y: node.y!,
        w,
        h
      })
      
      if (node.expanded && node.children.length > 0) {
        for (const child of node.children) {
          const childHasChildren = child.children.length > 0
          const childW = childHasChildren ? 180 : 240
          
          links.push({
            id: `${node.id}-${child.id}`,
            fromX: node.x! + w / 2, // 从父节点右边缘中心
            fromY: node.y!,
            toX: child.x! - childW / 2,   // 接到子节点左边缘中心
            toY: child.y!,
            depth: node.depth,
          })
          collect(child)
        }
      }
    }
    collect(treeCopy)
    
    return { visibleNodes: nodes, visibleLinks: links }
  }, [tree])

  // 自适应屏幕大小 (居中复位)
  const handleFitScreen = () => {
    if (visibleNodes.length === 0 || !containerRef.current) return
    
    const W = containerRef.current.clientWidth
    const H = containerRef.current.clientHeight
    
    // 根据节点自身的自适应宽高度计算精确包围盒
    const minX = Math.min(...visibleNodes.map(n => n.x - n.w / 2))
    const maxX = Math.max(...visibleNodes.map(n => n.x + n.w / 2))
    const minY = Math.min(...visibleNodes.map(n => n.y - n.h / 2))
    const maxY = Math.max(...visibleNodes.map(n => n.y + n.h / 2))
    
    const graphW = maxX - minX
    const graphH = maxY - minY
    
    const padding = 50
    const scaleX = W / (graphW + padding)
    const scaleY = H / (graphH + padding)
    
    const newScale = Math.min(Math.min(scaleX, scaleY), 1.1)
    const finalScale = Math.max(newScale, 0.3)
    
    const graphCenterX = (minX + maxX) / 2
    const graphCenterY = (minY + maxY) / 2
    
    setPan({
      x: W / 2 - graphCenterX * finalScale,
      y: H / 2 - graphCenterY * finalScale
    })
    setScale(finalScale)
  }

  // 绑定鼠标滚轮缩放事件以阻止页面默认滚动行为
  useEffect(() => {
    const container = containerRef.current
    if (!container || !interactive) return
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomFactor = 0.08
      setScale((prevScale) => {
        if (e.deltaY < 0) {
          return Math.min(prevScale + zoomFactor, 2.5)
        } else {
          return Math.max(prevScale - zoomFactor, 0.25)
        }
      })
    }
    
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [interactive])

  // 初始加载及树结构变更时自适应居中一次
  useEffect(() => {
    if (visibleNodes.length > 0 && !hasInitialized && containerRef.current) {
      const timer = setTimeout(() => {
        handleFitScreen()
        setHasInitialized(true)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [visibleNodes, hasInitialized])

  // 鼠标拖拽平移事件
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return
    if ((e.target as HTMLElement).closest('.mindmap-node') || (e.target as HTMLElement).closest('.mindmap-btn')) {
      return // 排除卡片和操作按钮的点击触发平移
    }
    isDragging.current = true
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !dragStart.current || !interactive) return
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    })
  }

  const handleMouseUpOrLeave = () => {
    isDragging.current = false
    dragStart.current = null
  }

  const handleZoomIn = () => setScale(s => Math.min(s + 0.15, 2.5))
  const handleZoomOut = () => setScale(s => Math.max(s - 0.15, 0.25))

  // 导出脑图为无损 SVG 矢量文件
  const handleDownload = () => {
    if (visibleNodes.length === 0) return
    
    const minX = Math.min(...visibleNodes.map(n => n.x - n.w / 2)) - 40
    const maxX = Math.max(...visibleNodes.map(n => n.x + n.w / 2)) + 40
    const minY = Math.min(...visibleNodes.map(n => n.y - n.h / 2)) - 40
    const maxY = Math.max(...visibleNodes.map(n => n.y + n.h / 2)) + 40
    
    const width = maxX - minX
    const height = maxY - minY
    
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">`
    
    // 渲染浅色/深色模式下的背景
    svgContent += `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#f8fafc" />`
    
    // 绘制连线
    visibleLinks.forEach(link => {
      const cX1 = link.fromX + (link.toX - link.fromX) / 2
      const cY1 = link.fromY
      const cX2 = link.fromX + (link.toX - link.fromX) / 2
      const cY2 = link.toY
      const path = `M ${link.fromX} ${link.fromY} C ${cX1} ${cY1}, ${cX2} ${cY2}, ${link.toX} ${link.toY}`
      const strokeColor = link.depth === 0 ? '#b2bdfa' : '#c3e0f5'
      svgContent += `<path d="${path}" fill="none" stroke="${strokeColor}" stroke-width="2.5" />`
    })
    
    // 绘制卡片
    visibleNodes.forEach(node => {
      const x = node.x - node.w / 2
      const y = node.y - node.h / 2
      
      let bgColor = '#ffffff'
      let strokeColor = '#e2e8f0'
      let textColor = '#334155'
      let fontWeight = 'normal'
      
      if (node.depth === 0) {
        bgColor = '#b2bdfa'
        strokeColor = '#8fa0f7'
        textColor = '#0f172a'
        fontWeight = 'bold'
      } else if (node.depth === 1) {
        bgColor = '#bfe1f6'
        strokeColor = '#94cdf0'
        textColor = '#0f172a'
        fontWeight = 'bold'
      }
      
      svgContent += `<rect x="${x}" y="${y}" width="${node.w}" height="${node.h}" rx="8" fill="${bgColor}" stroke="${strokeColor}" stroke-width="1" />`
      
      // 绘制居中文本 (SVG 支持折行)
      const text = node.text
      if (text.length > 12) {
        const line1 = text.slice(0, 11)
        const line2 = text.slice(11, 22) + (text.length > 22 ? '...' : '')
        svgContent += `<text x="${x + node.w / 2}" y="${y + node.h / 2 - 2}" font-family="system-ui, sans-serif" font-size="11" font-weight="${fontWeight}" fill="${textColor}" text-anchor="middle">${line1}</text>`
        svgContent += `<text x="${x + node.w / 2}" y="${y + node.h / 2 + 10}" font-family="system-ui, sans-serif" font-size="11" font-weight="${fontWeight}" fill="${textColor}" text-anchor="middle">${line2}</text>`
      } else {
        svgContent += `<text x="${x + node.w / 2}" y="${y + node.h / 2 + 4}" font-family="system-ui, sans-serif" font-size="11" font-weight="${fontWeight}" fill="${textColor}" text-anchor="middle">${text}</text>`
      }
    })
    
    svgContent += `</svg>`
    
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mindmap-${id || 'export'}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!tree) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] border border-dashed rounded-lg bg-slate-50 dark:bg-slate-900">
        <Network className="h-10 w-10 text-slate-300 dark:text-slate-700 animate-pulse mb-2" />
        <span className="text-xs text-slate-400">正在解析导图数据...</span>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      className={`relative w-full h-[550px] overflow-hidden bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-2xl select-none transition-colors ${
        interactive ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {/* 缩放/平移 画布容器 */}
      <div 
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none'
        }}
      >
        {/* SVG 连接线 */}
        <svg 
          style={{
            position: 'absolute',
            left: -10000,
            top: -10000,
            width: 20000,
            height: 20000,
            pointerEvents: 'none'
          }}
        >
          <g transform="translate(10000, 10000)">
            {visibleLinks.map(link => {
              const cX1 = link.fromX + (link.toX - link.fromX) / 2
              const cY1 = link.fromY
              const cX2 = link.fromX + (link.toX - link.fromX) / 2
              const cY2 = link.toY
              const path = `M ${link.fromX} ${link.fromY} C ${cX1} ${cY1}, ${cX2} ${cY2}, ${link.toX} ${link.toY}`
              
              // 连线色彩匹配
              const strokeClass = link.depth === 0 
                ? 'stroke-indigo-300 dark:stroke-indigo-850 stroke-[2.5px]' 
                : 'stroke-sky-200 dark:stroke-sky-950 stroke-[2px]'
              
              return (
                <path
                  key={link.id}
                  d={path}
                  fill="none"
                  className={`${strokeClass} transition-all duration-300`}
                />
              )
            })}
          </g>
        </svg>

        {/* HTML 树卡片节点 */}
        <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'auto' }}>
          {visibleNodes.map(node => {
            // 根据深度确定样式配色
            let cardClass = ''
            let textClass = ''
            
            if (node.depth === 0) {
              cardClass = 'bg-[#b2bdfa] border-[#8fa0f7] text-[#0f172a] shadow-md shadow-indigo-100/50 dark:shadow-none hover:border-indigo-400 hover:shadow-lg'
              textClass = 'text-sm font-bold'
            } else if (node.depth === 1) {
              cardClass = 'bg-[#bfe1f6] border-[#94cdf0] text-[#0f172a] shadow-sm hover:border-sky-400 hover:shadow-md'
              textClass = 'text-xs font-semibold'
            } else {
              cardClass = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:border-slate-350 dark:hover:border-slate-700 hover:shadow shadow-slate-100/40 dark:shadow-none'
              textClass = 'text-xs'
            }

            const isLong = node.text.length > 8
            const alignClass = (node.depth === 0 || node.depth === 1) ? 'text-center' : (isLong ? 'text-left' : 'text-center')
            const textStyle = `${alignClass} text-[11px] md:text-xs leading-snug whitespace-normal break-words w-full line-clamp-3 ${textClass}`

            return (
              <div
                key={node.id}
                className="absolute"
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.w}px`,
                  height: `${node.h}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* 节点主体 */}
                <div
                  className={`mindmap-node w-full h-full flex items-center justify-center px-3.5 rounded-xl border transition-all duration-300 select-none ${cardClass}`}
                  title={node.text}
                >
                  <span className={textStyle}>
                    {node.text}
                  </span>
                  
                  {/* 折叠/展开按钮 */}
                  {node.hasChildren && interactive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleNodeExpand(node.id)
                      }}
                      className="mindmap-btn absolute -right-2.5 top-1/2 -translate-y-1/2 w-5.5 h-5.5 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-105 active:scale-95 transition-all cursor-pointer z-10"
                    >
                      {node.expanded ? (
                        <ChevronLeft size={12} className="stroke-[3]" />
                      ) : (
                        <ChevronRight size={12} className="stroke-[3]" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 浮动控制面板 */}
      {interactive && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 p-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 shadow-lg pointer-events-auto">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            title="放大"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            title="缩小"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleFitScreen}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            title="自适应屏幕"
          >
            <Maximize2 size={16} />
          </button>
          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-0.5" />
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            title="导出为矢量图 (SVG)"
          >
            <Download size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
