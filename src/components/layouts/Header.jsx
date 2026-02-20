import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineMenu, HiOutlineLogout, HiOutlineBell } from 'react-icons/hi';

const Header = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();

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
          <button className="relative p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors">
            <HiOutlineBell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg border border-dark-700">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-violet-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">{user?.full_name?.charAt(0) || 'C'}</span>
            </div>
            <div className="text-sm">
              <p className="font-medium text-white">{user?.full_name}</p>
              <p className="text-xs text-dark-400">{user?.role}</p>
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