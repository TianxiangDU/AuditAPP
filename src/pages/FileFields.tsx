import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import type { FileFieldValue, EvidenceRef } from '@/types'

// 模拟数据
const mockFieldValues: FileFieldValue[] = [
  {
    id: '1',
    projectId: '1',
    projectFileId: '2',
    docTypeCode: 'bid_doc',
    fieldCode: 'bidderName',
    fieldName: '投标人名称',
    value: 'A建设工程有限公司',
    status: 'confirmed',
    evidenceRef: { page: 1, snippet: '投标人：A建设工程有限公司' },
    updatedAt: '2026-01-25T11:10:00Z',
  },
  {
    id: '2',
    projectId: '1',
    projectFileId: '2',
    docTypeCode: 'bid_doc',
    fieldCode: 'bidAmount',
    fieldName: '投标金额',
    value: '4,560万元',
    status: 'pending',
    evidenceRef: { page: 5, snippet: '投标报价：人民币肆仟伍佰陆拾万元整' },
    updatedAt: '2026-01-25T11:10:00Z',
  },
  {
    id: '3',
    projectId: '1',
    projectFileId: '2',
    docTypeCode: 'bid_doc',
    fieldCode: 'pmName',
    fieldName: '项目负责人姓名',
    value: '张工',
    status: 'auto',
    evidenceRef: { page: 8, snippet: '拟派项目负责人：张工' },
    updatedAt: '2026-01-25T11:10:00Z',
  },
  {
    id: '4',
    projectId: '1',
    projectFileId: '2',
    docTypeCode: 'bid_doc',
    fieldCode: 'pmQualification',
    fieldName: '项目负责人资质',
    value: '一级建造师',
    status: 'pending',
    evidenceRef: { page: 8, snippet: '资质证书：一级建造师（市政工程）' },
    updatedAt: '2026-01-25T11:10:00Z',
  },
  {
    id: '5',
    projectId: '1',
    projectFileId: '2',
    docTypeCode: 'bid_doc',
    fieldCode: 'constructionPeriod',
    fieldName: '施工工期',
    value: '24个月',
    status: 'confirmed',
    evidenceRef: { page: 3, snippet: '工期承诺：24个日历月' },
    updatedAt: '2026-01-25T11:10:00Z',
  },
  {
    id: '6',
    projectId: '1',
    projectFileId: '2',
    docTypeCode: 'bid_doc',
    fieldCode: 'bidBond',
    fieldName: '投标保证金',
    value: '100万元',
    status: 'auto',
    evidenceRef: { page: 2, snippet: '投标保证金：壹佰万元整' },
    updatedAt: '2026-01-25T11:10:00Z',
  },
  {
    id: '7',
    projectId: '1',
    projectFileId: '2',
    docTypeCode: 'bid_doc',
    fieldCode: 'similarProjects',
    fieldName: '类似业绩',
    value: null,
    status: 'missing',
    evidenceRef: null,
    updatedAt: '2026-01-25T11:10:00Z',
  },
  {
    id: '8',
    projectId: '1',
    projectFileId: '2',
    docTypeCode: 'bid_doc',
    fieldCode: 'qualityTarget',
    fieldName: '质量目标',
    value: '合格',
    status: 'auto',
    evidenceRef: { page: 4, snippet: '质量目标：合格，争创优良' },
    updatedAt: '2026-01-25T11:10:00Z',
  },
]

export function FileFields() {
  const { id: projectId, fileId } = useParams()
  const navigate = useNavigate()
  const [fields, setFields] = useState<FileFieldValue[]>(mockFieldValues)
  const [currentPage, setCurrentPage] = useState(1)
  const [highlightEvidence, setHighlightEvidence] = useState<EvidenceRef | null>(null)

  const handleFieldChange = (fieldCode: string, value: string) => {
    setFields((prev) =>
      prev.map((f) => (f.fieldCode === fieldCode ? { ...f, value } : f))
    )
  }

  const handleStatusChange = (fieldCode: string, status: FileFieldValue['status']) => {
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

  const confirmedCount = fields.filter((f) => f.status === 'confirmed').length
  const totalCount = fields.length

  // 按分组组织字段
  const groupedFields = fields.reduce((acc, field) => {
    const group = getFieldGroup(field.fieldCode)
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(field)
    return acc
  }, {} as Record<string, FileFieldValue[]>)

  return (
    <div className="h-full">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* 左侧：文件预览 */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <FilePreview
            fileId={fileId || ''}
            fileName="投标文件-A公司.pdf"
            currentPage={currentPage}
            totalPages={45}
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
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">关键信息确认</h2>
                  <p className="text-sm text-muted-foreground">
                    投标文件-A公司.pdf · 已确认 {confirmedCount} / {totalCount} 个字段
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleConfirmAll}>
                  <Check className="mr-1 h-3 w-3" />
                  全部确认
                </Button>
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

            {/* 底部 */}
            <div className="border-t bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {confirmedCount === totalCount ? (
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
                <Button onClick={() => navigate(`/projects/${projectId}/files`)}>
                  返回文件列表
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function getFieldGroup(fieldCode: string): string {
  const groupMap: Record<string, string> = {
    bidderName: '投标人信息',
    bidAmount: '报价信息',
    pmName: '人员信息',
    pmQualification: '人员信息',
    constructionPeriod: '工期信息',
    bidBond: '保证金',
    similarProjects: '业绩信息',
    qualityTarget: '质量信息',
  }
  return groupMap[fieldCode] || '其他信息'
}
