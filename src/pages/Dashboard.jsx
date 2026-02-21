import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import { RevenueBarChart, TrendLineChart, ExpensePieChart, ProfitComparisonChart, ProfitAreaChart } from '../components/charts/Charts';
import DataTable, { CurrencyCell } from '../components/tables/DataTable';
import { HiOutlineCurrencyDollar, HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineCash, HiOutlineChartBar, HiOutlineReceiptRefund, HiOutlineCalendar, HiOutlineSearch, HiOutlineRefresh } from 'react-icons/hi';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Global Filters from URL
  const startDate = searchParams.get('start') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0];
  const searchTerm = searchParams.get('q') || '';

  const updateFilters = (newFilters) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    setSearchParams(params);
  };

  useEffect(() => {
    loadDashboard();
  }, [startDate, endDate]); // Reload when date filters change

  const loadDashboard = async () => {
    try {
      setError('');
      // In a real app, we'd pass { startDate, endDate, searchTerm } to API
      const res = await dashboardAPI.getOverview({ start: startDate, end: endDate, q: searchTerm });
      setData(res.data.data);
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to load dashboard data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-white">Dashboard unavailable</h2>
        <p className="text-dark-400 mt-2">
          {error || 'Could not load dashboard data from the backend.'}
        </p>
        <button
          onClick={() => {
            setLoading(true);
            loadDashboard();
          }}
          className="btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }
  const { summary, revenueByUnit, expenseBreakdown, monthlyTrends, profitByUnit, recentTransactions } = data;

  const transactionColumns = [
    {
      header: 'Type', key: 'type', render: (val) => (
        <span className={`badge ${val === 'income' ? 'badge-success' : 'badge-danger'}`}>
          {val === 'income' ? '↑ Income' : '↓ Expense'}
        </span>
      )
    },
    { header: 'Category', key: 'category' },
    { header: 'Business Unit', key: 'business_unit' },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Date', key: 'date', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">CEO Dashboard</h1>
          <p className="text-dark-400 mt-1">Complete financial overview across all business units</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => updateFilters({ q: e.target.value })}
              className="input pl-10 w-48 md:w-64"
            />
          </div>
          <div className="flex items-center gap-2 bg-dark-800 rounded-lg p-1 border border-dark-700">
            <div className="flex items-center gap-2 px-2 text-dark-400 border-r border-dark-700 mr-1">
              <HiOutlineCalendar className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Range</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => updateFilters({ start: e.target.value })}
              className="bg-transparent text-white text-xs outline-none cursor-pointer"
            />
            <span className="text-dark-500 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => updateFilters({ end: e.target.value })}
              className="bg-transparent text-white text-xs outline-none cursor-pointer"
            />
          </div>
          <button onClick={loadDashboard} className="p-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors border border-dark-700">
            <HiOutlineRefresh className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards - Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Revenue (Yearly)"
          value={summary.revenue.yearly}
          subtitle={`Monthly: ₨ ${summary.revenue.monthly.toLocaleString()}`}
          icon={HiOutlineCurrencyDollar}
          color="blue"
          trend={summary.growthRate}
        />
        <SummaryCard
          title="Total Expenses (Yearly)"
          value={summary.expenses.yearly}
          subtitle={`Monthly: ₨ ${summary.expenses.monthly.toLocaleString()}`}
          icon={HiOutlineTrendingDown}
          color="red"
        />
        <SummaryCard
          title="Net Profit"
          value={summary.netProfit}
          subtitle={`Margin: ${summary.profitMargin}%`}
          icon={HiOutlineTrendingUp}
          color="green"
        />
        <SummaryCard
          title="Cash Flow"
          value={summary.cashFlow}
          subtitle={`Pending: ₨ ${summary.pendingReceivables.toLocaleString()}`}
          icon={HiOutlineCash}
          color="purple"
        />
      </div>

      {/* Summary Cards - Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Daily Revenue" value={summary.revenue.daily} icon={HiOutlineChartBar} color="cyan" />
        <SummaryCard title="Daily Expenses" value={summary.expenses.daily} icon={HiOutlineReceiptRefund} color="amber" />
        <SummaryCard title="Profit Margin" value={`${summary.profitMargin}%`} icon={HiOutlineTrendingUp} color="green" />
        <SummaryCard title="Growth Rate" value={`${summary.growthRate}%`} icon={HiOutlineTrendingUp} color="purple" trend={summary.growthRate} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendLineChart data={monthlyTrends} title="Monthly Revenue, Expenses & Profit Trends" />
        <ProfitAreaChart data={monthlyTrends} title="Revenue vs Expenses Over Time" />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueBarChart data={revenueByUnit} title="Revenue by Business Unit" />
        <ExpensePieChart data={expenseBreakdown} title="Expense Distribution" />
      </div>

      {/* Profit Comparison */}
      <ProfitComparisonChart data={profitByUnit} title="Profit/Loss Comparison by Business Unit" />

      {/* Recent Transactions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
        <DataTable columns={transactionColumns} data={recentTransactions} />
      </div>
    </div>
  );
};

export default Dashboard;
