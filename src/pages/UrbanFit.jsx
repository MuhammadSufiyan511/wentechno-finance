import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { urbanfitAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { StatusBadge, CurrencyCell } from '../components/tables/DataTable';
import { HiOutlineCurrencyDollar, HiOutlineClipboardList, HiOutlineTruck, HiOutlinePlus, HiOutlineRefresh, HiOutlineTrash } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { opsAPI } from '../services/api';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const UrbanFitPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const extractCustomType = (description) => {
    const match = /^\[Custom Type:\s*(.+?)\]\s*/i.exec(description || '');
    return match ? match[1] : '';
  };

  const stripCustomTypePrefix = (description) => (description || '').replace(/^\[Custom Type:\s*.+?\]\s*/i, '').trim();

  const loadData = async () => {
    try {
      const [overviewRes, ordersRes, salesRes, returnsRes] = await Promise.all([
        urbanfitAPI.getOverview(),
        urbanfitAPI.getOrders(),
        urbanfitAPI.getDailySales(),
        opsAPI.getReturns()
      ]);
      setOverview(overviewRes.data.data);
      setOrders(ordersRes.data.data);
      setDailySales(salesRes.data.data);
      setReturns(returnsRes.data.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      const customType = (form.custom_order_type || '').trim();
      const isCustomType = form.order_type === 'custom';
      const payload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        order_type: isCustomType ? 'stitching' : form.order_type,
        items_description: isCustomType
          ? `[Custom Type: ${customType}] ${stripCustomTypePrefix(form.items_description || '')}`.trim()
          : stripCustomTypePrefix(form.items_description || '') || null,
        measurements: form.measurements || null,
        total_amount: form.total_amount,
        advance_paid: form.advance_paid || 0,
        fabric_cost: form.fabric_cost || 0,
        stitching_cost: form.stitching_cost || 0,
        status: form.status || 'pending',
        order_date: form.order_date,
        delivery_date: form.delivery_date || null,
        delivered_date: form.delivered_date || null
      };

      if (form.id) {
        await urbanfitAPI.updateOrder(form.id, payload);
        toast.success('Order updated!');
      } else {
        await urbanfitAPI.createOrder(payload);
        toast.success('Order created!');
      }
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Failed to create order');
      }
    }
  };

  const handleRecordSales = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        const payload = {
          date: form.date,
          total_sales: form.total_sales || 0,
          cash_sales: form.cash_sales || 0,
          card_sales: form.card_sales || 0,
          online_sales: form.online_sales || 0,
          items_sold: form.items_sold || 0,
          returns_amount: form.returns_amount || 0,
          notes: form.notes || null
        };
        await urbanfitAPI.updateDailySales(form.id, payload);
        toast.success('Daily sales updated!');
      } else {
        await urbanfitAPI.recordDailySales(form);
        toast.success('Daily sales recorded!');
      }
      setShowModal(null);
      setForm({});
      loadData();
    } catch (error) {
      const serverError = error.response?.data;
      if (serverError?.errors) {
        serverError.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(serverError?.message || 'Failed to record sales');
      }
    }
  };

  const handleUpdateStatus = async (orderId, status) => {
    try {
      await opsAPI.updateOrderStatus(orderId, status);
      toast.success('Status updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleCreateReturn = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        const payload = {
          order_id: form.order_id,
          reason: form.reason,
          amount: form.amount,
          date: form.date,
          status: form.status || 'pending'
        };
        await opsAPI.updateReturn(form.id, payload);
        toast.success('Return updated');
      } else {
        await opsAPI.createReturn(form);
        toast.success('Return processed');
      }
      setShowModal(null);
      setForm({});
      loadData();
    } catch (err) {
      toast.error('Failed to process return');
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Delete order "${order.order_number}"?`)) return;
    try {
      await urbanfitAPI.deleteOrder(order.id);
      toast.success('Order deleted');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const handleDeleteSales = async (sale) => {
    if (!window.confirm(`Delete daily sales entry for ${new Date(sale.date).toLocaleDateString()}?`)) return;
    try {
      await urbanfitAPI.deleteDailySales(sale.id);
      toast.success('Daily sales deleted');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete daily sales');
    }
  };

  const handleDeleteReturn = async (ret) => {
    if (!window.confirm(`Delete return for order "${ret.order_number}"?`)) return;
    try {
      await opsAPI.deleteReturn(ret.id);
      toast.success('Return deleted');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete return');
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

  const toOrderForm = (row) => ({
    ...row,
    order_type: extractCustomType(row.items_description) ? 'custom' : row.order_type,
    custom_order_type: extractCustomType(row.items_description),
    items_description: stripCustomTypePrefix(row.items_description),
    order_date: toDateInput(row.order_date),
    delivery_date: toDateInput(row.delivery_date),
    delivered_date: toDateInput(row.delivered_date),
  });

  const toDailySalesForm = (row) => ({
    ...row,
    date: toDateInput(row.date),
  });

  const toReturnForm = (row) => ({
    ...row,
    date: toDateInput(row.date),
  });

  const handleMarkDelivered = async (order) => {
    try {
      await opsAPI.updateOrderStatus(order.id, 'delivered');
      toast.success('Order marked as delivered');
      loadData();
    } catch (err) {
      toast.error('Failed to update order status');
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('Reset all UrbanFit panel data? This cannot be undone.')) return;
    try {
      await urbanfitAPI.resetData();
      toast.success('UrbanFit data reset successfully');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset UrbanFit data');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  const orderColumns = [
    { header: 'Order #', key: 'order_number', render: (val) => <span className="font-mono text-emerald-400">{val}</span> },
    {
      header: 'Customer', key: 'customer_name', render: (val, row) => (
        <div><p className="font-medium text-white">{val}</p><p className="text-xs text-dark-400">{row.customer_phone}</p></div>
      )
    },
    { header: 'Type', key: 'order_type', render: (_, row) => <span className="badge-info">{extractCustomType(row.items_description) || row.order_type}</span> },
    { header: 'Total', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Advance', key: 'advance_paid', render: (val) => <CurrencyCell value={val} className="text-emerald-400" /> },
    { header: 'Total Cost', key: 'total_cost', render: (_, row) => <CurrencyCell value={Number(row.fabric_cost || 0) + Number(row.stitching_cost || 0)} className="text-red-400" /> },
    { header: 'Remaining', key: 'remaining_amount', render: (val) => <CurrencyCell value={val} className="text-amber-400" /> },
    { header: 'Delivery', key: 'delivery_date', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
    {
      header: 'Action',
      key: 'id',
      render: (_, row) => (
        <div className="flex gap-2">
          <button onClick={() => { setSelectedOrder(row); setShowModal('order-details'); }} className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold">
            View
          </button>
          <button onClick={() => { setForm(toOrderForm(row)); setShowModal('order'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          {row.status !== 'delivered' && (
            <button onClick={() => handleMarkDelivered(row)} className="text-amber-400 hover:text-amber-300 text-xs font-semibold">
              Complete
            </button>
          )}
          <button onClick={() => handleDeleteOrder(row)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
  ];

  const salesColumns = [
    { header: 'Date', key: 'date', render: (val) => new Date(val).toLocaleDateString() },
    { header: 'Total Sales', key: 'total_sales', render: (val) => <CurrencyCell value={val} className="font-bold text-white" /> },
    { header: 'Cash', key: 'cash_sales', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Card', key: 'card_sales', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Online', key: 'online_sales', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Items Sold', key: 'items_sold' },
    {
      header: 'Action',
      key: 'id',
      render: (_, row) => (
        <div className="flex gap-2">
          <button onClick={() => { setSelectedSale(row); setShowModal('sales-details'); }} className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold">
            View
          </button>
          <button onClick={() => { setForm(toDailySalesForm(row)); setShowModal('sales'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
            Edit
          </button>
          <button onClick={() => handleDeleteSales(row)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
            Delete
          </button>
        </div>
      )
    },
  ];

  const hasUrbanfitActivity = Boolean(
    Number(overview?.orderStats?.total_orders || 0) > 0 ||
    Number(overview?.todaySales?.total_sales || 0) > 0 ||
    Number(overview?.monthlyRevenue || 0) > 0 ||
    Number(overview?.yearlyRevenue || 0) > 0 ||
    Number(overview?.yearlyExpenses || 0) > 0
  );

  const monthlyRevenueCard = hasUrbanfitActivity ? Number(overview?.monthlyRevenue || 0) : 0;
  const yearlyRevenueCard = hasUrbanfitActivity ? Number(overview?.yearlyRevenue || 0) : 0;
  const netProfitCard = hasUrbanfitActivity ? Number(overview?.netProfit || 0) : 0;
  const profitMarginCard = hasUrbanfitActivity ? overview?.profitMargin || 0 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">UrbanFit Tailors</h1>
          <p className="text-dark-400 mt-1">Physical tailor shop management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('order'); setForm({ order_date: new Date().toISOString().split('T')[0] }); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> New Order
          </button>
          <button onClick={() => { setShowModal('sales'); setForm({ date: new Date().toISOString().split('T')[0], id: undefined }); }} className="btn-success">
            <HiOutlinePlus className="w-4 h-4" /> Record Sales
          </button>
          <button onClick={handleResetData} className="btn-danger">
            <HiOutlineTrash className="w-4 h-4" /> Reset Data
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
        {['overview', 'orders', 'production', 'daily-sales', 'returns'].map(tab => (
          <button key={tab} onClick={() => setSearchParams({ tab })}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${activeTab === tab ? 'bg-emerald-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Monthly Revenue" value={monthlyRevenueCard} icon={HiOutlineCurrencyDollar} color="green" />
            <SummaryCard title="Yearly Revenue" value={yearlyRevenueCard} icon={HiOutlineCurrencyDollar} color="blue" />
            <SummaryCard title="Net Profit" value={netProfitCard} subtitle={`Margin: ${profitMarginCard}% | Cost: ₨ ${Number(overview.yearlyOrderCosts || 0).toLocaleString()}`} icon={HiOutlineCurrencyDollar} color="green" />
            <SummaryCard title="Today's Sales" value={overview.todaySales.total_sales} icon={HiOutlineCurrencyDollar} color="amber" />
            <SummaryCard title="Total Orders" value={overview.orderStats.total_orders} icon={HiOutlineClipboardList} color="purple" />
            <SummaryCard title="In Progress" value={overview.orderStats.in_progress} icon={HiOutlineClipboardList} color="amber" />
            <SummaryCard title="Ready" value={overview.orderStats.ready} icon={HiOutlineTruck} color="cyan" />
            <SummaryCard title="Pending Payments" value={overview.orderStats.pending_amount} icon={HiOutlineCurrencyDollar} color="red" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend */}
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-6">Daily Sales Trend (Last 30 Days)</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.trends?.sales || []}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#9ca3af"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Order Status Distribution */}
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-6">Order Status Distribution</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={overview?.trends?.orderStatus || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(overview?.trends?.orderStatus || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {(overview?.trends?.orderStatus || []).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-xs text-dark-400 capitalize">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">All Orders ({orders.length})</h3>
          <DataTable columns={orderColumns} data={orders} />
        </div>
      )}

      {activeTab === 'production' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Production Board</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {['pending', 'cutting', 'stitching', 'finishing'].map(step => (
              <div key={step} className="bg-dark-900/50 p-4 rounded-xl border border-dark-700">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dark-400 mb-4 flex justify-between">
                  {step}
                  <span className="bg-dark-700 px-2 rounded-full">{orders.filter(o => o.status === step).length}</span>
                </h4>
                <div className="space-y-3">
                  {orders.filter(o => o.status === step).map(order => (
                    <div key={order.id} className="bg-dark-800 p-3 rounded-lg border border-dark-600 shadow-sm">
                      <p className="text-sm font-semibold text-white">{order.order_number}</p>
                      <p className="text-xs text-dark-400 mb-3">{order.customer_name}</p>
                      <select
                        className="text-[10px] bg-dark-700 text-white border-none rounded px-2 py-1 w-full"
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="cutting">Cutting</option>
                        <option value="stitching">Stitching</option>
                        <option value="finishing">Finishing</option>
                        <option value="ready">Ready</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'daily-sales' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Daily Sales Record</h3>
          <DataTable columns={salesColumns} data={dailySales} />
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Returns & Exchanges</h3>
            <button onClick={() => { setShowModal('return'); setForm({ date: new Date().toISOString().split('T')[0] }); }} className="btn-secondary text-xs">
              <HiOutlineRefresh className="w-4 h-4 mr-1" /> New Return
            </button>
          </div>
          <DataTable
            columns={[
              { header: 'Order #', key: 'order_number' },
              { header: 'Customer', key: 'customer_name' },
              { header: 'Reason', key: 'reason' },
              { header: 'Amount', key: 'amount', render: (val) => <CurrencyCell value={val} className="text-red-400" /> },
              { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
              {
                header: 'Action',
                key: 'id',
                render: (_, row) => (
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedReturn(row); setShowModal('return-details'); }} className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold">
                      View
                    </button>
                    <button onClick={() => { setForm(toReturnForm(row)); setShowModal('return'); }} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">
                      Edit
                    </button>
                    <button onClick={() => handleDeleteReturn(row)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
                      Delete
                    </button>
                  </div>
                )
              }
            ]}
            data={returns}
          />
        </div>
      )}

      {/* Modal */}
      {(showModal === 'order' || showModal === 'sales' || showModal === 'return') && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'order'
                ? (form.id ? 'Edit Order' : 'New Stitching Order')
                : showModal === 'return'
                  ? (form.id ? 'Edit Return' : 'Process Return')
                  : (form.id ? 'Edit Daily Sales' : 'Record Daily Sales')}
            </h3>
            <form
              onSubmit={
                showModal === 'order'
                  ? handleCreateOrder
                  : showModal === 'return'
                    ? handleCreateReturn
                    : handleRecordSales
              }
              className="space-y-4"
            >
              {showModal === 'order' ? (
                <>
                  <div><label className="label">Customer Name</label>
                    <input className="input" required value={form.customer_name || ''} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
                  <div><label className="label">Phone</label>
                    <input className="input" value={form.customer_phone || ''} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div>
                  <div><label className="label">Order Type</label>
                    <select className="select" required value={form.order_type || ''} onChange={e => setForm({ ...form, order_type: e.target.value })}>
                      <option value="">Select</option>
                      <option value="stitching">Stitching</option>
                      <option value="alteration">Alteration</option>
                      <option value="ready_made">Ready Made</option>
                      <option value="fabric_sale">Fabric Sale</option>
                      <option value="custom">Custom</option>
                    </select></div>
                  {form.order_type === 'custom' && (
                    <div><label className="label">Custom Order Type</label>
                      <textarea
                        className="input"
                        rows="2"
                        required
                        placeholder="Enter custom order type"
                        value={form.custom_order_type || ''}
                        onChange={e => setForm({ ...form, custom_order_type: e.target.value })}
                      />
                    </div>
                  )}
                  <div><label className="label">Items Description</label>
                    <textarea className="input" rows="2" value={form.items_description || ''} onChange={e => setForm({ ...form, items_description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Total Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.total_amount || ''} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
                    <div><label className="label">Advance Paid</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.advance_paid || ''} onChange={e => setForm({ ...form, advance_paid: e.target.value })} /></div>
                  </div>
                  <div>
                    <p className="label mb-2">Cost Section</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="label">Fabric Cost</label>
                        <input type="number" step="0.01" min="0" className="input" value={form.fabric_cost || ''} onChange={e => setForm({ ...form, fabric_cost: e.target.value })} /></div>
                      <div><label className="label">Stitching Cost</label>
                        <input type="number" step="0.01" min="0" className="input" value={form.stitching_cost || ''} onChange={e => setForm({ ...form, stitching_cost: e.target.value })} /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Order Date</label>
                      <input type="date" className="input" required value={form.order_date || ''} onChange={e => setForm({ ...form, order_date: e.target.value })} /></div>
                    <div><label className="label">Delivery Date</label>
                      <input type="date" className="input" value={form.delivery_date || ''} onChange={e => setForm({ ...form, delivery_date: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Status</label>
                    <select className="select" value={form.status || 'pending'} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="pending">Pending</option>
                      <option value="cutting">Cutting</option>
                      <option value="stitching">Stitching</option>
                      <option value="finishing">Finishing</option>
                      <option value="ready">Ready</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select></div>
                </>
              ) : showModal === 'sales' ? (
                <>
                  <div><label className="label">Date</label>
                    <input type="date" className="input" required value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                  <div><label className="label">Total Sales</label>
                    <input type="number" step="0.01" min="0.01" className="input" required value={form.total_sales || ''} onChange={e => setForm({ ...form, total_sales: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="label">Cash</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.cash_sales || ''} onChange={e => setForm({ ...form, cash_sales: e.target.value })} /></div>
                    <div><label className="label">Card</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.card_sales || ''} onChange={e => setForm({ ...form, card_sales: e.target.value })} /></div>
                    <div><label className="label">Online</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.online_sales || ''} onChange={e => setForm({ ...form, online_sales: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Items Sold</label>
                    <input type="number" min="0" className="input" value={form.items_sold || ''} onChange={e => setForm({ ...form, items_sold: e.target.value })} /></div>
                </>
              ) : showModal === 'return' ? (
                <>
                  <div><label className="label">Order</label>
                    <select className="select" required value={form.order_id || ''} onChange={e => setForm({ ...form, order_id: e.target.value })}>
                      <option value="">Select Order</option>
                      {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} - {o.customer_name}</option>)}
                    </select></div>
                  <div><label className="label">Reason</label>
                    <textarea className="input" rows="2" required value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Refund Amount</label>
                      <input type="number" step="0.01" className="input" required value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><label className="label">Date</label>
                      <input type="date" className="input" required value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                  </div>
                </>
              ) : null}
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1 justify-center">
                  {showModal === 'return' ? (form.id ? 'Update Return' : 'Process Return') : 'Save'}
                </button>
                <button type="button" onClick={() => setShowModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'order-details' && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Order Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-dark-400">Order #</p><p className="text-white font-medium">{selectedOrder.order_number}</p></div>
              <div><p className="text-dark-400">Customer</p><p className="text-white font-medium">{selectedOrder.customer_name || '-'}</p></div>
              <div><p className="text-dark-400">Phone</p><p className="text-white font-medium">{selectedOrder.customer_phone || '-'}</p></div>
              <div><p className="text-dark-400">Type</p><p className="text-white font-medium">{extractCustomType(selectedOrder.items_description) || selectedOrder.order_type || '-'}</p></div>
              <div><p className="text-dark-400">Total Amount</p><p className="text-white font-medium">{`Rs ${Number(selectedOrder.total_amount || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Advance Paid</p><p className="text-white font-medium">{`Rs ${Number(selectedOrder.advance_paid || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Fabric Cost</p><p className="text-white font-medium">{`Rs ${Number(selectedOrder.fabric_cost || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Stitching Cost</p><p className="text-white font-medium">{`Rs ${Number(selectedOrder.stitching_cost || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Remaining</p><p className="text-white font-medium">{`Rs ${Number(selectedOrder.remaining_amount || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Status</p><p className="text-white font-medium">{selectedOrder.status || '-'}</p></div>
              <div><p className="text-dark-400">Order Date</p><p className="text-white font-medium">{selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString() : '-'}</p></div>
              <div><p className="text-dark-400">Delivery Date</p><p className="text-white font-medium">{selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString() : '-'}</p></div>
            </div>
            <div className="mt-4">
              <p className="text-dark-400 text-sm">Items Description</p>
              <p className="text-white mt-1 whitespace-pre-wrap">{selectedOrder.items_description || '-'}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowModal(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'sales-details' && selectedSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Daily Sales Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-dark-400">Date</p><p className="text-white font-medium">{selectedSale.date ? new Date(selectedSale.date).toLocaleDateString() : '-'}</p></div>
              <div><p className="text-dark-400">Total Sales</p><p className="text-white font-medium">{`Rs ${Number(selectedSale.total_sales || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Cash Sales</p><p className="text-white font-medium">{`Rs ${Number(selectedSale.cash_sales || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Card Sales</p><p className="text-white font-medium">{`Rs ${Number(selectedSale.card_sales || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Online Sales</p><p className="text-white font-medium">{`Rs ${Number(selectedSale.online_sales || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Items Sold</p><p className="text-white font-medium">{Number(selectedSale.items_sold || 0)}</p></div>
            </div>
            <div className="mt-4">
              <p className="text-dark-400 text-sm">Notes</p>
              <p className="text-white mt-1 whitespace-pre-wrap">{selectedSale.notes || '-'}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowModal(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'return-details' && selectedReturn && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Return Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-dark-400">Order #</p><p className="text-white font-medium">{selectedReturn.order_number || '-'}</p></div>
              <div><p className="text-dark-400">Customer</p><p className="text-white font-medium">{selectedReturn.customer_name || '-'}</p></div>
              <div><p className="text-dark-400">Refund Amount</p><p className="text-white font-medium">{`Rs ${Number(selectedReturn.amount || 0).toLocaleString()}`}</p></div>
              <div><p className="text-dark-400">Date</p><p className="text-white font-medium">{selectedReturn.date ? new Date(selectedReturn.date).toLocaleDateString() : '-'}</p></div>
              <div><p className="text-dark-400">Status</p><p className="text-white font-medium">{selectedReturn.status || '-'}</p></div>
            </div>
            <div className="mt-4">
              <p className="text-dark-400 text-sm">Reason</p>
              <p className="text-white mt-1 whitespace-pre-wrap">{selectedReturn.reason || '-'}</p>
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

export default UrbanFitPanel;
