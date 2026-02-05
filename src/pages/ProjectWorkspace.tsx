import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Loader2,
  Play,
  Download,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { projectService, projectFileService, auditService } from '@/services'
import { useTaskContext } from '@/contexts/TaskContext'
import { cn, formatDate, formatRelativeTime } from '@/lib/utils'

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
  const { getProjectTasks } = useTaskContext()

  const [project, setProject] = useState<ProjectData | null>(null)
  const [files, setFiles] = useState<FileData[]>([])
  const [risks, setRisks] = useState<RiskData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 折叠状态
  const [showFiles, setShowFiles] = useState(true)
  const [showRisks, setShowRisks] = useState(true)

  // 项目相关的任务
  const projectTasks = id ? getProjectTasks(id) : []
  const runningTasks = projectTasks.filter(t => t.status === 'running' || t.status === 'pending')

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
        status: projectData.status || 'draft',
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

  // 如果项目状态为 confirming，自动跳转到确认页面
  useEffect(() => {
    if (project && project.status === 'confirming') {
      navigate(`/projects/${id}/confirm`)
    }
  }, [project?.status, id, navigate])

  // 计算进度
  const getProgress = () => {
    if (!project) return 0
    const stages = ['draft', 'parsing', 'confirming', 'auditing', 'completed']
    const index = stages.indexOf(project.status)
    return index >= 0 ? Math.round(((index + 1) / stages.length) * 100) : 0
  }

  // 快捷操作
  const handleStartAudit = async () => {
    // TODO: 调用审计服务
    navigate(`/projects/${id}/audit`)
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

  // 文件状态统计
  const classifiedFiles = files.filter(f => f.status === 'classified' || f.status === 'pending').length // 待确认
  const extractingFiles = files.filter(f => f.extractionStatus === 'processing').length // 提取中
  const extractedFiles = files.filter(f => f.extractionStatus === 'completed').length // 已提取

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 顶部导航 */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回列表
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/projects/${id}/ledger`)}>
              <FileText className="mr-2 h-4 w-4" />
              查看台账
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              导出报告
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 项目头部信息 */}
      <div className="mb-8 rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(project.createdAt)}
              </span>
              <span>{files.length} 个文件</span>
              <ProjectStatusBadge status={project.status} />
            </div>
          </div>

          {/* 主要操作 */}
          <div className="flex items-center gap-2">
            {project.status !== 'completed' && (
              <>
                <Button variant="outline" onClick={() => navigate(`/projects/${id}/files`)}>
                  <Plus className="mr-1 h-4 w-4" />
                  添加文件
                </Button>
                <Button onClick={handleStartAudit}>
                  <Play className="mr-1 h-4 w-4" />
                  开始审计
                </Button>
              </>
            )}
            {project.status === 'completed' && (
              <Button onClick={() => navigate(`/projects/${id}/risks`)}>
                <Eye className="mr-1 h-4 w-4" />
                查看结果
              </Button>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">审计进度</span>
            <span className="font-medium">{getProgress()}%</span>
          </div>
          <Progress value={getProgress()} className="h-2" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>资料上传</span>
            <span>信息提取</span>
            <span>智能审计</span>
            <span>完成</span>
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
                <span className="text-blue-700">{task.fileName || task.message}</span>
                <Progress value={task.progress} className="h-1.5 flex-1 max-w-32" />
                <span className="text-xs text-blue-600">{task.progress}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 审计结果/风险 - 优先显示 */}
      {risks.length > 0 && (
        <Collapsible open={showRisks} onOpenChange={setShowRisks} className="mb-6">
          <div className="rounded-xl border">
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between p-4 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="text-left">
                    <h2 className="font-semibold">风险发现</h2>
                    <p className="text-sm text-muted-foreground">
                      发现 {risks.length} 个潜在风险点
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{risks.length}</Badge>
                  {showRisks ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t p-4 space-y-3">
                {risks.slice(0, 5).map(risk => (
                  <div
                    key={risk.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <RiskLevelIcon level={risk.riskLevel} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{risk.ruleName}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {risk.description}
                      </p>
                    </div>
                    <Badge variant={risk.status === 'resolved' ? 'outline' : 'secondary'}>
                      {risk.status === 'resolved' ? '已处理' : '待处理'}
                    </Badge>
                  </div>
                ))}
                {risks.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => navigate(`/projects/${id}/risks`)}
                  >
                    查看全部 {risks.length} 个风险
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* 文件列表 */}
      <Collapsible open={showFiles} onOpenChange={setShowFiles}>
        <div className="rounded-xl border">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between p-4 hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <h2 className="font-semibold">项目资料</h2>
                  <p className="text-sm text-muted-foreground">
                    {files.length} 个文件
                    {classifiedFiles > 0 && `，${classifiedFiles} 个待确认`}
                    {extractingFiles > 0 && `，${extractingFiles} 个提取中`}
                    {extractedFiles > 0 && `，${extractedFiles} 个已提取`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/projects/${id}/files`)
                  }}
                >
                  管理文件
                </Button>
                {showFiles ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t">
              {files.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">暂无文件</p>
                  <Button
                    className="mt-4"
                    onClick={() => navigate(`/projects/${id}/files`)}
                  >
                    上传文件
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {files.map(file => (
                    <Link
                      key={file.id}
                      to={`/projects/${id}/files/${file.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50"
                    >
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{file.fileName}</p>
                        {file.docTypeName && (
                          <p className="text-sm text-primary">{file.docTypeName}</p>
                        )}
                      </div>
                      <FileStatusBadge status={file.status} extractionStatus={file.extractionStatus} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* 快捷入口 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink
          icon={FileText}
          label="项目台账"
          description="汇总提取的关键信息"
          onClick={() => navigate(`/projects/${id}/ledger`)}
        />
        <QuickLink
          icon={Play}
          label="执行审计"
          description="运行智能审计规则"
          onClick={() => navigate(`/projects/${id}/audit`)}
        />
        <QuickLink
          icon={AlertTriangle}
          label="风险报告"
          description={risks.length > 0 ? `${risks.length} 个风险待处理` : '暂无风险'}
          onClick={() => navigate(`/projects/${id}/risks`)}
          highlight={risks.length > 0}
        />
      </div>
    </div>
  )
}

// 项目状态徽章
function ProjectStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: '草稿', className: 'bg-gray-100 text-gray-700' },
    uploading: { label: '上传中', className: 'bg-blue-100 text-blue-700' },
    parsing: { label: '解析中', className: 'bg-blue-100 text-blue-700' },
    extracting: { label: '提取中', className: 'bg-indigo-100 text-indigo-700' },
    confirming: { label: '待确认', className: 'bg-amber-100 text-amber-700' },
    ready: { label: '待审计', className: 'bg-emerald-100 text-emerald-700' },
    auditing: { label: '审计中', className: 'bg-purple-100 text-purple-700' },
    completed: { label: '已完成', className: 'bg-green-100 text-green-700' },
    error: { label: '处理失败', className: 'bg-red-100 text-red-700' },
  }
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return <Badge className={className}>{label}</Badge>
}

// 文件状态徽章 - 显示当前处理阶段
function FileStatusBadge({ status, extractionStatus }: { status: string; extractionStatus: string }) {
  // 优先显示提取状态
  if (extractionStatus === 'completed') {
    return (
      <Badge className="bg-green-100 text-green-700 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        已提取
      </Badge>
    )
  }
  if (extractionStatus === 'processing') {
    return (
      <Badge className="bg-blue-100 text-blue-700 gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        提取中
      </Badge>
    )
  }
  // 确认后等待提取
  if (status === 'confirmed') {
    return (
      <Badge className="bg-indigo-100 text-indigo-700 gap-1">
        <Clock className="h-3 w-3" />
        待提取
      </Badge>
    )
  }
  // 已分拣待确认
  if (status === 'classified') {
    return (
      <Badge className="bg-amber-100 text-amber-700 gap-1">
        <Clock className="h-3 w-3" />
        待确认
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" />
      待分拣
    </Badge>
  )
}

// 风险等级图标
function RiskLevelIcon({ level }: { level: string }) {
  const config: Record<string, { bg: string; color: string }> = {
    high: { bg: 'bg-red-100', color: 'text-red-600' },
    medium: { bg: 'bg-amber-100', color: 'text-amber-600' },
    low: { bg: 'bg-blue-100', color: 'text-blue-600' },
  }
  const { bg, color } = config[level] || config.medium
  return (
    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', bg)}>
      <AlertTriangle className={cn('h-4 w-4', color)} />
    </div>
  )
}

// 快捷入口
function QuickLink({
  icon: Icon,
  label,
  description,
  onClick,
  highlight,
}: {
  icon: React.ElementType
  label: string
  description: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/50',
        highlight && 'border-red-200 bg-red-50/50'
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          highlight ? 'bg-red-100 text-red-600' : 'bg-muted'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}
