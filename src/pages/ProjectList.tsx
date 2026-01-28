import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, FileText, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/common'
import { formatDate } from '@/lib/utils'
import type { Project } from '@/types'

// 模拟数据
const mockProjects: Project[] = [
  {
    id: '1',
    projectName: '某市政工程招标项目',
    tenderFileId: 'file-1',
    status: 'auditing',
    pendingCount: 5,
    riskCount: 3,
    createdAt: '2026-01-25T10:30:00Z',
    updatedAt: '2026-01-27T14:20:00Z',
  },
  {
    id: '2',
    projectName: '智慧城市建设采购项目',
    tenderFileId: 'file-2',
    status: 'confirming',
    pendingCount: 12,
    riskCount: 0,
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-01-26T16:45:00Z',
  },
  {
    id: '3',
    projectName: '医疗设备采购招标',
    tenderFileId: 'file-3',
    status: 'completed',
    pendingCount: 0,
    riskCount: 7,
    createdAt: '2026-01-15T11:20:00Z',
    updatedAt: '2026-01-22T10:30:00Z',
  },
]

export function ProjectList() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [projects] = useState<Project[]>(mockProjects)

  const filteredProjects = projects.filter((p) =>
    p.projectName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'auditing':
        return <AlertTriangle className="h-5 w-5 text-purple-600" />
      case 'confirming':
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-600" />
    }
  }

  return (
    <div className="container mx-auto py-8">
      {/* 页面头部 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目列表</h1>
          <p className="mt-1 text-muted-foreground">
            管理您的招采审计项目，查看进度和风险情况
          </p>
        </div>
        <Button onClick={() => navigate('/projects/new')}>
          <Plus className="mr-2 h-4 w-4" />
          新建项目
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="mb-6">
        <Input
          placeholder="搜索项目名称..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* 统计卡片 */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>项目总数</CardDescription>
            <CardTitle className="text-3xl">{projects.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>进行中</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {projects.filter((p) => p.status !== 'completed').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>待确认项</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">
              {projects.reduce((sum, p) => sum + p.pendingCount, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>风险项</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {projects.reduce((sum, p) => sum + p.riskCount, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 项目列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`}>
            <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:ring-2 hover:ring-primary/20">
              <CardHeader>
                <div className="flex items-start justify-between">
                  {getStatusIcon(project.status)}
                  <StatusBadge status={project.status} />
                </div>
                <CardTitle className="mt-2 line-clamp-2 text-lg">
                  {project.projectName}
                </CardTitle>
                <CardDescription>
                  创建于 {formatDate(project.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    {project.pendingCount > 0 && (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <Clock className="h-4 w-4" />
                        待确认 {project.pendingCount}
                      </span>
                    )}
                    {project.riskCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        风险 {project.riskCount}
                      </span>
                    )}
                    {project.pendingCount === 0 && project.riskCount === 0 && (
                      <span className="text-muted-foreground">无待办事项</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 空状态 */}
      {filteredProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText className="h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">暂无项目</h3>
          <p className="mt-1 text-muted-foreground">
            {searchTerm ? '未找到匹配的项目' : '点击"新建项目"开始您的第一个审计项目'}
          </p>
          {!searchTerm && (
            <Button className="mt-4" onClick={() => navigate('/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
