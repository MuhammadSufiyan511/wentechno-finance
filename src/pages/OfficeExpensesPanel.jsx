import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { officeAPI, opsAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import {
  HiOutlineOfficeBuilding, HiOutlineLockClosed, HiOutlineRefresh,
  HiOutlinePlus, HiOutlineTrash, HiOutlineCash,
  HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineDocumentReport,
  HiOutlineUserGroup, HiOutlineTemplate, HiOutlineLightningBolt,
  HiOutlineDownload
} from 'react-icons/hi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, AreaChart, Area,
  PieChart, Pie
} from 'recharts';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'assets', label: 'Assets' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'travel', label: 'Travel' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'supplies', label: 'Office Supplies' },
  { value: 'tax', label: 'Tax/Legal' },
  { value: 'other', label: 'Other' }
];
const BUDGET_CATEGORIES = [...EXPENSE_CATEGORIES, { value: 'salaries', label: 'Salaries' }];

const OfficeExpensesPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedTabs = ['overview', 'expenses', 'approvals', 'vendors', 'budgets', 'salaries', 'reports'];
  const currentTab = searchParams.get('tab') || 'overview';
  const activeTab = allowedTabs.includes(currentTab) ? currentTab : 'overview';

  const [data, setData] = useState({
    overview: null,
    expenses: [],
    salaries: [],
    vendors: [],
    approvals: [],
    recurring: [],
    budgets: [],
    budgetHistory: [],
    budgetPeriodStatus: null,
    pos: [],
    reportSummary: null
  });

  const [filters, setFilters] = useState({
    month: format(new Date(), 'MMMM'),
    year: new Date().getFullYear(),
    category: '',
    status: '',
    search: ''
  });

  const [showModal, setShowModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({});
  const [historyCategory, setHistoryCategory] = useState('');
  const [reportFilters, setReportFilters] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab, filters.month, filters.year, reportFilters.from, reportFilters.to]);

  useEffect(() => {
    if (activeTab !== 'overview') return undefined;
    const intervalId = setInterval(() => loadTabContent('overview'), 30000);
    return () => clearInterval(intervalId);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'budgets') return;
    const categories = Array.from(new Set((data.budgetHistory || []).map(row => row.category))).filter(Boolean);
    if (!categories.length) {
      setHistoryCategory('');
      return;
    }
    if (!historyCategory || !categories.includes(historyCategory)) {
      setHistoryCategory(categories[0]);
    }
  }, [activeTab, data.budgetHistory, historyCategory]);

  const loadTabContent = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await officeAPI.getOverview();
        setData(prev => ({ ...prev, overview: res.data.data }));
      } else if (tab === 'expenses') {
        const res = await officeAPI.getExpenses(filters);
        setData(prev => ({ ...prev, expenses: res.data.data }));
      } else if (tab === 'salaries') {
        const res = await officeAPI.getSalaries(filters);
        setData(prev => ({ ...prev, salaries: res.data.data }));
      } else if (tab === 'vendors') {
        const res = await opsAPI.getVendors();
        setData(prev => ({ ...prev, vendors: res.data.data }));
      } else if (tab === 'approvals') {
        const res = await officeAPI.getApprovals();
        setData(prev => ({ ...prev, approvals: res.data.data }));
      } else if (tab === 'recurring') {
        const res = await officeAPI.getRecurringExpenses();
        setData(prev => ({ ...prev, recurring: res.data.data }));
      } else if (tab === 'budgets') {
        const [budgetRes, historyRes, periodRes] = await Promise.all([
          officeAPI.getBudgets(filters),
          officeAPI.getBudgetHistory({ ...filters, months: 6 }),
          officeAPI.getBudgetPeriodStatus(filters)
        ]);
        setData(prev => ({
          ...prev,
          budgets: budgetRes.data.data || [],
          budgetHistory: historyRes.data?.data?.rows || [],
          budgetPeriodStatus: periodRes.data?.data || null
        }));
      } else if (tab === 'reports') {
        const res = await officeAPI.getReportSummary({ ...filters, ...reportFilters });
        setData(prev => ({ ...prev, reportSummary: res.data.data }));
      }
    } catch (error) {
      toast.error(`Failed to load ${tab} data`);
    } finally {
      setLoading(false);
    }
  };

  const loadData = () => loadTabContent(activeTab);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setProcessing(true);
      if (showModal === 'expense') {
        if (form.id) await officeAPI.updateExpense(form.id, form);
        else await officeAPI.createExpense(form);
      } else if (showModal === 'salary') {
        if (form.id) await officeAPI.updateSalary(form.id, form);
        else await officeAPI.createSalary(form);
      } else if (showModal === 'vendor') {
        if (form.id) await opsAPI.updateVendor(form.id, form);
        else await opsAPI.createVendor(form);
      } else if (showModal === 'budget') {
        await officeAPI.saveBudget({
          category: form.category,
          planned_amount: Number(form.planned_amount),
          month: form.month,
          year: Number(form.year),
          notes: form.notes || null
        });
      } else if (showModal === 'recurring') {
        if (form.id) await officeAPI.updateRecurringExpense(form.id, form);
        else await officeAPI.saveRecurringExpense(form);
      }

      toast.success('Successfully saved');
      setShowModal(null);
      setForm({});
      loadTabContent(activeTab);
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Operation failed');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await officeAPI.deleteExpense(id);
      toast.success('Expense deleted');
      loadTabContent('expenses');
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const handleDeleteVendor = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    try {
      await opsAPI.deleteVendor(id);
      toast.success('Vendor deleted');
      loadTabContent('vendors');
    } catch (error) {
      toast.error('Failed to delete vendor');
    }
  };

  const handleApprovalAction = async (id, action) => {
    try {
      setProcessing(true);
      await officeAPI.bulkActionApprovals({ ids: [id], action });
      toast.success(`Expense ${action}`);
      loadTabContent('approvals');
    } catch (error) {
      toast.error('Failed to update approval');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteRecurring = async (id) => {
    if (!window.confirm('Delete this recurring rule?')) return;
    try {
      await officeAPI.deleteRecurringExpense(id);
      toast.success('Rule deleted');
      loadTabContent('recurring');
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDeleteBudget = async (id) => {
    if (data.budgetPeriodStatus?.closed) {
      toast.error('This period is closed. Budget edits are locked.');
      return;
    }
    if (!window.confirm('Delete this budget line?')) return;
    try {
      setProcessing(true);
      await officeAPI.deleteBudget(id);
      toast.success('Budget deleted');
      loadTabContent('budgets');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete budget');
    } finally {
      setProcessing(false);
    }
  };

  const handleRollForwardBudgets = async () => {
    if (data.budgetPeriodStatus?.closed) {
      toast.error('This period is closed. Budget edits are locked.');
      return;
    }
    if (!window.confirm(`Copy last month's budget into ${filters.month} ${filters.year}?`)) return;
    try {
      setProcessing(true);
      const res = await officeAPI.rollForwardBudgets({
        month: filters.month,
        year: Number(filters.year),
        overwrite: false
      });
      toast.success(res.data?.message || 'Budgets rolled forward');
      loadTabContent('budgets');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Roll-forward failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportBudgets = async () => {
    try {
      setProcessing(true);
      const res = await officeAPI.exportBudgets(filters);
      const monthIndex = MONTHS.findIndex(m => m === filters.month) + 1;
      const safeMonth = String(monthIndex || 0).padStart(2, '0');
      downloadBlob(res.data, `office-budgets-${filters.year}-${safeMonth}.csv`);
      toast.success('Budget CSV exported');
    } catch (error) {
      toast.error('Budget export failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportReports = async () => {
    try {
      setProcessing(true);
      const res = await officeAPI.exportCSV({ ...filters, ...reportFilters });
      const suffix = reportFilters.from && reportFilters.to
        ? `${reportFilters.from}_to_${reportFilters.to}`
        : `${filters.year}-${String((MONTHS.findIndex(m => m === filters.month) || 0) + 1).padStart(2, '0')}`;
      downloadBlob(res.data, `office-expenses-report-${suffix}.csv`);
      toast.success('Report CSV exported');
    } catch (error) {
      toast.error('Report export failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportReportsPDF = async () => {
    try {
      setProcessing(true);
      const res = await officeAPI.exportReportPDF({ ...filters, ...reportFilters });
      const suffix = reportFilters.from && reportFilters.to
        ? `${reportFilters.from}_to_${reportFilters.to}`
        : `${filters.year}-${String((MONTHS.findIndex(m => m === filters.month) || 0) + 1).padStart(2, '0')}`;
      downloadBlob(res.data, `office-expenses-report-${suffix}.pdf`);
      toast.success('Report PDF exported');
    } catch (error) {
      toast.error('Report PDF export failed');
    } finally {
      setProcessing(false);
    }
  };

  const setReportPreset = (preset) => {
    const now = new Date();
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (preset === 'thisMonth') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setReportFilters({ from: formatDate(from), to: formatDate(to) });
      return;
    }
    if (preset === 'lastMonth') {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      setReportFilters({ from: formatDate(from), to: formatDate(to) });
      return;
    }
    if (preset === 'ytd') {
      const from = new Date(now.getFullYear(), 0, 1);
      setReportFilters({ from: formatDate(from), to: formatDate(now) });
      return;
    }
    setReportFilters({ from: '', to: '' });
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all office data to sample?')) return;
    try {
      setProcessing(true);
      await officeAPI.resetPanel();
      toast.success('Panel reset successful');
      loadData();
    } catch (error) {
      toast.error('Reset failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSeed = async () => {
    try {
      setProcessing(true);
      await officeAPI.seedSample();
      toast.success('Sample data seeded');
      loadData();
    } catch (error) {
      toast.error('Seeding failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  const expenseColumns = [
    {
      header: 'Category',
      key: 'category',
      render: (val, row) => (
        <div>
          <span className="font-medium text-white capitalize">{val}</span>
          <p className="text-xs text-dark-400">{row.sub_category}</p>
        </div>
      )
    },
    { header: 'Vendor', key: 'vendor', render: (val) => val || '-' },
    { header: 'Type', key: 'expense_type', render: (val) => <span className={`badge-${val === 'fixed' ? 'purple' : 'info'} capitalize`}>{val}</span> },
    { header: 'Description', key: 'description' },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Date', key: 'date', render: (val) => format(new Date(val), 'MMM dd, yyyy') },
    { header: 'Approval', key: 'approval_status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Actions', key: 'id', render: (val, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowModal('expense');
              setForm({
                ...row,
                date: row?.date ? String(row.date).slice(0, 10) : ''
              });
            }}
            className="text-blue-400 hover:text-blue-300"
          >
            <HiOutlinePlus className="w-5 h-5 rotate-45" title="Edit Expense" />
          </button>
          <button onClick={() => handleDeleteExpense(val)} className="text-red-400 hover:text-red-300">
            <HiOutlineTrash className="w-5 h-5" />
          </button>
        </div>
      )
    },
  ];

  const vendorColumns = [
    { header: 'Name', key: 'name', render: (val) => <span className="font-medium text-white">{val}</span> },
    { header: 'Contact', key: 'contact_person' },
    { header: 'Category', key: 'category', render: (val) => <span className="badge-info capitalize">{val}</span> },
    { header: 'Email', key: 'email' },
    { header: 'Phone', key: 'phone' },
    {
      header: 'Actions', key: 'id', render: (val, row) => (
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('vendor'); setForm(row); }} className="text-blue-400 hover:text-blue-300">
            <HiOutlinePlus className="w-5 h-5 rotate-45" title="Edit" />
          </button>
          <button onClick={() => handleDeleteVendor(val)} className="text-red-400 hover:text-red-300">
            <HiOutlineTrash className="w-5 h-5" />
          </button>
        </div>
      )
    },
  ];

  const approvalColumns = [
    {
      header: 'Expense', key: 'description', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">{row.category}</p></div>
      )
    },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Date', key: 'date', render: (val) => format(new Date(val), 'MMM dd, yyyy') },
    { header: 'Status', key: 'approval_status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Actions', key: 'id', render: (val) => (
        <div className="flex gap-2">
          <button onClick={() => handleApprovalAction(val, 'approved')} className="text-green-400 hover:text-green-300">
            <HiOutlineCheckCircle className="w-6 h-6" />
          </button>
          <button onClick={() => handleApprovalAction(val, 'rejected')} className="text-red-400 hover:text-red-300">
            <HiOutlineXCircle className="w-6 h-6" />
          </button>
        </div>
      )
    },
  ];

  const recurringColumns = [
    { header: 'Description', key: 'description', render: (val) => <span className="font-medium text-white">{val}</span> },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Interval', key: 'interval_days', render: (val) => `Every ${val} days` },
    { header: 'Last Run', key: 'last_run_date', render: (val) => val ? format(new Date(val), 'MMM dd, yyyy') : 'Never' },
    { header: 'Next Run', key: 'next_run_date', render: (val) => format(new Date(val), 'MMM dd, yyyy') },
    {
      header: 'Actions', key: 'id', render: (val, row) => (
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('recurring'); setForm(row); }} className="text-amber-400 hover:text-amber-300">
            <HiOutlineLightningBolt className="w-5 h-5" />
          </button>
          <button onClick={() => handleDeleteRecurring(val)} className="text-red-400 hover:text-red-300">
            <HiOutlineTrash className="w-5 h-5" />
          </button>
        </div>
      )
    },
  ];

  const budgetColumns = [
    { header: 'Category', key: 'category', render: (val) => <span className="font-medium text-white capitalize">{val}</span> },
    { header: 'Planned', key: 'planned_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Actual', key: 'actual_amount', render: (val) => <CurrencyCell value={val} /> },
    {
      header: 'Variance', key: 'variance', render: (val, row) => {
        const variance = Number(row.planned_amount || 0) - Number(row.actual_amount || 0);
        return <span className={variance >= 0 ? 'text-green-400' : 'text-red-400'}><CurrencyCell value={variance} /></span>
      }
    },
    {
      header: 'Utilization', key: 'utilization_percent', render: (val) => (
        <div>
          <div className="w-full bg-dark-700 rounded-full h-2 mt-1">
            <div className={`h-2 rounded-full ${val > 100 ? 'bg-red-500' : val > 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(Number(val) || 0, 100)}%` }}></div>
          </div>
          <p className="text-xs text-dark-400 mt-1">{Number(val || 0).toFixed(1)}%</p>
        </div>
      )
    },
    {
      header: 'Actions', key: 'id', render: (val, row) => (
        <div className="flex gap-2">
          <button
            disabled={data.budgetPeriodStatus?.closed}
            onClick={() => {
              setShowModal('budget');
              setForm({
                id: row.id,
                category: row.category,
                planned_amount: row.planned_amount,
                month: MONTHS[Number(row.month) - 1] || filters.month,
                year: row.year,
                notes: row.notes || ''
              });
            }}
            className="text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <HiOutlinePlus className="w-5 h-5 rotate-45" title="Edit Budget" />
          </button>
          <button
            disabled={data.budgetPeriodStatus?.closed}
            onClick={() => handleDeleteBudget(val)}
            className="text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <HiOutlineTrash className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  const salaryColumns = [
    {
      header: 'Employee', key: 'employee_name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">{row.designation}</p></div>
      )
    },
    { header: 'Base', key: 'base_salary', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Bonus', key: 'bonus', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Deductions', key: 'deductions', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Net Salary', key: 'net_salary', render: (val) => <div className="font-bold text-primary-400"><CurrencyCell value={val} /></div> },
    { header: 'Month', key: 'month', render: (val, row) => `${val} ${row.year}` },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button onClick={() => { setForm(row); setShowModal('salary'); }} className="p-1 hover:text-white"><HiOutlinePlus className="w-4 h-4 rotate-45" title="Edit" /></button>
        </div>
      )
    }
  ];

  const reportTopColumns = [
    { header: 'Date', key: 'date', render: (val) => format(new Date(val), 'MMM dd, yyyy') },
    { header: 'Category', key: 'category', render: (val) => <span className="capitalize">{val}</span> },
    { header: 'Vendor', key: 'vendor', render: (val) => val || 'Unassigned' },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Status', key: 'approval_status', render: (val) => <StatusBadge status={val} /> },
    { header: 'Description', key: 'description' }
  ];

  const overviewCategoryData = (data.overview?.categoryBreakdown || [])
    .map(c => ({
      category: c.category,
      total: Number(c.total || 0)
    }))
    .filter(c => c.total > 0);

  const budgetTotals = (data.budgets || []).reduce((acc, row) => {
    acc.planned += Number(row.planned_amount || 0);
    acc.actual += Number(row.actual_amount || 0);
    return acc;
  }, { planned: 0, actual: 0 });
  const budgetVarianceTotal = budgetTotals.planned - budgetTotals.actual;
  const budgetUtilizationTotal = budgetTotals.planned > 0 ? (budgetTotals.actual / budgetTotals.planned) * 100 : 0;
  const overBudgetItems = (data.budgets || [])
    .filter(row => Number(row.actual_amount || 0) > Number(row.planned_amount || 0))
    .sort((a, b) => (Number(b.actual_amount || 0) - Number(b.planned_amount || 0)) - (Number(a.actual_amount || 0) - Number(a.planned_amount || 0)));

  const budgetHistoryCategories = Array.from(new Set((data.budgetHistory || []).map(row => row.category))).filter(Boolean);
  const activeHistoryCategory = historyCategory || budgetHistoryCategories[0] || '';
  const budgetHistoryTrend = (data.budgetHistory || [])
    .filter(row => row.category === activeHistoryCategory)
    .map(row => ({
      label: row.period_label,
      planned: Number(row.planned_amount || 0),
      actual: Number(row.actual_amount || 0)
    }));

  const reportSummary = data.reportSummary || null;
  const reportByCategory = reportSummary?.byCategory || [];
  const reportByVendor = (reportSummary?.byVendor || []).slice(0, 8);
  const reportTrend = reportSummary?.monthlyTrend || [];
  const reportTopExpenses = reportSummary?.topExpenses || [];
  const reportApprovalBreakdown = Object.entries(reportSummary?.approvals || {})
    .map(([status, count]) => ({ status, count: Number(count || 0) }))
    .filter(item => item.count > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HiOutlineOfficeBuilding className="text-primary-500" />
            Office & General Operations
          </h1>
          <p className="text-dark-400 mt-1">Full operational expense management, procurement, and payroll</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeTab === 'expenses' && (
            <button onClick={() => { setShowModal('expense'); setForm({ expense_type: 'variable', date: new Date().toISOString().split('T')[0] }); }} className="btn-primary">
              <HiOutlinePlus className="w-4 h-4" /> Add Expense
            </button>
          )}
          {activeTab === 'vendors' && (
            <button onClick={() => { setShowModal('vendor'); setForm({}); }} className="btn-primary">
              <HiOutlinePlus className="w-4 h-4" /> Add Vendor
            </button>
          )}
          {activeTab === 'salaries' && (
            <button onClick={() => { setShowModal('salary'); setForm({ business_unit_id: 6, status: 'paid', year: new Date().getFullYear(), month: format(new Date(), 'MMMM') }); }} className="btn-success">
              <HiOutlineCash className="w-4 h-4" /> Record Salary
            </button>
          )}
          {activeTab === 'budgets' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setShowModal('budget');
                  setForm({ category: '', planned_amount: '', month: filters.month, year: Number(filters.year), notes: '' });
                }}
                disabled={data.budgetPeriodStatus?.closed}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <HiOutlinePlus className="w-4 h-4" /> Add Budget
              </button>
              <button
                onClick={handleRollForwardBudgets}
                disabled={processing || data.budgetPeriodStatus?.closed}
                className="btn-secondary"
              >
                <HiOutlineRefresh className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} /> Roll Forward
              </button>
              <button onClick={handleExportBudgets} disabled={processing} className="btn-success-outline">
                <HiOutlineDownload className="w-4 h-4" /> Export Budget CSV
              </button>
            </div>
          )}
          {activeTab === 'overview' && (
            <div className="flex gap-2">
              <button onClick={handleReset} disabled={processing} className="btn-danger-outline">
                <HiOutlineTrash className="w-4 h-4" /> Reset Data
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Filters (Visible for relevant tabs) */}
      {['expenses', 'budgets', 'salaries', 'reports'].includes(activeTab) && (
        <div className="flex flex-wrap gap-4 bg-dark-800/50 p-4 rounded-xl border border-dark-700">
          <div className="flex items-center gap-2 min-w-[150px]">
            <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Month</label>
            <select className="select-sm text-gray-700" value={filters.month} onChange={e => setFilters({ ...filters, month: e.target.value })}>
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Year</label>
            <input type="number" className="input-sm text-gray-700 w-24" value={filters.year} onChange={e => setFilters({ ...filters, year: e.target.value })} />
          </div>
          <div className="flex-1"></div>
          {activeTab === 'reports' && (
            <div className="flex gap-2">
              <button onClick={handleExportReports} className="btn-success-outline btn-sm" disabled={processing}>
                <HiOutlineDownload className="w-4 h-4" /> Export CSV
              </button>
              <button onClick={handleExportReportsPDF} className="btn-secondary btn-sm" disabled={processing}>
                <HiOutlineDocumentReport className="w-4 h-4" /> Export PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overview Cards (Always show context if not in submodules) */}
      {activeTab === 'overview' && data.overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Monthly Burn" value={Number(data.overview.totalMonthly || 0)} icon={HiOutlineLightningBolt} color="red" trend={Number(data.overview.burnTrendPercent || 0)} />
          <SummaryCard title="Fixed Costs" value={data.overview.fixedCosts} icon={HiOutlineLockClosed} color="purple" subtitle="Rent, Net, etc." />
          <SummaryCard title="Payroll" value={data.overview.totalSalaries} icon={HiOutlineCash} color="green" subtitle={`${data.overview.employeeCount || 0} Employees`} />
          <SummaryCard title="Approved %" value={`${Number(data.overview.approvalRate || 0)}%`} raw icon={HiOutlineCheckCircle} color="blue" subtitle="Expense Compliance" />
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto thin-scrollbar">
        {[
          { id: 'overview', icon: HiOutlineOfficeBuilding },
          { id: 'expenses', icon: HiOutlineTemplate },
          { id: 'approvals', icon: HiOutlineCheckCircle },
          { id: 'vendors', icon: HiOutlineUserGroup },
          { id: 'budgets', icon: HiOutlineCash },
          { id: 'salaries', icon: HiOutlineCash },
          { id: 'reports', icon: HiOutlineDocumentReport },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSearchParams({ tab: tab.id })}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-all
              ${activeTab === tab.id ? 'bg-primary-600 text-white shadow-lg' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.id}
          </button>
        ))}
      </div>

      {/* Tab Content Rendering */}
      <div className="space-y-6">
        {activeTab === 'overview' && data.overview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card h-96">
              <h3 className="text-lg font-semibold text-white mb-6">Cash Burn Trend (L6M)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.overview.burnTrend || []}>
                  <defs>
                    <linearGradient id="colorBurn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₨${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(val) => [`₨${val.toLocaleString()}`, 'Expenses']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorBurn)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card h-96">
              <h3 className="text-lg font-semibold text-white mb-6">Expense Distribution</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overviewCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="total"
                    nameKey="category"
                  >
                    {overviewCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(val) => `₨${val.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {overviewCategoryData.slice(0, 4).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-xs text-dark-400 capitalize">{c.category}: </span>
                    <span className="text-xs font-semibold text-white">₨{Number(c.total || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white capitalize">General Expenses</h3>
                <span className="text-xs text-dark-400">{data.expenses.length} Records found</span>
              </div>
              <DataTable columns={expenseColumns} data={data.expenses} />
            </div>
          )}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Pending Approvals</h3>
                <div className="flex gap-2">
                  <button onClick={() => loadTabContent('approvals')} className="btn-secondary btn-sm"><HiOutlineRefresh /></button>
                </div>
              </div>
              <DataTable columns={approvalColumns} data={data.approvals} />
            </div>
          )}
          {activeTab === 'vendors' && <DataTable columns={vendorColumns} data={data.vendors} />}
          {activeTab === 'budgets' && (
            <div className="space-y-6">
              {data.budgetPeriodStatus?.closed && (
                <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/10">
                  <p className="text-amber-200 font-medium flex items-center gap-2">
                    <HiOutlineLockClosed className="w-5 h-5" />
                    Period Locked: {data.budgetPeriodStatus.month_name} {data.budgetPeriodStatus.year}
                  </p>
                  <p className="text-xs text-amber-100/80 mt-1">Budget changes are disabled for closed periods.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title="Total Planned" value={budgetTotals.planned} icon={HiOutlineCash} color="blue" />
                <SummaryCard title="Total Actual" value={budgetTotals.actual} icon={HiOutlineLightningBolt} color="amber" />
                <SummaryCard title="Total Variance" value={budgetVarianceTotal} icon={HiOutlineDocumentReport} color={budgetVarianceTotal >= 0 ? 'green' : 'red'} />
                <SummaryCard title="Utilization" value={`${budgetUtilizationTotal.toFixed(1)}%`} raw icon={HiOutlineTemplate} color={budgetUtilizationTotal > 100 ? 'red' : budgetUtilizationTotal > 80 ? 'amber' : 'green'} />
              </div>

              <div className="p-4 rounded-lg border border-dark-700 bg-dark-700/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white uppercase tracking-wide">Over-Budget Alerts</h4>
                  <span className={`text-xs ${overBudgetItems.length ? 'text-red-300' : 'text-green-300'}`}>
                    {overBudgetItems.length ? `${overBudgetItems.length} categories over budget` : 'No alerts'}
                  </span>
                </div>
                {overBudgetItems.length ? (
                  <div className="space-y-2">
                    {overBudgetItems.slice(0, 5).map(item => {
                      const overBy = Number(item.actual_amount || 0) - Number(item.planned_amount || 0);
                      return (
                        <div key={item.id} className="flex items-center justify-between text-sm border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
                          <span className="text-red-200 capitalize">{item.category}</span>
                          <span className="text-red-300 font-mono">+{overBy.toLocaleString()} ({Number(item.utilization_percent || 0).toFixed(1)}%)</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-dark-400">All categories are within planned limits for this month.</p>
                )}
              </div>

              <div className="p-4 rounded-lg border border-dark-700 bg-dark-700/20">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h4 className="text-sm font-semibold text-white uppercase tracking-wide">Budget History (Last 6 Months)</h4>
                  <select
                    className="select-sm text-gray-700 border-r-4"
                    value={activeHistoryCategory}
                    onChange={e => setHistoryCategory(e.target.value)}
                    disabled={!budgetHistoryCategories.length}
                  >
                    {budgetHistoryCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={budgetHistoryTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        formatter={(val, name) => [`Rs ${Number(val || 0).toLocaleString()}`, name === 'planned' ? 'Planned' : 'Actual']}
                      />
                      <Line type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="actual" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <DataTable columns={budgetColumns} data={data.budgets} />
            </div>
          )}
          {activeTab === 'salaries' && <DataTable columns={salaryColumns} data={data.salaries} />}

          {activeTab === 'reports' && reportSummary && (
            <div className="space-y-6 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 bg-dark-700/30 rounded-lg border border-dark-600 space-y-3">
                  <h4 className="text-sm font-semibold text-white uppercase tracking-wide">Date Range</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="date"
                      className="input-sm text-gray-600"
                      value={reportFilters.from}
                      onChange={e => setReportFilters(prev => ({ ...prev, from: e.target.value }))}
                    />
                    <input
                      type="date"
                      className="input-sm text-gray-600"
                      value={reportFilters.to}
                      onChange={e => setReportFilters(prev => ({ ...prev, to: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setReportPreset('thisMonth')} className="btn-secondary btn-sm">This Month</button>
                    <button onClick={() => setReportPreset('lastMonth')} className="btn-secondary btn-sm">Last Month</button>
                    <button onClick={() => setReportPreset('ytd')} className="btn-secondary btn-sm">YTD</button>
                    <button onClick={() => setReportPreset('clear')} className="btn-danger-outline btn-sm">Clear</button>
                  </div>
                </div>
                <div className="p-4 bg-dark-700/30 rounded-lg border border-dark-600">
                  <h4 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Budget Control</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-dark-400">Planned</p>
                      <p className="text-white font-semibold">Rs {Number(reportSummary.budgetPlanned || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-400">Actual</p>
                      <p className="text-white font-semibold">Rs {Number(reportSummary.budgetActual || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-400">Variance</p>
                      <p className={`font-semibold ${Number(reportSummary.budgetVariance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Rs {Number(reportSummary.budgetVariance || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-400">Utilization</p>
                      <p className="text-primary-300 font-semibold">{Number(reportSummary.budgetUtilization || 0).toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard title="Monthly Spend" value={Number(reportSummary.monthlyTotal || 0)} icon={HiOutlineCash} color="amber" />
                <SummaryCard title="Category Count" value={Number(reportSummary.categoriesCount || 0)} raw icon={HiOutlineTemplate} color="blue" />
                <SummaryCard title="Compliance Rate" value={`${Number(reportSummary.complianceRate || 0)}%`} raw icon={HiOutlineCheckCircle} color="green" />
                <SummaryCard title="Avg Approval Time" value={`${Number(reportSummary.approvalSlaHours || 0)}h`} raw icon={HiOutlineDocumentReport} color="purple" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="p-4 bg-dark-700/30 rounded-lg border border-dark-600 h-80">
                  <h4 className="text-sm font-bold text-dark-400 uppercase mb-3">Spend by Category</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportByCategory} onClick={(state) => {
                      const category = state?.activePayload?.[0]?.payload?.category;
                      if (!category) return;
                      setFilters(prev => ({ ...prev, category }));
                      setSearchParams({ tab: 'expenses' });
                    }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} formatter={(val) => `Rs ${Number(val || 0).toLocaleString()}`} />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-4 bg-dark-700/30 rounded-lg border border-dark-600 h-80">
                  <h4 className="text-sm font-bold text-dark-400 uppercase mb-3">Spend Trend</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} formatter={(val) => `Rs ${Number(val || 0).toLocaleString()}`} />
                      <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="p-4 bg-dark-700/30 rounded-lg border border-dark-600 h-80">
                  <h4 className="text-sm font-bold text-dark-400 uppercase mb-3">Top Vendors</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportByVendor} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis dataKey="vendor" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={100} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} formatter={(val) => `Rs ${Number(val || 0).toLocaleString()}`} />
                      <Bar dataKey="amount" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-4 bg-dark-700/30 rounded-lg border border-dark-600 h-80">
                  <h4 className="text-sm font-bold text-dark-400 uppercase mb-3">Approval Distribution</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reportApprovalBreakdown} dataKey="count" nameKey="status" innerRadius={55} outerRadius={95} paddingAngle={3}>
                        {reportApprovalBreakdown.map((entry, index) => (
                          <Cell key={`approval-${entry.status}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <h4 className="text-sm font-bold text-dark-400 uppercase">Top 10 Expenses</h4>
              <DataTable columns={reportTopColumns} data={reportTopExpenses} />
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white capitalize">
                {form.id ? 'Edit' : 'Add'} {showModal.replace('-', ' ')}
              </h3>
              <button onClick={() => setShowModal(null)} className="text-dark-400 hover:text-white">
                <HiOutlineXCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {showModal === 'expense' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Category</label>
                      <select className="select" required value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                        <option value="">Select</option>
                        {EXPENSE_CATEGORIES.map(category => (
                          <option key={category.value} value={category.value}>{category.label}</option>
                        ))}
                      </select></div>
                    <div><label className="label">Sub-Category</label>
                      <input className="input" placeholder="e.g. Electricity" value={form.sub_category || ''} onChange={e => setForm({ ...form, sub_category: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><label className="label">Expense Type</label>
                      <select className="select" value={form.expense_type || 'variable'} onChange={e => setForm({ ...form, expense_type: e.target.value })}>
                        <option value="fixed">Fixed Cost</option>
                        <option value="variable">Variable Cost</option>
                        <option value="one-time">One-time</option>
                      </select></div>
                  </div>
                  <div><label className="label">Vendor (Optional)</label>
                    <input className="input" list="vendor-list" value={form.vendor || ''} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                    <datalist id="vendor-list">
                      {data.vendors.map(v => <option key={v.id} value={v.name} />)}
                    </datalist>
                  </div>
                  <div><label className="label">Description</label>
                    <textarea className="input h-20" required value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Date</label>
                      <input type="date" className="input" required value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                    <div><label className="label">Payment Method</label>
                      <select className="select" value={form.payment_method || 'cash'} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="credit_card">Credit Card</option>
                      </select></div>
                  </div>
                </>
              )}

              {showModal === 'vendor' && (
                <>
                  <div><label className="label">Vendor Name</label>
                    <input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Contact Person</label>
                      <input className="input" value={form.contact_person || ''} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
                    <div><label className="label">Category</label>
                      <input className="input" placeholder="e.g. IT, Legal" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Email</label>
                      <input type="email" className="input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                    <div><label className="label">Phone</label>
                      <input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Address</label>
                    <textarea className="input h-20" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                </>
              )}

              {showModal === 'budget' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Category</label>
                      <select
                        className="select"
                        required
                        value={form.category || ''}
                        onChange={e => setForm({ ...form, category: e.target.value })}
                        disabled={data.budgetPeriodStatus?.closed}
                      >
                        <option value="">Select</option>
                        {BUDGET_CATEGORIES.map(category => (
                          <option key={category.value} value={category.value}>{category.label}</option>
                        ))}
                        {form.category && !BUDGET_CATEGORIES.some(c => c.value === form.category) && (
                          <option value={form.category}>{form.category}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="label">Planned Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        required
                        value={form.planned_amount || ''}
                        onChange={e => setForm({ ...form, planned_amount: e.target.value })}
                        disabled={data.budgetPeriodStatus?.closed}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Month</label>
                      <select
                        className="select"
                        required
                        value={form.month || filters.month}
                        onChange={e => setForm({ ...form, month: e.target.value })}
                        disabled={data.budgetPeriodStatus?.closed}
                      >
                        {MONTHS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Year</label>
                      <input
                        type="number"
                        className="input"
                        required
                        value={form.year || filters.year}
                        onChange={e => setForm({ ...form, year: e.target.value })}
                        disabled={data.budgetPeriodStatus?.closed}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea
                      className="input h-20"
                      placeholder="Budget assumptions or context"
                      value={form.notes || ''}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      disabled={data.budgetPeriodStatus?.closed}
                    />
                  </div>
                  {data.budgetPeriodStatus?.closed && (
                    <p className="text-xs text-amber-300">This period is closed. You can view but not modify budget data.</p>
                  )}
                </>
              )}

              {showModal === 'recurring' && (
                <>
                  <div><label className="label">Rule Description</label>
                    <input className="input" required placeholder="e.g Monthly Rent" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Amount</label>
                      <input type="number" step="0.01" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><label className="label">Interval (Days)</label>
                      <select className="select" value={form.interval_days || 30} onChange={e => setForm({ ...form, interval_days: e.target.value })}>
                        <option value="7">Weekly (7)</option>
                        <option value="30">Monthly (30)</option>
                        <option value="90">Quarterly (90)</option>
                        <option value="365">Yearly (365)</option>
                      </select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center items-center py-2">
                    <span className="text-dark-400">Next Auto-Run:</span>
                    <span className="text-white font-bold">{form.next_run_date ? format(new Date(form.next_run_date), 'MMM dd, yyyy') : 'Calculated on Save'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                    <label htmlFor="is_active" className="text-white cursor-pointer">Active / Enabled</label>
                  </div>
                </>
              )}

              {showModal === 'salary' && (
                <>
                  <div><label className="label">Employee Name</label>
                    <input className="input" required value={form.employee_name || ''} onChange={e => setForm({ ...form, employee_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Designation</label>
                      <input className="input" value={form.designation || ''} onChange={e => setForm({ ...form, designation: e.target.value })} /></div>
                    <div className="grid grid-cols-2t gap-4">
                      <div><label className="label">Base Salary</label>
                        <input type="number" step="0.01" className="input" required value={form.base_salary || ''} onChange={e => setForm({ ...form, base_salary: e.target.value })} /></div>
                      <div><label className="label">Bonus</label>
                        <input type="number" step="0.01" className="input" value={form.bonus || ''} onChange={e => setForm({ ...form, bonus: e.target.value })} /></div>
                      <div><label className="label">Deductions</label>
                        <input type="number" step="0.01" className="input" value={form.deductions || ''} onChange={e => setForm({ ...form, deductions: e.target.value })} /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Month</label>
                      <select className="select" required value={form.month || ''} onChange={e => setForm({ ...form, month: e.target.value })}>
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select></div>
                    <div><label className="label">Year</label>
                      <input type="number" className="input" required value={form.year || 2024} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-6 border-t border-dark-700">
                <button type="button" onClick={() => setShowModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={processing || (showModal === 'budget' && data.budgetPeriodStatus?.closed)} className="btn-primary flex-1">
                  {processing ? <HiOutlineRefresh className="animate-spin w-5 h-5 mx-auto" /> : 'Save ' + showModal}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeExpensesPanel;


