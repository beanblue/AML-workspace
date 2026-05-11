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
  ProcessLibraryItem,
  PolicyProcessItem,
  PublicityTask,
  ReferenceKnowledgeItem,
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
    documentType: '制度',
    code: 'AML-ZD-2026-001',
    name: '客户身份识别管理制度',
    sourceLevel: '监管层',
    issuingUnit: '国家金融监督管理总局',
    documentNo: '合规〔2026〕001号',
    issueDate: '2026-04-29',
    ownerDepartment: '合规管理部',
    version: 'V1.3',
    status: 'active',
    effectiveDate: '2026-01-10',
    abolishedDate: '2026-05-28',
    relatedRoles: ['合规岗', '客户经理岗', '风控复核岗'],
    fullText:
      '第一章 总则\\n为规范客户身份识别工作，落实反洗钱职责，制定本制度。\\n第二章 识别要求\\n开户环节应执行实名核验、风险等级识别和持续尽调。\\n第三章 留痕管理\\n应当完整保存客户识别资料、复核记录、审批信息。',
    historyVersions: [
      { version: 'V1.3', updatedAt: '2026-04-18', note: '补充高风险客户复核频率要求' },
      { version: 'V1.2', updatedAt: '2026-02-10', note: '新增跨境场景核查条款' },
    ],
    annotations: [
      { id: 'anno-001', createdAt: '2026-05-01 10:20', content: '第三章留痕模板需和 STR 流程保持一致。' },
    ],
    fileName: '客户身份识别管理制度_V1.3.pdf',
    summary: '明确开户、持续尽调、风险复核与留痕管理的统一标准，适用于全行客户身份识别工作。',
    description: '覆盖开户、持续尽调与存量复核要求',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'policy-002',
    category: '制度',
    documentType: '规定',
    code: 'AML-ZD-2026-008',
    name: '客户风险评级管理制度',
    sourceLevel: '总公司层',
    issuingUnit: '总公司合规管理委员会',
    documentNo: '总合规〔2026〕018号',
    issueDate: '2026-03-01',
    ownerDepartment: '风险管理部',
    version: 'V2.1',
    status: 'active',
    effectiveDate: '2026-03-01',
    abolishedDate: '2026-12-31',
    relatedRoles: ['评级分析岗', '合规岗'],
    fullText:
      '本制度明确评级模型输入项、评分阈值、人工复核和审批流程。\\n对评分波动超阈值客户，应在 T+1 工作日内完成二次复核。',
    historyVersions: [{ version: 'V2.1', updatedAt: '2026-03-01', note: '同步更新阈值区间' }],
    annotations: [],
    fileName: '客户风险评级管理制度_V2.1.docx',
    summary: '规范评级模型输入输出、等级划分及人工复核流程。',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'policy-003',
    category: '制度',
    documentType: '通知',
    code: 'AML-ZD-2025-011',
    name: '培训与宣传管理制度',
    sourceLevel: '分公司层',
    issuingUnit: '华东分公司合规部',
    documentNo: '华东合规〔2025〕011号',
    issueDate: '2025-09-01',
    ownerDepartment: '综合管理部',
    version: 'V1.0',
    status: 'draft',
    effectiveDate: '2025-09-01',
    relatedRoles: ['培训管理岗', '宣传管理岗'],
    fullText: '制度草案：明确培训需求收集、实施、档案留存和效果复盘流程。',
    historyVersions: [{ version: 'V1.0', updatedAt: '2025-09-01', note: '初版发布' }],
    annotations: [],
    fileName: '培训与宣传管理制度草案.md',
    summary: '明确培训宣传全过程管理与痕迹留存要求。',
    createdAt: now,
    updatedAt: now,
  },
];

const mockProcessLibrary: ProcessLibraryItem[] = [
  {
    id: 'proc-001',
    processCode: 'AML-LC-2026-002',
    processName: '可疑交易报告提交流程',
    businessDomain: 'STR 报告',
    version: 'V2.0',
    status: 'active',
    createdAt: now,
    updatedAt: '2026-04-25',
    steps: [
      {
        id: 'proc-001-step-1',
        index: 1,
        name: '线索识别与登记',
        triggerCondition: '系统规则触发或人工识别可疑行为',
        ownerRole: '交易监测岗',
        sla: 'T+0 当日内',
        evidenceRequirement: '保存规则命中截图、原始交易明细',
        note: '同一客户多笔交易需合并分析',
      },
      {
        id: 'proc-001-step-2',
        index: 2,
        name: '合规复核',
        triggerCondition: '线索登记完成后自动流转',
        ownerRole: '合规复核岗',
        sla: 'T+1 个工作日内',
        evidenceRequirement: '复核意见、补充材料清单、审批记录',
      },
      {
        id: 'proc-001-step-3',
        index: 3,
        name: '报送与归档',
        triggerCondition: '复核通过',
        ownerRole: '报告报送岗',
        sla: 'T+2 个工作日内',
        evidenceRequirement: '报送回执、最终报告 PDF、归档索引',
      },
    ],
  },
];

const mockKnowledgeLibrary: ReferenceKnowledgeItem[] = [
  {
    id: 'ref-001',
    materialType: '图书',
    title: '金融机构反洗钱合规研究',
    sourceOrg: '中国人民银行',
    publishDate: '2024-06-01',
    summary: '系统梳理金融机构 AML 合规体系、职责划分与实务案例。',
    tags: ['风险评级', '国际标准'],
    originLink: 'https://example.com/book-aml',
    personalNote: '适合用于培训管理的参考教材。',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'ref-002',
    materialType: '监管报告',
    title: 'FATF 40项建议',
    sourceOrg: 'FATF',
    publishDate: '2023-10-01',
    summary: '国际反洗钱/反恐融资核心标准，覆盖风险为本与跨境协作要求。',
    tags: ['FATF', '国际标准'],
    originLink: 'https://www.fatf-gafi.org/',
    personalNote: '可映射为内部制度条文对照表。',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'ref-003',
    materialType: '监管报告',
    title: '关于加强反洗钱工作的指导意见',
    sourceOrg: '银保监会',
    publishDate: '2022-08-18',
    summary: '明确金融机构在客户识别、可疑交易监测和内部治理方面的监管要求。',
    tags: ['CDD', 'STR', '风险评级'],
    originLink: 'https://example.com/reg-report-2022',
    personalNote: '和当前制度库进行差距分析时可重点引用。',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'ref-004',
    materialType: '论文',
    title: '洗钱风险评估方法研究',
    sourceOrg: '某高校',
    publishDate: '2023-04-10',
    summary: '提出基于多维特征的风险评估模型，并验证了行业场景效果。',
    tags: ['风险评级', '国际标准'],
    attachmentName: '洗钱风险评估方法研究.pdf',
    personalNote: '模型思路可用于优化我司客户评级策略。',
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
  policyProcess: ProcessLibraryItem[];
  policyKnowledge: ReferenceKnowledgeItem[];
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
  policyProcess: mockProcessLibrary,
  policyKnowledge: mockKnowledgeLibrary,
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

const NOTION_VERSION = '2022-06-28';
const FALLBACK_DB_ID_RAW = 'ee38fb1070e24a39a553fce111752217';

interface NotionRichText {
  plain_text?: string;
}

interface NotionProperty {
  type?: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  select?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  date?: { start?: string | null } | null;
}

interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionProperty>;
}

interface NotionQueryResponse {
  results: NotionPage[];
}

const toHyphenId = (idOrPath: string): string => {
  const raw = idOrPath.replace(/^collection:\/\//, '').replace(/-/g, '').trim();
  if (raw.length !== 32) return idOrPath.replace(/^collection:\/\//, '').trim();
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
};

const getPrimaryDatabaseId = (): string => {
  const resource = import.meta.env.VITE_NOTION_DB_RESOURCE as string | undefined;
  if (resource) return toHyphenId(resource);
  return toHyphenId(FALLBACK_DB_ID_RAW);
};

const getTitle = (props: Record<string, NotionProperty>, key: string): string =>
  props[key]?.title?.map((item) => item.plain_text ?? '').join('') ?? '';
const getRichText = (props: Record<string, NotionProperty>, key: string): string =>
  props[key]?.rich_text?.map((item) => item.plain_text ?? '').join('') ?? '';
const getSelect = (props: Record<string, NotionProperty>, key: string): string => props[key]?.select?.name ?? '';
const getDate = (props: Record<string, NotionProperty>, key: string): string => props[key]?.date?.start ?? '';
const getMultiSelect = (props: Record<string, NotionProperty>, key: string): string[] =>
  props[key]?.multi_select?.map((item) => item.name ?? '').filter(Boolean) ?? [];

const normalizeMaterialType = (value: string): ReferenceKnowledgeItem['materialType'] => {
  const allowed: ReferenceKnowledgeItem['materialType'][] = ['图书', '论文', '监管报告', '新闻资讯', '观点文章', '其他'];
  return (allowed.includes(value as ReferenceKnowledgeItem['materialType']) ? value : '其他') as ReferenceKnowledgeItem['materialType'];
};

const mapNotionToKnowledge = (page: NotionPage): ReferenceKnowledgeItem => {
  const props = page.properties;
  const type = getSelect(props, '类型');
  const status = getSelect(props, '状态');
  const effectiveDate = getDate(props, '生效/发布日期');
  const source = getRichText(props, '来源');
  const summary = getRichText(props, '摘要');
  const docType = getSelect(props, '文档类型');
  const tags = getMultiSelect(props, '主题标签');
  const amlLabel = getSelect(props, '反洗钱识别标签');
  const keyPoints = getRichText(props, '关键要点 / 适用情景') || getRichText(props, '关键要点/适用情景');
  const scope = getRichText(props, '适用范围');

  return {
    id: page.id,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
    materialType: normalizeMaterialType(type || docType || '其他'),
    type,
    status,
    docType,
    amlLabel,
    keyPoints,
    scope,
    title: getTitle(props, '标题') || '未命名资料',
    sourceOrg: source || '-',
    publishDate: effectiveDate || '',
    summary: summary || keyPoints || '-',
    tags,
    originLink: '',
    personalNote: '',
  };
};

const mapKnowledgeToPolicy = (item: ReferenceKnowledgeItem, index: number): PolicyProcessItem => {
  const statusMap: Record<string, PolicyProcessItem['status']> = {
    有效: 'active',
    拟稿草案: 'draft',
    已废止: 'archived',
    仅参考: 'inactive',
  };

  return {
    id: `policy-${item.id}`,
    category: '制度',
    documentType: '制度',
    code: `AML-ZD-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`,
    name: item.title,
    sourceLevel:
      item.sourceOrg.includes('监管') || item.sourceOrg.includes('银保监') || item.sourceOrg.includes('人民银行')
        ? '监管层'
        : item.sourceOrg.includes('分公司')
          ? '分公司层'
          : '总公司层',
    issuingUnit: item.sourceOrg || '-',
    documentNo: '-',
    issueDate: item.publishDate || item.createdAt.slice(0, 10),
    ownerDepartment: '合规管理部',
    version: 'V1.0',
    status: statusMap[item.status ?? ''] ?? 'active',
    effectiveDate: item.publishDate || item.createdAt.slice(0, 10),
    abolishedDate: undefined,
    relatedRoles: [],
    fullText: `${item.summary}\n${item.keyPoints ?? ''}\n${item.scope ?? ''}`.trim(),
    fileName: item.attachmentName,
    historyVersions: [{ version: 'V1.0', updatedAt: item.updatedAt, note: '来自 Notion 同步' }],
    annotations: [],
    summary: item.summary,
    description: item.summary,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const queryNotionDatabase = async (options?: { filter?: Record<string, unknown> }): Promise<ReferenceKnowledgeItem[]> => {
  if (!import.meta.env.DEV) {
    throw new Error('生产环境未启用 Notion 代理，回退 mock。');
  }

  const fallbackDbId = toHyphenId(FALLBACK_DB_ID_RAW);
  const candidates = Array.from(new Set([getPrimaryDatabaseId(), fallbackDbId]));
  if (candidates.length === 0) throw new Error('Notion 数据库 ID 未配置。');

  let lastError = '';
  for (const databaseId of candidates) {
    const response = await fetch(`/notion-api/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 100,
        ...(options?.filter ? { filter: options.filter } : {}),
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as NotionQueryResponse;
      return data.results.map(mapNotionToKnowledge);
    }

    const text = await response.text();
    lastError = `${response.status} ${text}`;
  }

  throw new Error(`Notion 查询失败：${lastError}`);
};

export const notionService = {
  async queryModuleData<T>(module: AMLModule, params?: Record<string, unknown>) {
    if (module === 'policyKnowledge' || module === 'policy') {
      try {
        const knowledgeData = await queryNotionDatabase(
          module === 'policy'
            ? {
                filter: {
                  property: '文档类型',
                  select: { equals: '制度类' },
                },
              }
            : undefined,
        );

        if (module === 'policyKnowledge') {
          return {
            success: true,
            data: knowledgeData as T,
            message: 'policyKnowledge/query (notion)',
          };
        }

        const policyData = knowledgeData.map(mapKnowledgeToPolicy);
        return {
          success: true,
          data: policyData as T,
          message: 'policy/query (notion)',
        };
      } catch (error) {
        console.warn('[notionService] 使用真实 Notion 数据失败，回退 mock：', error);
      }
    }

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
