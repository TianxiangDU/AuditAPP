import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Download,
  FileText,
  Edit2,
  Save,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn, getSeverityColor, getSeverityText } from '@/lib/utils'
import type { AuditRisk, RiskSeverity } from '@/types'

// 模拟风险数据
const mockRisks: AuditRisk[] = [
  {
    id: '1',
    projectId: '1',
    ruleId: '1',
    ruleName: '投标保证金比例检查',
    ruleCode: 'BOND_001',
    category: '保证金',
    result: 'fail',
    severity: 'high',
    description: '投标保证金金额为100万元，招标项目估算价为5000万元，保证金比例为2%，达到上限',
    suggestion: '建议核实是否有必要设置最高限额的保证金',
    usedFields: [
      { fieldCode: 'bidBond', fieldName: '投标保证金', value: '100万元', sourceFile: '招标文件.pdf' },
      { fieldCode: 'maxBidPrice', fieldName: '最高投标限价', value: '5000万元', sourceFile: '招标文件.pdf' },
    ],
    lawReferences: [
      {
        lawDocumentId: '1',
        lawDocumentName: '招标投标法实施条例',
        clauseId: '1',
        clauseNumber: '第二十六条',
        clauseContent: '招标人在招标文件中要求投标人提交投标保证金的，投标保证金不得超过招标项目估算价的2%。',
      },
    ],
    evidenceRefs: [{ page: 15, snippet: '投标保证金：壹佰万元整' }],
    createdAt: '2026-01-27T14:00:00Z',
    updatedAt: '2026-01-27T14:00:00Z',
  },
  {
    id: '2',
    projectId: '1',
    ruleId: '2',
    ruleName: '评标委员会人数检查',
    ruleCode: 'COMM_001',
    category: '评标',
    result: 'fail',
    severity: 'medium',
    description: '评标委员会由6名成员组成，不符合单数要求',
    suggestion: '评标委员会应由5人以上单数组成',
    usedFields: [
      { fieldCode: 'evaluationCommittee', fieldName: '评标委员会组成', value: '6人', sourceFile: '招标文件.pdf' },
    ],
    lawReferences: [
      {
        lawDocumentId: '1',
        lawDocumentName: '招标投标法',
        clauseId: '2',
        clauseNumber: '第三十七条',
        clauseContent: '评标委员会由招标人的代表和有关技术、经济等方面的专家组成，成员人数为五人以上单数。',
      },
    ],
    evidenceRefs: [{ page: 22, snippet: '评标委员会由6名成员组成' }],
    createdAt: '2026-01-27T14:00:00Z',
    updatedAt: '2026-01-27T14:00:00Z',
  },
  {
    id: '3',
    projectId: '1',
    ruleId: '6',
    ruleName: '履约保证金比例检查',
    ruleCode: 'PERF_001',
    category: '保证金',
    result: 'fail',
    severity: 'low',
    description: '履约保证金比例设置为中标合同金额的15%，超过规定的10%上限',
    suggestion: '根据规定，履约保证金一般不得超过中标合同金额的10%',
    usedFields: [
      { fieldCode: 'performanceBondRate', fieldName: '履约保证金金额百分比', value: '15%', sourceFile: '招标文件.pdf' },
    ],
    lawReferences: [],
    evidenceRefs: [{ page: 35, snippet: '履约保证金为中标合同金额的15%' }],
    createdAt: '2026-01-27T14:00:00Z',
    updatedAt: '2026-01-27T14:00:00Z',
  },
]

export function ProjectRisks() {
  const { id: projectId } = useParams()
  const [risks, setRisks] = useState<AuditRisk[]>(mockRisks)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ description: string; suggestion: string; severity: RiskSeverity }>({
    description: '',
    suggestion: '',
    severity: 'medium',
  })
  const [expandedRisks, setExpandedRisks] = useState<string[]>(risks.map((r) => r.id))
  const [isGenerating, setIsGenerating] = useState(false)

  const handleEdit = (risk: AuditRisk) => {
    setEditingId(risk.id)
    setEditForm({
      description: risk.description,
      suggestion: risk.suggestion,
      severity: risk.severity,
    })
  }

  const handleSave = (riskId: string) => {
    setRisks((prev) =>
      prev.map((r) =>
        r.id === riskId
          ? { ...r, ...editForm, updatedAt: new Date().toISOString() }
          : r
      )
    )
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  const toggleExpand = (riskId: string) => {
    setExpandedRisks((prev) =>
      prev.includes(riskId) ? prev.filter((id) => id !== riskId) : [...prev, riskId]
    )
  }

  const handleGenerateReport = async () => {
    setIsGenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsGenerating(false)
    // 模拟下载
    window.open(`/api/app/projects/${projectId}/report/download`, '_blank')
  }

  const highCount = risks.filter((r) => r.severity === 'high').length
  const mediumCount = risks.filter((r) => r.severity === 'medium').length
  const lowCount = risks.filter((r) => r.severity === 'low').length

  return (
    <div className="container mx-auto py-8">
      {/* 页面头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">风险报告</h1>
          <p className="mt-1 text-muted-foreground">
            查看和编辑审计风险，生成报告
          </p>
        </div>
        <Button onClick={handleGenerateReport} disabled={isGenerating}>
          <Download className="mr-2 h-4 w-4" />
          {isGenerating ? '生成中...' : '生成并下载报告'}
        </Button>
      </div>

      {/* 风险统计 */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>风险总数</CardDescription>
            <CardTitle className="text-2xl">{risks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardDescription>高风险</CardDescription>
            <CardTitle className="text-2xl text-red-600">{highCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-2">
            <CardDescription>中风险</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{mediumCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardDescription>低风险</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{lowCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 风险清单 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">风险清单</CardTitle>
          <CardDescription>点击风险项可展开查看详情，支持编辑描述和建议</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {risks.map((risk, index) => (
                <Collapsible
                  key={risk.id}
                  open={expandedRisks.includes(risk.id)}
                  onOpenChange={() => toggleExpand(risk.id)}
                >
                  <div
                    className={cn(
                      'rounded-lg border',
                      getSeverityColor(risk.severity)
                    )}
                  >
                    <CollapsibleTrigger className="flex w-full items-center gap-3 p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={cn(
                            'h-4 w-4',
                            risk.severity === 'high' && 'text-red-600',
                            risk.severity === 'medium' && 'text-yellow-600',
                            risk.severity === 'low' && 'text-blue-600'
                          )} />
                          <span className="font-medium">{risk.ruleName}</span>
                          <Badge variant="outline" className="text-xs">
                            {risk.category}
                          </Badge>
                          <Badge className={cn('text-xs', getSeverityColor(risk.severity))}>
                            {getSeverityText(risk.severity)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {risk.description}
                        </p>
                      </div>
                      {expandedRisks.includes(risk.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <Separator />
                      <div className="p-4">
                        {editingId === risk.id ? (
                          // 编辑模式
                          <div className="space-y-4">
                            <div>
                              <label className="mb-1 block text-sm font-medium">风险等级</label>
                              <Select
                                value={editForm.severity}
                                onValueChange={(v) => setEditForm((prev) => ({ ...prev, severity: v as RiskSeverity }))}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="high">高风险</SelectItem>
                                  <SelectItem value="medium">中风险</SelectItem>
                                  <SelectItem value="low">低风险</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium">问题描述</label>
                              <Textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                                rows={3}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium">处理建议</label>
                              <Textarea
                                value={editForm.suggestion}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, suggestion: e.target.value }))}
                                rows={2}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={handleCancel}>
                                <X className="mr-1 h-3 w-3" />
                                取消
                              </Button>
                              <Button size="sm" onClick={() => handleSave(risk.id)}>
                                <Save className="mr-1 h-3 w-3" />
                                保存
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // 查看模式
                          <div className="space-y-4">
                            <div className="flex justify-end">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(risk)}>
                                <Edit2 className="mr-1 h-3 w-3" />
                                编辑
                              </Button>
                            </div>
                            
                            <div>
                              <h4 className="mb-1 text-sm font-medium">问题描述</h4>
                              <p className="text-sm text-muted-foreground">{risk.description}</p>
                            </div>
                            
                            <div>
                              <h4 className="mb-1 text-sm font-medium">处理建议</h4>
                              <p className="text-sm text-muted-foreground">
                                {risk.suggestion || '无'}
                              </p>
                            </div>
                            
                            {/* 使用的字段 */}
                            <div>
                              <h4 className="mb-2 text-sm font-medium">涉及字段</h4>
                              <div className="flex flex-wrap gap-2">
                                {risk.usedFields.map((field, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {field.fieldName}: {field.value}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            {/* 法规依据 */}
                            {risk.lawReferences.length > 0 && (
                              <div>
                                <h4 className="mb-2 text-sm font-medium">法规依据</h4>
                                {risk.lawReferences.map((law, idx) => (
                                  <div key={idx} className="rounded border bg-muted/30 p-3">
                                    <p className="text-sm font-medium">
                                      {law.lawDocumentName} {law.clauseNumber}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {law.clauseContent}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* 证据 */}
                            {risk.evidenceRefs.length > 0 && (
                              <div>
                                <h4 className="mb-2 text-sm font-medium">原文证据</h4>
                                <div className="flex flex-wrap gap-2">
                                  {risk.evidenceRefs.map((evidence, idx) => (
                                    <Button key={idx} variant="outline" size="sm" className="gap-2">
                                      <FileText className="h-3 w-3" />
                                      第 {evidence.page} 页
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
