import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  AlertTriangle,
  ChevronRight,
  Loader2,
  FolderOpen,
  CheckCircle2,
  Clock,
  Trash2,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { projectService } from '@/services'
import { useTaskContext } from '@/contexts/TaskContext'
import { cn, formatRelativeTime } from '@/lib/utils'

interface Project {
  id: string
  name: string
  status: string
  fileCount: number
  riskCount: number
  createdAt: string
}

export function ProjectList() {
  const navigate = useNavigate()
  const { removeProjectTasks } = useTaskContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 删除确认对话框
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  })
  const [isDeleting, setIsDeleting] = useState(false)

  // 加载项目
  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await projectService.getList()
      setProjects(
        (Array.isArray(data) ? data : []).map((p: any) => ({
          id: p.id,
          name: p.name || p.projectName || '未命名项目',
          status: p.status || 'draft',
          fileCount: p.fileCount || 0,
          riskCount: p.riskCount || 0,
          createdAt: p.createdAt,
        }))
      )
    } catch (err) {
      console.error('加载项目列表失败:', err)
      setError('无法连接后端服务')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 删除项目
  const handleDelete = async () => {
    if (!deleteDialog.project) return
    
    setIsDeleting(true)
    try {
      const projectId = deleteDialog.project.id
      await projectService.delete(projectId)
      // 同时清理该项目的所有任务
      removeProjectTasks(projectId)
      setDeleteDialog({ open: false, project: null })
      // 重新加载列表
      await loadProjects()
    } catch (err) {
      console.error('删除项目失败:', err)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  // 打开删除确认
  const openDeleteDialog = (project: Project, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteDialog({ open: true, project })
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 按状态分组：进行中 / 已完成
  const inProgressProjects = filteredProjects.filter(p => p.status !== 'completed')
  const completedProjects = filteredProjects.filter(p => p.status === 'completed')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 标题 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">项目列表</h1>
        <Button onClick={() => navigate('/projects/new')}>
          <Plus className="mr-2 h-4 w-4" />
          新建项目
        </Button>
      </div>

      {/* 搜索 */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索项目..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">加载项目列表...</p>
        </div>
      )}

      {/* 错误 */}
      {error && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-700">{error}</p>
          <p className="mt-1 text-sm text-red-600">
            请确保后端服务已启动
          </p>
        </div>
      )}

      {/* 项目列表 */}
      {!isLoading && !error && (
        <div className="space-y-8">
          {/* 进行中 */}
          {inProgressProjects.length > 0 && (
            <ProjectSection
              title="进行中"
              icon={Clock}
              projects={inProgressProjects}
              iconColor="text-amber-600"
              bgColor="bg-amber-50"
              onDelete={openDeleteDialog}
            />
          )}

          {/* 已完成 */}
          {completedProjects.length > 0 && (
            <ProjectSection
              title="已完成"
              icon={CheckCircle2}
              projects={completedProjects}
              iconColor="text-green-600"
              bgColor="bg-green-50"
              onDelete={openDeleteDialog}
            />
          )}

          {/* 空状态 */}
          {filteredProjects.length === 0 && (
            <div className="py-12 text-center">
              <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">
                {searchTerm ? '未找到匹配的项目' : '暂无项目'}
              </p>
              {!searchTerm && (
                <Button className="mt-4" onClick={() => navigate('/projects/new')}>
                  创建第一个项目
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, project: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除项目</DialogTitle>
            <DialogDescription>
              确定要删除项目「{deleteDialog.project?.name}」吗？此操作不可撤销，将同时删除项目的所有文件、字段和审计记录。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, project: null })}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 项目分组
function ProjectSection({
  title,
  icon: Icon,
  projects,
  iconColor,
  onDelete,
}: {
  title: string
  icon: React.ElementType
  projects: Project[]
  iconColor: string
  bgColor: string
  onDelete: (project: Project, e: React.MouseEvent) => void
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn('h-5 w-5', iconColor)} />
        <h2 className="font-semibold">{title}</h2>
        <Badge variant="secondary" className="ml-1">
          {projects.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}

// 项目卡片
function ProjectCard({
  project,
  onDelete,
}: {
  project: Project
  onDelete: (project: Project, e: React.MouseEvent) => void
}) {
  return (
    <Link to={`/projects/${project.id}`}>
      <div className="group flex items-center gap-4 rounded-xl border p-4 transition-all hover:bg-muted/50 hover:shadow-sm">
        {/* 图标 */}
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
            project.status === 'completed' ? 'bg-green-100' : 'bg-primary/10'
          )}
        >
          {project.status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <FolderOpen className="h-5 w-5 text-primary" />
          )}
        </div>

        {/* 信息 */}
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{project.name}</p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatRelativeTime(project.createdAt)}</span>
            {project.fileCount > 0 && <span>{project.fileCount} 个文件</span>}
          </div>
        </div>

        {/* 风险数 */}
        {project.riskCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {project.riskCount}
          </Badge>
        )}

        {/* 状态 */}
        <ProjectStatusBadge status={project.status} />

        {/* 操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => onDelete(project, e)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除项目
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 箭头 */}
        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

// 状态徽章
function ProjectStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    uploading: { label: '待上传', className: 'bg-gray-100 text-gray-700' },
    extracting: { label: '提取中', className: 'bg-blue-100 text-blue-700' },
    auditing: { label: '审计中', className: 'bg-purple-100 text-purple-700' },
    completed: { label: '已完成', className: 'bg-green-100 text-green-700' },
    // 兼容旧状态
    draft: { label: '待上传', className: 'bg-gray-100 text-gray-700' },
    parsing: { label: '提取中', className: 'bg-blue-100 text-blue-700' },
    confirming: { label: '提取中', className: 'bg-blue-100 text-blue-700' },
    ready: { label: '提取中', className: 'bg-blue-100 text-blue-700' },
  }
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return <Badge className={className}>{label}</Badge>
}
