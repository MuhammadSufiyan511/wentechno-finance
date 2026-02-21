import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { officeAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import { HiOutlineOfficeBuilding, HiOutlineLockClosed, HiOutlineRefresh, HiOutlinePlus, HiOutlineTrash, HiOutlineCash } from 'react-icons/hi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

const OfficeExpensesPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'expenses';

  const [data, setData] = useState({
    overview: null,
    expenses: [],
    salaries: []
  });
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [overviewRes, expensesRes, salariesRes] = await Promise.all([
        officeAPI.getOverview(),
        officeAPI.getExpenses(),
        officeAPI.getSalaries()
      ]);
      setData({
        overview: overviewRes.data.data,
        expenses: expensesRes.data.data,
        salaries: salariesRes.data.data
      });
    } catch (error) {
      toast.error('Failed to load Office data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (showModal === 'expense') await officeAPI.createExpense(form);
      else if (showModal === 'salary') await officeAPI.createSalary(form);

      toast.success('Successfully saved');
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Operation failed');
      }
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await officeAPI.deleteExpense(id);
      toast.success('Expense deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  const expenseColumns = [
    { header: 'Category', key: 'category', render: (val) => <span className="font-medium text-white capitalize">{val}</span> },
    { header: 'Type', key: 'expense_type', render: (val) => <span className="badge-info capitalize">{val}</span> },
    { header: 'Description', key: 'description' },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Date', key: 'date', render: (val) => new Date(val).toLocaleDateString() },
    { header: 'Approval', key: 'approval_status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Actions', key: 'id', render: (val) => (
        <button onClick={() => handleDeleteExpense(val)} className="text-red-400 hover:text-red-300">
          <HiOutlineTrash className="w-5 h-5" />
        </button>
      )
    },
  ];

  const salaryColumns = [
    {
      header: 'Employee', key: 'employee_name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">{row.designation}</p></div>
      )
    },
    { header: 'Net Salary', key: 'net_salary', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Month', key: 'month', render: (val, row) => `${val} ${row.year}` },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  const chartData = data.overview?.categoryBreakdown?.map(c => ({
    name: c.category,
    amount: parseFloat(c.total)
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🏢 Office & General Operations</h1>
          <p className="text-dark-400 mt-1">Operational expenses and payroll management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('expense'); setForm({ expense_type: 'variable' }); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> Add Expense
          </button>
          <button onClick={() => { setShowModal('salary'); setForm({ status: 'paid' }); }} className="btn-success">
            <HiOutlineCash className="w-4 h-4" /> Record Salary
          </button>
        </div>
      </div>

      {data.overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Monthly" value={data.overview.totalMonthly} icon={HiOutlineOfficeBuilding} color="blue" />
          <SummaryCard title="Fixed Costs" value={data.overview.fixedCosts} icon={HiOutlineLockClosed} color="purple" />
          <SummaryCard title="Variable Costs" value={data.overview.variableCosts} icon={HiOutlineRefresh} color="amber" />
          <SummaryCard title="Salaries" value={data.overview.totalSalaries} icon={HiOutlineCash} color="green" />
        </div>
      )}

      {/* Chart Row */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6">Expense Distribution by Category</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₨${v / 1000}k`} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
        {['expenses', 'salaries'].map(tab => (
          <button key={tab} onClick={() => setSearchParams({ tab })}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'expenses' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Office Expenses</h3>
            <DataTable columns={expenseColumns} data={data.expenses} />
          </>
        )}
        {activeTab === 'salaries' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Payroll History</h3>
            <DataTable columns={salaryColumns} data={data.salaries} />
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'expense' ? 'Add Office Expense' : 'Record Salary Payment'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {showModal === 'expense' ? (
                <>
                  <div><label className="label">Category</label>
                    <select className="select" required value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                      <option value="">Select Category</option>
                      <option value="rent">Rent</option>
                      <option value="electricity">Electricity</option>
                      <option value="internet">Internet/Comm</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="supplies">Office Supplies</option>
                      <option value="other">Other</option>
                    </select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><label className="label">Type</label>
                      <select className="select" value={form.expense_type || 'variable'} onChange={e => setForm({ ...form, expense_type: e.target.value })}>
                        <option value="fixed">Fixed Cost</option>
                        <option value="variable">Variable Cost</option>
                        <option value="one-time">One-time</option>
                      </select></div>
                  </div>
                  <div><label className="label">Description</label>
                    <input className="input" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                  <div><label className="label">Date</label>
                    <input type="date" className="input" required value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div><label className="label">Employee Name</label>
                    <input className="input" required value={form.employee_name || ''} onChange={e => setForm({ ...form, employee_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Designation</label>
                      <input className="input" value={form.designation || ''} onChange={e => setForm({ ...form, designation: e.target.value })} /></div>
                    <div><label className="label">Base Salary</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.base_salary || ''} onChange={e => setForm({ ...form, base_salary: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Month</label>
                      <input className="input" placeholder="e.g. October" required value={form.month || ''} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
                    <div><label className="label">Year</label>
                      <input type="number" min="2000" max="2100" className="input" required value={form.year || new Date().getFullYear()} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Business Unit</label>
                    <select className="select" required value={form.business_unit_id || ''} onChange={e => setForm({ ...form, business_unit_id: e.target.value })}>
                      <option value="">Select Unit</option>
                      <option value="1">Ecom / POS</option>
                      <option value="2">UrbanFit</option>
                      <option value="3">School SaaS</option>
                      <option value="4">Physical School</option>
                      <option value="5">IT Courses</option>
                      <option value="6">General Office</option>
                    </select></div>
                </>
              )}
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1 justify-center">Save</button>
                <button type="button" onClick={() => setShowModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeExpensesPanel;