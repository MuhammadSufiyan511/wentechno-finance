import React, { useState, useEffect } from 'react';
import { approvalsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineCheck, HiOutlineX, HiOutlineInformationCircle } from 'react-icons/hi';

const Approvals = () => {
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {
            const response = await approvalsAPI.getPending();
            setPending(response.data.data);
        } catch (error) {
            toast.error('Failed to fetch pending approvals');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id, action) => {
        const comments = window.prompt(`Enter comments for ${action}:`);
        if (comments === null) return;

        setActionLoading(id);
        try {
            await approvalsAPI.takeAction(id, action, comments);
            toast.success(`Request ${action} successfully`);
            fetchPending();
        } catch (error) {
            const serverError = error.response?.data;
            if (serverError?.errors) {
                serverError.errors.forEach(err => toast.error(err.msg));
            } else {
                toast.error(serverError?.message || `Failed to ${action} request`);
            }
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-dark-400">Loading pending requests...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">⚖️ Pending Approvals</h1>
                <p className="text-dark-400 mt-1">Review items requiring CEO authorization</p>
            </div>

            {pending.length === 0 ? (
                <div className="card text-center py-20">
                    <HiOutlineInformationCircle className="w-12 h-12 text-dark-500 mx-auto mb-4" />
                    <h3 className="text-white font-medium">All caught up!</h3>
                    <p className="text-dark-500">No pending approval requests found.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {pending.map(item => (
                        <div key={item.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-dark-600 transition-colors">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-xs font-medium rounded uppercase">
                                        {item.entity_type}
                                    </span>
                                    <span className="text-dark-500 text-sm">#{item.entity_id}</span>
                                </div>
                                <h3 className="text-white font-medium">{item.comments || 'No description provided'}</h3>
                                <p className="text-dark-400 text-sm">Requested on {new Date(item.created_at).toLocaleDateString()}</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleAction(item.id, 'rejected')}
                                    disabled={actionLoading === item.id}
                                    className="btn-secondary border-red-500/30 text-red-500 hover:bg-red-500/10"
                                >
                                    <HiOutlineX className="w-4 h-4 mr-2" /> Reject
                                </button>
                                <button
                                    onClick={() => handleAction(item.id, 'approved')}
                                    disabled={actionLoading === item.id}
                                    className="btn-success"
                                >
                                    <HiOutlineCheck className="w-4 h-4 mr-2" /> Approve
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Approvals;
