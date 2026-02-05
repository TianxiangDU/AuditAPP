import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Download, 
  RefreshCw, 
  ArrowLeft,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  Users,
  ClipboardList,
  Trophy,
  Briefcase,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { projectService, projectFileService, fieldValueService } from '@/services'
import { cn, formatDate } from '@/lib/utils'
import { exportLedgerToExcel, formatDateForDisplay } from '@/utils/exportUtils'

interface ProjectInfo {
  id: string
  name: string
  status: string
  createdAt: string
}

interface FieldData {
  fieldCode: string
  fieldName: string
  value: string | null
  status: string
  groupName?: string
  fileId?: string      // 文件来源
  fileName?: string    // 文件名
}

// 选项卡配置
const TABS = [
  { id: 'basic', label: '项目基本信息', icon: Building2 },
  { id: 'tender', label: '招标关键信息', icon: ClipboardList },
  { id: 'winning', label: '中标关键信息', icon: Trophy },
  { id: 'bidders', label: '投标人关键信息', icon: Users },
]

// 各选项卡的字段定义（支持多个匹配名称）
const TAB_FIELDS: Record<string, Array<{ display: string; matches: string[] }>> = {
  basic: [
    { display: '项目名称', matches: ['项目名称'] },
    { display: '服务范围/建设规模', matches: ['服务范围/建设规模', '服务范围', '建设规模'] },
    { display: '招标方式', matches: ['招标方式'] },
    { display: '项目估算金额', matches: ['项目估算金额', '项目概算金额'] },
    { display: '最高投标限价', matches: ['最高投标限价'] },
    { display: '合同价格形式', matches: ['合同价格形式'] },
    { display: '服务期限', matches: ['服务期限', '工期'] },
    { display: '合同金额', matches: ['合同金额'] },
    { display: '合同签订时间', matches: ['合同签订时间'] },
  ],
  tender: [
    { display: '招标方案审核时间', matches: ['招标方案审核时间'] },
    { display: '招标公告发布时间', matches: ['招标公告发布时间'] },
    { display: '招标文件获取时间', matches: ['招标文件获取时间'] },
    { display: '投标截止时间', matches: ['投标截止时间'] },
    { display: '开标时间', matches: ['开标时间'] },
    { display: '资格审查方式', matches: ['资格审查方式'] },
    { display: '评标方法', matches: ['评标方法'] },
    { display: '评标委员会组成', matches: ['评标委员会组成'] },
    { display: '投标保证金', matches: ['投标保证金', '履约保证金金额百分比'] },
    { display: '废标条款', matches: ['废标条款'] },
    { display: '评标标准', matches: ['评标标准'] },
  ],
  winning: [
    { display: '中标候选人公示开始时间', matches: ['中标候选人公示开始时间'] },
    { display: '中标候选人名单', matches: ['中标候选人名单'] },
    { display: '中标通知书发送时间', matches: ['中标通知书发送时间'] },
    { display: '中标人公司名称', matches: ['中标人公司名称', '中标人名称'] },
    { display: '中标金额', matches: ['中标金额'] },
  ],
  bidders: [
    { display: '投标人公司名称', matches: ['投标人公司名称', '投标人名称'] },
    { display: '投标人联系电话', matches: ['投标人联系电话'] },
    { display: '投标人资质能力', matches: ['投标人资格条件-投标人资质能力', '投标人资格条件 - 投标人资质能力'] },
    { display: '项目负责人资质能力', matches: ['投标人资格条件-项目负责人资质能力', '投标人资格条件 - 项目负责人资质能力'] },
    { display: '类似业绩/类似项目', matches: ['投标人资格条件-类似业绩类似项目', '投标人资格条件 - 类似业绩类似项目'] },
    { display: '法定代表人授权委托书', matches: ['法定代表人授权委托书人员信息', '授权委托书'] },
    { display: '投标报价', matches: ['投标报价'] },
  ],
}

export function ProjectLedger() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  
  // 状态
  const [activeTab, setActiveTab] = useState('basic')
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [allFields, setAllFields] = useState<FieldData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载数据
  const loadData = async () => {
    if (!projectId) return
    
    try {
      // 加载项目基本信息
      const projectData = await projectService.getById(projectId)
      setProject({
        id: projectData.id,
        name: (projectData as any).name || projectData.projectName || '未命名项目',
        status: projectData.status || 'draft',
        createdAt: projectData.createdAt,
      })
      
      // 使用新的统一 API 获取所有文件的所有字段
      const allFieldsData = await fieldValueService.getAllFields(projectId)
      
      // 转换为 FieldData 格式
      const fields: FieldData[] = allFieldsData.map(f => ({
        fieldCode: f.fieldCode,
        fieldName: f.fieldName,
        value: f.value,
        status: f.status,
        groupName: f.groupName,
        fileId: f.fileId,
        fileName: f.fileName || (f.isTender ? '招标文件' : f.docTypeName) || '未知文件',
      }))
      
      setAllFields(fields)
      console.log('[台账] 加载字段总数:', fields.length)
      
    } catch (err) {
      console.error('加载台账数据失败:', err)
      setError('加载数据失败')
    }
  }

  useEffect(() => {
    setIsLoading(true)
    loadData().finally(() => setIsLoading(false))
  }, [projectId])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    setIsRefreshing(false)
  }

  // 导出台账
  const handleExport = () => {
    if (!project) return

    // 准备导出数据
    const exportData = {
      projectName: project.name,
      exportDate: formatDateForDisplay(new Date()),
      tabs: TABS.map(tab => {
        const tabFields = TAB_FIELDS[tab.id] || []
        const fields = tabFields.map(fieldDef => {
          const fieldData = getFieldValue(fieldDef.matches)
          return {
            fieldName: fieldDef.display,
            value: fieldData?.value ? formatValue(fieldData.value) : null,
            status: fieldData?.status || 'missing',
          }
        })
        return {
          name: tab.label,
          fields,
        }
      }),
    }

    exportLedgerToExcel(exportData)
  }

  // 获取字段值（支持多个匹配名称）
  const getFieldValue = (matches: string[]): FieldData | undefined => {
    for (const match of matches) {
      // 精确匹配
      const found = allFields.find(f => 
        f.fieldName === match || 
        f.fieldCode === match ||
        // 处理包含换行符的情况
        f.fieldName?.replace(/\n/g, '') === match.replace(/\n/g, '')
      )
      if (found) return found
      
      // 模糊匹配（包含关系）
      const fuzzy = allFields.find(f => 
        f.fieldName?.includes(match) || match.includes(f.fieldName || '')
      )
      if (fuzzy) return fuzzy
    }
    return undefined
  }

  // 获取当前选项卡的字段
  const currentTabFields = useMemo(() => {
    const fieldDefs = TAB_FIELDS[activeTab] || []
    return fieldDefs.map(def => ({
      name: def.display,
      data: getFieldValue(def.matches),
    }))
  }, [activeTab, allFields])

  // 投标人分组（按文件来源）
  const bidderGroups = useMemo(() => {
    if (activeTab !== 'bidders') return []
    
    // 找出所有投标人相关的字段（匹配任意一个关键词）
    const bidderKeywords = ['投标人', '投标报价', '授权委托']
    const bidderFields = allFields.filter(f => 
      bidderKeywords.some(keyword => f.fieldName?.includes(keyword))
    )
    
    // 按文件分组
    const groups = new Map<string, { fileName: string; fields: FieldData[] }>()
    
    for (const field of bidderFields) {
      const key = field.fileId || 'unknown'
      if (!groups.has(key)) {
        groups.set(key, {
          fileName: field.fileName || '未知文件',
          fields: [],
        })
      }
      groups.get(key)!.fields.push(field)
    }
    
    return Array.from(groups.entries()).map(([fileId, data]) => ({
      fileId,
      ...data,
    }))
  }, [activeTab, allFields])

  // 统计
  const getTabStats = (tabId: string) => {
    const fieldDefs = TAB_FIELDS[tabId] || []
    const filled = fieldDefs.filter(def => getFieldValue(def.matches)?.value).length
    return { total: fieldDefs.length, filled }
  }

  // 加载中
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // 错误
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-500">{error}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-background">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="font-semibold">{project?.name}</h1>
            <p className="text-sm text-muted-foreground">项目台账</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('mr-1 h-4 w-4', isRefreshing && 'animate-spin')} />
            刷新
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!project || allFields.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            导出
          </Button>
        </div>
      </div>

      {/* 选项卡 */}
      <div className="border-b bg-muted/30">
        <div className="flex px-6">
          {TABS.map(tab => {
            const stats = getTabStats(tab.id)
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <Badge 
                  variant={isActive ? 'default' : 'secondary'}
                  className="ml-1 text-xs"
                >
                  {stats.filled}/{stats.total}
                </Badge>
              </button>
            )
          })}
        </div>
      </div>

      {/* 内容区域 */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {activeTab === 'bidders' ? (
            // 投标人信息 - 按文件分组显示
            <BiddersTab groups={bidderGroups} fieldDefs={TAB_FIELDS.bidders} />
          ) : (
            // 其他选项卡 - 普通列表显示
            <FieldsTable fields={currentTabFields} />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// 字段表格组件
function FieldsTable({ fields }: { fields: Array<{ name: string; data?: FieldData }> }) {
  if (fields.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        暂无数据
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-1/3">
              字段名称
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              字段值
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground w-20">
              状态
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {fields.map(({ name, data }) => (
            <tr key={name} className="hover:bg-muted/30">
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {name}
              </td>
              <td className="px-4 py-3">
                {data?.value ? (
                  <span className="text-sm">{formatValue(data.value)}</span>
                ) : (
                  <span className="text-sm text-muted-foreground italic">未提取</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <StatusIcon status={data?.status} hasValue={!!data?.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 投标人选项卡组件
function BiddersTab({ 
  groups, 
  fieldDefs 
}: { 
  groups: Array<{ fileId: string; fileName: string; fields: FieldData[] }>
  fieldDefs: Array<{ display: string; matches: string[] }>
}) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <p className="mt-4 text-muted-foreground">暂无投标人信息</p>
        <p className="mt-2 text-sm text-muted-foreground">
          上传投标文件后，系统将自动提取投标人信息
        </p>
      </div>
    )
  }

  // 查找匹配的字段
  const findField = (matches: string[], fields: FieldData[]): FieldData | undefined => {
    for (const match of matches) {
      const found = fields.find(f => 
        f.fieldName === match || 
        f.fieldCode === match ||
        f.fieldName?.includes(match) ||
        match.includes(f.fieldName || '')
      )
      if (found) return found
    }
    return undefined
  }

  return (
    <div className="space-y-6">
      {groups.map((group, index) => {
        // 尝试从字段中获取投标人名称
        const companyField = group.fields.find(f => f.fieldName?.includes('投标人公司名称'))
        const companyName = companyField?.value ? formatValue(companyField.value) : `投标人 ${index + 1}`
        
        return (
          <div key={group.fileId} className="rounded-lg border overflow-hidden">
            {/* 投标人标题 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">{companyName}</h3>
                    <p className="text-sm text-blue-700">来源：{group.fileName}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white">
                  {group.fields.filter(f => f.value).length}/{fieldDefs.length} 个字段
                </Badge>
              </div>
            </div>

            {/* 字段列表 */}
            <table className="w-full">
              <tbody className="divide-y">
                {fieldDefs.map(def => {
                  const field = findField(def.matches, group.fields)
                  
                  return (
                    <tr key={def.display} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm text-muted-foreground w-1/3">
                        {def.display}
                      </td>
                      <td className="px-4 py-3">
                        {field?.value ? (
                          <span className="text-sm">{formatValue(field.value)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">未提取</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center w-20">
                        <StatusIcon status={field?.status} hasValue={!!field?.value} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

// 状态图标
function StatusIcon({ status, hasValue }: { status?: string; hasValue: boolean }) {
  if (status === 'confirmed') {
    return <Check className="h-4 w-4 text-green-500 mx-auto" />
  }
  if (hasValue) {
    return <div className="h-3 w-3 rounded-full bg-blue-400 mx-auto" />
  }
  return <AlertCircle className="h-4 w-4 text-amber-400 mx-auto" />
}

// 格式化字段值
function formatValue(value: string): string {
  if (!value) return ''
  
  let cleaned = value.trim()
  
  // 尝试解析 JSON
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === 'object' && parsed !== null) {
      // 尝试多种键名
      const mainValue = parsed.value ?? parsed.结果 ?? parsed.提取结果 ?? 
                        parsed.answer ?? parsed.result ?? parsed.data
      if (mainValue !== undefined && mainValue !== null) {
        cleaned = typeof mainValue === 'object' ? JSON.stringify(mainValue) : String(mainValue)
      } else {
        // 如果只有一个键，取其值
        const keys = Object.keys(parsed).filter(k => !['page', '页码', 'snippet', '原文片段'].includes(k))
        if (keys.length === 1) {
          const singleValue = parsed[keys[0]]
          cleaned = typeof singleValue === 'object' ? JSON.stringify(singleValue) : String(singleValue)
        }
      }
    } else if (typeof parsed === 'string') {
      cleaned = parsed
    } else {
      cleaned = String(parsed)
    }
  } catch {
    // 不是 JSON，继续处理
  }
  
  // 匹配 "key": "value" 格式并提取 value
  const kvMatch = cleaned.match(/^"[^"]+"\s*:\s*"([^"]*)"$/)
  if (kvMatch) {
    cleaned = kvMatch[1]
  }
  
  // 移除外层引号
  if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
    cleaned = cleaned.slice(1, -1)
  }
  
  // 处理转义字符
  return cleaned.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}
