import React, { useState, useEffect } from 'react';
import { schoolSaasAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import { HiOutlineAcademicCap, HiOutlineRefresh, HiOutlineCash, HiOutlineChartBar, HiOutlinePlus } from 'react-icons/hi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

const SchoolSaas = () => {
  const [data, setData] = useState({
    overview: null,
    schools: [],
    revenues: [],
    expenses: []
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [overviewRes, schoolsRes] = await Promise.all([
        schoolSaasAPI.getOverview(),
        schoolSaasAPI.getSchools()
      ]);
      setData({
        overview: overviewRes.data.data,
        schools: schoolsRes.data.data,
        revenues: [], // Populated if needed from overview or separate call
        expenses: []  // Populated if needed
      });
    } catch (error) {
      toast.error('Failed to load School SaaS data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (showModal === 'school') {
        await schoolSaasAPI.createSchool(form);
        toast.success('School added successfully');
      } else if (showModal === 'expense') {
        await schoolSaasAPI.createExpense({ ...form, business_unit_id: 3 }); // Assuming ID 3 for School SaaS
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

  const schoolColumns = [
    { header: 'School Name', key: 'school_name', render: (val) => <span className="font-medium text-white">{val}</span> },
    { header: 'Contact', key: 'contact_person' },
    { header: 'Plan', key: 'plan', render: (val) => <span className="badge-info capitalize">{val}</span> },
    { header: 'Monthly Fee', key: 'monthly_fee', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Students', key: 'students_count' },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    { header: 'Joined', key: 'join_date', render: (val) => new Date(val).toLocaleDateString() },
  ];

  const planData = data.overview?.planStats?.map(p => ({
    name: p.plan, value: p.count
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🏫 School Management SaaS</h1>
          <p className="text-dark-400 mt-1">SaaS subscription management and metrics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('school'); setForm({ plan: 'basic' }); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> Add School
          </button>
          <button onClick={() => { setShowModal('expense'); setForm({}); }} className="btn-secondary">
            <HiOutlinePlus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {data.overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Active Schools" value={data.overview.activeSchools} icon={HiOutlineAcademicCap} color="blue" />
          <SummaryCard title="Total MRR" value={data.overview.totalMRR} icon={HiOutlineRefresh} color="green" />
          <SummaryCard title="Average ARPU" value={data.overview.averageARPU} icon={HiOutlineChartBar} color="purple" />
          <SummaryCard title="Churn Rate" value={`${data.overview.churnRate}%`} icon={HiOutlineChartBar} color="red" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Partner Schools</h3>
            <div className="flex gap-1 bg-dark-900 p-1 rounded-lg">
              {['all', 'active', 'trial'].map(t => (
                <button key={t} className="px-3 py-1 text-xs rounded-md capitalize text-dark-400 hover:text-white">
                  {t}
                </button>
              ))}
            </div>
          </div>
          <DataTable columns={schoolColumns} data={data.schools} />
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6">Plan Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {planData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {planData.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-sm text-dark-300 capitalize">{p.name}</span>
                </div>
                <span className="text-sm font-medium text-white">{p.value} schools</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'school' ? 'Add New School' : 'Record SaaS Expense'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {showModal === 'school' ? (
                <>
                  <div><label className="label">School Name</label>
                    <input className="input" required value={form.school_name||''} onChange={e=>setForm({...form,school_name:e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Plan</label>
                      <select className="select" value={form.plan||'basic'} onChange={e=>setForm({...form,plan:e.target.value})}>
                        <option value="basic">Basic</option>
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                        <option value="enterprise">Enterprise</option>
                      </select></div>
                    <div><label className="label">Monthly Fee</label>
                      <input type="number" className="input" required value={form.monthly_fee||''} onChange={e=>setForm({...form,monthly_fee:e.target.value})} /></div>
                  </div>
                  <div><label className="label">Contact Person</label>
                    <input className="input" value={form.contact_person||''} onChange={e=>setForm({...form,contact_person:e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Email</label>
                      <input type="email" className="input" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} /></div>
                    <div><label className="label">Phone</label>
                      <input className="input" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
                  </div>
                  <div><label className="label">Join Date</label>
                    <input type="date" className="input" required value={form.join_date||''} onChange={e=>setForm({...form,join_date:e.target.value})} /></div>
                </>
              ) : (
                <>
                  <div><label className="label">Category</label>
                    <select className="select" required value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})}>
                      <option value="">Select Category</option>
                      <option value="Server">Server/Hosting</option>
                      <option value="Development">Development</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Support">Support</option>
                      <option value="Other">Other</option>
                    </select></div>
                  <div><label className="label">Amount</label>
                    <input type="number" className="input" required value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
                  <div><label className="label">Description</label>
                    <textarea className="input h-24" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}></textarea></div>
                  <div><label className="label">Date</label>
                    <input type="date" className="input" required value={form.date||''} onChange={e=>setForm({...form,date:e.target.value})} /></div>
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

export default SchoolSaas;