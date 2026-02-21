import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI } from '../../services/api';
import { HiOutlineMenu, HiOutlineLogout, HiOutlineBell, HiOutlineCheck } from 'react-icons/hi';
import { formatDistanceToNow } from 'date-fns';

const Header = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchNotifications = async () => {
    try {
      const response = await notificationsAPI.getRecent();
      setNotifications(response.data.data);
    } catch (error) {
      console.error('Failed to fetch notifications');
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Failed to mark as read');
    }
  };

  return (
    <header className="bg-dark-900 border-b border-dark-700 px-4 lg:px-6 py-3 sticky top-0 z-30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onMenuToggle} className="lg:hidden text-dark-400 hover:text-white p-1">
            <HiOutlineMenu className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-sm font-medium text-dark-300">Welcome back,</h2>
            <h1 className="text-lg font-bold text-white">{user?.full_name || 'CEO'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
            >
              <HiOutlineBell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-dark-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)}></div>
                <div className="absolute right-0 mt-2 w-80 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
                    <h3 className="text-sm font-bold text-white">Notifications</h3>
                    <button
                      onClick={async () => { await notificationsAPI.markAllRead(); fetchNotifications(); }}
                      className="text-xs text-primary-400 hover:text-primary-300"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-dark-500 text-sm">No notifications yet</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-4 border-b border-dark-700 last:border-0 hover:bg-dark-700/50 transition-colors ${!n.is_read ? 'bg-primary-500/5' : ''}`}>
                          <div className="flex justify-between gap-2">
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded h-fit ${n.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' :
                                n.type === 'error' ? 'bg-red-500/20 text-red-500' :
                                  n.type === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                                    'bg-blue-500/20 text-blue-500'
                              }`}>
                              {n.type}
                            </span>
                            {!n.is_read && (
                              <button onClick={() => markAsRead(n.id)} className="text-dark-500 hover:text-white">
                                <HiOutlineCheck className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-white mt-1">{n.title}</h4>
                          <p className="text-xs text-dark-400 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-dark-500 mt-2">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg border border-dark-700">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-violet-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">{user?.full_name?.charAt(0) || 'C'}</span>
            </div>
            <div className="text-sm">
              <p className="font-medium text-white">{user?.full_name}</p>
              <p className="text-xs text-dark-400 text-right">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Logout"
          >
            <HiOutlineLogout className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;