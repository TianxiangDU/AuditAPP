import { agentChatService } from './agentClient'
import type { AuditResult, RiskSeverity } from '@/types'

// 审计请求参数
export interface AuditRequest {
  // 比对方式 - 包含审计线索的多行字符串
  比对方式: string
  // 待审查项目 - 分来源列清项目-文件-字段-内容
  待审查项目: string
}

// 审计结果
export interface AuditAgentResult {
  ruleCode: string
  ruleName: string
  result: AuditResult
  severity: RiskSeverity
  description: string
  suggestion: string
  evidence?: string
  lawReference?: string
  rawResponse?: string
}

// 构建审计线索字符串
export interface AuditClue {
  规则编码: string
  规则名称: string
  规则描述?: string
  检查逻辑?: string
  涉及字段?: string[]
  法规依据?: string
  严重程度?: string
}

// 待审查项目
export interface AuditItem {
  来源: string     // 项目名称
  文件: string     // 文件名
  字段: string     // 字段名
  内容: string     // 字段值
}

/**
 * 审计智能体服务
 */
export const auditAgentService = {
  /**
   * 构建比对方式字符串（审计线索）
   */
  buildAuditClueString(clues: AuditClue[]): string {
    return clues.map(clue => {
      const lines = [
        `规则编码: ${clue.规则编码}`,
        `规则名称: ${clue.规则名称}`,
      ]
      
      // 可选字段，只在有值时添加
      if (clue.规则描述) {
        lines.push(`规则描述: ${clue.规则描述}`)
      }
      if (clue.检查逻辑) {
        lines.push(`检查逻辑: ${clue.检查逻辑}`)
      }
      if (clue.涉及字段 && clue.涉及字段.length > 0) {
        lines.push(`涉及字段: ${clue.涉及字段.join(', ')}`)
      }
      if (clue.严重程度) {
        lines.push(`严重程度: ${clue.严重程度}`)
      }
      if (clue.法规依据) {
        lines.push(`法规依据: ${clue.法规依据}`)
      }
      
      return lines.join('\n')
    }).join('\n\n---\n\n')
  },

  /**
   * 构建待审查项目字符串
   */
  buildAuditItemString(items: AuditItem[]): string {
    return items.map(item => 
      `来源: ${item.来源}\n文件: ${item.文件}\n字段: ${item.字段}\n内容: ${item.内容}`
    ).join('\n\n---\n\n')
  },

  /**
   * 执行基础审计
   */
  async runBasicAudit(
    clues: AuditClue[],
    items: AuditItem[]
  ): Promise<AuditAgentResult[]> {
    const currentTime = new Date().toISOString()
    
    const state = {
      比对方式: this.buildAuditClueString(clues),
      待审查项目: this.buildAuditItemString(items),
    }

    try {
      const response = await agentChatService.chat('basicAudit', currentTime, state)
      const content = agentChatService.getTextContent(response)

      // 尝试解析响应
      return this.parseAuditResponse(content, clues)
    } catch (error) {
      console.error('基础审计失败:', error)
      // 返回所有规则的失败结果
      return clues.map(clue => ({
        ruleCode: clue.规则编码,
        ruleName: clue.规则名称,
        result: 'review' as AuditResult,
        severity: this.parseSeverity(clue.严重程度),
        description: '审计执行失败，需要人工复核',
        suggestion: '',
        rawResponse: String(error),
      }))
    }
  },

  /**
   * 执行代码生成审计（更复杂的审计逻辑）
   */
  async runCodeAudit(
    clues: AuditClue[],
    items: AuditItem[]
  ): Promise<AuditAgentResult[]> {
    const currentTime = new Date().toISOString()
    
    const state = {
      比对方式: this.buildAuditClueString(clues),
      待审查项目: this.buildAuditItemString(items),
    }

    try {
      const response = await agentChatService.chat('codeAudit', currentTime, state)
      const content = agentChatService.getTextContent(response)

      return this.parseAuditResponse(content, clues)
    } catch (error) {
      console.error('代码审计失败:', error)
      return clues.map(clue => ({
        ruleCode: clue.规则编码,
        ruleName: clue.规则名称,
        result: 'review' as AuditResult,
        severity: this.parseSeverity(clue.严重程度),
        description: '审计执行失败，需要人工复核',
        suggestion: '',
        rawResponse: String(error),
      }))
    }
  },

  /**
   * 解析审计响应
   */
  parseAuditResponse(content: string, clues: AuditClue[]): AuditAgentResult[] {
    const results: AuditAgentResult[] = []

    console.log('[审计解析] 原始响应:', content)

    // 预处理：移除 markdown 代码块
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    try {
      // 尝试解析为 JSON
      const parsed = JSON.parse(cleanContent)
      console.log('[审计解析] JSON解析成功:', parsed)
      
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const result = this.extractResultFromItem(item, clues[0])
          results.push(result)
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        const result = this.extractResultFromItem(parsed, clues[0])
        results.push(result)
      } else {
        // 解析成功但不是对象/数组
        console.log('[审计解析] 解析结果不是对象或数组')
        results.push(this.createReviewResult(clues[0], String(parsed), content))
      }
    } catch (e) {
      console.log('[审计解析] JSON解析失败，作为文本处理:', e)
      // 如果解析失败，将原始内容作为描述返回
      for (const clue of clues) {
        results.push(this.createReviewResult(clue, cleanContent, content))
      }
    }

    // 如果没有解析出结果，使用 clues 创建默认结果
    if (results.length === 0) {
      console.log('[审计解析] 没有解析出结果，使用默认值')
      for (const clue of clues) {
        results.push(this.createReviewResult(clue, '未能解析审计结果', content))
      }
    }

    console.log('[审计解析] 最终结果:', results)
    return results
  },

  /**
   * 从解析的对象中提取审计结果
   */
  extractResultFromItem(item: Record<string, unknown>, clue?: AuditClue): AuditAgentResult {
    // 尝试从多种可能的键名获取值
    const getField = (keys: string[]): string => {
      for (const key of keys) {
        if (item[key] !== undefined && item[key] !== null) {
          return String(item[key])
        }
      }
      return ''
    }

    // 审计结果字段 - 优先使用智能体返回的字段名
    const result = getField([
      '审计结果', 'result', '结果', 'status', '状态', '结论', 'conclusion'
    ])
    
    // 描述/理由字段 - 优先使用智能体返回的字段名
    const description = getField([
      '审计理由简述', '审计理由', '理由简述', '理由',
      'description', '问题描述', '描述', '审计意见', '意见', 
      'opinion', 'message', '结论说明', '说明', 'reason'
    ])
    
    const suggestion = getField([
      'suggestion', '处理建议', '建议', '整改建议', 'recommendation', 'advice'
    ])
    const evidence = getField(['evidence', '证据', '依据', 'proof'])
    const lawRef = getField(['lawReference', '法规依据', '法律依据', '法规', 'law', 'reference'])
    const ruleCode = getField(['ruleCode', '规则编码', 'code']) || clue?.规则编码 || ''
    const ruleName = getField(['ruleName', '规则名称', 'name']) || clue?.规则名称 || ''

    // 如果没有找到 description，尝试从整个对象中找任意文本内容
    let finalDescription = description
    if (!finalDescription) {
      // 检查是否有其他可能包含描述的字段
      const possibleDescFields = Object.entries(item).filter(([k, v]) => 
        typeof v === 'string' && v.length > 10 && 
        !['ruleCode', '规则编码', 'ruleName', '规则名称'].includes(k)
      )
      if (possibleDescFields.length > 0) {
        finalDescription = possibleDescFields.map(([k, v]) => `${v}`).join('\n')
      } else {
        finalDescription = JSON.stringify(item, null, 2)
      }
    }

    console.log('[审计解析] 提取字段:', { result, description: finalDescription, ruleCode, ruleName })

    return {
      ruleCode,
      ruleName,
      result: this.parseResult(result),
      severity: this.parseSeverity(getField(['severity', '严重程度', '级别'])) || 'medium',
      description: finalDescription,
      suggestion: suggestion || '',
      evidence,
      lawReference: lawRef,
      rawResponse: JSON.stringify(item),
    }
  },

  /**
   * 创建待复核结果
   */
  createReviewResult(clue: AuditClue, description: string, rawResponse: string): AuditAgentResult {
    return {
      ruleCode: clue?.规则编码 || '',
      ruleName: clue?.规则名称 || '',
      result: 'review',
      severity: this.parseSeverity(clue?.严重程度),
      description: description || '需要人工复核',
      suggestion: '请人工复核审计结果',
      rawResponse,
    }
  },

  /**
   * 解析审计结果状态
   * - pass: 不存在问题（绿色）
   * - fail: 存在问题（红色）
   * - review: 需要复核（黄色）
   */
  parseResult(value: string | undefined): AuditResult {
    if (!value) return 'review'
    
    const v = value.toLowerCase()
    
    // 不存在问题 -> pass（绿色）
    if (v.includes('不存在问题') || v.includes('无问题') || v.includes('正常') ||
        v.includes('pass') || v.includes('通过') || v.includes('合规') || 
        v.includes('符合') || v.includes('ok') || v.includes('正确')) {
      return 'pass'
    }
    
    // 存在问题 -> fail（红色）
    if (v.includes('存在问题') || v.includes('有问题') || v.includes('异常') ||
        v.includes('fail') || v.includes('不通过') || v.includes('违规') || 
        v.includes('不合规') || v.includes('不符合') || v.includes('错误') ||
        v.includes('违反') || v.includes('问题')) {
      // 确保不是"不存在问题"
      if (!v.includes('不存在') && !v.includes('无问题')) {
        return 'fail'
      }
    }
    
    // 缺失
    if (v.includes('missing') || v.includes('缺失') || v.includes('未找到')) {
      return 'missing'
    }
    
    // 需要复核 -> review（黄色）
    return 'review'
  },

  /**
   * 解析严重程度
   */
  parseSeverity(value: string | undefined): RiskSeverity {
    if (!value) return 'medium'
    
    const v = value.toLowerCase()
    if (v.includes('critical') || v.includes('严重') || v.includes('critical')) {
      return 'critical'
    }
    if (v.includes('high') || v.includes('高')) {
      return 'high'
    }
    if (v.includes('low') || v.includes('低')) {
      return 'low'
    }
    return 'medium'
  },

  /**
   * 快速审计 - 单条规则
   */
  async auditSingleRule(
    rule: AuditClue,
    items: AuditItem[]
  ): Promise<AuditAgentResult> {
    const results = await this.runBasicAudit([rule], items)
    return results[0] || {
      ruleCode: rule.规则编码,
      ruleName: rule.规则名称,
      result: 'review',
      severity: this.parseSeverity(rule.严重程度),
      description: '审计执行失败',
      suggestion: '',
    }
  },
}
