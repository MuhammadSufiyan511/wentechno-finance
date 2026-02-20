import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#6B7280'];

const customTooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '12px',
  color: '#fff'
};

const formatRupees = (val) => {
  if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return val.toLocaleString();
};

export const RevenueBarChart = ({ data, title }) => (
  <div className="card">
    <h3 className="text-lg font-semibold text-white mb-4">{title || 'Revenue by Business Unit'}</h3>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatRupees} />
        <Tooltip contentStyle={customTooltipStyle} formatter={(val) => [`₨ ${val.toLocaleString()}`, 'Amount']} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data?.map((entry, idx) => (
            <Cell key={idx} fill={entry.color || COLORS[idx % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const TrendLineChart = ({ data, title }) => (
  <div className="card">
    <h3 className="text-lg font-semibold text-white mb-4">{title || 'Monthly Trends'}</h3>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month_name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatRupees} />
        <Tooltip contentStyle={customTooltipStyle} formatter={(val) => `₨ ${Number(val).toLocaleString()}`} />
        <Legend wrapperStyle={{ color: '#94a3b8' }} />
        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="profit" name="Profit" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export const ProfitAreaChart = ({ data, title }) => (
  <div className="card">
    <h3 className="text-lg font-semibold text-white mb-4">{title || 'Revenue vs Expenses'}</h3>
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month_name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatRupees} />
        <Tooltip contentStyle={customTooltipStyle} formatter={(val) => `₨ ${Number(val).toLocaleString()}`} />
        <Legend wrapperStyle={{ color: '#94a3b8' }} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} strokeWidth={2} />
        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const ExpensePieChart = ({ data, title }) => (
  <div className="card">
    <h3 className="text-lg font-semibold text-white mb-4">{title || 'Expense Breakdown'}</h3>
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="total"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={{ stroke: '#94a3b8' }}
        >
          {data?.map((entry, idx) => (
            <Cell key={idx} fill={entry.color || COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={customTooltipStyle} formatter={(val) => `₨ ${Number(val).toLocaleString()}`} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

export const ProfitComparisonChart = ({ data, title }) => (
  <div className="card">
    <h3 className="text-lg font-semibold text-white mb-4">{title || 'Profit by Business Unit'}</h3>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatRupees} />
        <Tooltip contentStyle={customTooltipStyle} formatter={(val) => `₨ ${Number(val).toLocaleString()}`} />
        <Legend wrapperStyle={{ color: '#94a3b8' }} />
        <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="profit" name="Profit" fill="#10B981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);