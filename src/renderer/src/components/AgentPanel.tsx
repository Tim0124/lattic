import { useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, Bot, FilePen, FilePlus2, FileDown, Wrench } from 'lucide-react'
import type { AgentStep, AgentWriteRequest, VaultFile } from 'src/share/types'
import { ChatInput } from './ChatInput'

const WRITE_MODE = {
  create: { Icon: FilePlus2, label: 'Agent 想建立新筆記', confirm: '同意建立' },
  overwrite: { Icon: FilePen, label: 'Agent 想覆寫筆記', confirm: '同意覆寫' },
  append: { Icon: FileDown, label: 'Agent 想追加內容到筆記', confirm: '同意追加' }
} as const

interface AgentPanelProps {
  onOpenNote: (path: string) => void
  files: VaultFile[]
}

export function AgentPanel({ onOpenNote, files }: AgentPanelProps): React.JSX.Element {
  const [task, setTask] = useState('')
  const [refs, setRefs] = useState<VaultFile[]>([])
  const [submittedTask, setSubmittedTask] = useState<string | null>(null)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [writeReq, setWriteReq] = useState<AgentWriteRequest | null>(null)
  const runRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const notes = useMemo(() => files.filter((f) => f.kind === 'note'), [files])

  useEffect(() => {
    runRef.current = runId
  }, [runId])

  useEffect(() => {
    const unsubs = [
      window.api.onAgentStep(({ id, step }) => {
        if (id !== runRef.current) return
        setSteps((prev) => [...prev, step])
        if (step.type === 'final' || step.type === 'error') setRunId(null)
      }),
      window.api.onAgentWriteRequest((req) => {
        if (req.id !== runRef.current) return
        setWriteReq(req)
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [steps, writeReq])

  const start = (): void => {
    const t = task.trim()
    if (!t || runId) return
    const id = crypto.randomUUID()
    const refPaths = refs.map((r) => r.path)
    setSubmittedTask(t)
    setTask('')
    setRefs([])
    setSteps([])
    setWriteReq(null)
    setRunId(id)
    void window.api.agentRun(id, t, refPaths)
  }

  const answerWrite = (approved: boolean): void => {
    if (!writeReq) return
    void window.api.agentResolveWrite(writeReq.requestId, approved)
    setWriteReq(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {!submittedTask && (
          <div className="flex flex-col items-center gap-2 pt-12 text-center">
            <div className="bg-secondary-soft flex h-10 w-10 items-center justify-center rounded-full">
              <Bot className="text-secondary h-5 w-5" />
            </div>
            <p className="text-sm text-zinc-400">
              交辦任務，例如
              <br />
              「整理所有提到 RAG 的筆記，寫一篇總覽」
            </p>
            <p className="text-xs text-zinc-300 dark:text-zinc-600">寫入筆記前會先徵求你的同意</p>
          </div>
        )}
        {submittedTask && (
          <div className="flex justify-end">
            <div className="bg-primary text-primary-fg max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm shadow-sm">
              {submittedTask}
            </div>
          </div>
        )}
        {steps.map((s, i) => {
          if (s.type === 'tool') {
            return (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                  <Wrench className="text-secondary h-3 w-3 shrink-0" />
                  <span className="font-medium">{s.tool}</span>
                  <span className="truncate text-zinc-400">{JSON.stringify(s.args)}</span>
                </div>
                <div className="mt-1 line-clamp-3 text-xs whitespace-pre-wrap text-zinc-400">
                  {s.result}
                </div>
              </div>
            )
          }
          if (s.type === 'final') {
            return (
              <div
                key={i}
                className="prose prose-sm prose-zinc dark:prose-invert max-w-none border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800"
              >
                <Markdown remarkPlugins={[remarkGfm]}>{s.content}</Markdown>
              </div>
            )
          }
          return (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {s.message}
            </div>
          )
        })}
        {runId && !writeReq && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="bg-secondary h-2 w-2 animate-pulse rounded-full" />
            執行中…
          </div>
        )}

        {writeReq && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm dark:border-amber-700 dark:bg-amber-950/60">
            <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
              {(() => {
                const Icon = WRITE_MODE[writeReq.mode].Icon
                return <Icon className="h-4 w-4" />
              })()}
              {WRITE_MODE[writeReq.mode].label}
            </div>
            <button
              onClick={() => onOpenNote(writeReq.path)}
              className="text-primary mt-1 font-mono text-xs hover:underline"
            >
              {writeReq.path}
            </button>
            {writeReq.mode === 'append' && (
              <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                以下內容會接到筆記末端：
              </div>
            )}
            <pre className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-amber-200 bg-white p-2 text-xs whitespace-pre-wrap dark:border-amber-900 dark:bg-zinc-900">
              {writeReq.content}
            </pre>
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                onClick={() => answerWrite(false)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                拒絕
              </button>
              <button
                onClick={() => answerWrite(true)}
                className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-amber-500"
              >
                {WRITE_MODE[writeReq.mode].confirm}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 p-2.5 dark:border-zinc-800">
        <ChatInput
          value={task}
          onChange={setTask}
          onSubmit={start}
          onStop={() => runId && void window.api.agentStop(runId)}
          pending={runId !== null}
          placeholder="交辦任務…（打 / 引用筆記）"
          hint="Enter 執行 · Shift+Enter 換行 · / 引用筆記"
          files={notes}
          refs={refs}
          onAddRef={(f) =>
            setRefs((prev) => (prev.some((r) => r.path === f.path) ? prev : [...prev, f]))
          }
          onRemoveRef={(path) => setRefs((prev) => prev.filter((r) => r.path !== path))}
        />
      </div>
    </div>
  )
}
