import React from 'react';

const SummaryCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'blue', className = '', raw = false }) => {
  const colorMap = {
    blue: 'from-blue-500 to-blue-700',
    green: 'from-emerald-500 to-emerald-700',
    red: 'from-red-500 to-red-700',
    purple: 'from-violet-500 to-violet-700',
    amber: 'from-amber-500 to-amber-700',
    cyan: 'from-cyan-500 to-cyan-700',
    pink: 'from-pink-500 to-pink-700',
    gray: 'from-gray-500 to-gray-700'
  };

  const bgColorMap = {
    blue: 'bg-blue-500/10 border-blue-500/20',
    green: 'bg-emerald-500/10 border-emerald-500/20',
    red: 'bg-red-500/10 border-red-500/20',
    purple: 'bg-violet-500/10 border-violet-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
    cyan: 'bg-cyan-500/10 border-cyan-500/20',
    pink: 'bg-pink-500/10 border-pink-500/20',
    gray: 'bg-gray-500/10 border-gray-500/20'
  };

  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val >= 10000000) return `₨ ${(val / 10000000).toFixed(2)}Cr`;
      if (val >= 100000) return `₨ ${(val / 100000).toFixed(2)}L`;
      if (val >= 1000) return `₨ ${(val / 1000).toFixed(1)}K`;
      return `₨ ${val.toLocaleString()}`;
    }
    return val;
  };

  return (
    <div className={`card-hover ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-dark-400 font-medium">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-white mt-2">
            {raw ? value : (typeof value === 'number' ? formatValue(value) : value)}
          </p>
          {subtitle && <p className="text-sm text-dark-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <span>{trend >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trendValue || trend)}%</span>
              <span className="text-dark-500">vs last period</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl border ${bgColorMap[color]}`}>
            <Icon className={`w-6 h-6 bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}
              style={{ color: color === 'blue' ? '#3b82f6' : color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : color === 'purple' ? '#8b5cf6' : color === 'amber' ? '#f59e0b' : color === 'cyan' ? '#06b6d4' : color === 'pink' ? '#ec4899' : '#6b7280' }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryCard;