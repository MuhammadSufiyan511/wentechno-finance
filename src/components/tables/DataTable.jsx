import React from 'react';

const DataTable = ({ columns, data, emptyMessage = 'No data available' }) => {
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={col.className || ''}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={col.cellClassName || ''}>
                    {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-dark-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const statusMap = {
    paid: 'badge-success', completed: 'badge-success', active: 'badge-success', delivered: 'badge-success',
    pending: 'badge-warning', in_progress: 'badge-warning', partial: 'badge-warning', stitching: 'badge-warning',
    approved: 'badge-success', rejected: 'badge-danger',
    cutting: 'badge-warning', finishing: 'badge-warning', ready: 'badge-info', upcoming: 'badge-info',
    draft: 'badge-info', sent: 'badge-info', trial: 'badge-info',
    overdue: 'badge-danger', cancelled: 'badge-danger', churned: 'badge-danger',
    dropped: 'badge-danger', refunded: 'badge-danger', inactive: 'badge-danger',
  };

  return (
    <span className={statusMap[status] || 'badge bg-dark-600 text-dark-300'}>
      {status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </span>
  );
};

export const CurrencyCell = ({ value, className = '' }) => (
  <span className={`font-mono ${className}`}>
    ₨ {Number(value || 0).toLocaleString()}
  </span>
);

export default DataTable;