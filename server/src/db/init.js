/**
 * 数据库初始化脚本
 * 运行: npm run db:init
 */

const mysql = require('mysql2/promise')
const config = require('../config')

const TABLES = `
-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT '项目名称',
  status VARCHAR(32) DEFAULT 'uploading' COMMENT '项目状态（uploading, extracting, auditing, completed）',
  tender_file_id VARCHAR(64) COMMENT '招标文件ID（智能体平台）',
  tender_ds_id INT COMMENT '招标文件知识库数据集ID',
  tender_file_url VARCHAR(512) COMMENT '招标文件预览URL',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目表';

-- 项目字段值表
CREATE TABLE IF NOT EXISTS project_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL COMMENT '项目ID',
  field_code VARCHAR(64) NOT NULL COMMENT '字段编码',
  field_name VARCHAR(128) NOT NULL COMMENT '字段名称',
  field_value TEXT COMMENT '字段值',
  status ENUM('auto', 'confirmed', 'modified', 'missing') DEFAULT 'auto' COMMENT '状态',
  group_name VARCHAR(64) COMMENT '分组名称',
  evidence_page INT COMMENT '原文页码',
  evidence_bbox JSON COMMENT '原文位置',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_field (project_id, field_code),
  INDEX idx_project_id (project_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目字段值表';

-- 项目文件表（所有文件包括招标文件都在这里）
CREATE TABLE IF NOT EXISTS project_files (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL COMMENT '项目ID',
  file_name VARCHAR(255) NOT NULL COMMENT '文件名',
  file_size BIGINT COMMENT '文件大小（字节）',
  mime_type VARCHAR(64) COMMENT 'MIME类型',
  file_id VARCHAR(64) COMMENT '智能体平台文件ID',
  ds_id INT COMMENT '知识库数据集ID',
  doc_type_code VARCHAR(64) COMMENT '文件类型编码',
  doc_type_name VARCHAR(128) COMMENT '文件类型名称',
  is_tender BOOLEAN DEFAULT FALSE COMMENT '是否为招标文件',
  status ENUM('pending', 'classified', 'confirmed') DEFAULT 'pending' COMMENT '分类状态',
  extraction_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '提取状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id),
  INDEX idx_status (status),
  INDEX idx_is_tender (is_tender),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目文件表';

-- 文件字段值表
CREATE TABLE IF NOT EXISTS file_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_id VARCHAR(64) NOT NULL COMMENT '文件ID',
  project_id VARCHAR(64) NOT NULL COMMENT '项目ID',
  field_code VARCHAR(64) NOT NULL COMMENT '字段编码',
  field_name VARCHAR(128) NOT NULL COMMENT '字段名称',
  field_value TEXT COMMENT '字段值',
  status ENUM('auto', 'confirmed', 'modified', 'missing', 'pending') DEFAULT 'auto' COMMENT '状态',
  group_name VARCHAR(64) COMMENT '字段分组',
  evidence_page INT COMMENT '原文页码',
  evidence_bbox JSON COMMENT '原文位置',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_file_field (file_id, field_code),
  INDEX idx_file_id (file_id),
  INDEX idx_project_id (project_id),
  FOREIGN KEY (file_id) REFERENCES project_files(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文件字段值表';

-- 审计风险表
CREATE TABLE IF NOT EXISTS audit_risks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL COMMENT '项目ID',
  rule_code VARCHAR(64) COMMENT '规则编码',
  rule_name VARCHAR(255) COMMENT '规则名称',
  risk_level VARCHAR(32) DEFAULT 'medium' COMMENT '风险等级（critical/high/medium/low/info）',
  description TEXT COMMENT '风险描述',
  suggestion TEXT COMMENT '处理建议',
  status VARCHAR(32) DEFAULT 'pending' COMMENT '状态（pending/confirmed/ignored/resolved）',
  evidence JSON COMMENT '证据信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id),
  INDEX idx_risk_level (risk_level),
  INDEX idx_status (status),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计风险表';

-- 审计规则表（从数据中台同步）
CREATE TABLE IF NOT EXISTS audit_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(64) NULL DEFAULT NULL COMMENT '数据中台规则ID（本地规则为空）',
  code VARCHAR(64) NOT NULL COMMENT '规则编码',
  name VARCHAR(255) NOT NULL COMMENT '规则名称',
  description TEXT COMMENT '规则描述',
  category VARCHAR(64) COMMENT '规则类别',
  stage VARCHAR(64) COMMENT '审计阶段',
  is_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  synced_at DATETIME COMMENT '同步时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计规则表';
`

async function init() {
  let connection
  
  try {
    // 先连接到 MySQL（不指定数据库）
    connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
    })
    
    console.log('连接 MySQL 成功')
    
    // 创建数据库
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.db.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log(`数据库 ${config.db.database} 创建成功`)
    
    // 切换到数据库
    await connection.query(`USE ${config.db.database}`)
    
    // 执行建表语句
    const statements = TABLES.split(';').filter(s => s.trim())
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement)
      }
    }
    
    console.log('数据表创建成功！')
    console.log('表：projects, project_fields, project_files, file_fields, audit_risks, audit_rules')
    
  } catch (error) {
    console.error('初始化数据库失败:', error.message)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

init()
