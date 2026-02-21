import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ecomAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { StatusBadge, CurrencyCell } from '../components/tables/DataTable';
import { HiOutlineCurrencyDollar, HiOutlineCollection, HiOutlineDocumentText, HiOutlineUserGroup, HiOutlinePlus } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { opsAPI } from '../services/api';

const EcomPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [overview, setOverview] = useState(null);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [showModal, setShowModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [milestones, setMilestones] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [overviewRes, projectsRes, invoicesRes, clientsRes, quotesRes] = await Promise.all([
        ecomAPI.getOverview(),
        ecomAPI.getProjects(),
        ecomAPI.getInvoices(),
        ecomAPI.getClients(),
        opsAPI.getQuotes()
      ]);
      setOverview(overviewRes.data.data);
      setProjects(projectsRes.data.data);
      setInvoices(invoicesRes.data.data);
      setClients(clientsRes.data.data);
      setQuotes(quotesRes.data.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const [form, setForm] = useState({});

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await ecomAPI.createProject(form);
      toast.success('Project created!');
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Failed to create project');
      }
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await ecomAPI.createClient(form);
      toast.success('Client added!');
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Failed to add client');
      }
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  const handleViewMilestones = async (project) => {
    setSelectedProject(project);
    try {
      const res = await opsAPI.getMilestones(project.id);
      setMilestones(res.data.data);
      setShowModal('milestones');
    } catch (err) {
      toast.error('Failed to load milestones');
    }
  };

  const tabs = ['overview', 'projects', 'quotes', 'invoices', 'clients'];

  const projectColumns = [
    {
      header: 'Project', key: 'name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">{row.client_name}</p></div>
      )
    },
    { header: 'Type', key: 'type', render: (val) => <span className="badge-info">{val}</span> },
    { header: 'Total', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Paid', key: 'paid_amount', render: (val) => <CurrencyCell value={val} className="text-emerald-400" /> },
    { header: 'Cost', key: 'development_cost', render: (val, row) => <CurrencyCell value={parseFloat(val) + parseFloat(row.marketing_cost)} className="text-red-400" /> },
    { header: 'Profit', key: 'profit', render: (val) => <CurrencyCell value={val} className={val >= 0 ? 'text-emerald-400' : 'text-red-400'} /> },
    {
      header: 'Milestones',
      key: 'id',
      render: (_, p) => (
        <button onClick={() => handleViewMilestones(p)} className="text-primary-400 hover:text-primary-300 text-xs font-semibold">
          Manage
        </button>
      )
    },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  const invoiceColumns = [
    { header: 'Invoice #', key: 'invoice_number', render: (val) => <span className="font-mono text-primary-400">{val}</span> },
    { header: 'Client', key: 'client_name' },
    { header: 'Project', key: 'project_name' },
    { header: 'Amount', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Due Date', key: 'due_date', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { header: 'Approval', key: 'approval_status', render: (val) => <StatusBadge status={val} /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  const clientColumns = [
    {
      header: 'Client', key: 'name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">{row.company}</p></div>
      )
    },
    { header: 'Email', key: 'email' },
    { header: 'Phone', key: 'phone' },
    { header: 'Billed', key: 'total_billed', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Paid', key: 'total_paid', render: (val) => <CurrencyCell value={val} className="text-emerald-400" /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🌐 Ecom / POS / Website Sales</h1>
          <p className="text-dark-400 mt-1">Web development, SaaS & client management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('project'); setForm({}); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> New Project
          </button>
          <button onClick={() => { setShowModal('client'); setForm({}); }} className="btn-secondary">
            <HiOutlinePlus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setSearchParams({ tab })}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'projects' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">All Projects ({projects.length})</h3>
          <DataTable columns={projectColumns} data={projects} />
        </div>
      )}

      {activeTab === 'quotes' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">All Quotes ({quotes.length})</h3>
          </div>
          <DataTable
            columns={[
              { header: 'Quote #', key: 'quote_number' },
              { header: 'Client', key: 'client_name' },
              { header: 'Subject', key: 'subject' },
              { header: 'Amount', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
              { header: 'Valid Until', key: 'valid_until' },
              { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
            ]}
            data={quotes}
          />
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">All Invoices ({invoices.length})</h3>
          <DataTable columns={invoiceColumns} data={invoices} />
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">All Clients ({clients.length})</h3>
          <DataTable columns={clientColumns} data={clients} />
        </div>
      )}

      {/* Modals */}
      {showModal && (showModal === 'project' || showModal === 'client') && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'project' ? 'Create New Project' : 'Add New Client'}
            </h3>
            <form onSubmit={showModal === 'project' ? handleCreateProject : handleCreateClient} className="space-y-4">
              {showModal === 'project' ? (
                <>
                  <div><label className="label">Project Name</label>
                    <input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div><label className="label">Type</label>
                    <select className="select" required value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })}>
                      <option value="">Select Type</option>
                      <option value="website">Website</option>
                      <option value="ecommerce">E-Commerce</option>
                      <option value="pos">POS System</option>
                      <option value="saas">SaaS</option>
                      <option value="mobile_app">Mobile App</option>
                      <option value="custom">Custom</option>
                    </select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Total Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.total_amount || ''} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
                    <div><label className="label">Paid Amount</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.paid_amount || ''} onChange={e => setForm({ ...form, paid_amount: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Dev Cost</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.development_cost || ''} onChange={e => setForm({ ...form, development_cost: e.target.value })} /></div>
                    <div><label className="label">Marketing Cost</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.marketing_cost || ''} onChange={e => setForm({ ...form, marketing_cost: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Client</label>
                    <select className="select" value={form.client_id || ''} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                      <option value="">Select Client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
                    </select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Start Date</label>
                      <input type="date" className="input" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                    <div><label className="label">End Date</label>
                      <input type="date" className="input" value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
                  </div>
                </>
              ) : (
                <>
                  <div><label className="label">Full Name</label>
                    <input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div><label className="label">Company</label>
                    <input className="input" value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
                  <div><label className="label">Email</label>
                    <input type="email" className="input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  <div><label className="label">Phone</label>
                    <input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
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

      {/* Milestones Modal */}
      {showModal === 'milestones' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Milestones: {selectedProject?.name}</h3>
            <div className="space-y-4">
              <DataTable
                columns={[
                  { header: 'Milestone', key: 'name' },
                  { header: 'Amount', key: 'amount', render: (v) => <CurrencyCell value={v} /> },
                  { header: 'Due', key: 'due_date' },
                  { header: 'Status', key: 'status' },
                  {
                    header: 'Action',
                    key: 'id',
                    render: (id, m) => (
                      m.status === 'pending' && (
                        <button
                          onClick={async () => {
                            try {
                              await opsAPI.invoiceMilestone(id);
                              toast.success('Invoice created!');
                              handleViewMilestones(selectedProject);
                            } catch (err) {
                              toast.error('Failed to create invoice');
                            }
                          }}
                          className="text-primary-400 hover:text-primary-300 text-xs font-bold"
                        >
                          Send Invoice
                        </button>
                      )
                    )
                  }
                ]}
                data={milestones}
              />
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

export default EcomPanel;