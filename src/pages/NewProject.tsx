import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { FilePreview, FieldEditor } from '@/components/common'
import { TENDER_FIELD_DEFINITIONS, type FieldStatus, type EvidenceRef } from '@/types'
import { cn, calculateSHA256 } from '@/lib/utils'

interface FieldValue {
  fieldCode: string
  fieldName: string
  value: string | null
  status: FieldStatus
  evidenceRef: EvidenceRef | null
  group: string
}

// 模拟解析结果
const mockParsedFields: FieldValue[] = TENDER_FIELD_DEFINITIONS.map((def) => ({
  fieldCode: def.code,
  fieldName: def.name,
  value: getMockValue(def.code),
  status: 'auto' as FieldStatus,
  evidenceRef: { page: Math.floor(Math.random() * 20) + 1, snippet: '相关原文内容...' },
  group: def.group,
}))

function getMockValue(code: string): string | null {
  const mockData: Record<string, string> = {
    projectName: '某市政道路建设工程招标项目',
    serviceScope: '市政道路新建及配套设施建设，全长约5公里',
    bidOpeningTime: '2026年2月15日 上午9:00',
    servicePeriod: '24个月',
    bidDeadline: '2026年2月14日 下午17:00',
    tenderMethod: '公开招标',
    evaluationMethod: '综合评估法',
    bidBond: '100万元',
    maxBidPrice: '5000万元',
  }
  return mockData[code] || null
}

export function NewProject() {
  const navigate = useNavigate()
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'parsing' | 'ready'>('idle')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fields, setFields] = useState<FieldValue[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [highlightEvidence, setHighlightEvidence] = useState<EvidenceRef | null>(null)

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      await processFile(file)
    }
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await processFile(file)
    }
  }, [])

  const processFile = async (file: File) => {
    setUploadState('uploading')
    setUploadedFile(file)

    // 模拟计算 SHA256
    await calculateSHA256(file)
    
    // 模拟上传延迟
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    setUploadState('parsing')
    
    // 模拟解析延迟
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    setFields(mockParsedFields)
    setUploadState('ready')
  }

  const handleFieldChange = (fieldCode: string, value: string) => {
    setFields((prev) =>
      prev.map((f) => (f.fieldCode === fieldCode ? { ...f, value } : f))
    )
  }

  const handleStatusChange = (fieldCode: string, status: FieldStatus) => {
    setFields((prev) =>
      prev.map((f) => (f.fieldCode === fieldCode ? { ...f, status } : f))
    )
  }

  const handleViewEvidence = (evidenceRef: EvidenceRef) => {
    if (evidenceRef.page) {
      setCurrentPage(evidenceRef.page)
    }
    setHighlightEvidence(evidenceRef)
  }

  const handleConfirmAll = () => {
    setFields((prev) =>
      prev.map((f) => ({ ...f, status: f.value ? 'confirmed' : 'missing' }))
    )
  }

  const handleCreateProject = async () => {
    // 获取项目名称
    const projectNameField = fields.find((f) => f.fieldCode === 'projectName')
    if (!projectNameField?.value) {
      alert('请确认项目名称')
      return
    }

    // 模拟创建项目
    console.log('Creating project with fields:', fields)
    
    // 跳转到项目详情
    navigate('/projects/1')
  }

  const confirmedCount = fields.filter((f) => f.status === 'confirmed').length
  const totalCount = fields.length
  const allConfirmed = confirmedCount === totalCount && totalCount > 0

  // 按分组组织字段
  const groupedFields = fields.reduce((acc, field) => {
    if (!acc[field.group]) {
      acc[field.group] = []
    }
    acc[field.group].push(field)
    return acc
  }, {} as Record<string, FieldValue[]>)

  return (
    <div className="h-full">
      {uploadState === 'idle' && (
        <div className="container mx-auto py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight">新建审计项目</h1>
            <p className="mt-2 text-muted-foreground">
              上传招标文件，系统将自动解析关键信息
            </p>

            <Card className="mt-8">
              <CardContent className="pt-6">
                <div
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
                    'hover:border-primary hover:bg-primary/5'
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">拖拽文件到此处</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    支持 PDF、Word、图片格式
                  </p>
                  <label className="mt-4">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={handleFileSelect}
                    />
                    <Button variant="outline" asChild>
                      <span>选择文件</span>
                    </Button>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {(uploadState === 'uploading' || uploadState === 'parsing') && (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h3 className="mt-4 text-lg font-medium">
              {uploadState === 'uploading' ? '正在上传文件...' : '正在解析招标文件...'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {uploadedFile?.name}
            </p>
          </div>
        </div>
      )}

      {uploadState === 'ready' && (
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* 左侧：文件预览 */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <FilePreview
              fileId="mock-file-id"
              fileName={uploadedFile?.name || '招标文件'}
              currentPage={currentPage}
              totalPages={25}
              highlightBbox={highlightEvidence?.bbox}
              onPageChange={setCurrentPage}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 右侧：字段确认 */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              {/* 头部 */}
              <div className="border-b bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">招标文件信息确认</h2>
                    <p className="text-sm text-muted-foreground">
                      已确认 {confirmedCount} / {totalCount} 个字段
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleConfirmAll}>
                      <Check className="mr-1 h-3 w-3" />
                      全部确认
                    </Button>
                  </div>
                </div>
              </div>

              {/* 字段列表 */}
              <ScrollArea className="flex-1 p-4">
                <Accordion type="multiple" defaultValue={Object.keys(groupedFields)}>
                  {Object.entries(groupedFields).map(([group, groupFields]) => (
                    <AccordionItem key={group} value={group}>
                      <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {group}
                          <span className="text-xs text-muted-foreground">
                            ({groupFields.filter((f) => f.status === 'confirmed').length}/{groupFields.length})
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {groupFields.map((field) => (
                            <FieldEditor
                              key={field.fieldCode}
                              fieldCode={field.fieldCode}
                              fieldName={field.fieldName}
                              value={field.value}
                              status={field.status}
                              evidenceRef={field.evidenceRef}
                              isTextarea={['serviceScope', 'rejectionClauses', 'evaluationCriteria'].includes(field.fieldCode)}
                              onValueChange={(v) => handleFieldChange(field.fieldCode, v)}
                              onStatusChange={(s) => handleStatusChange(field.fieldCode, s)}
                              onViewEvidence={handleViewEvidence}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>

              {/* 底部操作 */}
              <div className="border-t bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {allConfirmed ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">所有字段已确认</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <span className="text-yellow-600">
                          还有 {totalCount - confirmedCount} 个字段待确认
                        </span>
                      </>
                    )}
                  </div>
                  <Button onClick={handleCreateProject} disabled={!allConfirmed}>
                    <Check className="mr-2 h-4 w-4" />
                    确认无误并创建项目
                  </Button>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}
