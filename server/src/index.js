const express = require('express')
const cors = require('cors')
const config = require('./config')
const projectsRouter = require('./routes/projects')
const auditRulesRouter = require('./routes/auditRules')

const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// 路由
app.use('/api/app/projects', projectsRouter)
app.use('/api/app/audit-rules', auditRulesRouter)

// 健康检查
app.get('/api/app/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err)
  res.status(500).json({ code: 500, message: err.message })
})

// 启动服务器
app.listen(config.server.port, () => {
  console.log(`
========================================
  审计应用后端服务已启动
  端口: ${config.server.port}
  API: http://localhost:${config.server.port}/api/app
========================================
  `)
})
