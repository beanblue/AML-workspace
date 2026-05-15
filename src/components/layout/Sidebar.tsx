import {
  BarChart3,
  Briefcase,
  FolderOpen,
  ClipboardList,
  FileBarChart2,
  FileSearch,
  Flag,
  Handshake,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Star,
  UserCheck,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { AMLModule } from '../../types';

type ModuleGroup = 'dashboard' | 'org' | 'ops' | 'special';

interface SidebarModuleItem {
  module: AMLModule;
  label: string;
  features: string[];
  icon: ComponentType<{ className?: string }>;
}

interface SidebarGroup {
  key: ModuleGroup;
  label: string;
  colorClass: string;
  modules: SidebarModuleItem[];
}

interface SidebarProps {
  collapsed: boolean;
  activeModule: AMLModule;
  onToggle: () => void;
  onSelectModule: (module: AMLModule) => void;
}

const NAV_GROUPS: SidebarGroup[] = [
  {
    key: 'dashboard',
    label: '总览 Dashboard',
    colorClass: 'text-slate-700',
    modules: [
      {
        module: 'dashboard',
        label: '全景总览',
        features: ['指标卡片', '风险分布', '模块进展'],
        icon: BarChart3,
      },
    ],
  },
  {
    key: 'org',
    label: '组织类',
    colorClass: 'text-blue-700',
    modules: [
      {
        module: 'policy',
        label: '资料库',
        features: ['统一列表', '高级搜索', '导入导出'],
        icon: FolderOpen,
      },
      {
        module: 'policyFavorites',
        label: '⭐ 我的收藏',
        features: ['收藏列表', '快速筛选'],
        icon: Star,
      },
      {
        module: 'responsibility',
        label: '工作职责管理',
        features: ['岗位职责清单', '工作标准', '风险提示'],
        icon: Briefcase,
      },
      {
        module: 'committee',
        label: '组织活动管理',
        features: ['组织架构', '会议纪要', '行动项跟踪'],
        icon: Users,
      },
      {
        module: 'training',
        label: '培训管理',
        features: ['流程看板', '课件归档', '闭环改进'],
        icon: ClipboardList,
      },
      {
        module: 'publicity',
        label: '宣传管理',
        features: ['宣传计划', '材料库', '效果评估'],
        icon: Megaphone,
      },
      {
        module: 'assessment',
        label: '评估考核管理',
        features: ['部门/个人双 Tab', '评分表格', '趋势图'],
        icon: UserCheck,
      },
    ],
  },
  {
    key: 'ops',
    label: '操作类',
    colorClass: 'text-emerald-700',
    modules: [
      {
        module: 'cdd',
        label: '客户身份识别 CDD/EDD',
        features: ['标准尽调', '增强尽调', '黑名单预警'],
        icon: ShieldCheck,
      },
      {
        module: 'risk',
        label: '洗钱风险管理',
        features: ['风险评级', '评分输入输出', '分布图表'],
        icon: FileSearch,
      },
      {
        module: 'str',
        label: 'STR 可疑交易报告',
        features: ['提交流程', '状态追踪', '证据附件'],
        icon: Flag,
      },
      {
        module: 'largeTransaction',
        label: '大额交易管理',
        features: ['阈值预警', '交易列表', '归档管理'],
        icon: Handshake,
      },
      {
        module: 'otherOps',
        label: '其他操作类',
        features: ['扩展预留', '流程视图', '内容视图'],
        icon: FileBarChart2,
      },
    ],
  },
  {
    key: 'special',
    label: '专项类',
    colorClass: 'text-orange-700',
    modules: [
      {
        module: 'report',
        label: '报告报表',
        features: ['周期性/触发性', '留痕下载', '类型标签'],
        icon: FileBarChart2,
      },
      {
        module: 'rectification',
        label: '整改管理',
        features: ['整改任务', '进度看板', '证据归档'],
        icon: ClipboardList,
      },
    ],
  },
];

export function Sidebar({
  collapsed,
  activeModule,
  onToggle,
  onSelectModule,
}: SidebarProps) {
  return (
    <aside
      className={`h-screen border-r border-slate-200 bg-white transition-all duration-200 ${
        collapsed ? 'w-20' : 'w-80'
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
        {!collapsed ? (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-slate-900">反洗钱个人工作管理平台</p>
            <p className="text-xs text-slate-500">AML Personal Workspace</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <section key={group.key} className="mb-5">
            <p className={`mb-2 px-2 text-xs font-semibold ${group.colorClass}`}>
              {collapsed ? group.label.slice(0, 2) : group.label}
            </p>

            <div className="space-y-2">
              {group.modules.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.module;

                return (
                  <button
                    key={item.module}
                    type="button"
                    onClick={() => onSelectModule(item.module)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      isActive
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
                      {!collapsed ? (
                        <span
                          className={`text-sm font-medium ${isActive ? 'text-blue-900' : 'text-slate-800'}`}
                        >
                          {item.label}
                        </span>
                      ) : null}
                    </div>

                    {!collapsed ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.features.map((feature) => (
                          <span
                            key={feature}
                            className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-500"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
