import React, { useState, useEffect } from 'react';
import { itCoursesAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import { HiOutlineBookOpen, HiOutlineUserGroup, HiOutlineCash, HiOutlineCollection, HiOutlinePlus } from 'react-icons/hi';
import toast from 'react-hot-toast';

const ITCoursesPanel = () => {
  const [data, setData] = useState({
    overview: null,
    courses: [],
    batches: [],
    enrollments: [],
    trainers: []
  });
  const [activeTab, setActiveTab] = useState('courses');
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [overviewRes, coursesRes, batchesRes, enrollmentsRes, trainersRes] = await Promise.all([
        itCoursesAPI.getOverview(),
        itCoursesAPI.getCourses(),
        itCoursesAPI.getBatches(),
        itCoursesAPI.getEnrollments(),
        itCoursesAPI.getTrainers()
      ]);
      setData({
        overview: overviewRes.data.data,
        courses: coursesRes.data.data,
        batches: batchesRes.data.data,
        enrollments: enrollmentsRes.data.data,
        trainers: trainersRes.data.data
      });
    } catch (error) {
      toast.error('Failed to load IT Courses data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (showModal === 'course') await itCoursesAPI.createCourse(form);
      else if (showModal === 'batch') await itCoursesAPI.createBatch(form);
      else if (showModal === 'enrollment') await itCoursesAPI.createEnrollment(form);
      else if (showModal === 'trainer') await itCoursesAPI.createTrainer(form);

      toast.success('Successfully saved');
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  const courseColumns = [
    {
      header: 'Course', key: 'name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">{row.category}</p></div>
      )
    },
    { header: 'Duration', key: 'duration' },
    { header: 'Fee', key: 'fee', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  const batchColumns = [
    {
      header: 'Batch', key: 'batch_name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">Code: {row.batch_code}</p></div>
      )
    },
    { header: 'Course', key: 'course_name' },
    { header: 'Trainer', key: 'trainer_name' },
    { header: 'Students', key: 'current_students', render: (val, row) => `${val} / ${row.max_students}` },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  const enrollmentColumns = [
    { header: 'Student', key: 'student_name' },
    { header: 'Batch', key: 'batch_name' },
    { header: 'Paid', key: 'fee_paid', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Pending', key: 'fee_pending', render: (val) => <CurrencyCell value={val} className="text-red-400" /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">💻 IT Courses Training</h1>
          <p className="text-dark-400 mt-1">Courses, batches, and student enrollment</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('course'); setForm({ status: 'active' }); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> New Course
          </button>
          <button onClick={() => { setShowModal('enrollment'); setForm({ status: 'active' }); }} className="btn-success">
            <HiOutlinePlus className="w-4 h-4" /> Enroll Student
          </button>
        </div>
      </div>

      {data.overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Courses" value={data.overview.totalCourses} icon={HiOutlineBookOpen} color="blue" />
          <SummaryCard title="Active Batches" value={data.overview.activeBatches} icon={HiOutlineCollection} color="indigo" />
          <SummaryCard title="Enrollments (Monthly)" value={data.overview.monthlyEnrollments} icon={HiOutlineUserGroup} color="purple" />
          <SummaryCard title="Total Revenue" value={data.overview.totalRevenue} icon={HiOutlineCash} color="green" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
        {['courses', 'batches', 'enrollments'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'courses' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Available Courses ({data.courses.length})</h3>
            <DataTable columns={courseColumns} data={data.courses} />
          </>
        )}
        {activeTab === 'batches' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Active Batches ({data.batches.length})</h3>
            <DataTable columns={batchColumns} data={data.batches} />
          </>
        )}
        {activeTab === 'enrollments' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Student Enrollments ({data.enrollments.length})</h3>
            <DataTable columns={enrollmentColumns} data={data.enrollments} />
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'course' ? 'Create New Course' : showModal === 'enrollment' ? 'Enroll New Student' : 'Add New Batch'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {showModal === 'course' ? (
                <>
                  <div><label className="label">Course Name</label>
                    <input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Category</label>
                      <input className="input" placeholder="e.g. Programming" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                    <div><label className="label">Duration</label>
                      <input className="input" placeholder="e.g. 3 Months" value={form.duration || ''} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Fee</label>
                    <input type="number" className="input" required value={form.fee || ''} onChange={e => setForm({ ...form, fee: e.target.value })} /></div>
                  <div><label className="label">Description</label>
                    <textarea className="input h-24" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}></textarea></div>
                </>
              ) : showModal === 'enrollment' ? (
                <>
                  <div><label className="label">Student Name</label>
                    <input className="input" required value={form.student_name || ''} onChange={e => setForm({ ...form, student_name: e.target.value })} /></div>
                  <div><label className="label">Select Batch</label>
                    <select className="select" required value={form.batch_id || ''} onChange={e => setForm({ ...form, batch_id: e.target.value })}>
                      <option value="">Select Batch</option>
                      {data.batches.filter(b => b.status === 'active').map(b => <option key={b.id} value={b.id}>{b.batch_name} - {b.course_name}</option>)}
                    </select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Total Fee</label>
                      <input type="number" className="input" required value={form.total_fee || ''} onChange={e => setForm({ ...form, total_fee: e.target.value })} /></div>
                    <div><label className="label">Discount</label>
                      <input type="number" className="input" value={form.discount || 0} onChange={e => setForm({ ...form, discount: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Amount Paid</label>
                      <input type="number" className="input" required value={form.fee_paid || ''} onChange={e => setForm({ ...form, fee_paid: e.target.value })} /></div>
                    <div><label className="label">Enrollment Date</label>
                      <input type="date" className="input" required value={form.enrollment_date || ''} onChange={e => setForm({ ...form, enrollment_date: e.target.value })} /></div>
                  </div>
                </>
              ) : (
                <>
                  {/* Batch form */}
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

export default ITCoursesPanel;