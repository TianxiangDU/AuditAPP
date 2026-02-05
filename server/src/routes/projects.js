const express = require('express')
const pool = require('../db/pool')

const router = express.Router()

// 生成唯一ID
function generateId() {
  return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// =============== 项目 CRUD ===============

// 获取项目列表
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as file_count,
        (SELECT COUNT(*) FROM audit_risks WHERE project_id = p.id AND status = 'pending') as risk_count
      FROM projects p
      ORDER BY p.created_at DESC
    `)
    
    res.json({
      code: 0,
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        tenderFileId: row.tender_file_id,
        tenderDsId: row.tender_ds_id,
        tenderFileUrl: row.tender_file_url,
        fileCount: row.file_count,
        riskCount: row.risk_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取项目列表失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 获取单个项目
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id])
    
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' })
    }
    
    const row = rows[0]
    res.json({
      code: 0,
      data: {
        id: row.id,
        name: row.name,
        status: row.status,
        tenderFileId: row.tender_file_id,
        tenderDsId: row.tender_ds_id,
        tenderFileUrl: row.tender_file_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    })
  } catch (error) {
    console.error('获取项目失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 创建项目
router.post('/', async (req, res) => {
  const { name, tenderFileId, tenderDsId, tenderFileUrl, fields } = req.body
  
  if (!name) {
    return res.status(400).json({ code: 400, message: '项目名称不能为空' })
  }
  
  const connection = await pool.getConnection()
  
  try {
    await connection.beginTransaction()
    
    const projectId = generateId()
    
    // 插入项目
    await connection.query(
      'INSERT INTO projects (id, name, tender_file_id, tender_ds_id, tender_file_url) VALUES (?, ?, ?, ?, ?)',
      [projectId, name, tenderFileId || null, tenderDsId || null, tenderFileUrl || null]
    )
    
    // 插入字段
    if (fields && fields.length > 0) {
      const fieldValues = fields.map(f => [
        projectId,
        f.fieldCode,
        f.fieldName,
        f.value,
        f.status || 'auto',
        f.groupName || null,
        f.evidenceRef?.page || null,
        f.evidenceRef?.bbox ? JSON.stringify(f.evidenceRef.bbox) : null,
      ])
      
      await connection.query(
        `INSERT INTO project_fields 
         (project_id, field_code, field_name, field_value, status, group_name, evidence_page, evidence_bbox) 
         VALUES ?`,
        [fieldValues]
      )
    }
    
    await connection.commit()
    
    res.json({
      code: 0,
      data: { id: projectId, name },
      message: '项目创建成功',
    })
  } catch (error) {
    await connection.rollback()
    console.error('创建项目失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  } finally {
    connection.release()
  }
})

// 更新项目
router.put('/:id', async (req, res) => {
  const { name, status, tenderFileId, tenderDsId, tenderFileUrl } = req.body
  
  try {
    const updates = []
    const values = []
    
    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }
    if (tenderFileId !== undefined) {
      updates.push('tender_file_id = ?')
      values.push(tenderFileId)
    }
    if (tenderDsId !== undefined) {
      updates.push('tender_ds_id = ?')
      values.push(tenderDsId)
    }
    if (tenderFileUrl !== undefined) {
      updates.push('tender_file_url = ?')
      values.push(tenderFileUrl)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }
    
    values.push(req.params.id)
    
    await pool.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
    
    res.json({ code: 0, message: '更新成功' })
  } catch (error) {
    console.error('更新项目失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 删除项目（级联删除关联数据）
router.delete('/:id', async (req, res) => {
  const projectId = req.params.id
  const connection = await pool.getConnection()
  
  try {
    await connection.beginTransaction()
    
    // 1. 删除项目文件的字段
    await connection.query('DELETE FROM file_fields WHERE project_id = ?', [projectId])
    
    // 2. 删除项目文件
    await connection.query('DELETE FROM project_files WHERE project_id = ?', [projectId])
    
    // 3. 删除项目字段
    await connection.query('DELETE FROM project_fields WHERE project_id = ?', [projectId])
    
    // 4. 删除审计风险
    await connection.query('DELETE FROM audit_risks WHERE project_id = ?', [projectId])
    
    // 5. 删除项目
    const [result] = await connection.query('DELETE FROM projects WHERE id = ?', [projectId])
    
    await connection.commit()
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' })
    }
    
    console.log(`[删除项目] 已删除项目: ${projectId}`)
    res.json({ code: 0, message: '项目删除成功' })
  } catch (error) {
    await connection.rollback()
    console.error('删除项目失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  } finally {
    connection.release()
  }
})

// =============== 项目字段 ===============

// 获取项目字段
router.get('/:id/fields', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM project_fields WHERE project_id = ? ORDER BY id',
      [req.params.id]
    )
    
    res.json({
      code: 0,
      data: rows.map(row => ({
        fieldCode: row.field_code,
        fieldName: row.field_name,
        value: row.field_value,
        status: row.status,
        groupName: row.group_name,
        evidenceRef: row.evidence_page ? {
          page: row.evidence_page,
          bbox: row.evidence_bbox,
        } : null,
      })),
    })
  } catch (error) {
    console.error('获取项目字段失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 更新项目字段
router.put('/:id/fields/:fieldCode', async (req, res) => {
  const { value, status, fieldName, groupName } = req.body
  const projectId = req.params.id
  const fieldCode = req.params.fieldCode
  
  try {
    // 检查字段是否存在
    const [existing] = await pool.query(
      'SELECT id FROM project_fields WHERE project_id = ? AND field_code = ?',
      [projectId, fieldCode]
    )
    
    if (existing.length > 0) {
      // 更新
      await pool.query(
        `UPDATE project_fields SET field_value = ?, status = ? 
         WHERE project_id = ? AND field_code = ?`,
        [value, status || 'modified', projectId, fieldCode]
      )
    } else {
      // 插入
      await pool.query(
        `INSERT INTO project_fields (project_id, field_code, field_name, field_value, status, group_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projectId, fieldCode, fieldName || fieldCode, value, status || 'auto', groupName || null]
      )
    }
    
    res.json({ code: 0, message: '更新成功' })
  } catch (error) {
    console.error('更新字段失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// =============== 项目文件 ===============

// 获取项目文件列表
router.get('/:id/files', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at',
      [req.params.id]
    )
    
    res.json({
      code: 0,
      data: rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        fileName: row.file_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        fileId: row.file_id,
        dsId: row.ds_id,
        docTypeCode: row.doc_type_code,
        docTypeName: row.doc_type_name,
        isTender: row.is_tender === 1,  // 添加招标文件标记
        status: row.status,
        extractionStatus: row.extraction_status,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    console.error('获取项目文件失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 添加项目文件
router.post('/:id/files', async (req, res) => {
  const { fileName, fileSize, mimeType, fileId, dsId, docTypeCode, docTypeName, isTender, status } = req.body
  
  try {
    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    await pool.query(
      `INSERT INTO project_files 
       (id, project_id, file_name, file_size, mime_type, file_id, ds_id, doc_type_code, doc_type_name, is_tender, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, fileName, fileSize, mimeType, fileId, dsId, docTypeCode, docTypeName, isTender ? 1 : 0, status || 'pending']
    )
    
    res.json({
      code: 0,
      data: { id },
      message: '文件添加成功',
    })
  } catch (error) {
    console.error('添加文件失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 更新项目文件
router.put('/:id/files/:fileId', async (req, res) => {
  const { docTypeCode, docTypeName, status, extractionStatus } = req.body
  
  try {
    const updates = []
    const values = []
    
    if (docTypeCode !== undefined) {
      updates.push('doc_type_code = ?')
      values.push(docTypeCode)
    }
    if (docTypeName !== undefined) {
      updates.push('doc_type_name = ?')
      values.push(docTypeName)
    }
    if (status) {
      updates.push('status = ?')
      values.push(status)
    }
    if (extractionStatus) {
      updates.push('extraction_status = ?')
      values.push(extractionStatus)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }
    
    values.push(req.params.fileId)
    
    await pool.query(
      `UPDATE project_files SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
    
    res.json({ code: 0, message: '更新成功' })
  } catch (error) {
    console.error('更新文件失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 删除项目文件
router.delete('/:id/files/:fileId', async (req, res) => {
  const projectId = req.params.id
  const fileId = req.params.fileId
  
  const connection = await pool.getConnection()
  
  try {
    await connection.beginTransaction()
    
    // 1. 删除文件的字段
    await connection.query('DELETE FROM file_fields WHERE project_id = ? AND file_id = ?', [projectId, fileId])
    
    // 2. 删除文件记录
    const [result] = await connection.query('DELETE FROM project_files WHERE id = ? AND project_id = ?', [fileId, projectId])
    
    await connection.commit()
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '文件不存在' })
    }
    
    console.log(`[删除文件] projectId=${projectId}, fileId=${fileId}`)
    res.json({ code: 0, message: '文件删除成功' })
  } catch (error) {
    await connection.rollback()
    console.error('删除文件失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  } finally {
    connection.release()
  }
})

// =============== 文件字段 ===============

// 获取项目所有文件的所有字段（用于审计）
router.get('/:id/all-fields', async (req, res) => {
  const projectId = req.params.id
  console.log(`[API] 获取项目所有字段: projectId=${projectId}`)
  
  try {
    // 联表查询，获取所有文件的字段，并包含文件信息
    const [rows] = await pool.query(`
      SELECT 
        ff.*,
        pf.file_name,
        pf.doc_type_name,
        pf.is_tender
      FROM file_fields ff
      JOIN project_files pf ON ff.file_id = pf.id
      WHERE ff.project_id = ?
      ORDER BY pf.is_tender DESC, pf.created_at, ff.id
    `, [projectId])
    
    console.log(`[API] 找到 ${rows.length} 个字段`)
    
    res.json({
      code: 0,
      data: rows.map(row => ({
        fileId: row.file_id,
        fileName: row.file_name,
        docTypeName: row.doc_type_name,
        isTender: row.is_tender === 1,
        fieldCode: row.field_code,
        fieldName: row.field_name,
        value: row.field_value,
        status: row.status,
        groupName: row.group_name,
        evidenceRef: row.evidence_page ? {
          page: row.evidence_page,
          bbox: row.evidence_bbox ? JSON.parse(row.evidence_bbox) : null,
        } : null,
      })),
    })
  } catch (error) {
    console.error('获取项目所有字段失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 获取文件字段
router.get('/:id/files/:fileId/fields', async (req, res) => {
  console.log(`[API] 获取文件字段: projectId=${req.params.id}, fileId=${req.params.fileId}`)
  try {
    const [rows] = await pool.query(
      'SELECT * FROM file_fields WHERE project_id = ? AND file_id = ? ORDER BY id',
      [req.params.id, req.params.fileId]
    )
    
    console.log(`[API] 找到 ${rows.length} 个字段`)
    
    res.json({
      code: 0,
      data: rows.map(row => ({
        fieldCode: row.field_code,
        fieldName: row.field_name,
        value: row.field_value,
        status: row.status,
        groupName: row.group_name,
        evidenceRef: row.evidence_page ? {
          page: row.evidence_page,
          bbox: row.evidence_bbox ? JSON.parse(row.evidence_bbox) : null,
        } : null,
      })),
    })
  } catch (error) {
    console.error('获取文件字段失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 批量更新文件字段
router.put('/:id/files/:fileId/fields', async (req, res) => {
  const { fields } = req.body
  const projectId = req.params.id
  const fileId = req.params.fileId
  
  console.log(`[API] 保存文件字段: projectId=${projectId}, fileId=${fileId}, 字段数=${fields?.length || 0}`)
  
  if (!fields || !Array.isArray(fields)) {
    return res.status(400).json({ code: 400, message: '字段数据无效' })
  }
  
  const connection = await pool.getConnection()
  
  try {
    await connection.beginTransaction()
    
    for (const field of fields) {
      // 检查字段是否存在
      const [existing] = await connection.query(
        'SELECT id FROM file_fields WHERE project_id = ? AND file_id = ? AND field_code = ?',
        [projectId, fileId, field.fieldCode]
      )
      
      if (existing.length > 0) {
        // 更新
        await connection.query(
          `UPDATE file_fields SET 
            field_value = ?, 
            status = ?,
            evidence_page = ?,
            evidence_bbox = ?
           WHERE project_id = ? AND file_id = ? AND field_code = ?`,
          [
            field.value,
            field.status || 'modified',
            field.evidenceRef?.page || null,
            field.evidenceRef?.bbox ? JSON.stringify(field.evidenceRef.bbox) : null,
            projectId,
            fileId,
            field.fieldCode,
          ]
        )
      } else {
        // 插入
        await connection.query(
          `INSERT INTO file_fields 
           (project_id, file_id, field_code, field_name, field_value, status, group_name, evidence_page, evidence_bbox)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            fileId,
            field.fieldCode,
            field.fieldName || field.fieldCode,
            field.value,
            field.status || 'auto',
            field.groupName || null,
            field.evidenceRef?.page || null,
            field.evidenceRef?.bbox ? JSON.stringify(field.evidenceRef.bbox) : null,
          ]
        )
      }
    }
    
    await connection.commit()
    res.json({ code: 0, message: '字段更新成功' })
  } catch (error) {
    await connection.rollback()
    console.error('更新文件字段失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  } finally {
    connection.release()
  }
})

// =============== 审计风险 ===============

// 获取项目风险列表
router.get('/:id/risks', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM audit_risks WHERE project_id = ? ORDER BY created_at DESC',
      [req.params.id]
    )
    
    res.json({
      code: 0,
      data: rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        ruleCode: row.rule_code,
        ruleName: row.rule_name,
        riskLevel: row.risk_level,
        description: row.description,
        suggestion: row.suggestion,
        evidence: row.evidence ? JSON.parse(row.evidence) : null,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取风险列表失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 添加风险
router.post('/:id/risks', async (req, res) => {
  const { ruleCode, ruleName, riskLevel, description, suggestion, evidence } = req.body
  const projectId = req.params.id
  
  if (!description) {
    return res.status(400).json({ code: 400, message: '风险描述不能为空' })
  }
  
  try {
    const [result] = await pool.query(
      `INSERT INTO audit_risks 
       (project_id, rule_code, rule_name, risk_level, description, suggestion, evidence, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        projectId,
        ruleCode || null,
        ruleName || null,
        riskLevel || 'medium',
        description,
        suggestion || null,
        evidence ? JSON.stringify(evidence) : null,
      ]
    )
    
    res.json({
      code: 0,
      data: { id: result.insertId },
      message: '风险添加成功',
    })
  } catch (error) {
    console.error('添加风险失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 更新风险
router.put('/:id/risks/:riskId', async (req, res) => {
  const { status, description, suggestion, riskLevel } = req.body
  
  try {
    const updates = []
    const values = []
    
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }
    if (suggestion !== undefined) {
      updates.push('suggestion = ?')
      values.push(suggestion)
    }
    if (riskLevel !== undefined) {
      updates.push('risk_level = ?')
      values.push(riskLevel)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }
    
    values.push(req.params.riskId)
    
    await pool.query(
      `UPDATE audit_risks SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
    
    res.json({ code: 0, message: '更新成功' })
  } catch (error) {
    console.error('更新风险失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

// 删除风险
router.delete('/:id/risks/:riskId', async (req, res) => {
  try {
    await pool.query('DELETE FROM audit_risks WHERE id = ?', [req.params.riskId])
    res.json({ code: 0, message: '风险删除成功' })
  } catch (error) {
    console.error('删除风险失败:', error)
    res.status(500).json({ code: 500, message: error.message })
  }
})

module.exports = router
