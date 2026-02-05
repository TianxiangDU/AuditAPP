import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Play,
  Check,
  X,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Loader2,
  Settings,
  FileText,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useAuditContext } from '@/contexts/AuditContext'
import { projectService, projectFileService, fieldValueService, auditRuleService } from '@/services'
import { cn } from '@/lib/utils'
import type { AuditResult } from '@/types'
import type { AuditClue, AuditItem } from '@/services'

interface RuleData {
  id: number
  code: string
  name: string
  description?: string
  category?: string
  selected: boolean
}

export function ProjectAudit() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  const { getSession, startAudit, confirmResult, resetAudit, hasRunningAudit } = useAuditContext()

  // 规则列表
  const [rules, setRules] = useState<RuleData[]>([])
  const [isLoadingRules, setIsLoadingRules] = useState(true)

  // 项目数据
  const [projectName, setProjectName] = useState('')
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  // 确认中的规则
  const [confirmingCode, setConfirmingCode] = useState<string | null>(null)

  // 展开状态
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 获取当前项目的审计会话
  const session = projectId ? getSession(projectId) : undefined
  const isRunning = session?.isRunning || false
  const results = session?.results || []
  const progress = session?.progress || { current: 0, total: 0 }
  
  // 使用 useMemo 避免每次渲染创建新的 Set
  const emptySet = useMemo(() => new Set<string>(), [])
  const confirmedRules = session?.confirmedRules || emptySet

  // 加载审计规则（从后端）
  useEffect(() => {
    async function loadRules() {
      try {
        setIsLoadingRules(true)
        const data = await auditRuleService.getList()
        // 只加载启用的规则
        const enabledRules = (data || []).filter(rule => rule.isEnabled !== false)
        setRules(enabledRules.map(rule => ({
          id: rule.id,
          code: rule.code,
          name: rule.name,
          description: rule.description,
          category: rule.category,
          selected: true,
        })))
      } catch (error) {
        console.error('加载审计规则失败:', error)
      } finally {
        setIsLoadingRules(false)
      }
    }
    loadRules()
  }, [])

  // 加载项目数据用于审计
  useEffect(() => {
    async function loadProjectData() {
      if (!projectId) return

      try {
        setIsLoadingData(true)

        // 获取项目信息
        const project = await projectService.getById(projectId)
        const currentProjectName = (project as any).name || project.projectName || '未命名项目'
        setProjectName(currentProjectName)

        // 使用新的统一 API 获取所有文件的所有字段
        const allFields = await fieldValueService.getAllFields(projectId)
        console.log('[审计] 获取到字段总数:', allFields.length)

        // 转换为审计项目格式
        const items: AuditItem[] = allFields
          .filter(f => f.value)
          .map(f => ({
            来源: currentProjectName,
            文件: f.fileName || f.docTypeName || (f.isTender ? '招标文件' : '未知文件'),
            字段: f.fieldName || f.fieldCode,
            内容: f.value!,
          }))

        console.log('[审计] 总计待审查项目:', items.length, '条')
        setAuditItems(items)
      } catch (error) {
        console.error('加载项目数据失败:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadProjectData()
  }, [projectId])

  const handleToggleRule = (code: string) => {
    setRules(prev =>
      prev.map(r => (r.code === code ? { ...r, selected: !r.selected } : r))
    )
  }

  const handleSelectAll = () => {
    const allSelected = rules.every(r => r.selected)
    setRules(prev => prev.map(r => ({ ...r, selected: !allSelected })))
  }

  const handleRunAudit = () => {
    if (!projectId) return

    const selectedRules = rules.filter(r => r.selected)

    if (selectedRules.length === 0) {
      return
    }

    // 转换为 AuditClue 格式传给智能体
    const clues: AuditClue[] = selectedRules.map(rule => ({
      规则编码: rule.code,
      规则名称: rule.name,
      规则描述: rule.description || '',
    }))

    // 启动后台审计
    startAudit(projectId, projectName, clues, auditItems)
  }

  // 确认审计结果
  const handleConfirm = async (ruleCode: string) => {
    if (!projectId) return

    const result = results.find(r => r.ruleCode === ruleCode)
    if (!result) return

    setConfirmingCode(ruleCode)

    try {
      // 如果是有问题或需要复核，保存到风险点
      const saveAsRisk = result.result === 'fail' || result.result === 'review'
      console.log('[确认审计] 开始确认:', { projectId, ruleCode, saveAsRisk, result: result.result })
      await confirmResult(projectId, ruleCode, saveAsRisk)
      console.log('[确认审计] 确认成功')
    } catch (error) {
      console.error('确认失败:', error)
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      alert(`确认失败: ${errorMsg}`)
    } finally {
      setConfirmingCode(null)
    }
  }

  // 一键确认所有结果
  const handleConfirmAll = async () => {
    if (!projectId) return

    const unconfirmed = results.filter(r => !confirmedRules.has(r.ruleCode))

    for (const result of unconfirmed) {
      await handleConfirm(result.ruleCode)
    }
  }

  // 重置审计
  const handleReset = () => {
    if (!projectId) return
    resetAudit(projectId)
  }

  const selectedCount = rules.filter(r => r.selected).length

  // 计算统计信息
  const stats = useMemo(() => {
    return {
      total: results.length,
      pass: results.filter(r => r.result === 'pass').length,
      fail: results.filter(r => r.result === 'fail').length,
      review: results.filter(r => r.result === 'review').length,
      missing: results.filter(r => r.result === 'missing').length,
    }
  }, [results])

  const confirmedCount = confirmedRules.size
  const allConfirmed = results.length > 0 && confirmedCount === results.length

  // 获取结果图标
  const getResultIcon = (result: AuditResult) => {
    switch (result) {
      case 'pass':
        return <Check className="h-5 w-5 text-green-600" />
      case 'fail':
        return <X className="h-5 w-5 text-red-600" />
      case 'missing':
        return <AlertTriangle className="h-5 w-5 text-gray-500" />
      default: // review
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
    }
  }

  // 获取结果文本
  const getResultText = (result: AuditResult) => {
    switch (result) {
      case 'pass':
        return '不存在问题'
      case 'fail':
        return '存在问题'
      case 'missing':
        return '信息缺失'
      default:
        return '需要复核'
    }
  }

  // 获取结果边框/背景色
  const getResultStyles = (result: AuditResult) => {
    switch (result) {
      case 'pass':
        return 'border-green-300 bg-green-50/80 hover:bg-green-50'
      case 'fail':
        return 'border-red-300 bg-red-50/80 hover:bg-red-50'
      case 'missing':
        return 'border-gray-300 bg-gray-50/80 hover:bg-gray-50'
      default:
        return 'border-amber-300 bg-amber-50/80 hover:bg-amber-50'
    }
  }

  const isLoading = isLoadingRules || isLoadingData

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 返回 */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => navigate(`/projects/${projectId}`)}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回
      </Button>

      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">审计执行</h1>
          <p className="text-sm text-muted-foreground">
            {projectName}
            {auditItems.length > 0 && ` · ${auditItems.length} 条数据待审计`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link to="/audit-rules">
              <Settings className="mr-1 h-4 w-4" />
              规则配置
            </Link>
          </Button>
          <Button
            onClick={handleRunAudit}
            disabled={isRunning || selectedCount === 0 || isLoading}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                执行中 ({progress.current}/{progress.total})
              </>
            ) : (
              <>
                <Play className="mr-1 h-4 w-4" />
                执行审计 ({selectedCount})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 执行进度 */}
      {isRunning && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{progress.currentRule}</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <Progress
            value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
            className="h-2"
          />
        </div>
      )}

      {/* 加载中 */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      )}

      {/* 无规则提示 */}
      {!isLoading && rules.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">暂无审计规则</p>
          <Button className="mt-4" asChild>
            <Link to="/audit-rules">前往添加规则</Link>
          </Button>
        </div>
      )}

      {/* 规则选择 - 未执行时显示 */}
      {!isLoading && rules.length > 0 && results.length === 0 && !isRunning && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              选择要执行的审计规则 ({selectedCount}/{rules.length})
            </p>
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              {rules.every(r => r.selected) ? '取消全选' : '全选'}
            </Button>
          </div>

          <div className="space-y-2">
            {rules.map(rule => (
              <label
                key={rule.code}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  rule.selected && 'border-primary bg-primary/5'
                )}
              >
                <Checkbox
                  checked={rule.selected}
                  onCheckedChange={() => handleToggleRule(rule.code)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{rule.name}</span>
                    <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {rule.code}
                    </code>
                    {rule.category && (
                      <span className="text-xs text-primary">{rule.category}</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {rule.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 审计结果 */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* 统计和确认进度 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span>执行完成 {progress.current}/{progress.total}</span>
              {stats.pass > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" />
                  不存在问题 {stats.pass}
                </span>
              )}
              {stats.fail > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <X className="h-4 w-4" />
                  存在问题 {stats.fail}
                </span>
              )}
              {stats.review > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  需要复核 {stats.review}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                已确认 {confirmedCount}/{results.length}
              </span>
              {!allConfirmed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConfirmAll}
                  disabled={confirmingCode !== null}
                >
                  {confirmingCode ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                  )}
                  全部确认
                </Button>
              )}
            </div>
          </div>

          {/* 结果列表 */}
          <div className="space-y-2">
            {results.map(result => (
              <Collapsible
                key={result.ruleCode}
                open={expandedId === result.ruleCode}
                onOpenChange={() =>
                  setExpandedId(expandedId === result.ruleCode ? null : result.ruleCode)
                }
              >
                <CollapsibleTrigger className="w-full">
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                      getResultStyles(result.result)
                    )}
                  >
                    {getResultIcon(result.result)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{result.ruleName}</span>
                        <code className="text-xs text-muted-foreground bg-white/50 px-1.5 py-0.5 rounded">
                          {result.ruleCode}
                        </code>
                      </div>
                      {result.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {result.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 确认状态标记 */}
                      {confirmedRules.has(result.ruleCode) ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          {(result.result === 'fail' || result.result === 'review') ? '已加入风险' : '已确认'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          <Circle className="h-3 w-3" />
                          待确认
                        </span>
                      )}
                      <span className={cn(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        result.result === 'pass' && 'bg-green-100 text-green-700',
                        result.result === 'fail' && 'bg-red-100 text-red-700',
                        result.result === 'review' && 'bg-amber-100 text-amber-700',
                        result.result === 'missing' && 'bg-gray-100 text-gray-700'
                      )}>
                        {getResultText(result.result)}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform text-muted-foreground',
                          expandedId === result.ruleCode && 'rotate-180'
                        )}
                      />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
                    {result.description ? (
                      <p className="whitespace-pre-wrap">{result.description}</p>
                    ) : (
                      <p className="text-muted-foreground italic">暂无审计结论</p>
                    )}
                    {result.suggestion && (
                      <p className="text-muted-foreground">
                        <strong>建议：</strong>
                        {result.suggestion}
                      </p>
                    )}
                    {result.evidence && (
                      <p className="text-muted-foreground">
                        <strong>证据：</strong>
                        {result.evidence}
                      </p>
                    )}
                    {result.lawReference && (
                      <p className="text-xs text-muted-foreground border-t pt-2">
                        <strong>依据：</strong>
                        {result.lawReference}
                      </p>
                    )}
                    {result.rawResponse && !result.description && (
                      <details className="text-xs text-muted-foreground border-t pt-2">
                        <summary className="cursor-pointer">原始响应</summary>
                        <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-48">
                          {result.rawResponse}
                        </pre>
                      </details>
                    )}
                    
                    {/* 确认按钮 */}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {result.result === 'fail' && '确认后将添加到风险点'}
                        {result.result === 'review' && '确认后将添加到风险点'}
                        {result.result === 'pass' && '确认后标记为已审核'}
                      </div>
                      {confirmedRules.has(result.ruleCode) ? (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            {(result.result === 'fail' || result.result === 'review')
                              ? '已加入风险点' 
                              : '已确认通过'}
                          </span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleConfirm(result.ruleCode)
                          }}
                          disabled={confirmingCode === result.ruleCode}
                        >
                          {confirmingCode === result.ruleCode ? (
                            <>
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              确认中...
                            </>
                          ) : (
                            <>
                              <Check className="mr-1 h-4 w-4" />
                              确认结果
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="pt-4 flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              重新审计
            </Button>
            <Button onClick={() => navigate(`/projects/${projectId}/risks`)}>
              查看风险报告
            </Button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {session?.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{session.error}</p>
        </div>
      )}
    </div>
  )
}
