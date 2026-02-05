// 智能体配置
// 根据环境切换 host 和 apiKey

export type Environment = 'production' | 'qj'

// 当前环境配置
export const CURRENT_ENV: Environment = 'qj'

// 环境配置
export const ENV_CONFIG = {
  production: {
    host: 'https://qj.agentspro.cn',
    kbId: 734,
    // 账号级别 API Key（文件上传、知识库）
    account: {
      authKey: '49084c71d1984eca8fe7407634a3f913',
      authSecret: 'bgAGhKDJrZBdWL8m3TluyhVaVhHWIXaC',
    },
    // 智能体 API Keys
    agents: {
      // 获取项目介绍
      projectIntro: {
        uuid: 'e4db5477e0c04ac8bd6b2fcff5c01328',
        authKey: 'e4db5477e0c04ac8bd6b2fcff5c01328',
        authSecret: 'bgFFUousSLaGa4VKbafGN3gVjr5GYXCH',
      },
    },
  },
  qj: {
    host: 'https://qj.agentspro.cn',
    kbId: 761,
    // 账号级别 API Key（文件上传、知识库）
    account: {
      authKey: '44b98265828f465fa3202d5c92ec8d7b',
      authSecret: 'wY3nIU1mxgiEJ9dOhtihZsB54IEKfs0m',
    },
    // 智能体 API Keys
    agents: {
      // 普通提取智能体
      normalExtract: {
        uuid: '442e8356de0f4347a88ee9893eaa7301',
        authKey: '442e8356de0f4347a88ee9893eaa7301',
        authSecret: 'AH8tTaCUMs6tJhljmk5YhsdrmRyQ283q',
      },
      // 视觉提取智能体
      visionExtract: {
        uuid: '7f06a11565ef438a874212033a436a3a',
        authKey: '7f06a11565ef438a874212033a436a3a',
        authSecret: 'yz9XMDxTOoLbHl1t3K4segBv25OCmTNT',
      },
      // 基础审计智能体
      basicAudit: {
        uuid: '1fb34c506e6e4d38a337cfa67e13ec41',
        authKey: '1fb34c506e6e4d38a337cfa67e13ec41',
        authSecret: 'vtAONQqrx6pqXj8nkT3ucHkaCbXhUziF',
      },
      // 生成代码审计智能体
      codeAudit: {
        uuid: 'b6ccf238e5db4b6380154be1b8a8c564',
        authKey: 'b6ccf238e5db4b6380154be1b8a8c564',
        authSecret: 'x2U3yATmQIl0jtz5zMLJak5S171lOxID',
      },
      // 文件分拣智能体
      fileClassify: {
        uuid: 'f1f6f34bff9c4f4ca9304051929daa24',
        authKey: 'f1f6f34bff9c4f4ca9304051929daa24',
        authSecret: 'avQsqKC10PagtZbQlf96bDgJGZJm9DKi',
      },
    },
  },
} as const

// 获取当前环境配置
export function getConfig() {
  return ENV_CONFIG[CURRENT_ENV]
}

// 获取 Bearer Token
export function getBearerToken(authKey: string, authSecret: string): string {
  return `Bearer ${authKey}.${authSecret}`
}

// 获取账号级别的 Bearer Token
export function getAccountToken(): string {
  const config = getConfig()
  return getBearerToken(config.account.authKey, config.account.authSecret)
}

// 智能体类型
export type AgentType = keyof typeof ENV_CONFIG.qj.agents

// 获取智能体的 Bearer Token
export function getAgentToken(agentType: AgentType): string {
  const config = getConfig()
  const agent = config.agents[agentType]
  return getBearerToken(agent.authKey, agent.authSecret)
}
