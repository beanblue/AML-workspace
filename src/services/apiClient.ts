import type { ApiResult } from '../types';

export interface ApiRequestConfig {
  module: string;
  action: string;
  params?: Record<string, unknown>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

const DEFAULT_DELAY = 300;
const MOCK_MODE = import.meta.env.VITE_USE_MOCK !== 'false';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

class ApiClient {
  // 第一期开启本地 mock，后续切换为真实 API 网关
  private readonly useMockMode: boolean = MOCK_MODE;

  public isMockMode(): boolean {
    return this.useMockMode;
  }

  public async request<T>(config: ApiRequestConfig, mockData: T): Promise<ApiResult<T>> {
    if (this.useMockMode) {
      await sleep(DEFAULT_DELAY);
      return {
        success: true,
        data: mockData,
        message: `${config.module}/${config.action} (mock)`,
      };
    }

    // TODO: 第二期接入真实后端时，在此注入 fetch/axios 请求逻辑并统一处理鉴权、异常与重试
    throw new Error('真实 API 模式尚未实现，请先启用 mock 模式。');
  }
}

export const apiClient = new ApiClient();
