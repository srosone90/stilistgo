'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  color?: string;
  gradient?: string;
}

export default function KpiCard({ title, value, subValue, icon, trend, trendText, color = '#6366f1', gradient }: KpiCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : 'var(--muted)';

  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Gradient glow */}
      {gradient && (
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 pointer-events-none"
          style={{ background: gradient }}
        />
      )}

      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}
        >
          {icon}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium" style={{ color: trendColor }}>
            <TrendIcon size={13} />
            <span>{trendText}</span>
          </div>
        )}
      </div>

      <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>{title}</p>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {subValue && (
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{subValue}</p>
      )}
    </div>
  );
}
