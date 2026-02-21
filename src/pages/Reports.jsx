import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportsAPI } from '../services/api';
import SummaryCard from '../components/cards/SummaryCard';
import { HiOutlineDownload, HiOutlineChartPie, HiOutlineDocumentText } from 'react-icons/hi';
import toast from 'react-hot-toast';

const Reports = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);

    // Sync with URL params
    const startDate = searchParams.get('start') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0];

    const setDateRange = (range) => {
        const newParams = new URLSearchParams(searchParams);
        if (range.start) newParams.set('start', range.start);
        if (range.end) newParams.set('end', range.end);
        setSearchParams(newParams);
    };

    const dateRange = { start: startDate, end: endDate };

    const handleDownload = async (format, reportType) => {
        setLoading(true);
        try {
            const params = {
                year: new Date(dateRange.start).getFullYear(),
                month: new Date(dateRange.start).getMonth() + 1
            };

            let response;
            if (format === 'pdf') {
                response = await reportsAPI.exportPDF(params);
            } else {
                response = await reportsAPI.exportExcel(params);
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report-${reportType}-${params.year}-${params.month}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success(`${reportType} exported successfully`);
        } catch (error) {
            console.error('Download error:', error);
            toast.error(`Failed to export ${reportType}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">📊 Financial Reports</h1>
                    <p className="text-dark-400 mt-1">Export data and view consolidated financials</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card space-y-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg w-fit">
                        <HiOutlineDocumentText className="w-6 h-6 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Profit & Loss</h3>
                    <p className="text-dark-400 text-sm">Consolidated statement of revenue and expenses across all business units.</p>
                    <div className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="label text-xs">Start Date</label><input type="date" className="input text-sm py-1" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} /></div>
                            <div><label className="label text-xs">End Date</label><input type="date" className="input text-sm py-1" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} /></div>
                        </div>
                        <button onClick={() => handleDownload('pdf', 'P&L')} disabled={loading} className="btn-primary w-full justify-center">
                            <HiOutlineDownload className="w-4 h-4 mr-2" /> {loading ? 'Processing...' : 'Export PDF'}
                        </button>
                    </div>
                </div>

                <div className="card space-y-4">
                    <div className="p-3 bg-emerald-500/10 rounded-lg w-fit">
                        <HiOutlineChartPie className="w-6 h-6 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Full Tax Summary</h3>
                    <p className="text-dark-400 text-sm">Complete Excel workbook containing business unit summaries and transaction details.</p>
                    <div className="pt-4">
                        <button onClick={() => handleDownload('xlsx', 'Full_Financials')} disabled={loading} className="btn-success w-full justify-center">
                            <HiOutlineDownload className="w-4 h-4 mr-2" /> {loading ? 'Processing...' : 'Export Excel'}
                        </button>
                    </div>
                </div>

                <div className="card space-y-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg w-fit">
                        <HiOutlineDocumentText className="w-6 h-6 text-purple-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Unit Breakdown</h3>
                    <p className="text-dark-400 text-sm">Detailed performance comparison between different business units.</p>
                    <div className="pt-4">
                        <button onClick={() => handleDownload('Unit')} className="btn-secondary w-full justify-center border-dark-600">
                            <HiOutlineDownload className="w-4 h-4 mr-2" /> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-6">Recent Exports</h3>
                <div className="text-center py-12">
                    <div className="bg-dark-800/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <HiOutlineDocumentText className="w-8 h-8 text-dark-500" />
                    </div>
                    <p className="text-dark-500">No export history found for this period.</p>
                </div>
            </div>
        </div>
    );
};

export default Reports;
