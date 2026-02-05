// 数据库和服务器配置
// 可以通过环境变量覆盖

require('dotenv').config()

module.exports = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: process.env.DB_NAME || 'audit_app',
  },
  server: {
    port: parseInt(process.env.PORT || '8080'),
  },
  dataHub: {
    host: process.env.DATA_HUB_HOST || 'http://115.190.44.247',
    token: process.env.DATA_HUB_TOKEN || '',
  },
}
