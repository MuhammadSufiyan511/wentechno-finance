import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { itCoursesAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import { RevenueBarChart, ExpensePieChart } from '../components/charts/Charts';
import {
  HiOutlineBookOpen, HiOutlineUserGroup, HiOutlineCash, HiOutlineCollection,
  HiOutlinePlus, HiOutlineTrash, HiOutlineRefresh, HiOutlineDocumentReport, HiOutlineCheckCircle, HiOutlineXCircle
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const tabs = ['overview', 'courses', 'batches', 'trainers', 'enrollments', 'defaulters', 'reports'];

const ITCoursesPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const activeTab = tabs.includes(currentTab) ? currentTab : 'overview';

  const [data, setData] = useState({
    overview: null,
    courses: [],
    batches: [],
    enrollments: [],
    trainers: [],
    defaulters: [],
    reportSummary: null,
    batchProfitability: []
  });
  const [defaulterTimeline, setDefaulterTimeline] = useState([]);
  const [selectedDefaulter, setSelectedDefaulter] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    batch_id: '',
    age_bucket: '',
    reminder_status: '',
    from: '',
    to: '',
    month: format(new Date(), 'MMMM'),
    year: new Date().getFullYear()
  });
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [studentInfoData, setStudentInfoData] = useState({ loading: false, payments: [], followups: [] });
  const [trainerInfoBatches, setTrainerInfoBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab, filters.search, filters.status, filters.batch_id, filters.age_bucket, filters.reminder_status, filters.from, filters.to, filters.month, filters.year]);

  useEffect(() => {
    if (activeTab !== 'overview') return undefined;
    const id = setInterval(() => loadTabContent('overview'), 30000);
    return () => clearInterval(id);
  }, [activeTab]);

  const loadTabContent = async (tab) => {
    try {
      setLoading(true);
      if (tab === 'overview') {
        const [overviewRes, batchesRes, trainersRes] = await Promise.all([
          itCoursesAPI.getOverview(),
          itCoursesAPI.getBatches(),
          itCoursesAPI.getTrainers()
        ]);
        setData(prev => ({
          ...prev,
          overview: overviewRes.data.data,
          batches: batchesRes.data.data || [],
          trainers: trainersRes.data.data || []
        }));
      } else if (tab === 'courses') {
        const [coursesRes] = await Promise.all([itCoursesAPI.getCourses()]);
        setData(prev => ({ ...prev, courses: coursesRes.data.data || [] }));
      } else if (tab === 'batches') {
        const [batchesRes, profitabilityRes, coursesRes, trainersRes] = await Promise.all([
          itCoursesAPI.getBatches(),
          itCoursesAPI.getBatchProfitability(),
          itCoursesAPI.getCourses(),
          itCoursesAPI.getTrainers()
        ]);
        setData(prev => ({
          ...prev,
          batches: batchesRes.data.data || [],
          batchProfitability: profitabilityRes.data.data || [],
          courses: coursesRes.data.data || [],
          trainers: trainersRes.data.data || []
        }));
      } else if (tab === 'trainers') {
        const [trainersRes, batchesRes] = await Promise.all([
          itCoursesAPI.getTrainers(),
          itCoursesAPI.getBatches()
        ]);
        setData(prev => ({
          ...prev,
          trainers: trainersRes.data.data || [],
          batches: batchesRes.data.data || []
        }));
      } else if (tab === 'enrollments') {
        const res = await itCoursesAPI.getEnrollments({
          search: filters.search,
          status: filters.status,
          batch_id: filters.batch_id
        });
        setData(prev => ({ ...prev, enrollments: res.data.data || [] }));
      } else if (tab === 'defaulters') {
        const [defRes] = await Promise.all([itCoursesAPI.getDefaulters({
          search: filters.search || undefined,
          age_bucket: filters.age_bucket || undefined,
          reminder_status: filters.reminder_status || undefined
        })]);
        setData(prev => ({ ...prev, defaulters: defRes.data.data || [] }));
      } else if (tab === 'reports') {
        const res = await itCoursesAPI.getReportSummary({
          from: filters.from || undefined,
          to: filters.to || undefined,
          month: filters.month,
          year: filters.year
        });
        setData(prev => ({ ...prev, reportSummary: res.data.data || null }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to load ${tab} data`);
    } finally {
      setLoading(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setProcessing(true);
      if (showModal === 'course') {
        if (form.id) await itCoursesAPI.updateCourse(form.id, form);
        else await itCoursesAPI.createCourse(form);
      } else if (showModal === 'batch') {
        if (form.id) await itCoursesAPI.updateBatch(form.id, form);
        else await itCoursesAPI.createBatch(form);
      } else if (showModal === 'enrollment') {
        if (form.id) await itCoursesAPI.updateEnrollment(form.id, form);
        else await itCoursesAPI.createEnrollment(form);
      } else if (showModal === 'trainer') {
        if (form.id) await itCoursesAPI.updateTrainer(form.id, form);
        else await itCoursesAPI.createTrainer(form);
      } else if (showModal === 'payment') {
        await itCoursesAPI.collectEnrollmentPayment(form.enrollment_id, form);
      } else if (showModal === 'followup') {
        await itCoursesAPI.addEnrollmentFollowup(form.enrollment_id, form);
      } else if (showModal === 'reminderSchedule') {
        await itCoursesAPI.scheduleDefaulterReminder(form.enrollment_id, { next_reminder_date: form.next_reminder_date });
      } else if (showModal === 'promiseToPay') {
        await itCoursesAPI.runDefaulterAction(form.enrollment_id, {
          action: 'promise_to_pay',
          promise_to_pay_date: form.promise_to_pay_date,
          notes: form.notes
        });
      }
      toast.success('Saved successfully');
      setShowModal(null);
      setForm({});
      loadTabContent(activeTab);
      if (activeTab === 'defaulters' && selectedDefaulter?.id) {
        loadDefaulterTimeline(selectedDefaulter.id, selectedDefaulter.student_name);
      }
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) serverError.errors.forEach(err => toast.error(err.msg));
      else toast.error(serverError?.message || 'Operation failed');
    } finally {
      setProcessing(false);
    }
  };

  const updateEnrollmentStatus = async (id, status) => {
    try {
      setProcessing(true);
      await itCoursesAPI.updateEnrollmentStatus(id, { status });
      toast.success(`Enrollment set to ${status}`);
      loadTabContent('enrollments');
      loadTabContent('defaulters');
      loadTabContent('overview');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Status update failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      setProcessing(true);
      if (type === 'course') await itCoursesAPI.deleteCourse(id);
      if (type === 'batch') await itCoursesAPI.deleteBatch(id);
      if (type === 'trainer') await itCoursesAPI.deleteTrainer(id);
      toast.success('Deleted');
      loadTabContent(activeTab);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleTrainerStatusToggle = async (trainer) => {
    try {
      setProcessing(true);
      const nextStatus = trainer.status === 'active' ? 'inactive' : 'active';
      await itCoursesAPI.updateTrainer(trainer.id, { status: nextStatus });
      toast.success(`Trainer marked ${nextStatus}`);
      loadTabContent('trainers');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Trainer status update failed');
    } finally {
      setProcessing(false);
    }
  };

  const loadDefaulterTimeline = async (enrollmentId, studentName) => {
    try {
      const res = await itCoursesAPI.getEnrollmentFollowups(enrollmentId);
      setSelectedDefaulter({ id: enrollmentId, student_name: studentName });
      setDefaulterTimeline(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load follow-up timeline');
    }
  };

  const handleDefaulterAction = async (row, action) => {
    try {
      setProcessing(true);
      await itCoursesAPI.runDefaulterAction(row.id, { action });
      toast.success(`Action logged: ${action.replace(/_/g, ' ')}`);
      await loadTabContent('defaulters');
      if (selectedDefaulter?.id === row.id) {
        await loadDefaulterTimeline(row.id, row.student_name);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Defaulter action failed');
    } finally {
      setProcessing(false);
    }
  };

  const openStudentInfo = async (row) => {
    setShowModal('studentInfo');
    setForm(row);
    setStudentInfoData({ loading: true, payments: [], followups: [] });
    try {
      const [paymentsRes, followupsRes] = await Promise.all([
        itCoursesAPI.getEnrollmentPayments(row.id),
        itCoursesAPI.getEnrollmentFollowups(row.id)
      ]);
      setStudentInfoData({
        loading: false,
        payments: paymentsRes.data.data || [],
        followups: followupsRes.data.data || []
      });
    } catch (error) {
      setStudentInfoData({ loading: false, payments: [], followups: [] });
      toast.error(error.response?.data?.message || 'Failed to load student details');
    }
  };

  const openTrainerInfo = (row) => {
    const assignedBatches = data.batches.filter(batch => Number(batch.trainer_id) === Number(row.id));
    setTrainerInfoBatches(assignedBatches);
    setForm(row);
    setShowModal('trainerInfo');
  };

  const exportReport = async () => {
    try {
      const res = await itCoursesAPI.exportReportCSV({
        from: filters.from || undefined,
        to: filters.to || undefined,
        month: filters.month,
        year: filters.year
      });
      downloadBlob(res.data, 'it-courses-report.csv');
      toast.success('Report exported');
    } catch {
      toast.error('Report export failed');
    }
  };

  const handleResetAllData = async () => {
    const ok = window.confirm('This will permanently delete all IT Courses data (courses, batches, trainers, enrollments, collections, follow-ups, reports basis). Continue?');
    if (!ok) return;
    try {
      setProcessing(true);
      await itCoursesAPI.resetData();
      toast.success('IT Courses data reset successfully');
      setSelectedDefaulter(null);
      setDefaulterTimeline([]);
      loadTabContent(activeTab);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset IT Courses data');
    } finally {
      setProcessing(false);
    }
  };

  const courseColumns = [
    { header: 'Course', key: 'name', render: (v, r) => <div><p className="font-medium text-white">{v}</p><p className="text-xs text-dark-400">{r.category || '-'}</p></div> },
    { header: 'Duration', key: 'duration' },
    { header: 'Fee', key: 'fee', render: v => <CurrencyCell value={v} /> },
    { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
    { header: 'Actions', key: 'id', render: (v, r) => <div className="flex gap-2"><button onClick={() => { setShowModal('course'); setForm(r); }} className="text-blue-400"><HiOutlinePlus className="w-5 h-5 rotate-45" /></button><button onClick={() => handleDelete('course', v)} className="text-red-400"><HiOutlineTrash className="w-5 h-5" /></button></div> }
  ];
  const batchColumns = [
    { header: 'Batch', key: 'batch_name', render: (v, r) => <div><p className="font-medium text-white">{v}</p><p className="text-xs text-dark-400">{r.batch_code || '-'}</p></div> },
    { header: 'Course', key: 'course_name' },
    { header: 'Trainer', key: 'trainer_name', render: v => v || 'Unassigned' },
    { header: 'Students', key: 'current_students', render: (v, r) => `${v}/${r.max_students} (${Number(r.occupancy_percent || 0).toFixed(1)}%)` },
    { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
    { header: 'Actions', key: 'id', render: (v, r) => <div className="flex gap-2"><button onClick={() => { setShowModal('batch'); setForm(r); }} className="text-blue-400"><HiOutlinePlus className="w-5 h-5 rotate-45" /></button><button onClick={() => handleDelete('batch', v)} className="text-red-400"><HiOutlineTrash className="w-5 h-5" /></button></div> }
  ];
  const enrollmentColumns = [
    { header: 'Student', key: 'student_name', render: (v, r) => <div><p className="font-medium text-white">{v}</p><p className="text-xs text-dark-400">{r.phone || r.email || '-'}</p></div> },
    { header: 'Batch', key: 'batch_name' },
    { header: 'Paid', key: 'fee_paid', render: v => <CurrencyCell value={v} /> },
    { header: 'Pending', key: 'fee_pending_calc', render: v => <CurrencyCell value={v} className={Number(v) > 0 ? 'text-amber-400' : ''} /> },
    { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
    {
      header: 'Actions', key: 'id', render: (v, r) => (
        <div className="flex gap-2">
          <button onClick={() => openStudentInfo(r)} className="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-white">Info</button>
          <button onClick={() => { setShowModal('payment'); setForm({ enrollment_id: v, payment_date: new Date().toISOString().slice(0, 10), amount: '' }); }} className="text-green-400"><HiOutlineCash className="w-5 h-5" /></button>
          <button onClick={() => { setShowModal('followup'); setForm({ enrollment_id: v, followup_date: new Date().toISOString().slice(0, 10), channel: 'call' }); }} className="text-amber-400"><HiOutlineDocumentReport className="w-5 h-5" /></button>
          <button onClick={() => updateEnrollmentStatus(v, r.status === 'active' ? 'completed' : 'active')} className="text-blue-400"><HiOutlineCheckCircle className="w-5 h-5" /></button>
        </div>
      )
    }
  ];

  const trainerRows = data.trainers
    .map(trainer => {
      const assignedBatches = data.batches.filter(batch => Number(batch.trainer_id) === Number(trainer.id));
      const activeBatches = assignedBatches.filter(batch => ['active', 'upcoming'].includes(batch.status));
      const totalStudents = assignedBatches.reduce((sum, batch) => sum + Number(batch.current_students || 0), 0);
      return {
        ...trainer,
        assigned_batches: assignedBatches.length,
        active_batches: activeBatches.length,
        total_students: totalStudents
      };
    })
    .filter(trainer => {
      const q = (filters.search || '').trim().toLowerCase();
      const matchesSearch = !q || [trainer.name, trainer.specialization, trainer.email, trainer.phone]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
      const trainerStatusFilter = ['active', 'inactive'].includes(filters.status) ? filters.status : '';
      const matchesStatus = !trainerStatusFilter || trainer.status === trainerStatusFilter;
      return matchesSearch && matchesStatus;
    });

  const overviewRevenueTrendBars = (data.overview?.revenueTrend || []).map(row => ({
    name: row.period || '-',
    total: Number(row.total || 0)
  }));
  const overviewCourseRevenueBreakdown = (data.overview?.courseRevenue || [])
    .filter(row => Number(row.revenue || 0) > 0)
    .map(row => ({
      name: row.name || 'Unknown',
      total: Number(row.revenue || 0)
    }));

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"> IT Courses Training</h1>
          <p className="text-dark-400 mt-1">Lifecycle, batches, collections and defaulters</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'courses' && <button onClick={() => { setShowModal('course'); setForm({ status: 'active' }); }} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> New Course</button>}
          {activeTab === 'batches' && <button onClick={() => { setShowModal('batch'); setForm({ status: 'upcoming', max_students: 30 }); }} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> New Batch</button>}
          {(activeTab === 'batches' || activeTab === 'trainers') && <button onClick={() => { setShowModal('trainer'); setForm({ payment_type: 'salary', status: 'active' }); }} className="btn-secondary"><HiOutlinePlus className="w-4 h-4" /> New Trainer</button>}
          {activeTab === 'enrollments' && <button onClick={() => { setShowModal('enrollment'); setForm({ enrollment_date: new Date().toISOString().slice(0, 10), status: 'active' }); }} className="btn-success"><HiOutlinePlus className="w-4 h-4" /> Enroll Student</button>}
          <button onClick={handleResetAllData} disabled={processing} className="p-3 rounded-lg bg-red-600">{processing ? 'Resetting...' : 'Reset All Data'}</button>
          <button onClick={() => loadTabContent(activeTab)} className="btn-secondary"><HiOutlineRefresh className="w-4 h-4" /></button>
        </div>
      </div>
 <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setSearchParams({ tab })} className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>{tab}</button>
        ))}
      </div>
      {activeTab === 'overview' && data.overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Monthly Revenue" value={Number(data.overview.monthlyRevenue || 0)} icon={HiOutlineCash} color="green" />
            <SummaryCard title="Monthly Profit" value={Number(data.overview.monthlyProfit || 0)} icon={HiOutlineCollection} color={Number(data.overview.monthlyProfit || 0) >= 0 ? 'blue' : 'red'} />
            <SummaryCard title="Collection Rate" value={`${Number(data.overview.collectionRate || 0)}%`} raw icon={HiOutlineCheckCircle} color="cyan" />
            <SummaryCard title="Defaulters" value={Number(data.overview.defaultersCount || 0)} raw icon={HiOutlineXCircle} color="amber" subtitle={`Receivables: Rs ${Number(data.overview.totalFeePending || 0).toLocaleString()}`} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RevenueBarChart data={overviewRevenueTrendBars} title="Revenue Trend (Last 6 Months)" />
            <ExpensePieChart data={overviewCourseRevenueBreakdown} title="Course Revenue Distribution" />
          </div>
        </div>
      )}

      {['trainers', 'enrollments', 'defaulters', 'reports'].includes(activeTab) && (
        <div className="flex flex-wrap gap-3 bg-dark-800/50 p-4 rounded-xl border border-dark-700">
          {activeTab === 'trainers' && (
            <>
              <input className="input-sm text-gray-700" placeholder="Search trainer..." value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} />
              <select className="select-sm text-gray-700" value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
                <option value="">All Status</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </>
          )}
          {activeTab === 'enrollments' && (
            <>
              <input className="input-sm text-gray-700" placeholder="Search..." value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} />
              <select className="select-sm text-gray-700" value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
                <option value="">All Status</option><option value="active">active</option><option value="completed">completed</option><option value="dropped">dropped</option><option value="refunded">refunded</option><option value="deferred">deferred</option>
              </select>
              <select className="select-sm text-gray-700" value={filters.batch_id} onChange={e => setFilters(prev => ({ ...prev, batch_id: e.target.value }))}>
                <option value="">All Batches</option>
                {data.batches.map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
              </select>
            </>
          )}
          {activeTab === 'defaulters' && (
            <>
              <input className="input-sm text-gray-700" placeholder="Search student/batch..." value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} />
              <select className="select-sm text-gray-700" value={filters.age_bucket} onChange={e => setFilters(prev => ({ ...prev, age_bucket: e.target.value }))}>
                <option value="">All Aging</option>
                <option value="0-30">0-30</option>
                <option value="31-60">31-60</option>
                <option value="60+">60+</option>
              </select>
              <select className="select-sm text-gray-700" value={filters.reminder_status} onChange={e => setFilters(prev => ({ ...prev, reminder_status: e.target.value }))}>
                <option value="">All Reminder Status</option>
                <option value="none">none</option>
                <option value="scheduled">scheduled</option>
                <option value="due_today">due_today</option>
                <option value="overdue">overdue</option>
              </select>
            </>
          )}
          {activeTab === 'reports' && (
            <>
              <input type="date" className="input-sm text-gray-700" value={filters.from} onChange={e => setFilters(prev => ({ ...prev, from: e.target.value }))} />
              <input type="date" className="input-sm text-gray-700" value={filters.to} onChange={e => setFilters(prev => ({ ...prev, to: e.target.value }))} />
              <button onClick={exportReport} className="btn-success-outline btn-sm"><HiOutlineDocumentReport className="w-4 h-4" /> Export CSV</button>
            </>
          )}
        </div>
      )}

     

      <div className="card">
        {activeTab === 'courses' && <DataTable columns={courseColumns} data={data.courses} />}
        {activeTab === 'batches' && (
          <div className="space-y-6">
            <DataTable columns={batchColumns} data={data.batches} />
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Batch Profitability</h3>
              <DataTable
                columns={[
                  { header: 'Batch', key: 'batch_name' },
                  { header: 'Course', key: 'course_name' },
                  { header: 'Revenue', key: 'revenue', render: v => <CurrencyCell value={v} /> },
                  { header: 'Trainer Cost', key: 'trainer_cost', render: v => <CurrencyCell value={v} /> },
                  { header: 'Profit', key: 'profit', render: v => <CurrencyCell value={v} className={Number(v) >= 0 ? 'text-green-400' : 'text-red-400'} /> }
                ]}
                data={data.batchProfitability}
              />
            </div>
          </div>
        )}
        {activeTab === 'trainers' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-dark-800/60 rounded-lg border border-dark-700 p-3">
                <p className="text-xs text-dark-400">Total Trainers</p>
                <p className="text-lg font-semibold text-white">{trainerRows.length}</p>
              </div>
              <div className="bg-dark-800/60 rounded-lg border border-dark-700 p-3">
                <p className="text-xs text-dark-400">Active Trainers</p>
                <p className="text-lg font-semibold text-green-400">{trainerRows.filter(t => t.status === 'active').length}</p>
              </div>
              <div className="bg-dark-800/60 rounded-lg border border-dark-700 p-3">
                <p className="text-xs text-dark-400">Assigned Batches</p>
                <p className="text-lg font-semibold text-cyan-400">{trainerRows.reduce((sum, t) => sum + Number(t.assigned_batches || 0), 0)}</p>
              </div>
            </div>
            <DataTable
              columns={[
                { header: 'Trainer', key: 'name', render: (v, r) => <div><p className="font-medium text-white">{v}</p><p className="text-xs text-dark-400">{r.specialization || '-'}</p></div> },
                { header: 'Contact', key: 'email', render: (v, r) => <div><p className="text-sm text-white">{v || '-'}</p><p className="text-xs text-dark-400">{r.phone || '-'}</p></div> },
                { header: 'Payment Model', key: 'payment_type' },
                {
                  header: 'Rate',
                  key: 'salary',
                  render: (v, r) => {
                    if (r.payment_type === 'per_batch') return <CurrencyCell value={r.per_batch_fee} />;
                    if (r.payment_type === 'per_hour') return <CurrencyCell value={r.per_hour_fee || 0} />;
                    return <CurrencyCell value={v} />;
                  }
                },
                { header: 'Workload', key: 'assigned_batches', render: (v, r) => `${r.active_batches}/${v} batches | ${r.total_students} students` },
                { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
                {
                  header: 'Actions',
                  key: 'id',
                  render: (v, r) => (
                    <div className="flex gap-2">
                      <button onClick={() => openTrainerInfo(r)} className="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-white">Info</button>
                      <button onClick={() => { setShowModal('trainer'); setForm(r); }} className="text-blue-400"><HiOutlinePlus className="w-5 h-5 rotate-45" /></button>
                      <button onClick={() => handleTrainerStatusToggle(r)} className={r.status === 'active' ? 'text-amber-400' : 'text-green-400'}>
                        {r.status === 'active' ? <HiOutlineXCircle className="w-5 h-5" /> : <HiOutlineCheckCircle className="w-5 h-5" />}
                      </button>
                      <button onClick={() => handleDelete('trainer', v)} className="text-red-400"><HiOutlineTrash className="w-5 h-5" /></button>
                    </div>
                  )
                }
              ]}
              data={trainerRows}
            />
          </div>
        )}
        {activeTab === 'enrollments' && <DataTable columns={enrollmentColumns} data={data.enrollments} />}
        {activeTab === 'defaulters' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-dark-800/60 rounded-lg border border-dark-700 p-3">
                <p className="text-xs text-dark-400">0-30 Days</p>
                <p className="text-lg font-semibold text-white">{data.defaulters.filter(d => d.age_bucket === '0-30').length}</p>
              </div>
              <div className="bg-dark-800/60 rounded-lg border border-dark-700 p-3">
                <p className="text-xs text-dark-400">31-60 Days</p>
                <p className="text-lg font-semibold text-amber-400">{data.defaulters.filter(d => d.age_bucket === '31-60').length}</p>
              </div>
              <div className="bg-dark-800/60 rounded-lg border border-dark-700 p-3">
                <p className="text-xs text-dark-400">60+ Days</p>
                <p className="text-lg font-semibold text-red-400">{data.defaulters.filter(d => d.age_bucket === '60+').length}</p>
              </div>
            </div>
            <DataTable
              columns={[
                { header: 'Student', key: 'student_name', render: (v, r) => <div><p className="font-medium text-white">{v}</p><p className="text-xs text-dark-400">{r.phone || '-'} {r.email ? `| ${r.email}` : ''}</p></div> },
                { header: 'Batch', key: 'batch_name' },
                { header: 'Enroll Date', key: 'enrollment_date', render: v => v ? format(new Date(v), 'MMM dd, yyyy') : '-' },
                { header: 'Total Fee', key: 'total_fee', render: v => <CurrencyCell value={v} /> },
                { header: 'Paid', key: 'fee_paid', render: v => <CurrencyCell value={v} className="text-green-400" /> },
                { header: 'Discount', key: 'discount', render: v => <CurrencyCell value={v} /> },
                { header: 'Pending', key: 'pending_amount', render: v => <CurrencyCell value={v} className="text-amber-400" /> },
                { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
                { header: 'Aging', key: 'age_bucket', render: v => <StatusBadge status={v} /> },
                { header: 'Days', key: 'days_since_enrollment' },
                { header: 'Priority', key: 'priority_score', render: v => <span className={`font-semibold ${Number(v) >= 70 ? 'text-red-400' : Number(v) >= 40 ? 'text-amber-400' : 'text-green-400'}`}>{Number(v || 0).toFixed(1)}</span> },
                { header: 'Last Contact', key: 'last_contacted_at', render: v => v ? format(new Date(v), 'MMM dd, yyyy') : '-' },
                { header: 'Reminder', key: 'reminder_status', render: v => <StatusBadge status={v} /> },
                {
                  header: 'Actions', key: 'id', render: (v, r) => (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openStudentInfo(r)} className="px-2 py-1 rounded text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300">Info</button>
                      <button onClick={() => handleDefaulterAction(r, 'call')} disabled={processing} className="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-white">Call</button>
                      <button onClick={() => handleDefaulterAction(r, 'whatsapp')} disabled={processing} className="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-white">WhatsApp</button>
                      <button onClick={() => handleDefaulterAction(r, 'send_reminder')} disabled={processing} className="px-2 py-1 rounded text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-300">Send Reminder</button>
                      <button onClick={() => { setShowModal('promiseToPay'); setForm({ enrollment_id: v, promise_to_pay_date: new Date().toISOString().slice(0, 10), notes: '' }); }} className="px-2 py-1 rounded text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300">Promise</button>
                      <button onClick={() => { setShowModal('payment'); setForm({ enrollment_id: v, payment_date: new Date().toISOString().slice(0, 10), amount: '', notes: 'Partial payment from defaulter tab' }); }} className="px-2 py-1 rounded text-xs bg-green-600/20 hover:bg-green-600/30 text-green-300">Collect</button>
                      <button onClick={() => { setShowModal('reminderSchedule'); setForm({ enrollment_id: v, next_reminder_date: r.next_reminder_date || new Date().toISOString().slice(0, 10) }); }} className="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-white">Schedule</button>
                      <button onClick={() => loadDefaulterTimeline(v, r.student_name)} className="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-white">Timeline</button>
                    </div>
                  )
                }
              ]}
              data={data.defaulters}
            />
            {selectedDefaulter && (
              <div className="bg-dark-900/60 border border-dark-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">Follow-up Timeline: {selectedDefaulter.student_name}</h4>
                  <button className="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-white" onClick={() => { setSelectedDefaulter(null); setDefaulterTimeline([]); }}>Close</button>
                </div>
                <DataTable
                  columns={[
                    { header: 'Date', key: 'followup_date', render: v => v ? format(new Date(v), 'MMM dd, yyyy') : '-' },
                    { header: 'Action', key: 'action_type', render: v => v || 'note' },
                    { header: 'Channel', key: 'channel' },
                    { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
                    { header: 'Notes', key: 'notes', render: v => v || '-' },
                    { header: 'By', key: 'created_by_name', render: v => v || '-' }
                  ]}
                  data={defaulterTimeline}
                  emptyMessage="No follow-up timeline available"
                />
              </div>
            )}
          </div>
        )}
        {activeTab === 'reports' && data.reportSummary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard title="Revenue" value={Number(data.reportSummary.revenue || 0)} icon={HiOutlineCash} color="green" />
              <SummaryCard title="Expenses" value={Number(data.reportSummary.expenses || 0)} icon={HiOutlineCollection} color="amber" />
              <SummaryCard title="Profit" value={Number(data.reportSummary.profit || 0)} icon={HiOutlineCheckCircle} color={Number(data.reportSummary.profit || 0) >= 0 ? 'blue' : 'red'} />
              <SummaryCard title="Receivables" value={Number(data.reportSummary.receivables || 0)} icon={HiOutlineUserGroup} color="purple" />
            </div>
            <DataTable
              columns={[
                { header: 'Batch', key: 'batch_name' },
                { header: 'Course', key: 'course_name' },
                { header: 'Revenue', key: 'revenue', render: v => <CurrencyCell value={v} /> },
                { header: 'Trainer Cost', key: 'trainer_cost', render: v => <CurrencyCell value={v} /> },
                { header: 'Profit', key: 'profit', render: v => <CurrencyCell value={v} className={Number(v) >= 0 ? 'text-green-400' : 'text-red-400'} /> }
              ]}
              data={data.reportSummary.batchProfitability || []}
            />
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {showModal === 'studentInfo' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Student Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-dark-400">Name</p><p className="text-white">{form.student_name || '-'}</p></div>
                  <div><p className="text-dark-400">Batch</p><p className="text-white">{form.batch_name || '-'}</p></div>
                  <div><p className="text-dark-400">Phone</p><p className="text-white">{form.phone || '-'}</p></div>
                  <div><p className="text-dark-400">Email</p><p className="text-white">{form.email || '-'}</p></div>
                  <div><p className="text-dark-400">Enrollment Date</p><p className="text-white">{form.enrollment_date ? format(new Date(form.enrollment_date), 'MMM dd, yyyy') : '-'}</p></div>
                  <div><p className="text-dark-400">Status</p><p className="text-white">{form.status || '-'}</p></div>
                  <div><p className="text-dark-400">Total Fee</p><p className="text-white">Rs {Number(form.total_fee || 0).toLocaleString()}</p></div>
                  <div><p className="text-dark-400">Paid</p><p className="text-green-400">Rs {Number(form.fee_paid || 0).toLocaleString()}</p></div>
                  <div><p className="text-dark-400">Discount</p><p className="text-white">Rs {Number(form.discount || 0).toLocaleString()}</p></div>
                  <div><p className="text-dark-400">Pending</p><p className="text-amber-400">Rs {Number((form.total_fee || 0) - (form.fee_paid || 0)).toLocaleString()}</p></div>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Payment History</h4>
                  {studentInfoData.loading ? <p className="text-dark-400 text-sm">Loading...</p> : (
                    <DataTable
                      columns={[
                        { header: 'Date', key: 'payment_date', render: v => v ? format(new Date(v), 'MMM dd, yyyy') : '-' },
                        { header: 'Amount', key: 'amount', render: v => <CurrencyCell value={v} /> },
                        { header: 'Method', key: 'payment_method' },
                        { header: 'Notes', key: 'notes', render: v => v || '-' }
                      ]}
                      data={studentInfoData.payments}
                      emptyMessage="No payments found"
                    />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Follow-ups</h4>
                  {studentInfoData.loading ? <p className="text-dark-400 text-sm">Loading...</p> : (
                    <DataTable
                      columns={[
                        { header: 'Date', key: 'followup_date', render: v => v ? format(new Date(v), 'MMM dd, yyyy') : '-' },
                        { header: 'Action', key: 'action_type', render: v => v || 'note' },
                        { header: 'Channel', key: 'channel' },
                        { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
                        { header: 'Notes', key: 'notes', render: v => v || '-' }
                      ]}
                      data={studentInfoData.followups}
                      emptyMessage="No follow-ups found"
                    />
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(null)} className="btn-secondary w-full">Close</button>
                </div>
              </div>
            )}
            {showModal === 'trainerInfo' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Trainer Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-dark-400">Name</p><p className="text-white">{form.name || '-'}</p></div>
                  <div><p className="text-dark-400">Status</p><p className="text-white">{form.status || '-'}</p></div>
                  <div><p className="text-dark-400">Email</p><p className="text-white">{form.email || '-'}</p></div>
                  <div><p className="text-dark-400">Phone</p><p className="text-white">{form.phone || '-'}</p></div>
                  <div><p className="text-dark-400">Specialization</p><p className="text-white">{form.specialization || '-'}</p></div>
                  <div><p className="text-dark-400">Payment Type</p><p className="text-white">{form.payment_type || '-'}</p></div>
                  <div><p className="text-dark-400">Salary</p><p className="text-white">Rs {Number(form.salary || 0).toLocaleString()}</p></div>
                  <div><p className="text-dark-400">Per Batch Fee</p><p className="text-white">Rs {Number(form.per_batch_fee || 0).toLocaleString()}</p></div>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Assigned Batches</h4>
                  <DataTable
                    columns={[
                      { header: 'Batch', key: 'batch_name' },
                      { header: 'Course', key: 'course_name' },
                      { header: 'Students', key: 'current_students', render: (v, r) => `${v}/${r.max_students}` },
                      { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> }
                    ]}
                    data={trainerInfoBatches}
                    emptyMessage="No batches assigned"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(null)} className="btn-secondary w-full">Close</button>
                </div>
              </div>
            )}
            {!['studentInfo', 'trainerInfo'].includes(showModal) && <><h3 className="text-xl font-bold text-white mb-5 capitalize">{form.id ? 'Edit' : 'Add'} {showModal}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {showModal === 'course' && <>
                <input className="input" placeholder="Course name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" placeholder="Category" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} />
                  <input className="input" placeholder="Duration" value={form.duration || ''} onChange={e => setForm({ ...form, duration: e.target.value })} />
                </div>
                <input type="number" className="input" placeholder="Fee" required value={form.fee || ''} onChange={e => setForm({ ...form, fee: e.target.value })} />
                <select className="select" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="upcoming">upcoming</option>
                </select>
              </>}
              {showModal === 'batch' && <>
                <div>
                  <label className="label">Course</label>
                  <select className="select" required value={form.course_id || ''} onChange={e => setForm({ ...form, course_id: e.target.value })}>
                    <option value="">Select Course</option>
                    {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Trainer</label>
                  <select className="select" value={form.trainer_id || ''} onChange={e => setForm({ ...form, trainer_id: e.target.value || null })}>
                    <option value="">Select Trainer</option>
                    {data.trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Batch Name</label>
                    <input className="input" placeholder="Batch Name" required value={form.batch_name || ''} onChange={e => setForm({ ...form, batch_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Batch Code</label>
                    <input className="input" placeholder="Batch Code" value={form.batch_code || ''} onChange={e => setForm({ ...form, batch_code: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Start Date</label>
                    <input type="date" className="input" required value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input type="date" className="input" value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Max Students</label>
                  <input type="number" className="input" placeholder="Max Students" value={form.max_students || 30} onChange={e => setForm({ ...form, max_students: e.target.value })} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select" value={form.status || 'upcoming'} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="upcoming">upcoming</option>
                    <option value="active">active</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
              </>}
              {showModal === 'enrollment' && <>
                <div>
                  <label className="label">Batch</label>
                  <select className="select" required value={form.batch_id || ''} onChange={e => setForm({ ...form, batch_id: e.target.value })}>
                    <option value="">Select Batch</option>
                    {data.batches.filter(b => b.status === 'active' || b.status === 'upcoming').map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Student Name</label>
                  <input className="input" placeholder="Student Name" required value={form.student_name || ''} onChange={e => setForm({ ...form, student_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" placeholder="Phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" placeholder="Email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Total Fee</label>
                    <input type="number" className="input" placeholder="Total Fee" required value={form.total_fee || ''} onChange={e => setForm({ ...form, total_fee: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Discount</label>
                    <input type="number" className="input" placeholder="Discount" value={form.discount || 0} onChange={e => setForm({ ...form, discount: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Initial Paid</label>
                    <input type="number" className="input" placeholder="Initial Paid" value={form.fee_paid || 0} onChange={e => setForm({ ...form, fee_paid: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Enrollment Date</label>
                  <input type="date" className="input" required value={form.enrollment_date || ''} onChange={e => setForm({ ...form, enrollment_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">active</option>
                    <option value="deferred">deferred</option>
                  </select>
                </div>
              </>}
              {showModal === 'trainer' && <>
                <div>
                  <label className="label">Trainer Name</label>
                  <input className="input" placeholder="Name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" placeholder="Email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" placeholder="Phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Specialization</label>
                    <input className="input" placeholder="Specialization" value={form.specialization || ''} onChange={e => setForm({ ...form, specialization: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Payment Type</label>
                    <select className="select" value={form.payment_type || 'salary'} onChange={e => setForm({ ...form, payment_type: e.target.value })}>
                      <option value="salary">salary</option>
                      <option value="per_batch">per_batch</option>
                      <option value="per_hour">per_hour</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Salary</label>
                    <input type="number" className="input" placeholder="Salary" value={form.salary || 0} onChange={e => setForm({ ...form, salary: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Per Batch Fee</label>
                    <input type="number" className="input" placeholder="Per Batch Fee" value={form.per_batch_fee || 0} onChange={e => setForm({ ...form, per_batch_fee: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
              </>}
              {showModal === 'payment' && <><input type="number" className="input" placeholder="Amount" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /><input type="date" className="input" required value={form.payment_date || ''} onChange={e => setForm({ ...form, payment_date: e.target.value })} /><select className="select" value={form.payment_method || 'cash'} onChange={e => setForm({ ...form, payment_method: e.target.value })}><option value="cash">cash</option><option value="bank_transfer">bank_transfer</option><option value="online">online</option><option value="card">card</option></select><textarea className="input h-20" placeholder="Notes" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}></textarea></>}
              {showModal === 'followup' && <><input type="date" className="input" required value={form.followup_date || ''} onChange={e => setForm({ ...form, followup_date: e.target.value })} /><select className="select" value={form.channel || 'call'} onChange={e => setForm({ ...form, channel: e.target.value })}><option value="call">call</option><option value="whatsapp">whatsapp</option><option value="email">email</option><option value="in_person">in_person</option></select><select className="select" value={form.status || 'pending'} onChange={e => setForm({ ...form, status: e.target.value })}><option value="pending">pending</option><option value="done">done</option><option value="escalated">escalated</option></select><textarea className="input h-20" placeholder="Notes" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}></textarea></>}
              {showModal === 'reminderSchedule' && <>
                <div>
                  <label className="label">Next Reminder Date</label>
                  <input type="date" className="input" required value={form.next_reminder_date || ''} onChange={e => setForm({ ...form, next_reminder_date: e.target.value })} />
                </div>
                <p className="text-xs text-dark-400">This schedules an automatic reminder and updates last-contacted tracking.</p>
              </>}
              {showModal === 'promiseToPay' && <>
                <div>
                  <label className="label">Promise To Pay Date</label>
                  <input type="date" className="input" required value={form.promise_to_pay_date || ''} onChange={e => setForm({ ...form, promise_to_pay_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input h-24" placeholder="Promise details..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}></textarea>
                </div>
              </>}
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(null)} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={processing} className="btn-primary flex-1">{processing ? 'Saving...' : 'Save'}</button></div>
            </form>
            </>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ITCoursesPanel;
