import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Upload, 
  Database, 
  ClipboardList, 
  Search, 
  FileWarning,
  ChevronRight,
  AlertTriangle,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { StatusBadge, StepCards, type StepInfo } from '@/components/common'
import { formatDate } from '@/lib/utils'
import type { Project } from '@/types'

// 模拟项目数据
const mockProject: Project = {
  id: '1',
  projectName: '某市政道路建设工程招标项目',
  tenderFileId: 'file-1',
  status: 'auditing',
  pendingCount: 5,
  riskCount: 3,
  createdAt: '2026-01-25T10:30:00Z',
  updatedAt: '2026-01-27T14:20:00Z',
}

export function ProjectWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project] = useState<Project>(mockProject)

  const steps: StepInfo[] = [
    {
      id: 'files',
      title: '资料上传与分拣',
      description: '上传项目资料并进行文件分类',
      status: 'completed',
      progress: 100,
      pendingCount: 0,
      ctaText: '查看资料',
      ctaHref: `/projects/${id}/files`,
    },
    {
      id: 'fields',
      title: '关键信息库',
      description: '确认各文件的关键信息',
      status: 'in_progress',
      progress: 75,
      pendingCount: 5,
      ctaText: '继续确认',
      ctaHref: `/projects/${id}/files`,
    },
    {
      id: 'ledger',
      title: '项目台账',
      description: '汇总项目关键信息',
      status: 'pending',
      ctaText: '生成台账',
      ctaHref: `/projects/${id}/ledger`,
    },
    {
      id: 'audit',
      title: '审计',
      description: '执行审计规则检查',
      status: 'pending',
      ctaText: '开始审计',
      ctaHref: `/projects/${id}/audit`,
    },
    {
      id: 'risks',
      title: '风险报告',
      description: '生成审计风险报告',
      status: 'pending',
      pendingCount: 3,
      ctaText: '查看报告',
      ctaHref: `/projects/${id}/risks`,
    },
  ]

  // 计算总体进度
  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const totalProgress = Math.round((completedSteps / steps.length) * 100)

  return (
    <div className="container mx-auto py-8">
      {/* 项目信息头部 */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{project.projectName}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="mt-1 text-muted-foreground">
              创建于 {formatDate(project.createdAt)} · 
              最后更新 {formatDate(project.updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/projects')}>
              返回列表
            </Button>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">项目进度</span>
            <span className="text-muted-foreground">{totalProgress}%</span>
          </div>
          <Progress value={totalProgress} className="h-2" />
        </div>
      </div>

      {/* 快速统计 */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>文件数量</CardDescription>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">已分拣 10 个</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>关键信息</CardDescription>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">86</div>
            <p className="text-xs text-muted-foreground">待确认 {project.pendingCount} 个</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>审计规则</CardDescription>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">已执行 0 条</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>风险项</CardDescription>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{project.riskCount}</div>
            <p className="text-xs text-muted-foreground">需要处理</p>
          </CardContent>
        </Card>
      </div>

      {/* 步骤卡片 */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">工作流程</h2>
        <StepCards steps={steps} />
      </div>

      <Separator className="my-8" />

      {/* 待办事项 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 待确认字段 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-yellow-600" />
              待确认字段
            </CardTitle>
            <CardDescription>以下字段需要人工确认</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { file: '投标文件-A公司.pdf', field: '投标金额', value: '4,560万元' },
                { file: '投标文件-A公司.pdf', field: '项目负责人资质', value: '一级建造师' },
                { file: '投标文件-B公司.pdf', field: '投标金额', value: '4,320万元' },
                { file: '评标报告.pdf', field: '评标委员会组成', value: '5人' },
                { file: '中标通知书.pdf', field: '中标金额', value: '4,320万元' },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{item.field}</p>
                    <p className="text-xs text-muted-foreground">{item.file}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.value}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-4 w-full" asChild>
              <a href={`/projects/${id}/files`}>查看全部待确认</a>
            </Button>
          </CardContent>
        </Card>

        {/* 风险项 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              风险项
            </CardTitle>
            <CardDescription>审计发现的问题</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { rule: '投标保证金比例检查', severity: 'high', desc: '投标保证金比例超过2%' },
                { rule: '评标委员会人数检查', severity: 'medium', desc: '评标委员会人数为偶数' },
                { rule: '投标截止时间检查', severity: 'low', desc: '投标截止时间与开标时间间隔过短' },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        item.severity === 'high'
                          ? 'bg-red-500'
                          : item.severity === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{item.rule}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-4 w-full" asChild>
              <a href={`/projects/${id}/risks`}>查看风险报告</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
