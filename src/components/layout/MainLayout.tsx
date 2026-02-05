import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Plus,
  Bell,
  Loader2,
  Check,
  AlertCircle,
  X,
  ChevronRight,
  Settings,
  Menu,
  FileCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useTaskContext, TASK_TYPE_NAMES } from '@/contexts/TaskContext'
import { cn, formatRelativeTime } from '@/lib/utils'

export function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tasks, stats, clearCompleted, removeTask } = useTaskContext()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: '工作台' },
    { path: '/projects', icon: FolderKanban, label: '项目列表' },
    { path: '/audit-rules', icon: FileCheck, label: '审计规则' },
  ]

  // 最近的任务（显示最多10个）
  const recentTasks = tasks.slice(0, 10)
  const hasRunningTasks = stats.running > 0

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <aside
        className={cn(
          'flex flex-col border-r bg-card transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          {!sidebarCollapsed && (
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                审
              </div>
              <span className="font-semibold">审计工作台</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* 导航 */}
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* 新建项目按钮 */}
        <div className="border-t p-2">
          <Button
            className={cn('w-full', sidebarCollapsed && 'px-0')}
            onClick={() => navigate('/projects/new')}
          >
            <Plus className="h-4 w-4" />
            {!sidebarCollapsed && <span className="ml-2">新建项目</span>}
          </Button>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-4">
            {/* 面包屑或标题可以放这里 */}
          </div>

          <div className="flex items-center gap-2">
            {/* 任务中心 */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  {hasRunningTasks ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Bell className="h-5 w-5" />
                  )}
                  {stats.running > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {stats.running}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <div className="flex items-center justify-between border-b p-3">
                  <h3 className="font-semibold">任务中心</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {stats.running > 0 && (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {stats.running} 进行中
                      </span>
                    )}
                    {stats.completed > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={clearCompleted}
                      >
                        清除已完成
                      </Button>
                    )}
                  </div>
                </div>

                <ScrollArea className="max-h-[400px]">
                  {recentTasks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      暂无任务
                    </div>
                  ) : (
                    <div className="divide-y">
                      {recentTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-3 hover:bg-muted/50"
                        >
                          {/* 状态图标 */}
                          <div className="mt-0.5">
                            {task.status === 'running' && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                            {task.status === 'pending' && (
                              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                            )}
                            {task.status === 'completed' && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                            {task.status === 'failed' && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>

                          {/* 任务信息 */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {task.projectName}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {TASK_TYPE_NAMES[task.type]}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {task.fileName || task.message}
                            </p>
                            {task.status === 'running' && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="h-1.5 flex-1 rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {task.progress}%
                                </span>
                              </div>
                            )}
                            {task.status === 'failed' && task.error && (
                              <p className="mt-1 text-xs text-red-500 truncate">
                                {task.error}
                              </p>
                            )}
                          </div>

                          {/* 时间和操作 */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(task.completedAt || task.createdAt)}
                            </span>
                            {(task.status === 'completed' || task.status === 'failed') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => removeTask(task.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {recentTasks.length > 0 && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-between text-sm"
                      onClick={() => navigate('/tasks')}
                    >
                      查看全部任务
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* 设置 */}
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
