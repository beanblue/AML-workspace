import { apiClient } from './apiClient';
import type {
  AMLModule,
  AMLReport,
  AMLRiskProfile,
  AssessmentRecord,
  CDDCase,
  CommitteeMeeting,
  DashboardOverview,
  LargeTransactionRecord,
  PolicyProcessItem,
  PublicityTask,
  RectificationTask,
  ResponsibilityRole,
  STRCase,
  TrainingTask,
} from '../types';

const now = new Date().toISOString();

const mockPolicies: PolicyProcessItem[] = [
  {
    id: 'policy-001',
    category: '制度',
    code: 'AML-ZD-2026-001',
    name: '客户身份识别管理制度',
    ownerDepartment: '合规管理部',
    version: 'V1.3',
    status: 'active',
    effectiveDate: '2026-01-10',
    description: '覆盖开户、持续尽调与存量复核要求',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'process-001',
    category: '流程',
    code: 'AML-LC-2026-002',
    name: '可疑交易报告提交流程',
    ownerDepartment: '运营管理部',
    version: 'V2.0',
    status: 'draft',
    effectiveDate: '2026-03-01',
    createdAt: now,
    updatedAt: now,
  },
];

const mockOverview: DashboardOverview = {
  metrics: [
    { key: 'org', title: '组织类事项', value: 32, trend: 8, color: 'blue' },
    { key: 'ops', title: '操作类事项', value: 54, trend: -2, color: 'green' },
    { key: 'special', title: '专项类事项', value: 19, trend: 3, color: 'orange' },
  ],
  riskDistribution: [
    { name: '低风险', value: 62 },
    { name: '中风险', value: 28 },
    { name: '高风险', value: 10 },
  ],
  moduleProgress: [
    { name: '制度流程', completed: 12, pending: 4 },
    { name: '客户识别', completed: 20, pending: 6 },
    { name: '整改管理', completed: 8, pending: 3 },
  ],
};

type ModuleMockData = {
  dashboard: DashboardOverview;
  policy: PolicyProcessItem[];
  responsibility: ResponsibilityRole[];
  committee: CommitteeMeeting[];
  training: TrainingTask[];
  publicity: PublicityTask[];
  assessment: AssessmentRecord[];
  cdd: CDDCase[];
  risk: AMLRiskProfile[];
  str: STRCase[];
  largeTransaction: LargeTransactionRecord[];
  otherOps: Array<Record<string, unknown>>;
  report: AMLReport[];
  rectification: RectificationTask[];
};

const mockDataMap: ModuleMockData = {
  dashboard: mockOverview,
  policy: mockPolicies,
  responsibility: [],
  committee: [],
  training: [],
  publicity: [],
  assessment: [],
  cdd: [],
  risk: [],
  str: [],
  largeTransaction: [],
  otherOps: [],
  report: [],
  rectification: [],
};

export const notionService = {
  // 第一期开启 mock；第二期在此接入 Notion Database Query API
  async queryModuleData<T>(module: AMLModule, params?: Record<string, unknown>) {
    const moduleData = mockDataMap[module as keyof ModuleMockData] ?? [];
    return apiClient.request<T>(
      {
        module,
        action: 'query',
        params,
        method: 'GET',
      },
      moduleData as T,
    );
  },

  async savePolicy(payload: Partial<PolicyProcessItem>) {
    // 第二期可映射到 notion.pages.create / notion.pages.update
    return apiClient.request(
      {
        module: 'policy',
        action: 'save',
        params: payload as Record<string, unknown>,
        method: 'POST',
      },
      {
        id: payload.id ?? `policy-${Date.now()}`,
        savedAt: new Date().toISOString(),
      },
    );
  },
};
