import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  Trash2,
  ArrowLeft,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Plus,
  Pencil,
  Search,
  X,
  Check,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { auditRuleService, type AuditRuleData } from '@/services'
import { cn, formatRelativeTime } from '@/lib/utils'

// 规则表单类型
interface RuleFormData {
  code: string
  name: string
  description: string
  category: string
  stage: string
  isEnabled: boolean
}

const emptyForm: RuleFormData = {
  code: '',
  name: '',
  description: '',
  category: '',
  stage: '',
  isEnabled: true,
}

// 预定义类别和阶段选项
const CATEGORIES = ['工程管理审计', '采购审计', '招投标审计', '合同审计', '财务审计', '其他']
const STAGES = ['招投标阶段', '合同签订阶段', '执行阶段', '验收阶段', '结算阶段', '其他']

export function AuditRules() {
  const navigate = useNavigate()

  const [rules, setRules] = useState<AuditRuleData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ synced: number; total: number } | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)

  // 筛选状态
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStage, setFilterStage] = useState<string>('all')
  const [filterEnabled, setFilterEnabled] = useState<string>('all')

  // 编辑对话框
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    ruleId?: number
  }>({ open: false, mode: 'create' })
  const [formData, setFormData] = useState<RuleFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // 删除确认
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    rule: AuditRuleData | null
  }>({ open: false, rule: null })
  const [isDeleting, setIsDeleting] = useState(false)

  // 加载规则
  const loadRules = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await auditRuleService.getList()
      setRules(data || [])

      // 获取最后同步时间
      if (data && data.length > 0 && data[0].syncedAt) {
        setLastSyncTime(data[0].syncedAt)
      }
    } catch (err) {
      console.error('加载审计规则失败:', err)
      setError('加载失败，请检查后端服务')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRules()
  }, [])

  // 筛选后的规则
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // 搜索
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchCode = rule.code?.toLowerCase().includes(term)
        const matchName = rule.name?.toLowerCase().includes(term)
        const matchDesc = rule.description?.toLowerCase().includes(term)
        if (!matchCode && !matchName && !matchDesc) return false
      }

      // 类别筛选
      if (filterCategory !== 'all' && rule.category !== filterCategory) {
        return false
      }

      // 阶段筛选
      if (filterStage !== 'all' && rule.stage !== filterStage) {
        return false
      }

      // 启用状态筛选
      if (filterEnabled === 'enabled' && rule.isEnabled === false) {
        return false
      }
      if (filterEnabled === 'disabled' && rule.isEnabled !== false) {
        return false
      }

      return true
    })
  }, [rules, searchTerm, filterCategory, filterStage, filterEnabled])

  // 获取可用的类别和阶段选项（从现有数据中）
  const availableCategories = useMemo(() => {
    const cats = new Set(rules.map((r) => r.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [rules])

  const availableStages = useMemo(() => {
    const stages = new Set(rules.map((r) => r.stage).filter(Boolean))
    return Array.from(stages).sort()
  }, [rules])

  // 同步规则
  const handleSync = async () => {
    try {
      setIsSyncing(true)
      setError(null)
      setSyncResult(null)

      const result = await auditRuleService.syncFromDataHub()
      setSyncResult(result)

      // 重新加载
      await loadRules()
    } catch (err) {
      console.error('同步规则失败:', err)
      setError(err instanceof Error ? err.message : '同步失败')
    } finally {
      setIsSyncing(false)
    }
  }

  // 打开创建对话框
  const openCreateDialog = () => {
    setFormData(emptyForm)
    setFormError(null)
    setEditDialog({ open: true, mode: 'create' })
  }

  // 打开编辑对话框
  const openEditDialog = (rule: AuditRuleData) => {
    setFormData({
      code: rule.code,
      name: rule.name,
      description: rule.description || '',
      category: rule.category || '',
      stage: rule.stage || '',
      isEnabled: rule.isEnabled !== false,
    })
    setFormError(null)
    setEditDialog({ open: true, mode: 'edit', ruleId: rule.id })
  }

  // 保存规则
  const handleSave = async () => {
    // 验证
    if (!formData.code.trim()) {
      setFormError('规则编码不能为空')
      return
    }
    if (!formData.name.trim()) {
      setFormError('规则名称不能为空')
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      if (editDialog.mode === 'create') {
        await auditRuleService.create({
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          category: formData.category || undefined,
          stage: formData.stage || undefined,
          isEnabled: formData.isEnabled,
        })
      } else if (editDialog.ruleId) {
        await auditRuleService.update(editDialog.ruleId, {
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          stage: formData.stage,
          isEnabled: formData.isEnabled,
        })
      }

      setEditDialog({ open: false, mode: 'create' })
      await loadRules()
    } catch (err: any) {
      console.error('保存规则失败:', err)
      setFormError(err.response?.data?.message || err.message || '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  // 删除规则
  const handleDelete = async () => {
    if (!deleteDialog.rule) return

    setIsDeleting(true)
    try {
      await auditRuleService.delete(deleteDialog.rule.id)
      setDeleteDialog({ open: false, rule: null })
      await loadRules()
    } catch (err) {
      console.error('删除规则失败:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // 快速切换启用状态
  const toggleEnabled = async (rule: AuditRuleData) => {
    try {
      await auditRuleService.update(rule.id, { isEnabled: !rule.isEnabled })
      await loadRules()
    } catch (err) {
      console.error('更新规则状态失败:', err)
    }
  }

  // 清空筛选
  const clearFilters = () => {
    setSearchTerm('')
    setFilterCategory('all')
    setFilterStage('all')
    setFilterEnabled('all')
  }

  const hasFilters = searchTerm || filterCategory !== 'all' || filterStage !== 'all' || filterEnabled !== 'all'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 导航 */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => navigate('/dashboard')}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回
      </Button>

      {/* 标题和操作 */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">审计规则库</h1>
          <p className="text-sm text-muted-foreground">
            {rules.length > 0
              ? `共 ${rules.length} 条规则${hasFilters ? `，筛选后显示 ${filteredRules.length} 条` : ''}`
              : '从数据中台同步或手动添加审计规则'}
            {lastSyncTime && (
              <span className="ml-2">
                · 上次同步：{formatRelativeTime(lastSyncTime)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openCreateDialog}>
            <Plus className="mr-1 h-4 w-4" />
            添加规则
          </Button>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            同步规则
          </Button>
        </div>
      </div>

      {/* 同步结果提示 */}
      {syncResult && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="text-sm">同步成功！共获取 {syncResult.total} 条规则</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0"
            onClick={() => setSyncResult(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 w-6 p-0"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* 搜索 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索编码、名称、描述..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 类别筛选 */}
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="类别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类别</SelectItem>
            {availableCategories.map((cat) => (
              <SelectItem key={cat} value={cat!}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 阶段筛选 */}
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="阶段" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部阶段</SelectItem>
            {availableStages.map((stage) => (
              <SelectItem key={stage} value={stage!}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 启用状态筛选 */}
        <Select value={filterEnabled} onValueChange={setFilterEnabled}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="enabled">已启用</SelectItem>
            <SelectItem value="disabled">已禁用</SelectItem>
          </SelectContent>
        </Select>

        {/* 清空筛选 */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            清空筛选
          </Button>
        )}
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && rules.length === 0 && (
        <div className="py-12 text-center">
          <FileText className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">暂无审计规则</p>
          <p className="mt-2 text-sm text-muted-foreground">
            点击"同步规则"从数据中台获取，或点击"添加规则"手动创建
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={openCreateDialog}>
              <Plus className="mr-1 h-4 w-4" />
              添加规则
            </Button>
            <Button onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-4 w-4" />
              )}
              同步规则
            </Button>
          </div>
        </div>
      )}

      {/* 规则表格 */}
      {!isLoading && rules.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">规则编码</TableHead>
                <TableHead className="min-w-[200px]">规则名称</TableHead>
                <TableHead className="w-[120px]">类别</TableHead>
                <TableHead className="w-[100px]">阶段</TableHead>
                <TableHead className="w-[80px] text-center">状态</TableHead>
                <TableHead className="w-[100px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    没有匹配的规则
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className={cn(rule.isEnabled === false && 'opacity-50')}
                  >
                    <TableCell className="font-mono text-sm">{rule.code}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{rule.name}</span>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {rule.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.category && (
                        <Badge variant="outline" className="text-xs">
                          {rule.category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.stage && (
                        <span className="text-sm text-muted-foreground">{rule.stage}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={rule.isEnabled !== false}
                        onCheckedChange={() => toggleEnabled(rule)}
                        aria-label="启用状态"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteDialog({ open: true, rule })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 编辑/创建对话框 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, mode: 'create' })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editDialog.mode === 'create' ? '添加规则' : '编辑规则'}
            </DialogTitle>
            <DialogDescription>
              {editDialog.mode === 'create'
                ? '手动添加一条审计规则到本地规则库'
                : '修改审计规则信息（仅本地修改，不影响数据中台）'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">
                  编码 *
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="col-span-3"
                  placeholder="如：GCZTDB0001"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  名称 *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="col-span-3"
                  placeholder="规则名称"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  类别
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="选择类别" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stage" className="text-right">
                  阶段
                </Label>
                <Select
                  value={formData.stage}
                  onValueChange={(v) => setFormData({ ...formData, stage: v })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="选择阶段" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="description" className="text-right pt-2">
                  描述
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="col-span-3"
                  placeholder="规则描述或审计问题说明"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">启用</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Checkbox
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isEnabled: checked === true })
                    }
                  />
                  <Label htmlFor="isEnabled" className="font-normal">
                    启用此规则参与审计
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, mode: 'create' })}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, rule: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除规则</DialogTitle>
            <DialogDescription>
              确定要删除规则「{deleteDialog.rule?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, rule: null })}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
