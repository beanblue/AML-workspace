import { apiClient } from './apiClient';
import type { AMLModule } from '../types';

export interface AgentAdviceRequest {
  module: AMLModule;
  scene: string;
  context?: Record<string, unknown>;
}

export interface AgentAdviceResponse {
  summary: string;
  suggestions: string[];
  riskLevel: '低' | '中' | '高';
  generatedAt: string;
}

const mockAdviceMap: Record<string, AgentAdviceResponse> = {
  policy: {
    summary: '制度条文覆盖核心监管要求，但流程留痕字段仍可细化。',
    suggestions: [
      '补充废止制度的审批链路与版本比对记录',
      '新增制度更新后 30 天内培训触发提醒',
      '将制度状态变更与执行证据自动关联',
    ],
    riskLevel: '中',
    generatedAt: new Date().toISOString(),
  },
  risk: {
    summary: '高风险客群识别准确率稳定，但复审周期偏长。',
    suggestions: ['为高风险客户新增周级复核任务', '对评分波动异常客户触发人工复核'],
    riskLevel: '中',
    generatedAt: new Date().toISOString(),
  },
};

export const agentService = {
  // 第一期开启 mock；第二期在此接入 DeepSeek 对话/推理 API
  async generateAdvice(request: AgentAdviceRequest) {
    const data = mockAdviceMap[request.module] ?? {
      summary: '当前模块暂无专属建议，建议先补齐基础数据。',
      suggestions: ['补充标准化字段', '建立流程留痕与状态闭环'],
      riskLevel: '低' as const,
      generatedAt: new Date().toISOString(),
    };

    return apiClient.request<AgentAdviceResponse>(
      {
        module: request.module,
        action: 'agent.generateAdvice',
        params: request as unknown as Record<string, unknown>,
        method: 'POST',
      },
      data,
    );
  },
};
