import { useState, useCallback } from 'react'
import { auditAgentService, type AuditClue, type AuditItem, type AuditAgentResult } from '@/services'

interface UseAuditState {
  isRunning: boolean
  error: string | null
  results: AuditAgentResult[]
  progress: {
    current: number
    total: number
    currentRule?: string
  }
}

export function useAudit() {
  const [state, setState] = useState<UseAuditState>({
    isRunning: false,
    error: null,
    results: [],
    progress: { current: 0, total: 0 },
  })

  /**
   * 执行批量审计
   */
  const runAudit = useCallback(async (
    clues: AuditClue[],
    items: AuditItem[],
    options?: { useCodeAudit?: boolean }
  ) => {
    setState(prev => ({
      ...prev,
      isRunning: true,
      error: null,
      results: [],
      progress: { current: 0, total: clues.length },
    }))

    const results: AuditAgentResult[] = []

    try {
      // 逐条规则执行审计（可以改为批量）
      for (let i = 0; i < clues.length; i++) {
        const clue = clues[i]
        
        setState(prev => ({
          ...prev,
          progress: { current: i, total: clues.length, currentRule: clue.规则名称 },
        }))

        try {
          const auditFn = options?.useCodeAudit 
            ? auditAgentService.runCodeAudit.bind(auditAgentService)
            : auditAgentService.runBasicAudit.bind(auditAgentService)
          
          const ruleResults = await auditFn([clue], items)
          results.push(...ruleResults)
          
          // 实时更新结果
          setState(prev => ({ ...prev, results: [...results] }))
        } catch (error) {
          // 单条规则失败不影响其他规则
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
        }
      }

      setState(prev => ({
        ...prev,
        isRunning: false,
        results,
        progress: { current: clues.length, total: clues.length },
      }))

      return results
    } catch (error) {
      const msg = error instanceof Error ? error.message : '审计执行失败'
      setState(prev => ({ ...prev, isRunning: false, error: msg }))
      throw error
    }
  }, [])

  /**
   * 执行单条规则审计
   */
  const runSingleAudit = useCallback(async (
    clue: AuditClue,
    items: AuditItem[]
  ) => {
    setState(prev => ({
      ...prev,
      isRunning: true,
      error: null,
      progress: { current: 0, total: 1, currentRule: clue.规则名称 },
    }))

    try {
      const result = await auditAgentService.auditSingleRule(clue, items)
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        results: [...prev.results, result],
        progress: { current: 1, total: 1 },
      }))

      return result
    } catch (error) {
      const msg = error instanceof Error ? error.message : '审计执行失败'
      setState(prev => ({ ...prev, isRunning: false, error: msg }))
      throw error
    }
  }, [])

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      isRunning: false,
      error: null,
      results: [],
      progress: { current: 0, total: 0 },
    })
  }, [])

  /**
   * 获取统计信息
   */
  const getStats = useCallback(() => {
    const { results } = state
    return {
      total: results.length,
      pass: results.filter(r => r.result === 'pass').length,
      fail: results.filter(r => r.result === 'fail').length,
      review: results.filter(r => r.result === 'review').length,
      missing: results.filter(r => r.result === 'missing').length,
      high: results.filter(r => r.severity === 'high' && r.result === 'fail').length,
      medium: results.filter(r => r.severity === 'medium' && r.result === 'fail').length,
      low: results.filter(r => r.severity === 'low' && r.result === 'fail').length,
    }
  }, [state])

  return {
    ...state,
    runAudit,
    runSingleAudit,
    reset,
    getStats,
  }
}
