import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Download,
  ArrowLeft,
  Edit2,
  Save,
  X,
  AlertTriangle,
  Loader2,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { auditService, projectService } from '@/services'
import { cn, getSeverityText } from '@/lib/utils'
import { exportRiskReportToExcel, formatDateForDisplay } from '@/utils/exportUtils'
import type { AuditRisk, RiskSeverity } from '@/types'

export function ProjectRisks() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()

  const [projectName, setProjectName] = useState('')
  const [risks, setRisks] = useState<AuditRisk[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ description: '', suggestion: '', severity: 'medium' as RiskSeverity })
  const [isGenerating, setIsGenerating] = useState(false)

  // 加载数据
  useEffect(() => {
    async function loadData() {
      if (!projectId) return

      try {
        setIsLoading(true)
        setError(null)

        // 获取项目信息
        const project = await projectService.getById(projectId)
        setProjectName((project as any).name || project.projectName || '未命名项目')

        // 获取风险列表
        const riskList = await auditService.getRisks(projectId)
        setRisks(riskList || [])
      } catch (err) {
        console.error('加载风险列表失败:', err)
        setError('加载失败')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [projectId])

  const handleEdit = (risk: AuditRisk) => {
    setEditingId(risk.id)
    setEditForm({ description: risk.description, suggestion: risk.suggestion, severity: risk.severity })
  }

  const handleSave = async (riskId: string) => {
    try {
      await auditService.updateRisk(projectId!, riskId, editForm)
      setRisks((prev) =>
        prev.map((r) => r.id === riskId ? { ...r, ...editForm } : r)
      )
      setEditingId(null)
    } catch (err) {
      console.error('更新风险失败:', err)
    }
  }

  const handleGenerateReport = () => {
    if (risks.length === 0) return

    setIsGenerating(true)

    // 准备导出数据
    const exportData = {
      projectName,
      exportDate: formatDateForDisplay(new Date()),
      summary: {
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        total: risks.length,
      },
      risks: risks.map(risk => ({
        ruleName: risk.ruleName || '未命名规则',
        ruleCode: risk.ruleCode || '-',
        severity: risk.severity || 'medium',
        description: risk.description || '暂无描述',
        suggestion: risk.suggestion || '暂无建议',
      })),
    }

    try {
      exportRiskReportToExcel(exportData)
    } catch (err) {
      console.error('导出失败:', err)
      alert('导出失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const getSeverityStyle = (severity: RiskSeverity) => {
    if (severity === 'high') return 'bg-red-100 text-red-700 border-red-200'
    if (severity === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  const highCount = risks.filter(r => r.severity === 'high').length
  const mediumCount = risks.filter(r => r.severity === 'medium').length
  const lowCount = risks.filter(r => r.severity === 'low').length

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
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
          <h1 className="text-xl font-semibold">风险报告</h1>
          <p className="text-sm text-muted-foreground">{projectName}</p>
        </div>
        <Button
          onClick={handleGenerateReport}
          disabled={isGenerating || risks.length === 0}
        >
          {isGenerating ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1 h-4 w-4" />
          )}
          导出报告
        </Button>
      </div>

      {/* 加载中 */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      )}

      {/* 错误 */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700">
          {error}
        </div>
      )}

      {/* 无风险 */}
      {!isLoading && !error && risks.length === 0 && (
        <div className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <p className="mt-4 text-lg font-medium text-green-700">暂无风险</p>
          <p className="text-muted-foreground">请先执行审计以发现风险点</p>
          <Button
            className="mt-4"
            onClick={() => navigate(`/projects/${projectId}/audit`)}
          >
            执行审计
          </Button>
        </div>
      )}

      {/* 风险统计 */}
      {!isLoading && !error && risks.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-700">高风险</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-red-700">{highCount}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-amber-700">中风险</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-700">{mediumCount}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-700">低风险</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-700">{lowCount}</p>
            </div>
          </div>

          {/* 风险列表 */}
          <div className="space-y-4">
            {risks.map((risk) => (
              <div
                key={risk.id}
                className={cn(
                  'rounded-lg border p-4',
                  getSeverityStyle(risk.severity)
                )}
              >
                {/* 标题行 */}
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{risk.ruleName}</span>
                      <Badge variant="outline" className="text-xs">
                        {risk.ruleCode}
                      </Badge>
                    </div>
                  </div>
                  {editingId === risk.id ? (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSave(risk.id)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(risk)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* 内容 */}
                {editingId === risk.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium">风险描述</label>
                      <Textarea
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm({ ...editForm, description: e.target.value })
                        }
                        className="mt-1 min-h-[60px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">处理建议</label>
                      <Textarea
                        value={editForm.suggestion}
                        onChange={(e) =>
                          setEditForm({ ...editForm, suggestion: e.target.value })
                        }
                        className="mt-1 min-h-[60px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">严重程度</label>
                      <Select
                        value={editForm.severity}
                        onValueChange={(v) =>
                          setEditForm({ ...editForm, severity: v as RiskSeverity })
                        }
                      >
                        <SelectTrigger className="mt-1 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">高风险</SelectItem>
                          <SelectItem value="medium">中风险</SelectItem>
                          <SelectItem value="low">低风险</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p>{risk.description}</p>
                    {risk.suggestion && (
                      <p className="opacity-80">
                        <strong>建议：</strong>
                        {risk.suggestion}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
