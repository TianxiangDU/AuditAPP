import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { auditAgentService, auditService, type AuditClue, type AuditItem, type AuditAgentResult } from '@/services'
import { useTaskContext } from './TaskContext'

interface AuditProgress {
  current: number
  total: number
  currentRule?: string
}

interface AuditSession {
  projectId: string
  projectName: string
  isRunning: boolean
  error: string | null
  results: AuditAgentResult[]
  progress: AuditProgress
  confirmedRules: Set<string>
}

interface AuditContextType {
  getSession: (projectId: string) => AuditSession | undefined
  startAudit: (
    projectId: string,
    projectName: string,
    clues: AuditClue[],
    items: AuditItem[]
  ) => void
  confirmResult: (projectId: string, ruleCode: string, saveAsRisk: boolean) => Promise<void>
  resetAudit: (projectId: string) => void
  hasRunningAudit: (projectId: string) => boolean
}

const AuditContext = createContext<AuditContextType | null>(null)

export function useAuditContext() {
  const context = useContext(AuditContext)
  if (!context) {
    throw new Error('useAuditContext must be used within AuditProvider')
  }
  return context
}

export function AuditProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Map<string, AuditSession>>(new Map())
  const runningRef = useRef<Set<string>>(new Set())
  const { addTask, updateTask } = useTaskContext()

  // 保存稳定的函数引用
  const updateTaskRef = useRef(updateTask)
  updateTaskRef.current = updateTask

  // 获取项目的审计会话
  const getSession = useCallback((projectId: string): AuditSession | undefined => {
    return sessions.get(projectId)
  }, [sessions])

  // 更新会话状态
  const updateSession = useCallback((projectId: string, updates: Partial<AuditSession>) => {
    setSessions(prev => {
      const newSessions = new Map(prev)
      const existing = newSessions.get(projectId)
      if (existing) {
        const mergedUpdates = { ...updates }
        if (updates.confirmedRules && existing.confirmedRules) {
          mergedUpdates.confirmedRules = new Set([...existing.confirmedRules, ...updates.confirmedRules])
        }
        newSessions.set(projectId, { ...existing, ...mergedUpdates })
      }
      return newSessions
    })
  }, [])

  // 后台执行审计逻辑 - 定义在 startAudit 之前
  const runAuditInBackground = useCallback(async (
    projectId: string,
    clues: AuditClue[],
    items: AuditItem[],
    taskId: string
  ) => {
    const results: AuditAgentResult[] = []

    try {
      for (let i = 0; i < clues.length; i++) {
        const clue = clues[i]

        // 更新进度
        setSessions(prev => {
          const newSessions = new Map(prev)
          const existing = newSessions.get(projectId)
          if (existing) {
            newSessions.set(projectId, {
              ...existing,
              progress: { current: i, total: clues.length, currentRule: clue.规则名称 },
            })
          }
          return newSessions
        })

        updateTaskRef.current(taskId, {
          progress: Math.round((i / clues.length) * 100),
          message: `执行规则: ${clue.规则名称} (${i + 1}/${clues.length})`,
        })

        try {
          const ruleResults = await auditAgentService.runBasicAudit([clue], items)
          results.push(...ruleResults)

          // 实时更新结果
          setSessions(prev => {
            const newSessions = new Map(prev)
            const existing = newSessions.get(projectId)
            if (existing) {
              newSessions.set(projectId, { ...existing, results: [...results] })
            }
            return newSessions
          })
        } catch (error) {
          console.error(`规则 ${clue.规则编码} 执行失败:`, error)
          results.push({
            ruleCode: clue.规则编码,
            ruleName: clue.规则名称,
            result: 'review',
            severity: auditAgentService.parseSeverity(clue.严重程度),
            description: '规则执行失败，需要人工复核',
            suggestion: '',
            rawResponse: String(error),
          })
          setSessions(prev => {
            const newSessions = new Map(prev)
            const existing = newSessions.get(projectId)
            if (existing) {
              newSessions.set(projectId, { ...existing, results: [...results] })
            }
            return newSessions
          })
        }
      }

      // 完成
      setSessions(prev => {
        const newSessions = new Map(prev)
        const existing = newSessions.get(projectId)
        if (existing) {
          newSessions.set(projectId, {
            ...existing,
            isRunning: false,
            progress: { current: clues.length, total: clues.length },
            results,
          })
        }
        return newSessions
      })

      updateTaskRef.current(taskId, {
        status: 'completed',
        progress: 100,
        message: `审计完成，共 ${results.length} 条规则`,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : '审计执行失败'
      setSessions(prev => {
        const newSessions = new Map(prev)
        const existing = newSessions.get(projectId)
        if (existing) {
          newSessions.set(projectId, {
            ...existing,
            isRunning: false,
            error: msg,
          })
        }
        return newSessions
      })

      updateTaskRef.current(taskId, {
        status: 'failed',
        error: msg,
      })
    } finally {
      runningRef.current.delete(projectId)
    }
  }, [])

  // 开始审计（后台运行）
  const startAudit = useCallback((
    projectId: string,
    projectName: string,
    clues: AuditClue[],
    items: AuditItem[]
  ) => {
    // 如果已经在运行，不重复启动
    if (runningRef.current.has(projectId)) {
      console.log(`[审计] 项目 ${projectId} 已有审计任务在运行`)
      return
    }

    // 创建新会话
    const newSession: AuditSession = {
      projectId,
      projectName,
      isRunning: true,
      error: null,
      results: [],
      progress: { current: 0, total: clues.length },
      confirmedRules: new Set(),
    }

    setSessions(prev => {
      const newSessions = new Map(prev)
      newSessions.set(projectId, newSession)
      return newSessions
    })

    // 标记为运行中
    runningRef.current.add(projectId)

    // 创建任务通知
    const taskId = addTask({
      projectId,
      projectName,
      type: 'audit',
      status: 'running',
      progress: 0,
      message: '正在执行审计...',
    })

    // 后台执行审计
    runAuditInBackground(projectId, clues, items, taskId)
  }, [addTask, runAuditInBackground])

  // 确认审计结果
  const confirmResult = useCallback(async (
    projectId: string,
    ruleCode: string,
    saveAsRisk: boolean
  ) => {
    console.log('[AuditContext] confirmResult 开始:', { projectId, ruleCode, saveAsRisk })
    
    const session = sessions.get(projectId)
    if (!session) {
      console.log('[AuditContext] 未找到审计会话')
      return
    }

    const result = session.results.find(r => r.ruleCode === ruleCode)
    if (!result) {
      console.log('[AuditContext] 未找到审计结果')
      return
    }

    console.log('[AuditContext] 审计结果:', { result: result.result, severity: result.severity })

    // 如果需要保存为风险点
    if (saveAsRisk && (result.result === 'fail' || result.result === 'review')) {
      const riskLevel = result.result === 'fail'
        ? (result.severity === 'critical' ? 'critical' : result.severity === 'high' ? 'high' : 'medium')
        : 'low'

      console.log('[AuditContext] 保存风险点:', { riskLevel })
      
      await auditService.addRisk(projectId, {
        ruleCode: result.ruleCode,
        ruleName: result.ruleName,
        riskLevel,
        description: result.description || '需要人工复核',
        suggestion: result.suggestion || '',
        evidence: result.evidence ? { text: result.evidence, law: result.lawReference } : undefined,
      })
      
      console.log('[AuditContext] 风险点保存成功')
    }

    // 更新确认状态 - 合并已有的确认规则
    const existingConfirmed = session.confirmedRules || new Set()
    const newConfirmed = new Set([...existingConfirmed, ruleCode])
    
    updateSession(projectId, {
      confirmedRules: newConfirmed,
    })
    
    console.log('[AuditContext] confirmResult 完成')
  }, [sessions, updateSession])

  // 重置审计
  const resetAudit = useCallback((projectId: string) => {
    setSessions(prev => {
      const newSessions = new Map(prev)
      newSessions.delete(projectId)
      return newSessions
    })
  }, [])

  // 检查是否有运行中的审计
  const hasRunningAudit = useCallback((projectId: string): boolean => {
    return runningRef.current.has(projectId)
  }, [])

  return (
    <AuditContext.Provider
      value={{
        getSession,
        startAudit,
        confirmResult,
        resetAudit,
        hasRunningAudit,
      }}
    >
      {children}
    </AuditContext.Provider>
  )
}
