import { AlertTriangle, BarChart3, CheckCircle2, Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { notionService } from '../services/notionService';
import type { DashboardMetricCard, DashboardOverview } from '../types';

const COLOR_MAP = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
} as const;

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];
const TODAY_TODOS = [
  '复核高风险客户名单更新记录',
  '提交本周可疑交易分析简报',
  '完成制度修订会议纪要归档',
];

function TrendIcon({ trend }: { trend: number }) {
  if (trend > 0) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (trend < 0) return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <Clock3 className="h-4 w-4 text-slate-500" />;
}

function MetricCard({ metric }: { metric: DashboardMetricCard }) {
  return (
    <article className={`rounded-xl border p-4 ${COLOR_MAP[metric.color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs">{metric.title}</p>
          <p className="mt-2 text-2xl font-semibold">
            {metric.value}
            {metric.unit ? <span className="ml-1 text-sm font-medium">{metric.unit}</span> : null}
          </p>
        </div>
        <TrendIcon trend={metric.trend} />
      </div>
      <p className="mt-3 text-xs">
        同比
        <span className="mx-1 font-semibold">
          {metric.trend > 0 ? '+' : ''}
          {metric.trend}%
        </span>
      </p>
    </article>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await notionService.queryModuleData<DashboardOverview>('dashboard');
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载总览数据失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const hasData = useMemo(() => Boolean(data && data.metrics.length > 0), [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">正在加载总览数据...</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !hasData || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">总览数据加载失败</p>
        <p className="mt-1 text-sm">{error ?? '暂无可用数据，请稍后重试。'}</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">反洗钱工作全景总览</h2>
          <p className="mt-1 text-sm text-slate-500">组织类、操作类、专项类核心指标与进度概览</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          数据来源：Notion（Mock）
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">年度重点工作</h3>
          <p className="mt-2 text-sm text-slate-600">推进反洗钱制度体系标准化升级与落地。</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">月度重点工作</h3>
          <p className="mt-2 text-sm text-slate-600">完成重点客户风险重评与抽样复核。</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">本周重点工作</h3>
          <p className="mt-2 text-sm text-slate-600">组织 STR 线索复盘并更新流程留痕模板。</p>
        </article>
        <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900">今日待办</h3>
          <ul className="mt-2 space-y-1 text-sm text-blue-800">
            {TODAY_TODOS.map((todo) => (
              <li key={todo}>- {todo}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">风险等级分布</h3>
          <p className="mt-1 text-sm text-slate-500">低/中/高风险客户占比</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.riskDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.riskDistribution.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value ?? 0}%`, '占比']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">模块事项进展</h3>
          <p className="mt-1 text-sm text-slate-500">各模块已完成与待处理任务</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.moduleProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="completed" name="已完成" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pending" name="待处理" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </section>
  );
}
