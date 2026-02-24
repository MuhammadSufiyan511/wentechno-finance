import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  HiOutlineOfficeBuilding,
  HiOutlineDocumentReport,
  HiOutlineX,
  HiOutlineCurrencyDollar,
  HiOutlineChartPie,
  HiOutlineGlobeAlt,
  HiOutlineShoppingBag,
  HiOutlineCloud,
  HiOutlineAcademicCap,
  HiOutlineBookOpen
} from 'react-icons/hi';

const navItems = [
  { path: '/', icon: HiOutlineChartPie, label: 'Dashboard', color: 'text-primary-400' },
  { path: '/ecom', icon: HiOutlineGlobeAlt, label: 'Ecom / POS / Web', color: 'text-blue-400' },
  { path: '/urbanfit', icon: HiOutlineShoppingBag, label: 'UrbanFit Tailors', color: 'text-emerald-400' },
  { path: '/school-saas', icon: HiOutlineCloud, label: 'School SaaS', color: 'text-violet-400' },
  { path: '/physical-school', icon: HiOutlineAcademicCap, label: 'Physical School', color: 'text-amber-400' },
  { path: '/it-courses', icon: HiOutlineBookOpen, label: 'IT Courses', color: 'text-red-400' },
  { path: '/office', icon: HiOutlineOfficeBuilding, label: 'Office & General', color: 'text-gray-400' },
  // { path: '/finance', icon: HiOutlineCurrencyDollar, label: 'Advanced Finance', color: 'text-emerald-500' },
  { path: '/approvals', icon: HiOutlineChartPie, label: 'Pending Approvals', color: 'text-yellow-400' },
  { path: '/reports', icon: HiOutlineDocumentReport, label: 'Reports & Export', color: 'text-cyan-400' },
];

const Sidebar = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-dark-900 border-r border-dark-700 z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">FinTracker</h1>
              <p className="text-xs text-dark-400">CEO Dashboard</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-dark-400 hover:text-white">
            <HiOutlineX className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100%-88px)]">
          <p className="px-3 text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">
            Navigation
          </p>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                  : 'text-dark-300 hover:bg-dark-800 hover:text-white border border-transparent'}
              `}
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
