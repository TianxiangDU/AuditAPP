import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// =============== 类型定义 ===============

interface LedgerField {
  fieldName: string
  value: string | null
  status: string
}

interface RiskItem {
  ruleName: string
  ruleCode: string
  severity: string
  description: string
  suggestion: string
}

interface LedgerExportData {
  projectName: string
  exportDate: string
  tabs: {
    name: string
    fields: LedgerField[]
  }[]
}

interface RiskExportData {
  projectName: string
  exportDate: string
  summary: {
    high: number
    medium: number
    low: number
    total: number
  }
  risks: RiskItem[]
}

// =============== 样式配置 ===============

// 标题样式
const titleStyle = {
  font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '2563EB' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
}

// 表头样式
const headerStyle = {
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '4B5563' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
}

// 单元格样式
const cellStyle = {
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
    left: { style: 'thin', color: { rgb: 'D1D5DB' } },
    right: { style: 'thin', color: { rgb: 'D1D5DB' } },
  },
}

// 风险等级颜色
const riskColors = {
  high: 'FEE2E2',    // 红色背景
  medium: 'FEF3C7',  // 黄色背景
  low: 'DBEAFE',     // 蓝色背景
}

// =============== 辅助函数 ===============

function getSeverityText(severity: string): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return '高风险'
    case 'medium':
      return '中风险'
    case 'low':
      return '低风险'
    default:
      return severity
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'confirmed':
      return '已确认'
    case 'auto':
      return '自动提取'
    case 'modified':
      return '已修改'
    case 'missing':
      return '缺失'
    default:
      return status
  }
}

function applyStyles(ws: XLSX.WorkSheet, range: XLSX.Range, style: Record<string, unknown>) {
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c })
      if (!ws[cellRef]) ws[cellRef] = { v: '' }
      ws[cellRef].s = style
    }
  }
}

// =============== 导出函数 ===============

/**
 * 导出项目台账为 Excel 文件
 */
export function exportLedgerToExcel(data: LedgerExportData): void {
  const wb = XLSX.utils.book_new()

  // 为每个选项卡创建一个工作表
  data.tabs.forEach((tab) => {
    const wsData: (string | null)[][] = []

    // 添加标题行
    wsData.push([`${data.projectName} - ${tab.name}`])
    wsData.push([`导出时间：${data.exportDate}`])
    wsData.push([]) // 空行

    // 添加表头
    wsData.push(['序号', '字段名称', '字段值', '状态'])

    // 添加数据行
    tab.fields.forEach((field, index) => {
      wsData.push([
        String(index + 1),
        field.fieldName,
        field.value || '未提取',
        getStatusText(field.status),
      ])
    })

    // 创建工作表
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 25 },  // 字段名称
      { wch: 60 },  // 字段值
      { wch: 12 },  // 状态
    ]

    // 合并标题单元格
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // 标题行
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // 导出时间行
    ]

    // 设置行高
    ws['!rows'] = [
      { hpt: 30 }, // 标题行高度
      { hpt: 20 }, // 导出时间行高度
      { hpt: 15 }, // 空行
      { hpt: 25 }, // 表头行高度
    ]

    // 添加到工作簿（工作表名称不能超过31字符）
    const sheetName = tab.name.length > 31 ? tab.name.substring(0, 31) : tab.name
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })

  // 生成文件并下载
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  const fileName = `${data.projectName}_项目台账_${formatDateForFileName(new Date())}.xlsx`
  saveAs(blob, fileName)
}

/**
 * 导出风险报告为 Excel 文件
 */
export function exportRiskReportToExcel(data: RiskExportData): void {
  const wb = XLSX.utils.book_new()
  const wsData: (string | null)[][] = []

  // 添加标题
  wsData.push([`${data.projectName} - 风险报告`])
  wsData.push([`导出时间：${data.exportDate}`])
  wsData.push([])

  // 添加统计摘要
  wsData.push(['风险统计'])
  wsData.push(['高风险', '中风险', '低风险', '总计'])
  wsData.push([
    String(data.summary.high),
    String(data.summary.medium),
    String(data.summary.low),
    String(data.summary.total),
  ])
  wsData.push([])

  // 添加风险详情表头
  wsData.push(['风险详情'])
  wsData.push(['序号', '规则名称', '规则编码', '风险等级', '风险描述', '处理建议'])

  // 添加风险数据
  data.risks.forEach((risk, index) => {
    wsData.push([
      String(index + 1),
      risk.ruleName,
      risk.ruleCode,
      getSeverityText(risk.severity),
      risk.description,
      risk.suggestion || '暂无建议',
    ])
  })

  // 创建工作表
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // 设置列宽
  ws['!cols'] = [
    { wch: 6 },   // 序号
    { wch: 30 },  // 规则名称
    { wch: 15 },  // 规则编码
    { wch: 10 },  // 风险等级
    { wch: 50 },  // 风险描述
    { wch: 40 },  // 处理建议
  ]

  // 合并单元格
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // 标题
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // 导出时间
    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }, // 风险统计标题
    { s: { r: 7, c: 0 }, e: { r: 7, c: 5 } }, // 风险详情标题
  ]

  // 设置行高
  ws['!rows'] = [
    { hpt: 30 }, // 标题
    { hpt: 20 }, // 导出时间
    { hpt: 15 }, // 空行
    { hpt: 25 }, // 风险统计标题
    { hpt: 22 }, // 统计表头
    { hpt: 22 }, // 统计数据
    { hpt: 15 }, // 空行
    { hpt: 25 }, // 风险详情标题
    { hpt: 22 }, // 详情表头
  ]

  XLSX.utils.book_append_sheet(wb, ws, '风险报告')

  // 生成文件并下载
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  const fileName = `${data.projectName}_风险报告_${formatDateForFileName(new Date())}.xlsx`
  saveAs(blob, fileName)
}

/**
 * 格式化日期用于文件名
 */
function formatDateForFileName(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * 格式化日期用于显示
 */
export function formatDateForDisplay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}
