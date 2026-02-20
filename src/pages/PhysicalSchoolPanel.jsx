import React, { useState, useEffect } from 'react';
import { physicalSchoolAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import { HiOutlineUserGroup, HiOutlineCash, HiOutlineExclamation, HiOutlineTrendingDown, HiOutlinePlus } from 'react-icons/hi';
import toast from 'react-hot-toast';

const PhysicalSchoolPanel = () => {
  const [data, setData] = useState({
    overview: null,
    students: [],
    fees: [],
    defaulters: [],
    expenses: []
  });
  const [activeTab, setActiveTab] = useState('students');
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [overviewRes, studentsRes, feesRes, defaultersRes] = await Promise.all([
        physicalSchoolAPI.getOverview(),
        physicalSchoolAPI.getStudents(),
        physicalSchoolAPI.getFees(),
        physicalSchoolAPI.getDefaulters()
      ]);
      setData({
        overview: overviewRes.data.data,
        students: studentsRes.data.data,
        fees: feesRes.data.data,
        defaulters: defaultersRes.data.data,
        expenses: []
      });
    } catch (error) {
      toast.error('Failed to load Physical School data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (showModal === 'student') {
        await physicalSchoolAPI.createStudent(form);
        toast.success('Student added successfully');
      } else if (showModal === 'fee') {
        await physicalSchoolAPI.collectFee(form);
        toast.success('Fee collected');
      } else if (showModal === 'expense') {
        await physicalSchoolAPI.createExpense({ ...form, business_unit_id: 4 }); // Assuming ID 4 for Physical School
        toast.success('Expense recorded');
      }
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  const studentColumns = [
    {
      header: 'Student', key: 'name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">ID: {row.student_id_number}</p></div>
      )
    },
    { header: 'Class', key: 'class', render: (val, row) => `${val} - ${row.section}` },
    { header: 'Parent', key: 'parent_name' },
    { header: 'Phone', key: 'phone' },
    { header: 'Fee', key: 'monthly_fee', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  const feeColumns = [
    { header: 'Student', key: 'student_name' },
    { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Type', key: 'fee_type', render: (val) => <span className="badge-info capitalize">{val}</span> },
    { header: 'Month', key: 'month' },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    { header: 'Date', key: 'paid_date', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🏫 Physical School Management</h1>
          <p className="text-dark-400 mt-1">Students, fee collection and school operations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('student'); setForm({ status: 'active' }); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> Add Student
          </button>
          <button onClick={() => { setShowModal('fee'); setForm({ status: 'paid', fee_type: 'monthly' }); }} className="btn-success">
            <HiOutlineCash className="w-4 h-4" /> Collect Fee
          </button>
        </div>
      </div>

      {data.overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard title="Total Students" value={data.overview.totalStudents} icon={HiOutlineUserGroup} color="blue" />
          <SummaryCard title="Monthly Revenue" value={data.overview.monthlyRevenue} icon={HiOutlineCash} color="green" />
          <SummaryCard title="Fee Collection Status" value={`${data.overview.collectionPercentage}%`} icon={HiOutlineCash} color="purple" />
          <SummaryCard title="Pending Fees" value={data.overview.pendingFees} icon={HiOutlineExclamation} color="amber" />
          <SummaryCard title="Defaulters" value={data.overview.defaulterCount} icon={HiOutlineTrendingDown} color="red" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
        {['students', 'fees', 'defaulters'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'students' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Enrolled Students ({data.students.length})</h3>
            <DataTable columns={studentColumns} data={data.students} />
          </>
        )}
        {activeTab === 'fees' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Recent Fee Collections</h3>
            <DataTable columns={feeColumns} data={data.fees} />
          </>
        )}
        {activeTab === 'defaulters' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4 text-red-400">Fee Defaulters ({data.defaulters.length})</h3>
            <DataTable columns={studentColumns} data={data.defaulters} />
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'student' ? 'Add New Student' : 'Collect Student Fee'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {showModal === 'student' ? (
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
                      <input type="number" className="input" required value={form.monthly_fee || ''} onChange={e => setForm({ ...form, monthly_fee: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Admission Date</label>
                    <input type="date" className="input" required value={form.admission_date || ''} onChange={e => setForm({ ...form, admission_date: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div><label className="label">Select Student</label>
                    <select className="select" required value={form.student_id || ''} onChange={e => setForm({ ...form, student_id: e.target.value })}>
                      <option value="">Select Student</option>
                      {data.students.map(s => <option key={s.id} value={s.id}>{s.name} - Class {s.class}</option>)}
                    </select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Amount</label>
                      <input type="number" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><label className="label">Fee Type</label>
                      <select className="select" value={form.fee_type || 'monthly'} onChange={e => setForm({ ...form, fee_type: e.target.value })}>
                        <option value="monthly">Monthly Fee</option>
                        <option value="admission">Admission Fee</option>
                        <option value="exam">Exam Fee</option>
                        <option value="other">Other</option>
                      </select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Month</label>
                      <input type="text" className="input" placeholder="e.g. October" required value={form.month || ''} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
                    <div><label className="label">Year</label>
                      <input type="number" className="input" required value={form.year || new Date().getFullYear()} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Payment Date</label>
                    <input type="date" className="input" required value={form.paid_date || ''} onChange={e => setForm({ ...form, paid_date: e.target.value })} /></div>
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

export default PhysicalSchoolPanel;