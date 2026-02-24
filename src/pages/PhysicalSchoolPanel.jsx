import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { physicalSchoolAPI, opsAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import { HiOutlineUserGroup, HiOutlineCash, HiOutlineExclamation, HiOutlineTrendingDown, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { RevenueBarChart, ExpensePieChart } from '../components/charts/Charts';

const PhysicalSchoolPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState({
    overview: null,
    students: [],
    fees: [],
    defaulters: [],
    expenses: [],
    challans: [],
    escalations: []
  });
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedFee, setSelectedFee] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [classFilter, setClassFilter] = useState('');
  const [feeMonthFilter, setFeeMonthFilter] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [overviewRes, studentsRes, feesRes, defaultersRes, expensesRes, challansRes, escalationsRes] = await Promise.all([
        physicalSchoolAPI.getOverview(),
        physicalSchoolAPI.getStudents(),
        physicalSchoolAPI.getFees(),
        physicalSchoolAPI.getDefaulters(),
        physicalSchoolAPI.getExpenses(),
        opsAPI.getChallans(),
        opsAPI.getEscalations()
      ]);
      setData({
        overview: overviewRes.data.data,
        students: studentsRes.data.data,
        fees: feesRes.data.data,
        defaulters: defaultersRes.data.data,
        expenses: expensesRes.data.data,
        challans: challansRes.data.data,
        escalations: escalationsRes.data.data
      });
    } catch (error) {
      toast.error('Failed to load Physical School data');
    } finally {
      setLoading(false);
    }
  };

  const toDateInput = (value) => {
    if (!value) return '';
    const asString = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return asString.slice(0, 10);
    return d.toISOString().slice(0, 10);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (showModal === 'student') {
        const payload = { ...form };
        if (form.id) {
          await physicalSchoolAPI.updateStudent(form.id, payload);
          toast.success('Student updated');
        } else {
          await physicalSchoolAPI.createStudent(payload);
          toast.success('Student added successfully');
        }
      } else if (showModal === 'fee') {
        const payload = {
          student_id: form.student_id,
          amount: form.amount,
          fee_type: form.fee_type || 'monthly',
          month: form.month,
          year: form.year,
          paid_amount: form.paid_amount ?? form.amount,
          payment_method: form.payment_method || 'cash',
          paid_date: form.paid_date || null
        };
        if (form.id) {
          await physicalSchoolAPI.updateFee(form.id, payload);
          toast.success('Fee record updated');
        } else {
          await physicalSchoolAPI.collectFee(payload);
          toast.success('Fee collected');
        }
      } else if (showModal === 'expense') {
        const payload = {
          category: form.category,
          expense_type: form.expense_type || 'fixed',
          amount: form.amount,
          description: form.description || null,
          vendor: form.vendor || null,
          date: form.date
        };
        if (form.id) {
          await physicalSchoolAPI.updateExpense(form.id, payload);
          toast.success('Expense updated');
        } else {
          await physicalSchoolAPI.createExpense(payload);
          toast.success('Expense recorded');
        }
      } else if (showModal === 'challan') {
        await opsAPI.generateChallan({
          student_id: form.student_id,
          month: Number(form.month),
          year: Number(form.year),
          due_date: form.due_date || null,
          amount: form.total_amount || undefined
        });
        toast.success('Challan generated');
      } else if (showModal === 'challan-edit') {
        await opsAPI.updateChallan(form.id, {
          due_date: form.due_date,
          total_amount: Number(form.total_amount)
        });
        toast.success('Challan updated');
      }

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

  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`Delete student "${student.name}"?`)) return;
    try {
      await physicalSchoolAPI.deleteStudent(student.id);
      toast.success('Student deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete student');
    }
  };

  const handleMarkStudentDefaulter = async (student) => {
    try {
      await physicalSchoolAPI.markDefaulter({
        student_id: student.id,
        month: new Date().toLocaleString('en-US', { month: 'long' }),
        year: new Date().getFullYear(),
        amount: student.monthly_fee
      });
      toast.success('Student moved to defaulters');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark as defaulter');
    }
  };

  const handleStudentStatusChange = async (student, status) => {
    try {
      await physicalSchoolAPI.updateStudent(student.id, { status });
      toast.success('Student status updated');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update student status');
    }
  };

  const handleDeleteFee = async (fee) => {
    if (!window.confirm(`Delete fee record for "${fee.student_name}"?`)) return;
    try {
      await physicalSchoolAPI.deleteFee(fee.id);
      toast.success('Fee record deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete fee record');
    }
  };

  const handleClearDefaulter = async (fee) => {
    if (!window.confirm(`Move "${fee.student_name}" back from defaulters?`)) return;
    try {
      let defaulterId = fee.id;
      if (!defaulterId) {
        const created = await physicalSchoolAPI.markDefaulter({
          student_id: fee.student_id,
          month: fee.month,
          year: fee.year,
          amount: fee.amount
        });
        defaulterId = created.data?.data?.id;
      }
      await physicalSchoolAPI.clearDefaulter(defaulterId);
      toast.success('Defaulter moved back');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to move back defaulter');
    }
  };

  const handleEscalateDefaulter = async (fee) => {
    const input = window.prompt('Escalate after how many overdue days?', '30');
    if (input === null) return;
    const days = Number(input);
    if (!Number.isFinite(days) || days <= 0) {
      toast.error('Please enter a valid positive number of days');
      return;
    }
    try {
      let defaulterId = fee.id;
      if (!defaulterId) {
        const created = await physicalSchoolAPI.markDefaulter({
          student_id: fee.student_id,
          month: fee.month,
          year: fee.year,
          amount: fee.amount
        });
        defaulterId = created.data?.data?.id;
      }
      await physicalSchoolAPI.escalateDefaulter(defaulterId, { days_overdue: days });
      toast.success('Defaulter escalated');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to escalate defaulter');
    }
  };

  const handleMarkFeePaid = async (fee) => {
    try {
      await physicalSchoolAPI.updateFee(fee.id, {
        paid_amount: fee.amount,
        paid_date: new Date().toISOString().split('T')[0]
      });
      toast.success('Fee marked as paid');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update fee status');
    }
  };

  const handleCollectNowFromFee = (fee) => {
    setForm({
      id: fee.id,
      student_id: fee.student_id,
      amount: Number(fee.amount || 0),
      paid_amount: Number(fee.amount || 0),
      fee_type: fee.fee_type || 'monthly',
      month: fee.month,
      year: fee.year,
      paid_date: new Date().toISOString().split('T')[0],
      payment_method: fee.payment_method || 'cash'
    });
    setShowModal('fee');
  };

  const handleMarkFeePending = async (fee) => {
    try {
      await physicalSchoolAPI.updateFee(fee.id, {
        paid_amount: 0,
        paid_date: null
      });
      toast.success('Fee marked as pending');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update fee status');
    }
  };

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.category}"?`)) return;
    try {
      await physicalSchoolAPI.deleteExpense(expense.id);
      toast.success('Expense deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete expense');
    }
  };

  const handleChallanStatusChange = async (challan, status) => {
    try {
      if (status === 'partial') {
        const input = window.prompt('Enter partial paid amount', `${Math.max(1, Number(challan.total_amount || 0) / 2)}`);
        if (input === null) return;
        const partialAmount = Number(input);
        if (!Number.isFinite(partialAmount) || partialAmount <= 0) {
          toast.error('Invalid partial amount');
          return;
        }
        await opsAPI.updateChallanStatus(challan.id, 'partial', {
          paid_amount: partialAmount,
          paid_date: new Date().toISOString().split('T')[0]
        });
      } else {
        await opsAPI.updateChallanStatus(challan.id, status, {
          paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null
        });
      }
      toast.success(`Challan marked ${status}`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update challan status');
    }
  };

  const handleSendChallanReminder = async (challan) => {
    try {
      await opsAPI.sendChallanReminder(challan.id);
      toast.success('Reminder marked as sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reminder');
    }
  };

  const handleDeleteChallan = async (challan) => {
    if (!window.confirm(`Delete challan "${challan.challan_number}"?`)) return;
    try {
      await opsAPI.deleteChallan(challan.id);
      toast.success('Challan deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete challan');
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('Reset all Physical School panel data? This cannot be undone.')) return;
    try {
      await physicalSchoolAPI.resetData();
      toast.success('Physical School data reset successfully');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset data');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  const filteredStudents = classFilter
    ? data.students.filter(s => String(s.class || '').toLowerCase().includes(classFilter.toLowerCase()))
    : data.students;

  const filteredFees = data.fees.filter(f => {
    if (feeMonthFilter && !String(f.month || '').toLowerCase().includes(feeMonthFilter.toLowerCase())) return false;
    if (feeStatusFilter && f.status !== feeStatusFilter) return false;
    return true;
  });

  const studentColumns = [
    {
      header: 'Student', key: 'name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">ID: {row.student_id_number || '-'}</p></div>
      )
    },
    { header: 'Class', key: 'class', render: (val, row) => `${val}${row.section ? ` - ${row.section}` : ''}` },
    { header: 'Parent', key: 'parent_name' },
    { header: 'Phone', key: 'phone' },
    { header: 'Fee', key: 'monthly_fee', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Action',
      key: 'id',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => { setSelectedStudent(row); setShowModal('student-details'); }}
            className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
          >
            View
          </button>
          <button onClick={() => { setForm({ ...row, admission_date: toDateInput(row.admission_date) }); setShowModal('student'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          {row.status === 'active' ? (
            <button onClick={() => handleStudentStatusChange(row, 'inactive')} className="text-amber-400 hover:text-amber-300 text-xs font-semibold">
              Deactivate
            </button>
          ) : (
            <button onClick={() => handleStudentStatusChange(row, 'active')} className="text-amber-400 hover:text-amber-300 text-xs font-semibold">
              Activate
            </button>
          )}
          <button onClick={() => handleMarkStudentDefaulter(row)} className="text-orange-400 hover:text-orange-300 text-xs font-semibold">
            Defaulter
          </button>
          <button onClick={() => handleDeleteStudent(row)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
  ];

  const feeColumns = [
    { header: 'Student', key: 'student_name' },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Paid', key: 'paid_amount', render: (val) => <CurrencyCell value={val} className="text-emerald-400" /> },
    { header: 'Type', key: 'fee_type', render: (val) => <span className="badge-info capitalize">{val}</span> },
    { header: 'Month', key: 'month' },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    { header: 'Date', key: 'paid_date', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    {
      header: 'Action',
      key: 'id',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => { setSelectedFee(row); setShowModal('fee-details'); }}
            className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
          >
            View
          </button>
          <button onClick={() => { setForm({ ...row, paid_date: toDateInput(row.paid_date) }); setShowModal('fee'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          {row.status !== 'paid' ? (
            <button onClick={() => handleCollectNowFromFee(row)} className="text-amber-400 hover:text-amber-300 text-xs font-semibold">
              Collect Now
            </button>
          ) : (
            <button onClick={() => handleMarkFeePending(row)} className="text-amber-400 hover:text-amber-300 text-xs font-semibold">
              Mark Pending
            </button>
          )}
          <button onClick={() => handleDeleteFee(row)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
  ];

  const expenseColumns = [
    { header: 'Category', key: 'category' },
    { header: 'Type', key: 'expense_type', render: (val) => <span className="badge-info capitalize">{val}</span> },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} className="text-red-400" /> },
    { header: 'Vendor', key: 'vendor' },
    { header: 'Date', key: 'date', render: (val) => new Date(val).toLocaleDateString() },
    {
      header: 'Action',
      key: 'id',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => { setSelectedExpense(row); setShowModal('expense-details'); }}
            className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
          >
            View
          </button>
          <button onClick={() => { setForm({ ...row, date: toDateInput(row.date) }); setShowModal('expense'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          <button onClick={() => handleDeleteExpense(row)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
  ];

  const defaulterColumns = [
    { header: 'Student', key: 'student_name' },
    { header: 'Class', key: 'class', render: (val, row) => `${val}${row.section ? ` - ${row.section}` : ''}` },
    { header: 'Parent', key: 'parent_name' },
    { header: 'Phone', key: 'phone' },
    { header: 'Due', key: 'amount', render: (val, row) => <CurrencyCell value={Number(val || 0) - Number(row.paid_amount || 0)} className="text-red-400" /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Action',
      key: 'id',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEscalateDefaulter(row)}
            className="text-amber-400 hover:text-amber-300 text-xs font-semibold"
          >
            Escalate
          </button>
          <button
            onClick={() => handleClearDefaulter(row)}
            className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
          >
            Move Back
          </button>
        </div>
      )
    },
  ];

  const challanColumns = [
    { header: 'Challan #', key: 'challan_number' },
    { header: 'Student', key: 'student_name' },
    { header: 'Class', key: 'class', render: (val, row) => `${val}${row.section ? ` - ${row.section}` : ''}` },
    { header: 'Due Date', key: 'due_date', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { header: 'Amount', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Action',
      key: 'id',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => { setSelectedChallan(row); setShowModal('challan-details'); }}
            className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
          >
            View
          </button>
          <button
            onClick={() => { setForm({ ...row, due_date: toDateInput(row.due_date), total_amount: row.total_amount }); setShowModal('challan-edit'); }}
            className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold"
          >
            Edit
          </button>
          {row.status !== 'paid' && (
            <button
              onClick={() => handleChallanStatusChange(row, 'paid')}
              className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold"
            >
              Mark Paid
            </button>
          )}
          {row.status !== 'partial' && row.status !== 'paid' && (
            <button
              onClick={() => handleChallanStatusChange(row, 'partial')}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold"
            >
              Partial
            </button>
          )}
          {row.status !== 'overdue' && row.status !== 'paid' && (
            <button
              onClick={() => handleChallanStatusChange(row, 'overdue')}
              className="text-orange-400 hover:text-orange-300 text-xs font-semibold"
            >
              Overdue
            </button>
          )}
          <button
            onClick={() => handleSendChallanReminder(row)}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold"
          >
            Reminder
          </button>
          <button onClick={() => handleDeleteChallan(row)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    }
  ];

  const overviewRevenueBars = [
    { name: 'Collected', total: Number(data.overview?.feeCollected || 0), color: '#10b981' },
    { name: 'Pending', total: Number(data.overview?.feePending || 0), color: '#f59e0b' },
    { name: 'Expenses', total: Number(data.overview?.yearlyExpenses || 0), color: '#ef4444' },
    { name: 'Net Profit', total: Number(data.overview?.netProfit || 0), color: '#3b82f6' },
  ];

  const overviewExpenseBreakdown = (data.overview?.expenseBreakdown || []).map(item => ({
    name: item.category || 'Other',
    total: Number(item.total || 0)
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Physical School Management</h1>
          <p className="text-dark-400 mt-1">Students, fee collection and school operations</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setShowModal('student'); setForm({ status: 'active', admission_date: new Date().toISOString().split('T')[0] }); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> Add Student
          </button>
          <button onClick={() => { setShowModal('fee'); setForm({ fee_type: 'monthly', year: new Date().getFullYear(), paid_date: new Date().toISOString().split('T')[0] }); }} className="btn-success">
            <HiOutlineCash className="w-4 h-4" /> Collect Fee
          </button>
          <button onClick={() => { setShowModal('expense'); setForm({ date: new Date().toISOString().split('T')[0] }); }} className="btn-secondary">
            <HiOutlinePlus className="w-4 h-4" /> Add Expense
          </button>
          <button onClick={() => { setShowModal('challan'); setForm({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }); }} className="btn-secondary">
            <HiOutlinePlus className="w-4 h-4" /> Generate Challan
          </button>
          <button onClick={handleResetData} className="btn-danger">
            <HiOutlineTrash className="w-4 h-4" /> Reset Data
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
        {['overview', 'students', 'fees', 'defaulters', 'expenses', 'challans', 'escalations'].map(tab => (
          <button key={tab} onClick={() => setSearchParams({ tab })}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {data.overview && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <SummaryCard title="Total Students" value={data.overview.totalStudents} subtitle={`${data.overview.activeStudents} active`} icon={HiOutlineUserGroup} color="blue" raw />
              <SummaryCard title="Monthly Collected" value={data.overview.feeCollected} icon={HiOutlineCash} color="green" />
              <SummaryCard title="Collection Rate" value={`${data.overview.collectionPercentage || 0}%`} subtitle={`Expected: ₨ ${Number(data.overview.expectedMonthly || 0).toLocaleString()}`} icon={HiOutlineCash} color="purple" />
              <SummaryCard title="Pending Fees" value={data.overview.feePending} icon={HiOutlineExclamation} color="amber" />
              <SummaryCard title="Defaulters" value={data.overview.defaultersCount} icon={HiOutlineTrendingDown} color="red" raw />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueBarChart data={overviewRevenueBars} title="Collection vs Costs" />
            <ExpensePieChart data={overviewExpenseBreakdown} title="Expense Breakdown (Yearly)" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Defaulters</h3>
              <DataTable
                columns={[
                  { header: 'Student', key: 'student_name' },
                  { header: 'Class', key: 'class', render: (val, row) => `${val}${row.section ? ` - ${row.section}` : ''}` },
                  { header: 'Due', key: 'amount', render: (val, row) => <CurrencyCell value={Number(val || 0) - Number(row.paid_amount || 0)} className="text-red-400" /> },
                  { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
                ]}
                data={data.defaulters.slice(0, 8)}
              />
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">Escalation Queue</h3>
              <DataTable
                columns={[
                  { header: 'Student', key: 'name' },
                  { header: 'Pending', key: 'pending_challans' },
                  { header: 'Total Due', key: 'total_due', render: (val) => <CurrencyCell value={val} className="text-red-400" /> },
                  { header: 'Level', key: 'escalation_level', render: (val) => <span className="badge-warning">{val}</span> },
                ]}
                data={data.escalations.slice(0, 8)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {activeTab === 'students' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <h3 className="text-lg font-semibold text-white">Enrolled Students ({filteredStudents.length})</h3>
              <div className="flex gap-2 ml-auto">
                <input
                  className="input text-sm py-1" placeholder="Filter by class..."
                  value={classFilter}
                  onChange={e => setClassFilter(e.target.value)}
                />
              </div>
            </div>
            {filteredStudents.length === 0
              ? <p className="text-dark-400 text-center py-8">No students found{classFilter ? ` for class "${classFilter}"` : ''}.</p>
              : <DataTable columns={studentColumns} data={filteredStudents} />}
          </>
        )}
        {activeTab === 'fees' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <h3 className="text-lg font-semibold text-white">Fee Collections ({filteredFees.length})</h3>
              <div className="flex gap-2 ml-auto flex-wrap">
                <input
                  className="input text-sm py-1" placeholder="Month (e.g. January)"
                  value={feeMonthFilter}
                  onChange={e => setFeeMonthFilter(e.target.value)}
                />
                <select className="select text-sm py-1" value={feeStatusFilter} onChange={e => setFeeStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            {filteredFees.length === 0
              ? <p className="text-dark-400 text-center py-8">No fee records found matching filters.</p>
              : <DataTable columns={feeColumns} data={filteredFees} />}
          </>
        )}
        {activeTab === 'defaulters' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4 text-red-400">Fee Defaulters ({data.defaulters.length})</h3>
            {data.defaulters.length === 0
              ? <p className="text-emerald-400 text-center py-8">✓ No defaulters — all fees are collected for the current period!</p>
              : <DataTable columns={defaulterColumns} data={data.defaulters} />}
          </>
        )}
        {activeTab === 'expenses' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Expenses ({data.expenses.length})</h3>
            {data.expenses.length === 0
              ? <p className="text-dark-400 text-center py-8">No expenses recorded yet.</p>
              : <DataTable columns={expenseColumns} data={data.expenses} />}
          </>
        )}
        {activeTab === 'challans' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Fee Challans ({data.challans.length})</h3>
            {data.challans.length === 0
              ? <p className="text-dark-400 text-center py-8">No challans generated yet.</p>
              : <DataTable columns={challanColumns} data={data.challans} />}
          </>
        )}
        {activeTab === 'escalations' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Defaulter Escalations ({data.escalations.length})</h3>
            <DataTable
              columns={[
                { header: 'Student', key: 'name' },
                { header: 'Parent', key: 'parent_name' },
                { header: 'Phone', key: 'phone' },
                { header: 'Pending Challans', key: 'pending_challans' },
                { header: 'Total Due', key: 'total_due', render: (val) => <CurrencyCell value={val} className="text-red-400" /> },
                { header: 'Escalation', key: 'escalation_level', render: (val) => <span className="badge-warning">{val}</span> },
              ]}
              data={data.escalations}
            />
          </>
        )}
      </div>

      {['student', 'fee', 'expense', 'challan', 'challan-edit'].includes(showModal) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'student' ? (form.id ? 'Edit Student' : 'Add New Student')
                : showModal === 'fee' ? (form.id ? 'Edit Fee Collection' : 'Collect Student Fee')
                  : showModal === 'expense' ? (form.id ? 'Edit Expense' : 'Record School Expense')
                    : showModal === 'challan-edit' ? 'Edit Challan'
                      : 'Generate Fee Challan'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {showModal === 'student' && (
                <>
                  <div><label className="label">Full Name</label>
                    <input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Class</label>
                      <input className="input" required value={form.class || ''} onChange={e => setForm({ ...form, class: e.target.value })} /></div>
                    <div><label className="label">Section</label>
                      <input className="input" value={form.section || ''} onChange={e => setForm({ ...form, section: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Parent Name</label>
                    <input className="input" value={form.parent_name || ''} onChange={e => setForm({ ...form, parent_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Phone</label>
                      <input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><label className="label">Monthly Fee</label>
                      <input type="number" step="0.01" min="0" className="input" required value={form.monthly_fee || ''} onChange={e => setForm({ ...form, monthly_fee: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Admission Fee</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.admission_fee || ''} onChange={e => setForm({ ...form, admission_fee: e.target.value })} /></div>
                    <div><label className="label">Admission Date</label>
                      <input type="date" className="input" required value={form.admission_date || ''} onChange={e => setForm({ ...form, admission_date: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Status</label>
                    <select className="select" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="graduated">Graduated</option>
                      <option value="transferred">Transferred</option>
                    </select></div>
                </>
              )}

              {showModal === 'fee' && (
                <>
                  <div><label className="label">Select Student</label>
                    <select className="select" required value={form.student_id || ''} onChange={e => setForm({ ...form, student_id: e.target.value })}>
                      <option value="">Select Student</option>
                      {data.students.map(s => <option key={s.id} value={s.id}>{s.name} - Class {s.class}</option>)}
                    </select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><label className="label">Paid Amount</label>
                      <input type="number" step="0.01" min="0" className="input" required value={form.paid_amount ?? ''} onChange={e => setForm({ ...form, paid_amount: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Fee Type</label>
                      <select className="select" value={form.fee_type || 'monthly'} onChange={e => setForm({ ...form, fee_type: e.target.value })}>
                        <option value="monthly">Monthly Fee</option>
                        <option value="admission">Admission Fee</option>
                        <option value="exam">Exam Fee</option>
                        <option value="transport">Transport Fee</option>
                        <option value="other">Other</option>
                      </select></div>
                    <div><label className="label">Payment Method</label>
                      <select className="select" value={form.payment_method || 'cash'} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="card">Card</option>
                        <option value="online">Online</option>
                      </select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Month</label>
                      <input type="text" className="input" placeholder="e.g. October" required value={form.month || ''} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
                    <div><label className="label">Year</label>
                      <input type="number" className="input" required value={form.year || new Date().getFullYear()} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Payment Date</label>
                    <input type="date" className="input" value={form.paid_date || ''} onChange={e => setForm({ ...form, paid_date: e.target.value })} /></div>
                </>
              )}

              {showModal === 'expense' && (
                <>
                  <div><label className="label">Category</label>
                    <input className="input" required value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Expense Type</label>
                      <select className="select" value={form.expense_type || 'fixed'} onChange={e => setForm({ ...form, expense_type: e.target.value })}>
                        <option value="fixed">Fixed</option>
                        <option value="variable">Variable</option>
                      </select></div>
                    <div><label className="label">Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Vendor</label>
                    <input className="input" value={form.vendor || ''} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
                  <div><label className="label">Description</label>
                    <textarea className="input" rows="2" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                  <div><label className="label">Date</label>
                    <input type="date" className="input" required value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                </>
              )}

              {showModal === 'challan' && (
                <>
                  <div><label className="label">Student</label>
                    <select className="select" required value={form.student_id || ''} onChange={e => setForm({ ...form, student_id: e.target.value })}>
                      <option value="">Select Student</option>
                      {data.students.map(s => <option key={s.id} value={s.id}>{s.name} - Class {s.class}</option>)}
                    </select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Month (1-12)</label>
                      <input type="number" min="1" max="12" className="input" required value={form.month || ''} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
                    <div><label className="label">Year</label>
                      <input type="number" className="input" required value={form.year || new Date().getFullYear()} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Due Date</label>
                      <input type="date" className="input" value={form.due_date || ''} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                    <div><label className="label">Amount (optional)</label>
                      <input type="number" step="0.01" min="0.01" className="input" value={form.total_amount || ''} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
                  </div>
                </>
              )}

              {showModal === 'challan-edit' && (
                <>
                  <div><label className="label">Challan #</label>
                    <input className="input" disabled value={form.challan_number || ''} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Due Date</label>
                      <input type="date" className="input" required value={form.due_date || ''} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                    <div><label className="label">Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.total_amount || ''} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
                  </div>
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

      {showModal === 'student-details' && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Student Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-dark-400">Name</p><p className="text-white font-medium">{selectedStudent.name || '-'}</p></div>
              <div><p className="text-dark-400">Student ID</p><p className="text-white font-medium">{selectedStudent.student_id_number || '-'}</p></div>
              <div><p className="text-dark-400">Class</p><p className="text-white font-medium">{selectedStudent.class || '-'}</p></div>
              <div><p className="text-dark-400">Section</p><p className="text-white font-medium">{selectedStudent.section || '-'}</p></div>
              <div><p className="text-dark-400">Parent</p><p className="text-white font-medium">{selectedStudent.parent_name || '-'}</p></div>
              <div><p className="text-dark-400">Phone</p><p className="text-white font-medium">{selectedStudent.phone || '-'}</p></div>
              <div><p className="text-dark-400">Monthly Fee</p><p className="text-white font-medium">Rs {Number(selectedStudent.monthly_fee || 0).toLocaleString()}</p></div>
              <div><p className="text-dark-400">Admission Fee</p><p className="text-white font-medium">Rs {Number(selectedStudent.admission_fee || 0).toLocaleString()}</p></div>
              <div><p className="text-dark-400">Admission Date</p><p className="text-white font-medium">{selectedStudent.admission_date ? new Date(selectedStudent.admission_date).toLocaleDateString() : '-'}</p></div>
              <div><p className="text-dark-400">Status</p><p className="text-white font-medium">{selectedStudent.status || '-'}</p></div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowModal(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'fee-details' && selectedFee && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Fee Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-dark-400">Student</p><p className="text-white font-medium">{selectedFee.student_name || '-'}</p></div>
              <div><p className="text-dark-400">Class</p><p className="text-white font-medium">{selectedFee.class || '-'}</p></div>
              <div><p className="text-dark-400">Fee Type</p><p className="text-white font-medium">{selectedFee.fee_type || '-'}</p></div>
              <div><p className="text-dark-400">Status</p><p className="text-white font-medium">{selectedFee.status || '-'}</p></div>
              <div><p className="text-dark-400">Amount</p><p className="text-white font-medium">Rs {Number(selectedFee.amount || 0).toLocaleString()}</p></div>
              <div><p className="text-dark-400">Paid Amount</p><p className="text-white font-medium">Rs {Number(selectedFee.paid_amount || 0).toLocaleString()}</p></div>
              <div><p className="text-dark-400">Month</p><p className="text-white font-medium">{selectedFee.month || '-'}</p></div>
              <div><p className="text-dark-400">Year</p><p className="text-white font-medium">{selectedFee.year || '-'}</p></div>
              <div><p className="text-dark-400">Payment Method</p><p className="text-white font-medium">{selectedFee.payment_method || '-'}</p></div>
              <div><p className="text-dark-400">Paid Date</p><p className="text-white font-medium">{selectedFee.paid_date ? new Date(selectedFee.paid_date).toLocaleDateString() : '-'}</p></div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowModal(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'expense-details' && selectedExpense && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Expense Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-dark-400">Category</p><p className="text-white font-medium">{selectedExpense.category || '-'}</p></div>
              <div><p className="text-dark-400">Type</p><p className="text-white font-medium">{selectedExpense.expense_type || '-'}</p></div>
              <div><p className="text-dark-400">Amount</p><p className="text-white font-medium">Rs {Number(selectedExpense.amount || 0).toLocaleString()}</p></div>
              <div><p className="text-dark-400">Vendor</p><p className="text-white font-medium">{selectedExpense.vendor || '-'}</p></div>
              <div><p className="text-dark-400">Date</p><p className="text-white font-medium">{selectedExpense.date ? new Date(selectedExpense.date).toLocaleDateString() : '-'}</p></div>
              <div><p className="text-dark-400">Description</p><p className="text-white font-medium">{selectedExpense.description || '-'}</p></div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowModal(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'challan-details' && selectedChallan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Challan Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-dark-400">Challan #</p><p className="text-white font-medium">{selectedChallan.challan_number || '-'}</p></div>
              <div><p className="text-dark-400">Student</p><p className="text-white font-medium">{selectedChallan.student_name || '-'}</p></div>
              <div><p className="text-dark-400">Class</p><p className="text-white font-medium">{selectedChallan.class || '-'}</p></div>
              <div><p className="text-dark-400">Section</p><p className="text-white font-medium">{selectedChallan.section || '-'}</p></div>
              <div><p className="text-dark-400">Parent</p><p className="text-white font-medium">{selectedChallan.parent_name || '-'}</p></div>
              <div><p className="text-dark-400">Phone</p><p className="text-white font-medium">{selectedChallan.phone || '-'}</p></div>
              <div><p className="text-dark-400">Due Date</p><p className="text-white font-medium">{selectedChallan.due_date ? new Date(selectedChallan.due_date).toLocaleDateString() : '-'}</p></div>
              <div><p className="text-dark-400">Amount</p><p className="text-white font-medium">Rs {Number(selectedChallan.total_amount || 0).toLocaleString()}</p></div>
              <div><p className="text-dark-400">Status</p><p className="text-white font-medium">{selectedChallan.status || '-'}</p></div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowModal(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhysicalSchoolPanel;
