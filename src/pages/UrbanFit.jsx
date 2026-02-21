import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { urbanfitAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { StatusBadge, CurrencyCell } from '../components/tables/DataTable';
import { HiOutlineCurrencyDollar, HiOutlineClipboardList, HiOutlineTruck, HiOutlinePlus, HiOutlineRefresh } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { opsAPI } from '../services/api';

const UrbanFitPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

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
      await urbanfitAPI.createOrder(form);
      toast.success('Order created!');
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
      await urbanfitAPI.recordDailySales(form);
      toast.success('Daily sales recorded!');
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
      await opsAPI.createReturn(form);
      toast.success('Return processed');
      setShowModal(null);
      setForm({});
      loadData();
    } catch (err) {
      toast.error('Failed to process return');
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
    { header: 'Type', key: 'order_type', render: (val) => <span className="badge-info">{val}</span> },
    { header: 'Total', key: 'total_amount', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Advance', key: 'advance_paid', render: (val) => <CurrencyCell value={val} className="text-emerald-400" /> },
    { header: 'Remaining', key: 'remaining_amount', render: (val) => <CurrencyCell value={val} className="text-amber-400" /> },
    { header: 'Delivery', key: 'delivery_date', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> },
  ];

  const salesColumns = [
    { header: 'Date', key: 'date', render: (val) => new Date(val).toLocaleDateString() },
    { header: 'Total Sales', key: 'total_sales', render: (val) => <CurrencyCell value={val} className="font-bold text-white" /> },
    { header: 'Cash', key: 'cash_sales', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Card', key: 'card_sales', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Online', key: 'online_sales', render: (val) => <CurrencyCell value={val} /> },
    { header: 'Items Sold', key: 'items_sold' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">✂️ UrbanFit Tailors</h1>
          <p className="text-dark-400 mt-1">Physical tailor shop management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowModal('order'); setForm({ order_date: new Date().toISOString().split('T')[0] }); }} className="btn-primary">
            <HiOutlinePlus className="w-4 h-4" /> New Order
          </button>
          <button onClick={() => { setShowModal('sales'); setForm({ date: new Date().toISOString().split('T')[0] }); }} className="btn-success">
            <HiOutlinePlus className="w-4 h-4" /> Record Sales
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Monthly Revenue" value={overview.monthlyRevenue} icon={HiOutlineCurrencyDollar} color="green" />
          <SummaryCard title="Yearly Revenue" value={overview.yearlyRevenue} icon={HiOutlineCurrencyDollar} color="blue" />
          <SummaryCard title="Net Profit" value={overview.netProfit} subtitle={`Margin: ${overview.profitMargin}%`} icon={HiOutlineCurrencyDollar} color="green" />
          <SummaryCard title="Today's Sales" value={overview.todaySales.total_sales} icon={HiOutlineCurrencyDollar} color="amber" />
          <SummaryCard title="Total Orders" value={overview.orderStats.total_orders} icon={HiOutlineClipboardList} color="purple" />
          <SummaryCard title="In Progress" value={overview.orderStats.in_progress} icon={HiOutlineClipboardList} color="amber" />
          <SummaryCard title="Ready" value={overview.orderStats.ready} icon={HiOutlineTruck} color="cyan" />
          <SummaryCard title="Pending Payments" value={overview.orderStats.pending_amount} icon={HiOutlineCurrencyDollar} color="red" />
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
              { header: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> }
            ]}
            data={returns}
          />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">
              {showModal === 'order'
                ? 'New Stitching Order'
                : showModal === 'return'
                  ? 'Process Return'
                  : 'Record Daily Sales'}
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
                    </select></div>
                  <div><label className="label">Items Description</label>
                    <textarea className="input" rows="2" value={form.items_description || ''} onChange={e => setForm({ ...form, items_description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Total Amount</label>
                      <input type="number" step="0.01" min="0.01" className="input" required value={form.total_amount || ''} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
                    <div><label className="label">Advance Paid</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.advance_paid || ''} onChange={e => setForm({ ...form, advance_paid: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Order Date</label>
                      <input type="date" className="input" required value={form.order_date || ''} onChange={e => setForm({ ...form, order_date: e.target.value })} /></div>
                    <div><label className="label">Delivery Date</label>
                      <input type="date" className="input" value={form.delivery_date || ''} onChange={e => setForm({ ...form, delivery_date: e.target.value })} /></div>
                  </div>
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
                  {showModal === 'return' ? 'Process Return' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UrbanFitPanel;
