import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  ChevronRight,
  FolderOpen,
  Loader2,
  Play,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  ClipboardList,
  Flag,
  RotateCcw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { projectService, projectFileService, auditService } from '@/services'
import { useTaskContext } from '@/contexts/TaskContext'
import { cn, formatDate } from '@/lib/utils'
import { exportLedgerToExcel, exportRiskReportToExcel, formatDateForDisplay } from '@/utils/exportUtils'

interface ProjectData {
  id: string
  name: string
  status: string
  createdAt: string
  fileCount: number
  riskCount: number
}

interface FileData {
  id: string
  fileName: string
  docTypeName: string | null
  status: string
  extractionStatus: string
  isTender: boolean
}

interface RiskData {
  id: string
  ruleName: string
  description: string
  riskLevel: string
  status: string
}

export function ProjectWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getProjectTasks, updateTask, retryTask, removeTask } = useTaskContext()

  const [project, setProject] = useState<ProjectData | null>(null)
  const [files, setFiles] = useState<FileData[]>([])
  const [risks, setRisks] = useState<RiskData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)

  // 项目相关的任务
  const projectTasks = id ? getProjectTasks(id) : []
  const runningTasks = projectTasks.filter(t => t.status === 'running' || t.status === 'pending')
  const failedTasks = projectTasks.filter(t => t.status === 'failed')

  // 加载数据
  const loadData = async () => {
    if (!id) return
    try {
      setIsLoading(true)
      setError(null)

      const [projectData, fileList] = await Promise.all([
        projectService.getById(id),
        projectFileService.getList(id).catch(() => []),
      ])

      setProject({
        id: projectData.id,
        name: (projectData as any).name || projectData.projectName || '未命名项目',
        status: projectData.status || 'uploading',
        createdAt: projectData.createdAt,
        fileCount: (fileList || []).length,
        riskCount: 0,
      })

      setFiles(
        (fileList || []).map((f: any) => ({
          id: f.id,
          fileName: f.fileName,
          docTypeName: f.docTypeName,
          status: f.status,
          extractionStatus: f.extractionStatus || 'pending',
          isTender: f.isTender || false,
        }))
      )

      // 加载风险
      try {
        const riskList = await auditService.getRisks(id)
        setRisks(riskList || [])
        setProject(prev => prev ? { ...prev, riskCount: (riskList || []).length } : null)
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('加载项目失败:', err)
      setError('加载项目失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  // 计算项目当前阶段
  const projectStage = useMemo(() => {
    if (!project) return 'uploading'
    
    // 已完成
    if (project.status === 'completed') return 'completed'
    
    // 有风险记录 = 审计中
    if (risks.length > 0) return 'auditing'
    
    // 只有招标文件 = 待上传
    const nonTenderFiles = files.filter(f => !f.isTender)
    if (nonTenderFiles.length === 0) return 'uploading'
    
    // 有其他文件 = 提取中
    return 'extracting'
  }, [project, files, risks])

  // 进度百分比
  const progressPercent = useMemo(() => {
    switch (projectStage) {
      case 'uploading': return 25
      case 'extracting': return 50
      case 'auditing': return 75
      case 'completed': return 100
      default: return 0
    }
  }, [projectStage])

  // 统计
  const stats = useMemo(() => {
    const nonTenderFiles = files.filter(f => !f.isTender)
    const extractedCount = nonTenderFiles.filter(f => f.extractionStatus === 'completed').length
    const extractingCount = nonTenderFiles.filter(f => f.extractionStatus === 'processing').length
    const pendingCount = nonTenderFiles.filter(f => f.extractionStatus === 'pending').length
    
    return {
      totalFiles: nonTenderFiles.length,
      extractedCount,
      extractingCount,
      pendingCount,
      riskCount: risks.length,
      highRiskCount: risks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
    }
  }, [files, risks])

  // 完成项目
  const handleComplete = async () => {
    if (!id || !project) return
    
    setIsCompleting(true)
    try {
      await projectService.update(id, { status: 'completed' })
      setProject(prev => prev ? { ...prev, status: 'completed' } : null)
    } catch (err) {
      console.error('完成项目失败:', err)
      alert('操作失败，请重试')
    } finally {
      setIsCompleting(false)
    }
  }

  // 重试失败任务
  const handleRetryTask = (taskId: string) => {
    retryTask(taskId)
    // 实际重试逻辑需要根据任务类型处理
  }

  // 取消任务
  const handleCancelTask = (taskId: string) => {
    updateTask(taskId, { status: 'failed', error: '已取消' })
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-500">{error || '项目不存在'}</p>
        <Button variant="outline" onClick={() => navigate('/projects')}>
          返回项目列表
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 顶部导航 */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回列表
        </Button>
      </div>

      {/* 项目标题和状态 */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(project.createdAt)}
              </span>
              <ProjectStageBadge stage={projectStage} />
            </div>
          </div>
          
          {/* 主要操作按钮 */}
          {projectStage === 'completed' ? (
            <Badge className="bg-green-100 text-green-700 text-base px-4 py-2">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              已完成
            </Badge>
          ) : projectStage === 'auditing' ? (
            <Button onClick={handleComplete} disabled={isCompleting}>
              {isCompleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Flag className="mr-2 h-4 w-4" />
              )}
              完成项目
            </Button>
          ) : null}
        </div>

        {/* 进度条 */}
        <div className="mt-6 bg-muted/50 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">项目进度</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
            <StageIndicator 
              label="资料上传" 
              active={projectStage === 'uploading'} 
              completed={['extracting', 'auditing', 'completed'].includes(projectStage)}
            />
            <StageIndicator 
              label="信息提取" 
              active={projectStage === 'extracting'} 
              completed={['auditing', 'completed'].includes(projectStage)}
            />
            <StageIndicator 
              label="智能审计" 
              active={projectStage === 'auditing'} 
              completed={projectStage === 'completed'}
            />
            <StageIndicator 
              label="完成" 
              active={projectStage === 'completed'} 
              completed={projectStage === 'completed'}
            />
          </div>
        </div>
      </div>

      {/* 正在处理的任务 */}
      {runningTasks.length > 0 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="font-medium text-blue-900">正在处理 ({runningTasks.length})</span>
          </div>
          <div className="space-y-2">
            {runningTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 text-sm">
                <span className="text-blue-700 flex-1 truncate">{task.fileName || task.message}</span>
                <Progress value={task.progress} className="h-1.5 w-24" />
                <span className="text-xs text-blue-600 w-12 text-right">{task.progress}%</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-muted-foreground hover:text-red-500"
                  onClick={() => handleCancelTask(task.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 失败的任务 */}
      {failedTasks.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-900">处理失败 ({failedTasks.length})</span>
          </div>
          <div className="space-y-2">
            {failedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 text-sm">
                <span className="text-red-700 flex-1 truncate">{task.fileName || task.message}</span>
                <span className="text-xs text-red-500 truncate max-w-48">{task.error}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => handleRetryTask(task.id)}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  重试
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => removeTask(task.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 功能卡片 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 项目资料 */}
        <ActionCard
          icon={FolderOpen}
          title="项目资料"
          description={
            stats.totalFiles === 0
              ? '上传项目相关文件'
              : `${stats.totalFiles} 个文件，${stats.extractedCount} 个已提取`
          }
          badge={stats.extractingCount > 0 ? `${stats.extractingCount} 个处理中` : undefined}
          badgeVariant="processing"
          onClick={() => navigate(`/projects/${id}/files`)}
          highlight={projectStage === 'uploading'}
          actionLabel={projectStage === 'uploading' ? '上传文件' : '管理文件'}
          actionIcon={projectStage === 'uploading' ? Upload : ChevronRight}
        />

        {/* 项目台账 */}
        <ActionCard
          icon={ClipboardList}
          title="项目台账"
          description="查看汇总的关键信息"
          onClick={() => navigate(`/projects/${id}/ledger`)}
          actionLabel="查看"
          actionIcon={ChevronRight}
        />

        {/* 智能审计 */}
        <ActionCard
          icon={Play}
          title="智能审计"
          description={
            risks.length > 0
              ? `已发现 ${risks.length} 个风险点`
              : '执行智能审计规则'
          }
          badge={risks.length > 0 ? `${stats.highRiskCount} 个高风险` : undefined}
          badgeVariant="danger"
          onClick={() => navigate(`/projects/${id}/audit`)}
          highlight={projectStage === 'extracting'}
          actionLabel={risks.length > 0 ? '继续审计' : '开始审计'}
          actionIcon={Play}
        />

        {/* 风险报告 */}
        <ActionCard
          icon={AlertTriangle}
          title="风险报告"
          description={
            risks.length > 0
              ? `${risks.length} 个风险待处理`
              : '暂无风险发现'
          }
          onClick={() => navigate(`/projects/${id}/risks`)}
          disabled={risks.length === 0}
          actionLabel="查看报告"
          actionIcon={ChevronRight}
        />
      </div>

      {/* 快速导出 */}
      {projectStage !== 'uploading' && (
        <div className="mt-6 flex gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // 导出台账
              if (id && project) {
                exportLedgerToExcel({
                  projectName: project.name,
                  exportDate: formatDateForDisplay(new Date()),
                  tabs: [] // 简化处理，实际需要加载数据
                })
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            导出台账
          </Button>
          {risks.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (id && project) {
                  exportRiskReportToExcel({
                    projectName: project.name,
                    exportDate: formatDateForDisplay(new Date()),
                    summary: {
                      high: stats.highRiskCount,
                      medium: risks.filter(r => r.riskLevel === 'medium').length,
                      low: risks.filter(r => r.riskLevel === 'low').length,
                      total: risks.length,
                    },
                    risks: risks.map(r => ({
                      ruleName: r.ruleName,
                      ruleCode: '',
                      severity: r.riskLevel,
                      description: r.description,
                      suggestion: '',
                    }))
                  })
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              导出风险报告
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// 项目阶段徽章
function ProjectStageBadge({ stage }: { stage: string }) {
  const config: Record<string, { label: string; className: string }> = {
    uploading: { label: '待上传', className: 'bg-gray-100 text-gray-700' },
    extracting: { label: '提取中', className: 'bg-blue-100 text-blue-700' },
    auditing: { label: '审计中', className: 'bg-purple-100 text-purple-700' },
    completed: { label: '已完成', className: 'bg-green-100 text-green-700' },
  }
  const { label, className } = config[stage] || config.uploading
  return <Badge className={className}>{label}</Badge>
}

// 阶段指示器
function StageIndicator({ label, active, completed }: { label: string; active: boolean; completed: boolean }) {
  return (
    <div className={cn(
      'text-center',
      completed ? 'text-green-600' : active ? 'text-primary font-medium' : 'text-muted-foreground'
    )}>
      <div className={cn(
        'h-2 w-2 rounded-full mx-auto mb-1',
        completed ? 'bg-green-500' : active ? 'bg-primary' : 'bg-muted-foreground/30'
      )} />
      {label}
    </div>
  )
}

// 功能卡片
function ActionCard({
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant,
  onClick,
  highlight,
  disabled,
  actionLabel,
  actionIcon: ActionIcon,
}: {
  icon: React.ElementType
  title: string
  description: string
  badge?: string
  badgeVariant?: 'processing' | 'danger'
  onClick: () => void
  highlight?: boolean
  disabled?: boolean
  actionLabel: string
  actionIcon: React.ElementType
}) {
  return (
    <button
      className={cn(
        'flex items-center gap-4 rounded-xl border p-4 text-left transition-all hover:shadow-md',
        highlight && 'border-primary bg-primary/5 ring-1 ring-primary/20',
        disabled && 'opacity-50 cursor-not-allowed hover:shadow-none'
      )}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
        highlight ? 'bg-primary text-white' : 'bg-muted'
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{title}</p>
          {badge && (
            <Badge 
              variant="outline" 
              className={cn(
                'text-xs',
                badgeVariant === 'danger' && 'border-red-200 text-red-600 bg-red-50',
                badgeVariant === 'processing' && 'border-blue-200 text-blue-600 bg-blue-50'
              )}
            >
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <div className={cn(
        'flex items-center gap-1 text-sm',
        highlight ? 'text-primary' : 'text-muted-foreground'
      )}>
        <span>{actionLabel}</span>
        <ActionIcon className="h-4 w-4" />
      </div>
    </button>
  )
}
