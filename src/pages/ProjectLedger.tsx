import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  FileText,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LEDGER_FIELD_DEFINITIONS, type LedgerFieldInfo } from '@/types'
import { cn } from '@/lib/utils'

// 模拟台账数据
const mockLedgerData: Record<string, LedgerFieldInfo> = {
  projectName: {
    fieldName: '项目名称',
    value: '某市政道路建设工程招标项目',
    source: 'auto',
    sourceFile: '招标文件.pdf',
    sourceField: 'projectName',
  },
  tenderCompanyName: {
    fieldName: '招标人公司名称',
    value: '某市城市建设投资有限公司',
    source: 'auto',
    sourceFile: '招标文件.pdf',
    sourceField: 'tenderCompany',
  },
  tenderContactPhone: {
    fieldName: '招标人联系电话',
    value: '0571-88888888',
    source: 'auto',
    sourceFile: '招标文件.pdf',
    sourceField: 'contactPhone',
  },
  tenderMethod: {
    fieldName: '招标方式',
    value: '公开招标',
    source: 'auto',
    sourceFile: '招标文件.pdf',
    sourceField: 'tenderMethod',
  },
  agencyName: {
    fieldName: '招标代理机构名称',
    value: null,
    source: 'manual',
  },
  agencyContact: {
    fieldName: '招标代理机构联系人',
    value: null,
    source: 'manual',
  },
  maxBidPrice: {
    fieldName: '最高投标限价',
    value: '5000万元',
    source: 'auto',
    sourceFile: '招标文件.pdf',
    sourceField: 'maxBidPrice',
  },
  bidderCompanyName: {
    fieldName: '投标人公司名称',
    value: 'B建设工程有限公司',
    source: 'auto',
    sourceFile: '中标通知书.pdf',
    sourceField: 'winningBidder',
  },
  bidAmount: {
    fieldName: '投标金额',
    value: '4,320万元',
    source: 'auto',
    sourceFile: '投标文件-B公司.pdf',
    sourceField: 'bidAmount',
  },
  bidderContact: {
    fieldName: '投标人联系人',
    value: '李经理',
    source: 'auto',
    sourceFile: '投标文件-B公司.pdf',
    sourceField: 'contactPerson',
  },
  bidderContactPhone: {
    fieldName: '投标人联系电话',
    value: '138-0000-0000',
    source: 'auto',
    sourceFile: '投标文件-B公司.pdf',
    sourceField: 'contactPhone',
  },
  isWinningBid: {
    fieldName: '是否中标',
    value: '是',
    source: 'auto',
    sourceFile: '中标通知书.pdf',
    sourceField: 'isWinning',
  },
}

export function ProjectLedger() {
  const { id: projectId } = useParams()
  const [ledger, setLedger] = useState<Record<string, LedgerFieldInfo>>(mockLedgerData)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsGenerating(false)
  }

  const handleFieldChange = (fieldCode: string, value: string) => {
    setLedger((prev) => ({
      ...prev,
      [fieldCode]: {
        ...prev[fieldCode],
        value,
        source: 'manual',
      },
    }))
  }

  const missingFields = Object.entries(ledger).filter(([, info]) => !info.value)
  const filledCount = Object.keys(ledger).length - missingFields.length

  return (
    <div className="container mx-auto py-8">
      {/* 页面头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">项目台账</h1>
          <p className="mt-1 text-muted-foreground">
            汇总项目关键信息，支持人工补录和导出
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isGenerating && 'animate-spin')} />
            {isGenerating ? '生成中...' : '重新生成'}
          </Button>
          <Button asChild>
            <a href={`/api/app/projects/${projectId}/ledger/export.xlsx`} download>
              <Download className="mr-2 h-4 w-4" />
              导出 Excel
            </a>
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>字段总数</CardDescription>
            <CardTitle className="text-2xl">{Object.keys(ledger).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已填写</CardDescription>
            <CardTitle className="text-2xl text-green-600">{filledCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>缺失字段</CardDescription>
            <CardTitle className="text-2xl text-red-600">{missingFields.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 台账表单 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">台账信息</CardTitle>
              <CardDescription>点击字段可编辑，编辑后来源将标记为"人工"</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {LEDGER_FIELD_DEFINITIONS.map((def) => {
                  const fieldInfo = ledger[def.code] || {
                    fieldName: def.name,
                    value: null,
                    source: 'manual',
                  }
                  
                  return (
                    <div key={def.code} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={def.code} className="text-sm font-medium">
                          {def.name}
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={fieldInfo.source === 'auto' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {fieldInfo.source === 'auto' ? '自动' : '人工'}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {fieldInfo.source === 'auto' && fieldInfo.sourceFile && (
                                <p className="text-xs">
                                  来源：{fieldInfo.sourceFile}<br />
                                  字段：{fieldInfo.sourceField}
                                </p>
                              )}
                              {fieldInfo.source === 'manual' && (
                                <p className="text-xs">人工录入</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="relative">
                        <Input
                          id={def.code}
                          value={fieldInfo.value || ''}
                          onChange={(e) => handleFieldChange(def.code, e.target.value)}
                          placeholder={fieldInfo.value ? undefined : '待补录'}
                          className={cn(
                            !fieldInfo.value && 'border-dashed border-orange-300 bg-orange-50/50'
                          )}
                        />
                        {fieldInfo.source === 'auto' && fieldInfo.sourceFile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 缺失字段清单 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                缺失字段清单
              </CardTitle>
              <CardDescription>以下字段需要补充资料</CardDescription>
            </CardHeader>
            <CardContent>
              {missingFields.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Check className="h-10 w-10 text-green-600" />
                  <p className="mt-2 font-medium">所有字段已填写</p>
                  <p className="text-sm text-muted-foreground">台账信息完整</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {missingFields.map(([code, info]) => (
                      <div
                        key={code}
                        className="flex items-center justify-between rounded-lg border border-dashed border-orange-200 bg-orange-50/50 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{info.fieldName}</p>
                          <p className="text-xs text-muted-foreground">{code}</p>
                        </div>
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* 数据来源 */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                数据来源
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {['招标文件.pdf', '投标文件-B公司.pdf', '中标通知书.pdf'].map((file) => (
                  <div key={file} className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
