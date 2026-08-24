'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/ui/feedback';

/**
 * Average examination score by class.
 *
 * Colour is used as reinforcement, never as the sole carrier of meaning — the
 * value is printed in the tooltip and the axis is labelled, so the chart is
 * still readable in greyscale or by a colour-blind reader.
 */
export function ClassPerformanceChart({
  data,
}: {
  data: { name: string; average: number; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No results yet"
        description="Class averages appear once students start submitting examinations."
        className="border-0"
      />
    );
  }

  const barColour = (average: number) => {
    if (average >= 65) return 'var(--color-success-500)';
    if (average >= 40) return 'var(--color-brand-500)';
    return 'var(--color-danger-500)';
  };

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--line-soft)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--line-soft)' }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={56}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            unit="%"
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-sunken)' }}
            contentStyle={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--line-soft)',
              borderRadius: 12,
              fontSize: 12,
              color: 'var(--text-strong)',
            }}
            formatter={(value: number, _name, entry) => [
              `${value}% average over ${(entry.payload as { count: number }).count} result(s)`,
              'Performance',
            ]}
          />
          <Bar dataKey="average" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={barColour(entry.average)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Grade distribution for a single examination or class. */
export function GradeDistributionChart({
  data,
}: {
  data: { grade: string; count: number }[];
}) {
  if (data.every((row) => row.count === 0)) {
    return (
      <EmptyState
        title="No submissions yet"
        description="The grade spread appears once students have submitted."
        className="border-0"
      />
    );
  }

  const colours: Record<string, string> = {
    A: 'var(--color-success-600)',
    B: 'var(--color-success-500)',
    C: 'var(--color-brand-500)',
    D: 'var(--color-warn-500)',
    E: 'var(--color-warn-600)',
    F: 'var(--color-danger-500)',
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--line-soft)"
            vertical={false}
          />
          <XAxis
            dataKey="grade"
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--line-soft)' }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-sunken)' }}
            contentStyle={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--line-soft)',
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value} student(s)`, 'Count']}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((entry) => (
              <Cell
                key={entry.grade}
                fill={colours[entry.grade] ?? 'var(--color-brand-500)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
