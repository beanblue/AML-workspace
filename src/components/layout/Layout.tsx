import { useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { AMLModule } from '../../types';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps extends PropsWithChildren {
  activeModule: AMLModule;
  onSelectModule: (module: AMLModule) => void;
}

const BREADCRUMB_MAP: Record<AMLModule, string[]> = {
  dashboard: ['总览 Dashboard', '全景总览'],
  policy: ['组织类', '制度与流程管理'],
  policyProcess: ['组织类', '制度与流程管理', '流程库'],
  policyKnowledge: ['组织类', '制度与流程管理', '参考知识库'],
  responsibility: ['组织类', '反洗钱工作职责管理'],
  committee: ['组织类', '反洗钱工作组织活动管理'],
  training: ['组织类', '培训管理'],
  publicity: ['组织类', '宣传管理'],
  assessment: ['组织类', '评估考核管理'],
  cdd: ['操作类', '客户身份识别 CDD/EDD'],
  risk: ['操作类', '洗钱风险管理'],
  str: ['操作类', 'STR 可疑交易报告'],
  largeTransaction: ['操作类', '大额交易管理'],
  otherOps: ['操作类', '其他操作类'],
  report: ['专项类', '报告报表'],
  rectification: ['专项类', '整改管理'],
};

export function Layout({ activeModule, onSelectModule, children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  const breadcrumb = useMemo(() => BREADCRUMB_MAP[activeModule], [activeModule]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        collapsed={collapsed}
        activeModule={activeModule}
        onToggle={() => setCollapsed((prev) => !prev)}
        onSelectModule={onSelectModule}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header breadcrumb={breadcrumb} />
        <main className="flex-1 p-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>
        </main>
      </div>
    </div>
  );
}
