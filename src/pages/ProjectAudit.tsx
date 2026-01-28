import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Play,
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Scale,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { cn } from '@/lib/utils'
import type { AuditRule, AuditRisk, AuditResult } from '@/types'

// 模拟规则数据
const mockRules: (AuditRule & { selected?: boolean })[] = [
  { id: '1', code: 'BOND_001', name: '投标保证金比例检查', description: '检查投标保证金是否超过招标项目估算价的2%', category: '保证金', stage: '投标', isEnabled: true, expression: '', selected: true },
  { id: '2', code: 'COMM_001', name: '评标委员会人数检查', description: '检查评标委员会成员人数是否为5人以上单数', category: '评标', stage: '评标', isEnabled: true, expression: '', selected: true },
  { id: '3', code: 'TIME_001', name: '投标截止时间检查', description: '检查投标截止时间与开标时间的间隔', category: '时间', stage: '投标', isEnabled: true, expression: '', selected: true },
  { id: '4', code: 'QUAL_001', name: '资格条件合规性检查', description: '检查资格条件是否存在限制性条款', category: '资格', stage: '资格审查', isEnabled: true, expression: '', selected: false },
  { id: '5', code: 'EVAL_001', name: '评标方法合规性检查', description: '检查评标方法是否符合规定', category: '评标', stage: '评标', isEnabled: true, expression: '', selected: false },
  { id: '6', code: 'PERF_001', name: '履约保证金比例检查', description: '检查履约保证金比例是否在规定范围内', category: '保证金', stage: '定标', isEnabled: true, expression: '', selected: true },
]

// 模拟审计结果
const mockResults: AuditRisk[] = [
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
    ruleId: '3',
    ruleName: '投标截止时间检查',
    ruleCode: 'TIME_001',
    category: '时间',
    result: 'pass',
    severity: 'low',
    description: '投标截止时间与开标时间间隔符合要求',
    suggestion: '',
    usedFields: [
      { fieldCode: 'bidDeadline', fieldName: '投标截止时间', value: '2026-02-14 17:00', sourceFile: '招标文件.pdf' },
      { fieldCode: 'bidOpeningTime', fieldName: '开标时间', value: '2026-02-15 09:00', sourceFile: '招标文件.pdf' },
    ],
    lawReferences: [],
    evidenceRefs: [],
    createdAt: '2026-01-27T14:00:00Z',
    updatedAt: '2026-01-27T14:00:00Z',
  },
]

export function ProjectAudit() {
  const { id: projectId } = useParams()
  const [rules, setRules] = useState(mockRules)
  const [results, setResults] = useState<AuditRisk[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [expandedResults, setExpandedResults] = useState<string[]>([])

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, selected: !r.selected } : r))
    )
  }

  const handleSelectAll = () => {
    setRules((prev) => prev.map((r) => ({ ...r, selected: true })))
  }

  const handleDeselectAll = () => {
    setRules((prev) => prev.map((r) => ({ ...r, selected: false })))
  }

  const handleRunAudit = async () => {
    setIsRunning(true)
    setResults([])
    
    // 模拟逐条执行
    for (const result of mockResults) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      setResults((prev) => [...prev, result])
    }
    
    setIsRunning(false)
    setExpandedResults(mockResults.map((r) => r.id))
  }

  const toggleExpand = (resultId: string) => {
    setExpandedResults((prev) =>
      prev.includes(resultId) ? prev.filter((id) => id !== resultId) : [...prev, resultId]
    )
  }

  const getResultIcon = (result: AuditResult) => {
    switch (result) {
      case 'pass':
        return <Check className="h-5 w-5 text-green-600" />
      case 'fail':
        return <X className="h-5 w-5 text-red-600" />
      case 'review':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'missing':
        return <HelpCircle className="h-5 w-5 text-gray-400" />
    }
  }

  const categories = [...new Set(rules.map((r) => r.category))]
  const selectedCount = rules.filter((r) => r.selected).length
  const filteredRules = categoryFilter === 'all' ? rules : rules.filter((r) => r.category === categoryFilter)

  const passCount = results.filter((r) => r.result === 'pass').length
  const failCount = results.filter((r) => r.result === 'fail').length

  return (
    <div className="container mx-auto py-8">
      {/* 页面头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">审计</h1>
          <p className="mt-1 text-muted-foreground">
            选择审计规则并执行检查
          </p>
        </div>
        <Button onClick={handleRunAudit} disabled={isRunning || selectedCount === 0}>
          <Play className="mr-2 h-4 w-4" />
          {isRunning ? '执行中...' : `执行审计 (${selectedCount})`}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 规则选择 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">审计规则</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  全选
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
                  清空
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="类别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类别</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                      rule.selected && 'border-primary bg-primary/5'
                    )}
                  >
                    <Checkbox
                      checked={rule.selected}
                      onCheckedChange={() => handleToggleRule(rule.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{rule.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {rule.category}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {rule.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {rule.code} · {rule.stage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 审计结果 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">审计结果</CardTitle>
                {results.length > 0 && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                      <Check className="h-4 w-4" />
                      通过 {passCount}
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <X className="h-4 w-4" />
                      不通过 {failCount}
                    </span>
                  </div>
                )}
              </div>
              <CardDescription>
                {isRunning
                  ? `正在执行审计规则... (${results.length}/${selectedCount})`
                  : results.length > 0
                  ? `共执行 ${results.length} 条规则`
                  : '选择规则后点击"执行审计"开始检查'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results.length === 0 && !isRunning ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Scale className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">暂无审计结果</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {results.map((result) => (
                      <Collapsible
                        key={result.id}
                        open={expandedResults.includes(result.id)}
                        onOpenChange={() => toggleExpand(result.id)}
                      >
                        <div
                          className={cn(
                            'rounded-lg border',
                            result.result === 'fail' && 'border-red-200 bg-red-50/50',
                            result.result === 'pass' && 'border-green-200 bg-green-50/50'
                          )}
                        >
                          <CollapsibleTrigger className="flex w-full items-center gap-3 p-4">
                            {getResultIcon(result.result)}
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{result.ruleName}</span>
                                <Badge
                                  variant={result.severity === 'high' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {result.severity === 'high' ? '高风险' : result.severity === 'medium' ? '中风险' : '低风险'}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                                {result.description}
                              </p>
                            </div>
                            {expandedResults.includes(result.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <Separator />
                            <div className="space-y-4 p-4">
                              {/* 使用的字段 */}
                              <div>
                                <h4 className="mb-2 text-sm font-medium">使用的字段</h4>
                                <div className="space-y-1">
                                  {result.usedFields.map((field, idx) => (
                                    <div key={idx} className="flex items-center justify-between rounded bg-muted/50 px-3 py-2 text-sm">
                                      <span>{field.fieldName}</span>
                                      <span className="text-muted-foreground">{field.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              {/* 法规依据 */}
                              {result.lawReferences.length > 0 && (
                                <div>
                                  <h4 className="mb-2 text-sm font-medium">法规依据</h4>
                                  {result.lawReferences.map((law, idx) => (
                                    <div key={idx} className="rounded border bg-muted/30 p-3">
                                      <p className="text-sm font-medium">{law.lawDocumentName} {law.clauseNumber}</p>
                                      <p className="mt-1 text-sm text-muted-foreground">{law.clauseContent}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* 建议 */}
                              {result.suggestion && (
                                <div>
                                  <h4 className="mb-2 text-sm font-medium">处理建议</h4>
                                  <p className="text-sm text-muted-foreground">{result.suggestion}</p>
                                </div>
                              )}
                              
                              {/* 证据 */}
                              {result.evidenceRefs.length > 0 && (
                                <div>
                                  <h4 className="mb-2 text-sm font-medium">原文证据</h4>
                                  {result.evidenceRefs.map((evidence, idx) => (
                                    <Button key={idx} variant="outline" size="sm" className="gap-2">
                                      <FileText className="h-3 w-3" />
                                      第 {evidence.page} 页
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
