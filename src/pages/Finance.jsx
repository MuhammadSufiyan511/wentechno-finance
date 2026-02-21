import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { financeAPI, dashboardAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import DataTable, { CurrencyCell, StatusBadge } from '../components/tables/DataTable';
import { HiOutlineLibrary, HiOutlineTrendingUp, HiOutlineReceiptTax, HiOutlineLightBulb, HiOutlineRefresh, HiOutlinePlus } from 'react-icons/hi';
import toast from 'react-hot-toast';

const Finance = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'banks';

    const [loading, setLoading] = useState(true);
    const [agingType, setAgingType] = useState('ar');
    const [data, setData] = useState({
        banks: [],
        budgets: [],
        forecast: null,
        taxes: [],
        scenarios: [],
        businessUnits: []
    });
    const [showModal, setShowModal] = useState(null);
    const [form, setForm] = useState({});

    useEffect(() => { loadData(); }, [activeTab, agingType]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [buRes, banksRes, taxesRes] = await Promise.all([
                dashboardAPI.getBusinessUnits(),
                financeAPI.getBankAccounts(),
                financeAPI.getTaxes()
            ]);

            let extraData = {};
            if (activeTab === 'budgets') {
                const budgetRes = await financeAPI.getBudgets({ year: new Date().getFullYear() });
                extraData.budgets = budgetRes.data.data;
            } else if (activeTab === 'cashflow') {
                const forecastRes = await financeAPI.getCashflowForecast(90);
                extraData.forecast = forecastRes.data.data;
                const scenarioRes = await financeAPI.getScenarios();
                extraData.scenarios = scenarioRes.data.data;
            } else if (activeTab === 'aging') {
                const agingRes = await financeAPI.getAging({ type: agingType });
                extraData.aging = agingRes.data.data;
            } else if (activeTab === 'profitability') {
                const profitRes = await financeAPI.getProfitability();
                extraData.profitability = profitRes.data.data;
            }

            setData({
                businessUnits: buRes.data.data,
                banks: banksRes.data.data,
                taxes: taxesRes.data.data,
                ...extraData
            });
        } catch (error) {
            toast.error('Failed to load finance data');
        } finally {
            setLoading(false);
        }
    };

    const handleRunRecurring = async () => {
        try {
            const res = await financeAPI.runRecurringBilling();
            toast.success(`Generated ${res.data.data.generated} recurring items!`);
            loadData();
        } catch (error) {
            toast.error('Failed to run recurring billing');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (showModal === 'bank') await financeAPI.createBankAccount(form);
            else if (showModal === 'budget') await financeAPI.saveBudget(form);
            else if (showModal === 'tax') await financeAPI.createTax(form);

            toast.success('Saved successfully');
            setShowModal(null);
            setForm({});
            loadData();
        } catch (error) {
            toast.error('Operation failed');
        }
    };

    if (loading && !data.businessUnits.length) return <div className="p-10 text-center">Loading Financial Engine...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">💰 Advanced Financial Engine</h1>
                    <p className="text-dark-400 mt-1">Management of banks, budgets, taxes, and forecasting</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleRunRecurring} className="btn-secondary">
                        <HiOutlineRefresh className="w-4 h-4 mr-2" /> Run Recurring
                    </button>
                    <button onClick={() => setShowModal('bank')} className="btn-primary">
                        <HiOutlinePlus className="w-4 h-4 mr-2" /> Add Bank/Account
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-dark-800 p-1 rounded-lg overflow-x-auto">
                {[
                    { id: 'banks', label: 'Bank & Cash', icon: HiOutlineLibrary },
                    { id: 'budgets', label: 'Budgets', icon: HiOutlineTrendingUp },
                    { id: 'profitability', label: 'Profitability', icon: HiOutlineChartPie },
                    { id: 'cashflow', label: 'Cashflow', icon: HiOutlineTrendingUp },
                    { id: 'aging', label: 'AR/AP Aging', icon: HiOutlineRefresh },
                    { id: 'taxes', label: 'Tax Config', icon: HiOutlineReceiptTax },
                    { id: 'scenarios', label: 'Scenarios', icon: HiOutlineLightBulb }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setSearchParams({ tab: tab.id })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors
                        ${activeTab === tab.id ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="card">
                {activeTab === 'banks' && (
                    <DataTable
                        columns={[
                            { header: 'Account Name', key: 'name' },
                            { header: 'Bank', key: 'bank_name' },
                            { header: 'Type', key: 'type', render: (val) => <span className="badge-info uppercase">{val}</span> },
                            { header: 'Current Balance', key: 'balance', render: (val) => <CurrencyCell value={val} className="text-emerald-400 font-bold" /> },
                            { header: 'Currency', key: 'currency' }
                        ]}
                        data={data.banks}
                    />
                )}

                {activeTab === 'budgets' && (
                    <DataTable
                        columns={[
                            { header: 'Category', key: 'category' },
                            { header: 'Planned', key: 'planned_amount', render: (val) => <CurrencyCell value={val} /> },
                            { header: 'Month/Year', key: 'month', render: (val, row) => `${val}/${row.year}` },
                            { header: 'Status', key: 'id', render: () => <span className="text-emerald-500 font-medium">Under Budget</span> }
                        ]}
                        data={data.budgets}
                    />
                )}

                {activeTab === 'profitability' && (
                    <DataTable
                        columns={[
                            { header: 'Category', key: 'category' },
                            { header: 'Revenue', key: 'revenue', render: (val) => <CurrencyCell value={val} /> },
                            { header: 'Expenses', key: 'expenses', render: (val) => <CurrencyCell value={val} className="text-red-400" /> },
                            { header: 'Net Profit', key: 'net_profit', render: (val) => <CurrencyCell value={val} className={val >= 0 ? 'text-emerald-400 font-bold' : 'text-red-500 font-bold'} /> }
                        ]}
                        data={data.profitability || []}
                    />
                )}

                {activeTab === 'cashflow' && data.forecast && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard title="Current Liquidity" value={data.forecast.current_liquidity} color="blue" />
                        <SummaryCard title="Receivables (AR)" value={data.forecast.accounts_receivable} color="emerald" />
                        <SummaryCard title="Payables (AP)" value={data.forecast.accounts_payable} color="red" />
                        <SummaryCard title="90D Projection" value={data.forecast.projected_position} color="indigo" />
                    </div>
                )}

                {activeTab === 'aging' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-white">{agingType === 'ar' ? 'Accounts Receivable' : 'Accounts Payable'} Aging</h3>
                            <div className="flex gap-1 bg-dark-900 p-1 rounded-lg">
                                <button onClick={() => setAgingType('ar')} className={`px-3 py-1 text-xs rounded-md ${agingType === 'ar' ? 'bg-primary-600 text-white' : 'text-dark-400'}`}>AR</button>
                                <button onClick={() => setAgingType('ap')} className={`px-3 py-1 text-xs rounded-md ${agingType === 'ap' ? 'bg-primary-600 text-white' : 'text-dark-400'}`}>AP</button>
                            </div>
                        </div>
                        <DataTable
                            columns={[
                                { header: agingType === 'ar' ? 'Client' : 'Vendor', key: agingType === 'ar' ? 'client_name' : 'vendor' },
                                { header: 'Current', key: 'current', render: (val) => <CurrencyCell value={val} /> },
                                { header: '31-60 Days', key: '31_60', render: (val) => <CurrencyCell value={val} className="text-yellow-400" /> },
                                { header: '61-90 Days', key: '61_90', render: (val) => <CurrencyCell value={val} className="text-orange-400" /> },
                                { header: '90+ Days', key: '90_plus', render: (val) => <CurrencyCell value={val} className="text-red-400 font-bold" /> }
                            ]}
                            data={data.aging || []}
                        />
                    </div>
                )}

                {activeTab === 'taxes' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <button onClick={() => setShowModal('tax')} className="btn-primary">Add Tax Rule</button>
                        </div>
                        <DataTable
                            columns={[
                                { header: 'Tax Name', key: 'name' },
                                { header: 'Rate (%)', key: 'rate', render: (val) => `${val}%` },
                                { header: 'Type', key: 'type', render: (val) => <span className="badge-info uppercase">{val}</span> },
                                { header: 'Status', key: 'is_active', render: (val) => val ? 'Active' : 'Inactive' }
                            ]}
                            data={data.taxes}
                        />
                    </div>
                )}

                {activeTab === 'scenarios' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.scenarios.map(s => (
                                <div key={s.id} className="card border-primary-500/20">
                                    <h4 className="text-white font-bold">{s.name}</h4>
                                    <p className="text-dark-400 text-sm mt-1">{s.description}</p>
                                    <div className="mt-4 flex justify-between items-center">
                                        <span className="text-xs text-dark-500">Created by {s.creator}</span>
                                        <button className="text-primary-400 hover:underline text-sm font-medium">View Analysis</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Simple Modal for adding entities */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
                    <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-6">Add {showModal}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {showModal === 'bank' && (
                                <>
                                    <div><label className="label">Account Name</label><input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="label">Type</label>
                                            <select className="select" value={form.type || 'bank'} onChange={e => setForm({ ...form, type: e.target.value })}>
                                                <option value="bank">Bank</option>
                                                <option value="cash">Cash</option>
                                                <option value="mobile_wallet">Mobile Wallet</option>
                                            </select></div>
                                        <div><label className="label">Business Unit</label>
                                            <select className="select" required value={form.business_unit_id || ''} onChange={e => setForm({ ...form, business_unit_id: e.target.value })}>
                                                <option value="">Select BU</option>
                                                {data.businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                                            </select></div>
                                    </div>
                                    <div><label className="label">Initial Balance</label><input type="number" className="input" value={form.balance || 0} onChange={e => setForm({ ...form, balance: e.target.value })} /></div>
                                </>
                            )}

                            {showModal === 'tax' && (
                                <>
                                    <div><label className="label">Tax Name</label><input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="label">Rate (%)</label><input type="number" step="0.01" className="input" required value={form.rate || ''} onChange={e => setForm({ ...form, rate: e.target.value })} /></div>
                                        <div><label className="label">Type</label>
                                            <select className="select" value={form.type || 'sales'} onChange={e => setForm({ ...form, type: e.target.value })}>
                                                <option value="sales">Sales Tax</option>
                                                <option value="withholding">Withholding</option>
                                                <option value="vat">VAT</option>
                                            </select></div>
                                    </div>
                                    <div><label className="label">Business Unit</label>
                                        <select className="select" required value={form.business_unit_id || ''} onChange={e => setForm({ ...form, business_unit_id: e.target.value })}>
                                            <option value="">Select BU</option>
                                            {data.businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                                        </select></div>
                                </>
                            )}

                            {showModal === 'budget' && (
                                <>
                                    <div><label className="label">Category</label><input className="input" required value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="label">Amount</label><input type="number" className="input" required value={form.planned_amount || ''} onChange={e => setForm({ ...form, planned_amount: e.target.value })} /></div>
                                        <div><label className="label">Business Unit</label>
                                            <select className="select" required value={form.business_unit_id || ''} onChange={e => setForm({ ...form, business_unit_id: e.target.value })}>
                                                <option value="">Select BU</option>
                                                {data.businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                                            </select></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="label">Month (1-12)</label><input type="number" min="1" max="12" className="input" required value={form.month || new Date().getMonth() + 1} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
                                        <div><label className="label">Year</label><input type="number" className="input" required value={form.year || new Date().getFullYear()} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
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
        </div>
    );
};

export default Finance;
