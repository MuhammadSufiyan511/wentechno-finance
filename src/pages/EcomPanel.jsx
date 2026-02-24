import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ecomAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { StatusBadge, CurrencyCell } from '../components/tables/DataTable';
import { HiOutlineCurrencyDollar, HiOutlineCollection, HiOutlineDocumentText, HiOutlineUserGroup, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { opsAPI } from '../services/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

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
  const [projectDetails, setProjectDetails] = useState(null);
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
      if (form.id) {
        const payload = {
          client_id: form.client_id || null,
          name: form.name,
          type: form.type,
          description: form.description || null,
          total_amount: form.total_amount,
          paid_amount: form.paid_amount || 0,
          development_cost: form.development_cost || 0,
          marketing_cost: form.marketing_cost || 0,
          status: form.status || 'inquiry',
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          assigned_to: form.assigned_to || null,
          commission_rate: form.commission_rate || 0
        };
        await ecomAPI.updateProject(form.id, payload);
        toast.success('Project updated!');
      } else {
        await ecomAPI.createProject(form);
        toast.success('Project created!');
      }
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Failed to save project');
      }
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        const payload = {
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          company: form.company || null,
          address: form.address || null,
          status: form.status || 'active'
        };
        await ecomAPI.updateClient(form.id, payload);
        toast.success('Client updated!');
      } else {
        await ecomAPI.createClient(form);
        toast.success('Client added!');
      }
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Failed to save client');
      }
    }
  };

  const handleCreateQuote = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        const payload = {
          client_id: form.client_id,
          subject: form.subject,
          total_amount: form.total_amount,
          valid_until: form.valid_until,
          notes: form.notes || null,
          status: form.status || 'draft'
        };
        await opsAPI.updateQuote(form.id, payload);
        toast.success('Quote updated!');
      } else {
        await opsAPI.createQuote(form);
        toast.success('Quote created!');
      }
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Failed to save quote');
      }
    }
  };

  const handleDeleteProject = async (project) => {
    if (!window.confirm(`Delete project "${project.name}"?`)) return;
    try {
      await ecomAPI.deleteProject(project.id);
      toast.success('Project deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleMarkCompleted = async (project) => {
    try {
      await ecomAPI.updateProject(project.id, { status: 'completed' });
      toast.success('Project marked as completed');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark project as completed');
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`Delete client "${client.name}"?`)) return;
    try {
      await ecomAPI.deleteClient(client.id);
      toast.success('Client deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete client');
    }
  };

  const handleDeleteQuote = async (quote) => {
    if (!window.confirm(`Delete quote "${quote.quote_number}"?`)) return;
    try {
      await opsAPI.deleteQuote(quote.id);
      toast.success('Quote deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete quote');
    }
  };

  const handleDeleteInvoice = async (invoice) => {
    if (!window.confirm(`Delete invoice "${invoice.invoice_number}"?`)) return;
    try {
      await ecomAPI.deleteInvoice(invoice.id);
      toast.success('Invoice deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete invoice');
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('Reset all Ecom panel data? This cannot be undone.')) return;
    try {
      await ecomAPI.resetData();
      toast.success('Ecom data reset successfully');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset Ecom data');
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      // Find client_id from selected project
      const project = projects.find(p => p.id === parseInt(form.project_id));
      const invoiceData = {
        ...form,
        client_id: project?.client_id || form.client_id,
        amount: form.total_amount || form.amount,
        invoice_number: form.invoice_number || `INV-${Date.now()}`
      };

      if (form.id) {
        const payload = {
          project_id: invoiceData.project_id,
          client_id: invoiceData.client_id || null,
          invoice_number: invoiceData.invoice_number,
          amount: invoiceData.amount,
          tax_amount: invoiceData.tax_amount || 0,
          total_amount: invoiceData.total_amount || invoiceData.amount,
          status: invoiceData.status || 'draft',
          due_date: invoiceData.due_date,
          notes: invoiceData.notes || null
        };
        await ecomAPI.updateInvoice(form.id, payload);
        toast.success('Invoice updated!');
      } else {
        await ecomAPI.createInvoice(invoiceData);
        toast.success('Invoice created!');
      }
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Failed to save invoice');
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

  const statusCount = (items, key) => Object.entries(
    items.reduce((acc, item) => {
      const k = item[key] || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  const projectStatusData = statusCount(projects, 'status');
  const invoiceStatusData = statusCount(invoices, 'status');
  const financialBars = [
    { name: 'Revenue', value: Number(overview?.totalRevenue || 0) },
    { name: 'Expenses', value: Number(overview?.totalExpenses || 0) },
    { name: 'Profit', value: Number(overview?.netProfit || 0) },
  ];
  const STATUS_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const projectColumns = [
    {
      header: 'Project', key: 'name', render: (val, row) => (
        <div>
          <button
            type="button"
            onClick={() => { setProjectDetails(row); setShowModal('project-details'); }}
            className="font-medium text-white hover:text-primary-300 text-left"
          >
            {val}
          </button>
          <p className="text-xs text-dark-400">{row.client_name}</p>
        </div>
      )
    },
    { header: 'Type', key: 'type', render: (val) => <span className="badge-info">{val}</span> },
    { header: 'Total', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Paid', key: 'paid_amount', render: (val) => <CurrencyCell value={val} className="text-emerald-400" /> },
    { header: 'Cost', key: 'development_cost', render: (val, row) => <CurrencyCell value={parseFloat(val) + parseFloat(row.marketing_cost)} className="text-red-400" /> },
    { header: 'Profit', key: 'profit', render: (val) => <CurrencyCell value={val} className={val >= 0 ? 'text-emerald-400' : 'text-red-400'} /> },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Action',
      key: 'id',
      render: (_, p) => (
        <div className="flex gap-2">
          <button onClick={() => handleViewMilestones(p)} className="text-primary-400 hover:text-primary-300 text-xs font-semibold">
            Manage
          </button>
          <button onClick={() => { setForm(p); setShowModal('project'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          <button onClick={() => { setProjectDetails(p); setShowModal('project-details'); }} className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold">
            View
          </button>
          {p.status !== 'completed' && (
            <button onClick={() => handleMarkCompleted(p)} className="text-amber-400 hover:text-amber-300 text-xs font-semibold">
              Complete
            </button>
          )}
          <button onClick={() => handleDeleteProject(p)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
  ];

  const quoteColumns = [
    { header: 'Quote #', key: 'quote_number', render: (val) => <span className="font-mono text-primary-400">{val}</span> },
    {
      header: 'Project / Client', key: 'subject', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">{row.client_name}</p></div>
      )
    },
    { header: 'Amount', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Valid Until', key: 'valid_until', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Action',
      key: 'id',
      render: (_, q) => (
        <div className="flex gap-2">
          <button onClick={() => { setForm(q); setShowModal('quote'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          <button onClick={() => handleDeleteQuote(q)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
  ];

  const invoiceColumns = [
    { header: 'Invoice #', key: 'invoice_number', render: (val) => <span className="font-mono text-primary-400">{val}</span> },
    {
      header: 'Project / Client', key: 'project_name', render: (val, row) => (
        <div><p className="font-medium text-white">{val || 'N/A'}</p><p className="text-xs text-dark-400">{row.client_name}</p></div>
      )
    },
    { header: 'Amount', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Due Date', key: 'due_date', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Action',
      key: 'id',
      render: (_, i) => (
        <div className="flex gap-2">
          <button onClick={() => { setForm(i); setShowModal('invoice'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          <button onClick={() => handleDeleteInvoice(i)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
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
    {
      header: 'Action',
      key: 'id',
      render: (_, c) => (
        <div className="flex gap-2">
          <button onClick={() => { setForm(c); setShowModal('client'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          <button onClick={() => handleDeleteClient(c)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ecom / POS / Website Sales</h1>
          <p className="text-dark-400 mt-1">Web development, SaaS & client management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('project'); setForm({}); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> New Project
          </button>
          <button onClick={() => { setShowModal('client'); setForm({}); }} className="btn-secondary">
            <HiOutlinePlus className="w-4 h-4" /> Add Client
          </button>
          <button onClick={handleResetData} className="btn-danger">
            <HiOutlineTrash className="w-4 h-4" /> Reset Data
          </button>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto mb-6">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setSearchParams({ tab })}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Revenue"
              value={overview?.totalRevenue || 0}
              icon={HiOutlineCurrencyDollar}
              color="green"
            />
            <SummaryCard
              title="Active Projects"
              value={overview?.projectStats?.active || projects.length}
              icon={HiOutlineCollection}
              color="blue"
            />
            <SummaryCard
              title="Pending Invoices"
              value={overview?.invoiceStats?.pending || 0}
              icon={HiOutlineDocumentText}
              color="amber"
            />
            <SummaryCard
              title="Total Clients"
              value={overview?.total_clients_count || clients.length}
              icon={HiOutlineUserGroup}
              color="purple"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">Financial Snapshot</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value) => [`Rs ${Number(value).toLocaleString()}`, 'Amount']}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">Project Status Mix</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={projectStatusData} dataKey="value" nameKey="name" outerRadius={100} label>
                      {projectStatusData.map((entry, index) => (
                        <Cell key={`project-status-${entry.name}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Invoice Status Breakdown</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invoiceStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value) => [value, 'Count']}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

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
            <button onClick={() => { setShowModal('quote'); setForm({}); }} className="btn-primary btn-sm">
              <HiOutlinePlus className="w-4 h-4" /> New Quote
            </button>
          </div>
          <DataTable
            columns={quoteColumns}
            data={quotes}
          />
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">All Invoices ({invoices.length})</h3>
            <button onClick={() => { setShowModal('invoice'); setForm({}); }} className="btn-primary btn-sm">
              <HiOutlinePlus className="w-4 h-4" /> New Invoice
            </button>
          </div>
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
      {showModal && (showModal === 'project' || showModal === 'client' || showModal === 'quote' || showModal === 'invoice') && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'project' ? (form.id ? 'Edit Project' : 'Create New Project') :
                showModal === 'client' ? (form.id ? 'Edit Client' : 'Add New Client') :
                  showModal === 'quote' ? (form.id ? 'Edit Quote' : 'Create New Quote') : (form.id ? 'Edit Invoice' : 'Create New Invoice')}
            </h3>
            <form onSubmit={
              showModal === 'project' ? handleCreateProject :
                showModal === 'client' ? handleCreateClient :
                  showModal === 'quote' ? handleCreateQuote : handleCreateInvoice
            } className="space-y-4">
              {showModal === 'project' && (
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
                  <div><label className="label">Status</label>
                    <select className="select" value={form.status || 'inquiry'} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="inquiry">Inquiry</option>
                      <option value="active">Active</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select></div>
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
              )}

              {showModal === 'client' && (
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

              {showModal === 'quote' && (
                <>
                  <div><label className="label">Client</label>
                    <select className="select" required value={form.client_id || ''} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                      <option value="">Select Client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
                    </select></div>
                  <div><label className="label">Subject</label>
                    <input className="input" required value={form.subject || ''} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
                  <div><label className="label">Total Amount</label>
                    <input type="number" step="0.01" min="0.01" className="input" required value={form.total_amount || ''} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
                  <div><label className="label">Valid Until</label>
                    <input type="date" className="input" required value={form.valid_until || ''} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
                </>
              )}

              {showModal === 'invoice' && (
                <>
                  <div><label className="label">Project</label>
                    <select className="select" required value={form.project_id || ''} onChange={e => {
                      const p = projects.find(proj => proj.id === parseInt(e.target.value));
                      setForm({ ...form, project_id: e.target.value, total_amount: p?.total_amount });
                    }}>
                      <option value="">Select Project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name} - {p.client_name}</option>)}
                    </select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Invoice # (Optional)</label>
                      <input className="input" placeholder="Auto-generated" value={form.invoice_number || ''} onChange={e => setForm({ ...form, invoice_number: e.target.value })} /></div>
                    <div><label className="label">Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.total_amount || ''} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Status</label>
                    <select className="select" value={form.status || 'draft'} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select></div>
                  <div><label className="label">Due Date</label>
                    <input type="date" className="input" required value={form.due_date || ''} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                  <div><label className="label">Notes</label>
                    <textarea className="input" rows="2" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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

      {/* Project Details Modal */}
      {showModal === 'project-details' && projectDetails && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Project Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-dark-400">Name</p><p className="text-white font-medium">{projectDetails.name || '-'}</p></div>
              <div><p className="text-dark-400">Client</p><p className="text-white font-medium">{projectDetails.client_name || '-'}</p></div>
              <div><p className="text-dark-400">Type</p><p className="text-white font-medium">{projectDetails.type || '-'}</p></div>
              <div><p className="text-dark-400">Status</p><p className="text-white font-medium">{projectDetails.status || '-'}</p></div>
              <div><p className="text-dark-400">Total Amount</p><p className="text-white font-medium">{`Rs ${Number(projectDetails.total_amount || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Paid Amount</p><p className="text-white font-medium">{`Rs ${Number(projectDetails.paid_amount || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Development Cost</p><p className="text-white font-medium">{`Rs ${Number(projectDetails.development_cost || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Marketing Cost</p><p className="text-white font-medium">{`Rs ${Number(projectDetails.marketing_cost || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Commission Rate</p><p className="text-white font-medium">{`${Number(projectDetails.commission_rate || 0)}%`}</p></div>
              <div><p className="text-dark-400">Assigned To</p><p className="text-white font-medium">{projectDetails.assigned_to || '-'}</p></div>
              <div><p className="text-dark-400">Start Date</p><p className="text-white font-medium">{projectDetails.start_date ? new Date(projectDetails.start_date).toLocaleDateString() : '-'}</p></div>
              <div><p className="text-dark-400">End Date</p><p className="text-white font-medium">{projectDetails.end_date ? new Date(projectDetails.end_date).toLocaleDateString() : '-'}</p></div>
            </div>
            <div className="mt-4">
              <p className="text-dark-400 text-sm">Description</p>
              <p className="text-white mt-1 whitespace-pre-wrap">{projectDetails.description || '-'}</p>
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
