// 统一业务类型定义：覆盖总览、组织类、操作类、专项类核心实体

export type ModuleCategory = 'dashboard' | 'org' | 'ops' | 'special';

export type EntityStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'archived'
  | 'pending'
  | 'completed'
  | 'overdue';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface TableQueryParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiResult<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface DashboardMetricCard {
  key: string;
  title: string;
  value: number;
  unit?: string;
  trend: number;
  color: 'blue' | 'green' | 'orange';
}

export interface DashboardOverview {
  metrics: DashboardMetricCard[];
  riskDistribution: Array<{ name: string; value: number }>;
  moduleProgress: Array<{ name: string; completed: number; pending: number }>;
}

export interface PolicyProcessItem extends BaseEntity {
  category: '制度' | '流程';
  code: string;
  name: string;
  sourceLevel: '监管层' | '总公司层' | '分公司层';
  issuingUnit: string;
  documentNo: string;
  ownerDepartment: string;
  version: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  effectiveDate: string;
  abolishedDate?: string;
  relatedRoles: string[];
  fullText: string;
  fileName?: string;
  historyVersions: Array<{
    version: string;
    updatedAt: string;
    note: string;
  }>;
  annotations: Array<{
    id: string;
    createdAt: string;
    content: string;
  }>;
  description?: string;
}

export interface ProcessStep {
  id: string;
  index: number;
  name: string;
  triggerCondition: string;
  ownerRole: string;
  sla: string;
  evidenceRequirement: string;
  note?: string;
}

export interface ProcessLibraryItem extends BaseEntity {
  processCode: string;
  processName: string;
  businessDomain: string;
  version: string;
  status: EntityStatus;
  updatedAt: string;
  steps: ProcessStep[];
}

export interface ReferenceKnowledgeItem extends BaseEntity {
  materialType: '图书' | '论文' | '监管报告' | '新闻资讯' | '观点文章' | '其他';
  title: string;
  sourceOrg: string;
  publishDate: string;
  summary: string;
  tags: string[];
  originLink?: string;
  attachmentName?: string;
  personalNote: string;
}

export interface ResponsibilityRole extends BaseEntity {
  roleName: string;
  responsibilities: string[];
  workStandard: string;
  selfAssessmentCriteria: string;
  appraisalCriteria: string;
  administrativePenaltyRiskTips: string[];
}

export interface CommitteeMeeting extends BaseEntity {
  title: string;
  meetingDate: string;
  topics: string[];
  minutes: string;
  actionItems: Array<{
    id: string;
    content: string;
    owner: string;
    dueDate: string;
    status: 'pending' | 'completed' | 'overdue';
  }>;
}

export interface TrainingTask extends BaseEntity {
  stage:
    | '需求收集'
    | '规划设计'
    | '课件制作'
    | '培训实施'
    | '痕迹留存'
    | '闭环改进';
  title: string;
  owner: string;
  deadline: string;
  status: EntityStatus;
}

export interface PublicityTask extends BaseEntity {
  planName: string;
  materialCount: number;
  executionDate: string;
  effectivenessScore: number;
  status: EntityStatus;
}

export interface AssessmentRecord extends BaseEntity {
  targetType: '部门' | '个人';
  targetName: string;
  period: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  reviewer: string;
}

export interface CDDCase extends BaseEntity {
  customerName: string;
  customerType: '个人' | '企业';
  level: 'CDD' | 'EDD';
  blacklistMatch: boolean;
  status: EntityStatus;
  lastReviewDate: string;
}

export interface AMLRiskProfile extends BaseEntity {
  customerName: string;
  riskScore: number;
  riskLevel: '低' | '中' | '高';
  factors: string[];
}

export interface STRCase extends BaseEntity {
  reportNo: string;
  customerName: string;
  submissionDate: string;
  status: 'draft' | 'pending' | 'completed';
  attachmentCount: number;
}

export interface LargeTransactionRecord extends BaseEntity {
  transactionNo: string;
  customerName: string;
  amount: number;
  currency: string;
  warningTriggered: boolean;
  status: EntityStatus;
  transactionDate: string;
}

export interface AMLReport extends BaseEntity {
  reportName: string;
  reportType: '周期性' | '触发性';
  dimension: '信息留存类' | '证据留存类';
  status: EntityStatus;
  generatedAt: string;
}

export interface RectificationTask extends BaseEntity {
  taskName: string;
  issueSource: string;
  owner: string;
  dueDate: string;
  progress: number;
  status: EntityStatus;
  evidenceCount: number;
}

export type AMLModule =
  | 'dashboard'
  | 'policy'
  | 'policyProcess'
  | 'policyKnowledge'
  | 'responsibility'
  | 'committee'
  | 'training'
  | 'publicity'
  | 'assessment'
  | 'cdd'
  | 'risk'
  | 'str'
  | 'largeTransaction'
  | 'otherOps'
  | 'report'
  | 'rectification';
