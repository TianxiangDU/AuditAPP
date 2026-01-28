import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  Upload, 
  FileText, 
  Eye, 
  RefreshCw, 
  Check,
  AlertCircle,
  Loader2,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable, StatusBadge, BatchActionBar } from '@/components/common'
import { formatFileSize, formatDate, cn } from '@/lib/utils'
import type { ProjectFile, DocType } from '@/types'
import { type ColumnDef } from '@tanstack/react-table'

// 模拟数据
const mockFiles: ProjectFile[] = [
  {
    id: '1',
    projectId: '1',
    fileAssetId: 'asset-1',
    fileName: '招标文件.pdf',
    fileSize: 2500000,
    mimeType: 'application/pdf',
    sha256: 'abc123',
    docTypeCode: 'tender_doc',
    docTypeName: '招标文件',
    status: 'confirmed',
    extractionStatus: 'completed',
    createdAt: '2026-01-25T10:30:00Z',
    updatedAt: '2026-01-25T10:35:00Z',
  },
  {
    id: '2',
    projectId: '1',
    fileAssetId: 'asset-2',
    fileName: '投标文件-A公司.pdf',
    fileSize: 5600000,
    mimeType: 'application/pdf',
    sha256: 'def456',
    docTypeCode: 'bid_doc',
    docTypeName: '投标文件',
    status: 'confirmed',
    extractionStatus: 'completed',
    createdAt: '2026-01-25T11:00:00Z',
    updatedAt: '2026-01-25T11:10:00Z',
  },
  {
    id: '3',
    projectId: '1',
    fileAssetId: 'asset-3',
    fileName: '投标文件-B公司.pdf',
    fileSize: 4800000,
    mimeType: 'application/pdf',
    sha256: 'ghi789',
    docTypeCode: 'bid_doc',
    docTypeName: '投标文件',
    status: 'classified',
    extractionStatus: 'processing',
    createdAt: '2026-01-25T11:15:00Z',
    updatedAt: '2026-01-25T11:20:00Z',
  },
  {
    id: '4',
    projectId: '1',
    fileAssetId: 'asset-4',
    fileName: '评标报告.pdf',
    fileSize: 1200000,
    mimeType: 'application/pdf',
    sha256: 'jkl012',
    docTypeCode: null,
    docTypeName: null,
    status: 'pending',
    extractionStatus: 'pending',
    createdAt: '2026-01-26T09:00:00Z',
    updatedAt: '2026-01-26T09:00:00Z',
  },
  {
    id: '5',
    projectId: '1',
    fileAssetId: 'asset-5',
    fileName: '中标通知书.pdf',
    fileSize: 350000,
    mimeType: 'application/pdf',
    sha256: 'mno345',
    docTypeCode: null,
    docTypeName: null,
    status: 'pending',
    extractionStatus: 'pending',
    createdAt: '2026-01-26T09:30:00Z',
    updatedAt: '2026-01-26T09:30:00Z',
  },
]

const mockDocTypes: DocType[] = [
  { id: '1', code: 'tender_doc', name: '招标文件', description: '', category: '招标', isEnabled: true, fieldCount: 22 },
  { id: '2', code: 'bid_doc', name: '投标文件', description: '', category: '投标', isEnabled: true, fieldCount: 18 },
  { id: '3', code: 'evaluation_report', name: '评标报告', description: '', category: '评标', isEnabled: true, fieldCount: 12 },
  { id: '4', code: 'winning_notice', name: '中标通知书', description: '', category: '定标', isEnabled: true, fieldCount: 8 },
  { id: '5', code: 'contract', name: '合同', description: '', category: '合同', isEnabled: true, fieldCount: 15 },
]

export function ProjectFiles() {
  const { id: projectId } = useParams()
  const [files, setFiles] = useState<ProjectFile[]>(mockFiles)
  const [selectedFiles, setSelectedFiles] = useState<ProjectFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    await uploadFiles(droppedFiles)
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    await uploadFiles(selectedFiles)
  }, [])

  const uploadFiles = async (newFiles: File[]) => {
    setIsUploading(true)
    // 模拟上传
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    const newProjectFiles: ProjectFile[] = newFiles.map((file, index) => ({
      id: `new-${Date.now()}-${index}`,
      projectId: projectId || '1',
      fileAssetId: `asset-new-${index}`,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      sha256: 'new-hash',
      docTypeCode: null,
      docTypeName: null,
      status: 'pending',
      extractionStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    
    setFiles((prev) => [...prev, ...newProjectFiles])
    setIsUploading(false)
  }

  const handleChangeType = (docTypeCode: string) => {
    const docType = mockDocTypes.find((t) => t.code === docTypeCode)
    setFiles((prev) =>
      prev.map((f) =>
        selectedFiles.some((sf) => sf.id === f.id)
          ? { ...f, docTypeCode, docTypeName: docType?.name || null, status: 'classified' }
          : f
      )
    )
    setSelectedFiles([])
  }

  const handleBatchConfirm = () => {
    setFiles((prev) =>
      prev.map((f) =>
        selectedFiles.some((sf) => sf.id === f.id) && f.docTypeCode
          ? { ...f, status: 'confirmed' }
          : f
      )
    )
    setSelectedFiles([])
  }

  const handleReExtract = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, extractionStatus: 'processing' } : f
      )
    )
    // 模拟提取完成
    setTimeout(() => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, extractionStatus: 'completed' } : f
        )
      )
    }, 2000)
  }

  const columns: ColumnDef<ProjectFile>[] = [
    {
      accessorKey: 'fileName',
      header: '文件名',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.fileName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'fileSize',
      header: '大小',
      cell: ({ row }) => formatFileSize(row.original.fileSize),
    },
    {
      accessorKey: 'docTypeName',
      header: '文件类型',
      cell: ({ row }) => (
        <Select
          value={row.original.docTypeCode || undefined}
          onValueChange={(value) => {
            const docType = mockDocTypes.find((t) => t.code === value)
            setFiles((prev) =>
              prev.map((f) =>
                f.id === row.original.id
                  ? { ...f, docTypeCode: value, docTypeName: docType?.name || null, status: 'classified' }
                  : f
              )
            )
          }}
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="选择类型" />
          </SelectTrigger>
          <SelectContent>
            {mockDocTypes.map((type) => (
              <SelectItem key={type.code} value={type.code}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: 'status',
      header: '分拣状态',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'extractionStatus',
      header: '提取状态',
      cell: ({ row }) => {
        const status = row.original.extractionStatus
        if (status === 'processing') {
          return (
            <div className="flex items-center gap-1 text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">提取中</span>
            </div>
          )
        }
        return <StatusBadge status={status} />
      },
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link to={`/projects/${projectId}/files/${row.original.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleReExtract(row.original.id)}
            disabled={row.original.extractionStatus === 'processing'}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {row.original.status === 'classified' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600"
              onClick={() => {
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === row.original.id ? { ...f, status: 'confirmed' } : f
                  )
                )
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const confirmedCount = files.filter((f) => f.status === 'confirmed').length

  return (
    <div className="container mx-auto py-8">
      {/* 页面头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">资料上传与分拣</h1>
          <p className="mt-1 text-muted-foreground">
            上传项目资料，进行文件分类和关键信息提取
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>共 {files.length} 个文件</span>
            <span>·</span>
            <span className="text-yellow-600">{pendingCount} 待分拣</span>
            <span>·</span>
            <span className="text-green-600">{confirmedCount} 已确认</span>
          </div>
        </div>
      </div>

      {/* 上传区域 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
              isUploading ? 'border-primary bg-primary/5' : 'hover:border-primary hover:bg-primary/5'
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">正在上传...</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  拖拽文件到此处，或
                  <label className="mx-1 cursor-pointer text-primary hover:underline">
                    点击选择
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={handleFileSelect}
                    />
                  </label>
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 文件列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">文件队列</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={files}
            enableRowSelection
            onRowSelectionChange={setSelectedFiles}
            searchPlaceholder="搜索文件名..."
            searchColumn="fileName"
          />
        </CardContent>
      </Card>

      {/* 批量操作栏 */}
      <BatchActionBar
        selectedCount={selectedFiles.length}
        docTypes={mockDocTypes.map((t) => ({ code: t.code, name: t.name }))}
        onClear={() => setSelectedFiles([])}
        onChangeType={handleChangeType}
        onConfirm={handleBatchConfirm}
      />
    </div>
  )
}
