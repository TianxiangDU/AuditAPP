const express = require('express')
const pool = require('../db/pool')
const config = require('../config')

const router = express.Router()

// 获取本地规则列表
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM audit_rules ORDER BY category, code')
    res.json({
      code: 0,
      data: rows.map(row => ({
        id: row.id,
        sourceId: row.source_id,
        code: row.code,
        name: row.name,
        description: row.description,
        category: row.category,
        stage: row.stage,
        isEnabled: row.is_enabled === 1,
        syncedAt: row.synced_at,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    console.error('获取审计规则失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 从数据中台同步规则
router.post('/sync', async (req, res) => {
  try {
    const { host, token } = config.dataHub
    
    console.log('[同步规则] 开始从数据中台获取规则...')
    console.log('[同步规则] Host:', host)
    console.log('[同步规则] Token configured:', token ? '是' : '否')

    if (!token) {
      throw new Error('未配置数据中台 Token，请设置环境变量 DATA_HUB_TOKEN')
    }

    // 从数据中台获取所有规则
    const response = await fetch(`${host}/api/v1/audit-rules/all`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[同步规则] 数据中台响应:', response.status, errorText)
      throw new Error(`数据中台请求失败: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const rules = result.data || []

    console.log(`[同步规则] 获取到 ${rules.length} 条规则`)

    if (rules.length === 0) {
      return res.json({
        code: 0,
        data: { synced: 0, total: 0 },
        message: '数据中台暂无规则',
      })
    }

    // 清空现有规则并插入新规则
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 清空现有规则
      await connection.query('DELETE FROM audit_rules')

      // 批量插入新规则
      // 数据中台字段映射：
      // ruleCode → code
      // ruleName → name
      // problemDesc → description
      // auditType → category
      // phase → stage
      // status === 1 → isEnabled
      const syncedAt = new Date()
      const values = rules.map(rule => [
        rule.id,                       // source_id
        rule.ruleCode,                 // code
        rule.ruleName,                 // name
        rule.problemDesc || null,      // description
        rule.auditType || null,        // category
        rule.phase || null,            // stage
        rule.status === 1 ? 1 : 0,     // is_enabled
        syncedAt,                      // synced_at
      ])

      await connection.query(
        `INSERT INTO audit_rules (source_id, code, name, description, category, stage, is_enabled, synced_at)
         VALUES ?`,
        [values]
      )

      await connection.commit()

      console.log(`[同步规则] 成功同步 ${rules.length} 条规则`)

      res.json({
        code: 0,
        data: { synced: rules.length, total: rules.length },
        message: `成功同步 ${rules.length} 条规则`,
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('同步审计规则失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 创建规则
router.post('/', async (req, res) => {
  const { code, name, description, category, stage, isEnabled } = req.body
  
  if (!code || !name) {
    return res.status(400).json({ code: 400, message: '规则编码和名称不能为空' })
  }
  
  try {
    const [result] = await pool.query(
      `INSERT INTO audit_rules (source_id, code, name, description, category, stage, is_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [null, code, name, description || null, category || null, stage || null, isEnabled !== false ? 1 : 0]
    )
    
    res.json({
      code: 0,
      data: { id: result.insertId },
      message: '规则创建成功',
    })
  } catch (error) {
    console.error('创建审计规则失败:', error)
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ code: 400, message: '规则编码已存在' })
    } else {
      res.status(500).json({ code: 500, message: error.message })
    }
  }
})

// 更新规则
router.put('/:id', async (req, res) => {
  const { code, name, description, category, stage, isEnabled } = req.body
  const id = req.params.id
  
  try {
    const updates = []
    const values = []
    
    if (code !== undefined) {
      updates.push('code = ?')
      values.push(code)
    }
    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }
    if (category !== undefined) {
      updates.push('category = ?')
      values.push(category)
    }
    if (stage !== undefined) {
      updates.push('stage = ?')
      values.push(stage)
    }
    if (isEnabled !== undefined) {
      updates.push('is_enabled = ?')
      values.push(isEnabled ? 1 : 0)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }
    
    values.push(id)
    
    await pool.query(
      `UPDATE audit_rules SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
    
    res.json({ code: 0, message: '规则更新成功' })
  } catch (error) {
    console.error('更新审计规则失败:', error)
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ code: 400, message: '规则编码已存在' })
    } else {
      res.status(500).json({ code: 500, message: error.message })
    }
  }
})

// 删除单条规则
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM audit_rules WHERE id = ?', [req.params.id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '规则不存在' })
    }
    res.json({ code: 0, message: '规则删除成功' })
  } catch (error) {
    console.error('删除审计规则失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 清空所有规则
router.delete('/all', async (req, res) => {
  try {
    await pool.query('DELETE FROM audit_rules')
    res.json({ code: 0, message: '已清空所有规则' })
  } catch (error) {
    console.error('清空审计规则失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

module.exports = router
