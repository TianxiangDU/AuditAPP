import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  FileSearch, 
  Home, 
  FolderOpen, 
  Settings,
  ChevronRight 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const navigation = [
  { name: '首页', href: '/projects', icon: Home },
  { name: '项目管理', href: '/projects', icon: FolderOpen },
]

export function MainLayout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <div className="hidden w-64 flex-col border-r bg-card lg:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <FileSearch className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold tracking-tight">招采审计</span>
        </div>

        {/* 导航 */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/projects' && location.pathname.startsWith(item.href))
              return (
                <Link key={item.name} to={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start',
                      isActive && 'bg-secondary font-medium'
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* 底部 */}
        <div className="border-t p-4">
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="mr-2 h-4 w-4" />
            设置
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-2">
            <Breadcrumb />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">审计人员</span>
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

function Breadcrumb() {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter((x) => x)

  const breadcrumbMap: Record<string, string> = {
    projects: '项目列表',
    new: '新建项目',
    files: '资料管理',
    ledger: '项目台账',
    audit: '审计',
    risks: '风险报告',
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link to="/projects" className="text-muted-foreground hover:text-foreground">
        首页
      </Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`
        const isLast = index === pathnames.length - 1
        const displayName = breadcrumbMap[name] || name

        // 跳过 ID 类的路径段
        if (name.length > 20) return null

        return (
          <span key={name} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {isLast ? (
              <span className="font-medium">{displayName}</span>
            ) : (
              <Link to={routeTo} className="text-muted-foreground hover:text-foreground">
                {displayName}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
