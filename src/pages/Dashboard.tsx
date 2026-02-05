import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plus,
  FolderOpen,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  FileText,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useTaskContext, TASK_TYPE_NAMES } from '@/contexts/TaskContext'
import { projectService } from '@/services'
import { cn, formatDate, formatRelativeTime } from '@/lib/utils'

interface ProjectSummary {
  id: string
  name: string
  status: string
  riskCount: number
  fileCount: number
  createdAt: string
  progress: number
}

export function Dashboard() {
  const navigate = useNavigate()
  const { tasks, stats } = useTaskContext()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 加载项目数据
  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await projectService.getList()
        setProjects(
          (data || []).map((p: any) => ({
            id: p.id,
            name: p.name || p.projectName || '未命名项目',
            status: p.status || 'draft',
            riskCount: p.riskCount || 0,
            fileCount: p.fileCount || 0,
            createdAt: p.createdAt,
            progress: getProjectProgress(p.status),
          }))
        )
      } catch {
        // ignore
      } finally {
        setIsLoading(false)
      }
    }
    loadProjects()
  }, [])

  // 计算项目进度
  function getProjectProgress(status: string): number {
    const progressMap: Record<string, number> = {
      draft: 10,
      parsing: 30,
      confirming: 50,
      auditing: 70,
      completed: 100,
    }
    return progressMap[status] || 0
  }

  // 正在进行的任务（最多显示3个）
  const runningTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending').slice(0, 3)

  // 统计数据
  const totalProjects = projects.length
  const completedProjects = projects.filter(p => p.status === 'completed').length
  const totalRisks = projects.reduce((sum, p) => sum + p.riskCount, 0)
  const inProgressProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'draft').length

  // 最近项目（最多5个）
  const recentProjects = projects.slice(0, 5)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 欢迎语和快捷操作 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作台</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => navigate('/projects/new')}>
          <Plus className="mr-2 h-4 w-4" />
          新建审计项目
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="项目总数"
          value={totalProjects}
          subtext={`${completedProjects} 个已完成`}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="进行中"
          value={inProgressProjects}
          subtext="个项目正在审计"
          color="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="风险发现"
          value={totalRisks}
          subtext="条待处理风险"
          color="red"
        />
        <StatCard
          icon={TrendingUp}
          label="处理中任务"
          value={stats.running}
          subtext={`${stats.completed} 个已完成`}
          color="green"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：正在进行的任务 + 最近项目 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 正在进行的任务 */}
          {runningTasks.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  正在处理
                </h2>
                <span className="text-sm text-muted-foreground">{runningTasks.length} 个任务</span>
              </div>

              <div className="space-y-3">
                {runningTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{task.projectName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {TASK_TYPE_NAMES[task.type]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {task.fileName || task.message}
                      </p>
                    </div>
                    <div className="w-24">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>进度</span>
                        <span>{task.progress}%</span>
                      </div>
                      <Progress value={task.progress} className="h-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 最近项目 */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">最近项目</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
                查看全部
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="py-8 text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">暂无项目</p>
                <Button className="mt-4" onClick={() => navigate('/projects/new')}>
                  创建第一个项目
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}`}>
                    <div className="group flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          project.status === 'completed'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {project.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <FolderOpen className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{project.name}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{formatRelativeTime(project.createdAt)}</span>
                          {project.fileCount > 0 && (
                            <span>{project.fileCount} 个文件</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {project.riskCount > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {project.riskCount}
                          </Badge>
                        )}
                        <ProjectStatusBadge status={project.status} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：快捷入口 */}
        <div className="space-y-6">
          {/* 快捷操作 */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">快捷操作</h2>
            <div className="space-y-2">
              <QuickAction
                icon={Plus}
                label="新建审计项目"
                description="上传招标文件开始审计"
                onClick={() => navigate('/projects/new')}
              />
              <QuickAction
                icon={FolderOpen}
                label="继续未完成项目"
                description={`${inProgressProjects} 个项目进行中`}
                onClick={() => navigate('/projects')}
                disabled={inProgressProjects === 0}
              />
              <QuickAction
                icon={AlertTriangle}
                label="查看风险报告"
                description={`${totalRisks} 条风险待处理`}
                onClick={() => navigate('/projects')}
                highlight={totalRisks > 0}
              />
            </div>
          </div>

          {/* 使用提示 */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5">
            <h3 className="font-semibold mb-2">💡 使用提示</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 上传招标文件后，系统会自动提取关键信息</li>
              <li>• 可以继续上传其他资料，系统在后台处理</li>
              <li>• 处理完成后会在任务中心收到通知</li>
              <li>• 审计结果会自动识别潜在风险点</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// 统计卡片组件
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  subtext: string
  color: 'blue' | 'amber' | 'red' | 'green'
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    green: 'bg-green-100 text-green-600',
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{subtext}</p>
    </div>
  )
}

// 快捷操作组件
function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  highlight,
}: {
  icon: React.ElementType
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50',
        highlight && 'border-red-200 bg-red-50/50'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          highlight ? 'bg-red-100 text-red-600' : 'bg-muted'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </button>
  )
}

// 项目状态徽章
function ProjectStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    draft: { label: '草稿', variant: 'outline' },
    parsing: { label: '解析中', variant: 'secondary' },
    confirming: { label: '待确认', variant: 'secondary' },
    auditing: { label: '审计中', variant: 'default' },
    completed: { label: '已完成', variant: 'outline' },
  }

  const { label, variant } = config[status] || { label: status, variant: 'outline' }

  return <Badge variant={variant}>{label}</Badge>
}
