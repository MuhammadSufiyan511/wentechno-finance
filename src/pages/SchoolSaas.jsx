import React, { useEffect, useMemo, useState } from 'react';
import { schoolSaasAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import { RevenueBarChart, ExpensePieChart } from '../components/charts/Charts';
import { HiOutlineAcademicCap, HiOutlineCash, HiOutlineChartBar, HiOutlinePlus, HiOutlineRefresh, HiOutlineTrash } from 'react-icons/hi';
import toast from 'react-hot-toast';

const tabs = ['overview', 'schools', 'plans', 'subscriptions', 'billing', 'receivables', 'health', 'reports'];

const SchoolSaas = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    overview: null, schools: [], plans: [], subscriptions: [], invoices: [], receivables: [], health: [], reportSummary: null
  });
  const [filters, setFilters] = useState({ from: '', to: '', month: new Date().toLocaleString('en-US', { month: 'long' }), year: new Date().getFullYear() });
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [infoTitle, setInfoTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadTab(activeTab); }, [activeTab, filters.from, filters.to, filters.month, filters.year]);

  const loadTab = async (tab) => {
    try {
      setLoading(true);
      if (tab === 'overview') {
        const [overview, schools, plans] = await Promise.all([schoolSaasAPI.getOverview(), schoolSaasAPI.getSchools(), schoolSaasAPI.getPlans()]);
        setData(prev => ({ ...prev, overview: overview.data.data, schools: schools.data.data || [], plans: plans.data.data || [] }));
      } else if (tab === 'schools') {
        const [schools] = await Promise.all([schoolSaasAPI.getSchools()]);
        setData(prev => ({ ...prev, schools: schools.data.data || [] }));
      } else if (tab === 'plans') {
        const [plans] = await Promise.all([schoolSaasAPI.getPlans()]);
        setData(prev => ({ ...prev, plans: plans.data.data || [] }));
      } else if (tab === 'subscriptions') {
        const [subs, schools, plans] = await Promise.all([schoolSaasAPI.getSubscriptions(), schoolSaasAPI.getSchools(), schoolSaasAPI.getPlans()]);
        setData(prev => ({ ...prev, subscriptions: subs.data.data || [], schools: schools.data.data || [], plans: plans.data.data || [] }));
      } else if (tab === 'billing') {
        const [invoices, schools, subs] = await Promise.all([schoolSaasAPI.getInvoices(), schoolSaasAPI.getSchools(), schoolSaasAPI.getSubscriptions()]);
        setData(prev => ({ ...prev, invoices: invoices.data.data || [], schools: schools.data.data || [], subscriptions: subs.data.data || [] }));
      } else if (tab === 'receivables') {
        const [rows] = await Promise.all([schoolSaasAPI.getReceivables()]);
        setData(prev => ({ ...prev, receivables: rows.data.data || [] }));
      } else if (tab === 'health') {
        const [health, schools] = await Promise.all([schoolSaasAPI.getHealthScores(), schoolSaasAPI.getSchools()]);
        setData(prev => ({ ...prev, health: health.data.data || [], schools: schools.data.data || [] }));
      } else if (tab === 'reports') {
        const res = await schoolSaasAPI.getReportSummary({ from: filters.from || undefined, to: filters.to || undefined, month: filters.month, year: filters.year });
        setData(prev => ({ ...prev, reportSummary: res.data.data || null }));
      }
    } catch (e) {
      toast.error(e.response?.data?.message || `Failed to load ${tab} data`);
    } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setProcessing(true);
      if (showModal === 'school') form.id ? await schoolSaasAPI.updateSchool(form.id, form) : await schoolSaasAPI.createSchool(form);
      if (showModal === 'plan') form.id ? await schoolSaasAPI.updatePlan(form.id, form) : await schoolSaasAPI.createPlan(form);
      if (showModal === 'subscription') form.id ? await schoolSaasAPI.updateSubscription(form.id, form) : await schoolSaasAPI.createSubscription(form);
      if (showModal === 'invoice') await schoolSaasAPI.generateInvoice(form);
      if (showModal === 'payment') await schoolSaasAPI.updateInvoiceStatus(form.id, { paid_amount: form.paid_amount, payment_date: form.payment_date, status: form.status });
      if (showModal === 'reminder') await schoolSaasAPI.sendReminder(form.id, { channel: form.channel, notes: form.notes, next_reminder_date: form.next_reminder_date });
      if (showModal === 'promise') await schoolSaasAPI.markPromiseToPay(form.id, { promise_to_pay_date: form.promise_to_pay_date, notes: form.notes });
      if (showModal === 'expense') await schoolSaasAPI.createExpense(form);
      if (showModal === 'activity') await schoolSaasAPI.recordActivity(form);
      toast.success('Saved');
      setShowModal(null);
      setForm({});
      loadTab(activeTab);
    } catch (e2) {
      toast.error(e2.response?.data?.message || 'Operation failed');
    } finally { setProcessing(false); }
  };

  const resetAll = async () => {
    if (!window.confirm('Reset all School SaaS data?')) return;
    try { await schoolSaasAPI.resetData(); toast.success('Reset complete'); loadTab(activeTab); } catch (e) { toast.error(e.response?.data?.message || 'Reset failed'); }
  };

  const exportReport = async () => {
    try {
      const res = await schoolSaasAPI.exportReportCSV({ from: filters.from || undefined, to: filters.to || undefined, month: filters.month, year: filters.year });
      const blob = res.data; const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'school-saas-report.csv'; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const openInfo = (title, row) => {
    setInfoTitle(title);
    setForm(row);
    setShowModal('info');
  };

  const revenueBars = useMemo(() => (data.overview?.revenueTrend || []).map(r => ({ name: r.period, total: Number(r.total || 0) })), [data.overview]);
  const planPie = useMemo(() => (data.overview?.planDistribution || []).map(r => ({ name: r.name, total: Number(r.total || 0) })), [data.overview]);
  const infoEntries = useMemo(() => Object.entries(form || {}).filter(([k]) => k !== ''), [form]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><HiOutlineAcademicCap className="text-primary-500" /> School SaaS</h1>
          <p className="text-dark-400 mt-1">Lifecycle, subscriptions, billing, dunning, metrics and reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'schools' && <button onClick={() => { setShowModal('school'); setForm({ plan: 'basic', status: 'active' }); }} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> Add School</button>}
          {activeTab === 'plans' && <button onClick={() => { setShowModal('plan'); setForm({ status: 'active' }); }} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> Add Plan</button>}
          {activeTab === 'subscriptions' && <button onClick={() => { setShowModal('subscription'); setForm({ billing_cycle: 'monthly', status: 'active', start_date: new Date().toISOString().slice(0, 10) }); }} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> Add Subscription</button>}
          {activeTab === 'billing' && <button onClick={() => { setShowModal('invoice'); setForm({ due_date: new Date().toISOString().slice(0, 10), amount: '' }); }} className="btn-success"><HiOutlinePlus className="w-4 h-4" /> Generate Invoice</button>}
          {activeTab === 'health' && <button onClick={() => { setShowModal('activity'); setForm({ activity_date: new Date().toISOString().slice(0, 10) }); }} className="btn-secondary"><HiOutlinePlus className="w-4 h-4" /> Log Activity</button>}
          <button onClick={() => { setShowModal('expense'); setForm({ date: new Date().toISOString().slice(0, 10) }); }} className="btn-secondary"><HiOutlinePlus className="w-4 h-4" /> Add Expense</button>
          <button onClick={resetAll} className="btn-danger-outline"><HiOutlineTrash className="w-4 h-4" /> Reset</button>
          <button onClick={() => loadTab(activeTab)} className="btn-secondary"><HiOutlineRefresh className="w-4 h-4" /></button>
        </div>
      </div>
  <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap ${activeTab === t ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>{t}</button>)}
      </div>
      {activeTab === 'overview' && data.overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="MRR" value={Number(data.overview.mrr || 0)} icon={HiOutlineCash} color="green" />
            <SummaryCard title="ARR" value={Number(data.overview.arr || 0)} icon={HiOutlineChartBar} color="blue" />
            <SummaryCard title="Active Schools" value={Number(data.overview.activeSchools || 0)} raw icon={HiOutlineAcademicCap} color="cyan" />
            <SummaryCard title="Receivables" value={Number(data.overview.receivables || 0)} icon={HiOutlineCash} color="amber" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RevenueBarChart data={revenueBars} title="Revenue Trend (Last 6 Months)" />
            <ExpensePieChart data={planPie} title="Plan Revenue Mix" />
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="flex flex-wrap gap-3 bg-dark-800/50 p-4 rounded-xl border border-dark-700">
          <input type="date" className="input-sm text-gray-700" value={filters.from} onChange={e => setFilters(prev => ({ ...prev, from: e.target.value }))} />
          <input type="date" className="input-sm text-gray-700" value={filters.to} onChange={e => setFilters(prev => ({ ...prev, to: e.target.value }))} />
          <button onClick={exportReport} className="btn-success-outline btn-sm">Export CSV</button>
        </div>
      )}

    

      <div className="card">
        {activeTab === 'schools' && <DataTable columns={[
          { header: 'School', key: 'school_name' }, { header: 'Contact', key: 'contact_person' }, { header: 'Plan', key: 'plan' },
          { header: 'Fee', key: 'monthly_fee', render: v => <CurrencyCell value={v} /> }, { header: 'Students', key: 'students_count' }, { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
          { header: 'Actions', key: 'id', render: (v, r) => <div className="flex gap-2"><button className="text-cyan-400" onClick={() => openInfo('School Details', r)}>Info</button><button className="text-blue-400" onClick={() => { setShowModal('school'); setForm(r); }}>Edit</button><button className="text-amber-400" onClick={() => schoolSaasAPI.updateLifecycle(v, { status: r.status === 'active' ? 'inactive' : 'active' }).then(() => loadTab('schools'))}>Toggle</button><button className="text-red-400" onClick={() => schoolSaasAPI.deleteSchool(v).then(() => loadTab('schools'))}>Delete</button></div> }
        ]} data={data.schools} />}

        {activeTab === 'plans' && <DataTable columns={[
          { header: 'Plan', key: 'name' }, { header: 'Monthly', key: 'price_monthly', render: v => <CurrencyCell value={v} /> }, { header: 'Yearly', key: 'price_yearly', render: v => <CurrencyCell value={v} /> }, { header: 'Student Limit', key: 'student_limit' }, { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
          { header: 'Actions', key: 'id', render: (v, r) => <div className="flex gap-2"><button className="text-cyan-400" onClick={() => openInfo('Plan Details', r)}>Info</button><button className="text-blue-400" onClick={() => { setShowModal('plan'); setForm(r); }}>Edit</button><button className="text-red-400" onClick={() => schoolSaasAPI.deletePlan(v).then(() => loadTab('plans'))}>Delete</button></div> }
        ]} data={data.plans} />}

        {activeTab === 'subscriptions' && <DataTable columns={[
          { header: 'School', key: 'school_name' }, { header: 'Plan', key: 'plan_name' }, { header: 'Cycle', key: 'billing_cycle' }, { header: 'Amount', key: 'amount', render: v => <CurrencyCell value={v} /> }, { header: 'Next Billing', key: 'next_billing_date' }, { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
          { header: 'Actions', key: 'id', render: (v, r) => <div className="flex gap-2"><button className="text-cyan-400" onClick={() => openInfo('Subscription Details', r)}>Info</button><button className="text-blue-400" onClick={() => { setShowModal('subscription'); setForm(r); }}>Edit</button><button className="text-green-400" onClick={() => schoolSaasAPI.renewSubscription(v).then(() => loadTab('subscriptions'))}>Renew</button><button className="text-red-400" onClick={() => schoolSaasAPI.cancelSubscription(v, { reason: 'manual_cancel' }).then(() => loadTab('subscriptions'))}>Cancel</button></div> }
        ]} data={data.subscriptions} />}

        {activeTab === 'billing' && <DataTable columns={[
          { header: 'Invoice #', key: 'invoice_number' }, { header: 'School', key: 'school_name' }, { header: 'Due Date', key: 'due_date' }, { header: 'Total', key: 'total_amount', render: v => <CurrencyCell value={v} /> }, { header: 'Paid', key: 'paid_amount', render: v => <CurrencyCell value={v} /> }, { header: 'Due', key: 'due_amount', render: v => <CurrencyCell value={v} className={Number(v) > 0 ? 'text-amber-400' : ''} /> }, { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
          { header: 'Actions', key: 'id', render: (v, r) => <div className="flex gap-2"><button className="text-cyan-400" onClick={() => openInfo('Invoice Details', r)}>Info</button><button className="text-green-400" onClick={() => { setShowModal('payment'); setForm({ id: v, paid_amount: '', payment_date: new Date().toISOString().slice(0, 10), status: r.status }); }}>Collect</button><button className="text-amber-400" onClick={() => { setShowModal('reminder'); setForm({ id: v, channel: 'email', next_reminder_date: '' }); }}>Reminder</button><button className="text-cyan-400" onClick={() => { setShowModal('promise'); setForm({ id: v, promise_to_pay_date: new Date().toISOString().slice(0, 10), notes: '' }); }}>Promise</button></div> }
        ]} data={data.invoices} />}

        {activeTab === 'receivables' && <DataTable columns={[
          { header: 'School', key: 'school_name' }, { header: 'Invoice', key: 'invoice_number' }, { header: 'Due', key: 'due_amount', render: v => <CurrencyCell value={v} className="text-amber-400" /> }, { header: 'Aging', key: 'aging_bucket', render: v => <StatusBadge status={v} /> }, { header: 'Overdue Days', key: 'overdue_days' }, { header: 'Priority', key: 'priority_score' }, { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
          { header: 'Action', key: 'id', render: (_, r) => <button className="text-cyan-400" onClick={() => openInfo('Receivable Details', r)}>Info</button> }
        ]} data={data.receivables} />}

        {activeTab === 'health' && <DataTable columns={[
          { header: 'School', key: 'school_name' }, { header: 'Plan', key: 'plan' }, { header: 'Active Users', key: 'active_users' }, { header: 'Feature Usage', key: 'feature_usage_score' }, { header: 'Overdue Invoices', key: 'overdue_invoices' }, { header: 'Overdue Amount', key: 'overdue_amount', render: v => <CurrencyCell value={v} /> }, { header: 'Health Score', key: 'health_score', render: v => <span className={Number(v) < 40 ? 'text-red-400' : Number(v) < 70 ? 'text-amber-400' : 'text-green-400'}>{Number(v || 0).toFixed(1)}</span> },
          { header: 'Action', key: 'id', render: (_, r) => <button className="text-cyan-400" onClick={() => openInfo('Health Details', r)}>Info</button> }
        ]} data={data.health} />}

        {activeTab === 'reports' && data.reportSummary && <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Revenue" value={Number(data.reportSummary.revenue || 0)} icon={HiOutlineCash} color="green" />
            <SummaryCard title="Expenses" value={Number(data.reportSummary.expenses || 0)} icon={HiOutlineChartBar} color="amber" />
            <SummaryCard title="Profit" value={Number(data.reportSummary.profit || 0)} icon={HiOutlineChartBar} color={Number(data.reportSummary.profit || 0) >= 0 ? 'blue' : 'red'} />
            <SummaryCard title="Receivables" value={Number(data.reportSummary.receivables || 0)} icon={HiOutlineCash} color="purple" />
          </div>
          <DataTable columns={[
            { header: 'Invoice', key: 'invoice_number' }, { header: 'School', key: 'school_name' }, { header: 'Due Amount', key: 'due_amount', render: v => <CurrencyCell value={v} /> }, { header: 'Due Date', key: 'due_date' }, { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
            { header: 'Action', key: 'invoice_number', render: (_, r) => <button className="text-cyan-400" onClick={() => openInfo('Report Row Details', r)}>Info</button> }
          ]} data={data.reportSummary.receivableRows || []} />
        </div>}
      </div>

      {showModal && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
        <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
          {showModal === 'info' && <>
            <h3 className="text-xl font-bold text-white mb-5">{infoTitle || 'Details'}</h3>
            <div className="bg-dark-900/60 border border-dark-700 rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {infoEntries.map(([key, value]) => (
                  <div key={key} className="bg-dark-800/70 border border-dark-700 rounded-md p-3">
                    <p className="text-xs uppercase tracking-wide text-dark-400">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-white mt-1 break-words">
                      {value === null || value === undefined || value === '' ? '-' : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowModal(null)} className="btn-secondary flex-1">Close</button>
            </div>
          </>}
          {showModal !== 'info' && <>
          <h3 className="text-xl font-bold text-white mb-5 capitalize">{form.id ? 'Edit' : 'Add'} {showModal}</h3>
          <form onSubmit={submit} className="space-y-4">
            {showModal === 'school' && <>
              <div><label className="label">School Name</label><input className="input" required value={form.school_name || ''} onChange={e => setForm({ ...form, school_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Contact Person</label><input className="input" value={form.contact_person || ''} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label className="label">Students</label><input type="number" className="input" value={form.students_count || 0} onChange={e => setForm({ ...form, students_count: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Plan</label><select className="select" value={form.plan || 'basic'} onChange={e => setForm({ ...form, plan: e.target.value })}><option value="basic">basic</option><option value="standard">standard</option><option value="premium">premium</option><option value="enterprise">enterprise</option></select></div>
                <div><label className="label">Monthly Fee</label><input type="number" className="input" required value={form.monthly_fee || ''} onChange={e => setForm({ ...form, monthly_fee: e.target.value })} /></div>
                <div><label className="label">Status</label><select className="select" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">active</option><option value="trial">trial</option><option value="inactive">inactive</option><option value="churned">churned</option></select></div>
              </div>
              <div><label className="label">Join Date</label><input type="date" className="input" required value={form.join_date || ''} onChange={e => setForm({ ...form, join_date: e.target.value })} /></div>
            </>}
            {showModal === 'plan' && <>
              <div><label className="label">Plan Name</label><input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Price Monthly</label><input type="number" className="input" value={form.price_monthly || 0} onChange={e => setForm({ ...form, price_monthly: e.target.value })} /></div>
                <div><label className="label">Price Yearly</label><input type="number" className="input" value={form.price_yearly || 0} onChange={e => setForm({ ...form, price_yearly: e.target.value })} /></div>
              </div>
              <div><label className="label">Student Limit</label><input type="number" className="input" value={form.student_limit || 0} onChange={e => setForm({ ...form, student_limit: e.target.value })} /></div>
              <div><label className="label">Features (JSON/Text)</label><textarea className="input h-20" value={form.features_json || ''} onChange={e => setForm({ ...form, features_json: e.target.value })}></textarea></div>
            </>}
            {showModal === 'subscription' && <>
              <div><label className="label">School</label><select className="select" required value={form.school_id || ''} onChange={e => setForm({ ...form, school_id: e.target.value })}><option value="">Select School</option>{data.schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}</select></div>
              <div><label className="label">Plan Name</label><select className="select" required value={form.plan_name || ''} onChange={e => {
                const selectedPlan = data.plans.find(p => p.name === e.target.value);
                setForm({ ...form, plan_name: e.target.value, amount: selectedPlan ? selectedPlan.price_monthly : form.amount });
              }}><option value="">Select Plan</option>{data.plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Amount</label><input type="number" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div><label className="label">Billing Cycle</label><select className="select" value={form.billing_cycle || 'monthly'} onChange={e => setForm({ ...form, billing_cycle: e.target.value })}><option value="monthly">monthly</option><option value="quarterly">quarterly</option><option value="semi_annual">semi_annual</option><option value="yearly">yearly</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Start Date</label><input type="date" className="input" required value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><label className="label">Next Billing Date</label><input type="date" className="input" value={form.next_billing_date || ''} onChange={e => setForm({ ...form, next_billing_date: e.target.value })} /></div>
              </div>
            </>}
            {showModal === 'invoice' && <>
              <div><label className="label">School</label><select className="select" required value={form.school_id || ''} onChange={e => setForm({ ...form, school_id: e.target.value })}><option value="">Select School</option>{data.schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}</select></div>
              <div><label className="label">Subscription (Optional)</label><select className="select" value={form.subscription_id || ''} onChange={e => setForm({ ...form, subscription_id: e.target.value || null })}><option value="">Optional Subscription</option>{data.subscriptions.map(s => <option key={s.id} value={s.id}>{s.school_name} - {s.plan_name}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Amount</label><input type="number" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div><label className="label">Tax</label><input type="number" className="input" value={form.tax_amount || 0} onChange={e => setForm({ ...form, tax_amount: e.target.value })} /></div>
                <div><label className="label">Discount</label><input type="number" className="input" value={form.discount_amount || 0} onChange={e => setForm({ ...form, discount_amount: e.target.value })} /></div>
              </div>
              <div><label className="label">Due Date</label><input type="date" className="input" required value={form.due_date || ''} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            </>}
            {showModal === 'payment' && <>
              <div><label className="label">Paid Amount</label><input type="number" className="input" required value={form.paid_amount || ''} onChange={e => setForm({ ...form, paid_amount: e.target.value })} /></div>
              <div><label className="label">Payment Date</label><input type="date" className="input" required value={form.payment_date || ''} onChange={e => setForm({ ...form, payment_date: e.target.value })} /></div>
            </>}
            {showModal === 'reminder' && <>
              <div><label className="label">Channel</label><select className="select" value={form.channel || 'email'} onChange={e => setForm({ ...form, channel: e.target.value })}><option value="email">email</option><option value="whatsapp">whatsapp</option><option value="call">call</option></select></div>
              <div><label className="label">Next Reminder Date</label><input type="date" className="input" value={form.next_reminder_date || ''} onChange={e => setForm({ ...form, next_reminder_date: e.target.value })} /></div>
              <div><label className="label">Notes</label><textarea className="input h-20" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}></textarea></div>
            </>}
            {showModal === 'promise' && <>
              <div><label className="label">Promise To Pay Date</label><input type="date" className="input" required value={form.promise_to_pay_date || ''} onChange={e => setForm({ ...form, promise_to_pay_date: e.target.value })} /></div>
              <div><label className="label">Notes</label><textarea className="input h-20" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}></textarea></div>
            </>}
            {showModal === 'expense' && <>
              <div><label className="label">Category</label><input className="input" required value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
              <div><label className="label">Amount</label><input type="number" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div><label className="label">Date</label><input type="date" className="input" required value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input h-20" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}></textarea></div>
            </>}
            {showModal === 'activity' && <>
              <div><label className="label">School</label><select className="select" required value={form.school_id || ''} onChange={e => setForm({ ...form, school_id: e.target.value })}><option value="">Select School</option>{data.schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}</select></div>
              <div><label className="label">Activity Date</label><input type="date" className="input" required value={form.activity_date || ''} onChange={e => setForm({ ...form, activity_date: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Active Users</label><input type="number" className="input" value={form.active_users || 0} onChange={e => setForm({ ...form, active_users: e.target.value })} /></div>
                <div><label className="label">Feature Usage Score</label><input type="number" className="input" value={form.feature_usage_score || 0} onChange={e => setForm({ ...form, feature_usage_score: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">API Calls</label><input type="number" className="input" value={form.api_calls || 0} onChange={e => setForm({ ...form, api_calls: e.target.value })} /></div>
                <div><label className="label">Tickets Opened</label><input type="number" className="input" value={form.tickets_opened || 0} onChange={e => setForm({ ...form, tickets_opened: e.target.value })} /></div>
              </div>
            </>}
            <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(null)} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={processing} className="btn-primary flex-1">{processing ? 'Saving...' : 'Save'}</button></div>
          </form>
          </>}
        </div>
      </div>}
    </div>
  );
};

export default SchoolSaas;
