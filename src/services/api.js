import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - add token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, error => Promise.reject(error));

// Response interceptor - handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Dashboard
export const dashboardAPI = {
  getOverview: (params) => api.get('/dashboard/overview', { params }),
  getBusinessUnits: () => api.get('/dashboard/business-units'),
};

// Ecom
export const ecomAPI = {
  getOverview: () => api.get('/ecom/overview'),
  resetData: () => api.post('/ecom/reset'),
  getClients: () => api.get('/ecom/clients'),
  createClient: (data) => api.post('/ecom/clients', data),
  updateClient: (id, data) => api.put(`/ecom/clients/${id}`, data),
  deleteClient: (id) => api.delete(`/ecom/clients/${id}`),
  getProjects: () => api.get('/ecom/projects'),
  createProject: (data) => api.post('/ecom/projects', data),
  updateProject: (id, data) => api.put(`/ecom/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/ecom/projects/${id}`),
  getInvoices: () => api.get('/ecom/invoices'),
  createInvoice: (data) => api.post('/ecom/invoices', data),
  updateInvoice: (id, data) => api.put(`/ecom/invoices/${id}`, data),
  deleteInvoice: (id) => api.delete(`/ecom/invoices/${id}`),
  getRevenue: (params) => api.get('/ecom/revenue', { params }),
  createRevenue: (data) => api.post('/ecom/revenue', data),
  getExpenses: (params) => api.get('/ecom/expenses', { params }),
  createExpense: (data) => api.post('/ecom/expenses', data),
};

// UrbanFit
export const urbanfitAPI = {
  getOverview: () => api.get('/urbanfit/overview'),
  resetData: () => api.post('/urbanfit/reset'),
  getOrders: (params) => api.get('/urbanfit/orders', { params }),
  createOrder: (data) => api.post('/urbanfit/orders', data),
  updateOrder: (id, data) => api.put(`/urbanfit/orders/${id}`, data),
  deleteOrder: (id) => api.delete(`/urbanfit/orders/${id}`),
  getDailySales: (params) => api.get('/urbanfit/daily-sales', { params }),
  recordDailySales: (data) => api.post('/urbanfit/daily-sales', data),
  updateDailySales: (id, data) => api.put(`/urbanfit/daily-sales/${id}`, data),
  deleteDailySales: (id) => api.delete(`/urbanfit/daily-sales/${id}`),
  createRevenue: (data) => api.post('/urbanfit/revenue', data),
  createExpense: (data) => api.post('/urbanfit/expenses', data),
};

// School SaaS
export const schoolSaasAPI = {
  getOverview: () => api.get('/school-saas/overview'),
  resetData: () => api.post('/school-saas/reset'),
  getSchools: () => api.get('/school-saas/schools'),
  createSchool: (data) => api.post('/school-saas/schools', data),
  updateSchool: (id, data) => api.put(`/school-saas/schools/${id}`, data),
  deleteSchool: (id) => api.delete(`/school-saas/schools/${id}`),
  updateLifecycle: (id, data) => api.patch(`/school-saas/schools/${id}/lifecycle`, data),
  getPlans: () => api.get('/school-saas/plans'),
  createPlan: (data) => api.post('/school-saas/plans', data),
  updatePlan: (id, data) => api.put(`/school-saas/plans/${id}`, data),
  deletePlan: (id) => api.delete(`/school-saas/plans/${id}`),
  getSubscriptions: () => api.get('/school-saas/subscriptions'),
  createSubscription: (data) => api.post('/school-saas/subscriptions', data),
  updateSubscription: (id, data) => api.put(`/school-saas/subscriptions/${id}`, data),
  renewSubscription: (id) => api.post(`/school-saas/subscriptions/${id}/renew`),
  cancelSubscription: (id, data) => api.post(`/school-saas/subscriptions/${id}/cancel`, data),
  getInvoices: () => api.get('/school-saas/invoices'),
  generateInvoice: (data) => api.post('/school-saas/invoices/generate', data),
  updateInvoiceStatus: (id, data) => api.patch(`/school-saas/invoices/${id}/status`, data),
  getReceivables: () => api.get('/school-saas/receivables'),
  sendReminder: (id, data) => api.post(`/school-saas/invoices/${id}/reminder`, data),
  markPromiseToPay: (id, data) => api.post(`/school-saas/invoices/${id}/promise`, data),
  getDunningHistory: (id) => api.get(`/school-saas/invoices/${id}/dunning`),
  getHealthScores: () => api.get('/school-saas/health-scores'),
  recordActivity: (data) => api.post('/school-saas/activity', data),
  getReportSummary: (params) => api.get('/school-saas/reports/summary', { params }),
  exportReportCSV: (params) => api.get('/school-saas/reports/export', { params, responseType: 'blob' }),
  createRevenue: (data) => api.post('/school-saas/revenue', data),
  createExpense: (data) => api.post('/school-saas/expenses', data),
};

// Physical School
export const physicalSchoolAPI = {
  getOverview: () => api.get('/physical-school/overview'),
  resetData: () => api.post('/physical-school/reset'),
  getStudents: () => api.get('/physical-school/students'),
  createStudent: (data) => api.post('/physical-school/students', data),
  updateStudent: (id, data) => api.put(`/physical-school/students/${id}`, data),
  deleteStudent: (id) => api.delete(`/physical-school/students/${id}`),
  markDefaulter: (data) => api.post('/physical-school/defaulters/mark', data),
  getFees: (params) => api.get('/physical-school/fees', { params }),
  collectFee: (data) => api.post('/physical-school/fees', data),
  updateFee: (id, data) => api.put(`/physical-school/fees/${id}`, data),
  deleteFee: (id) => api.delete(`/physical-school/fees/${id}`),
  getDefaulters: (params) => api.get('/physical-school/defaulters', { params }),
  clearDefaulter: (id) => api.post(`/physical-school/defaulters/${id}/clear`),
  escalateDefaulter: (id, data) => api.post(`/physical-school/defaulters/${id}/escalate`, data),
  getExpenses: (params) => api.get('/physical-school/expenses', { params }),
  createExpense: (data) => api.post('/physical-school/expenses', data),
  updateExpense: (id, data) => api.put(`/physical-school/expenses/${id}`, data),
  deleteExpense: (id) => api.delete(`/physical-school/expenses/${id}`),
};

// IT Courses
export const itCoursesAPI = {
  getOverview: () => api.get('/it-courses/overview'),
  resetData: () => api.post('/it-courses/reset'),
  getCourses: () => api.get('/it-courses/courses'),
  createCourse: (data) => api.post('/it-courses/courses', data),
  updateCourse: (id, data) => api.put(`/it-courses/courses/${id}`, data),
  deleteCourse: (id) => api.delete(`/it-courses/courses/${id}`),
  getBatches: () => api.get('/it-courses/batches'),
  getBatchProfitability: () => api.get('/it-courses/batches/profitability'),
  createBatch: (data) => api.post('/it-courses/batches', data),
  updateBatch: (id, data) => api.put(`/it-courses/batches/${id}`, data),
  deleteBatch: (id) => api.delete(`/it-courses/batches/${id}`),
  getEnrollments: (params) => api.get('/it-courses/enrollments', { params }),
  createEnrollment: (data) => api.post('/it-courses/enrollments', data),
  updateEnrollment: (id, data) => api.put(`/it-courses/enrollments/${id}`, data),
  updateEnrollmentStatus: (id, data) => api.patch(`/it-courses/enrollments/${id}/status`, data),
  getEnrollmentPayments: (id) => api.get(`/it-courses/enrollments/${id}/payments`),
  collectEnrollmentPayment: (id, data) => api.post(`/it-courses/enrollments/${id}/payments`, data),
  getDefaulters: (params) => api.get('/it-courses/defaulters', { params }),
  runDefaulterAction: (id, data) => api.post(`/it-courses/defaulters/${id}/action`, data),
  scheduleDefaulterReminder: (id, data) => api.patch(`/it-courses/defaulters/${id}/reminder`, data),
  getEnrollmentFollowups: (id) => api.get(`/it-courses/enrollments/${id}/followups`),
  addEnrollmentFollowup: (id, data) => api.post(`/it-courses/enrollments/${id}/followups`, data),
  getTrainers: () => api.get('/it-courses/trainers'),
  createTrainer: (data) => api.post('/it-courses/trainers', data),
  updateTrainer: (id, data) => api.put(`/it-courses/trainers/${id}`, data),
  deleteTrainer: (id) => api.delete(`/it-courses/trainers/${id}`),
  getAttendanceSummary: (params) => api.get('/it-courses/attendance/summary', { params }),
  getReportSummary: (params) => api.get('/it-courses/reports/summary', { params }),
  exportReportCSV: (params) => api.get('/it-courses/reports/export', { params, responseType: 'blob' }),
  createExpense: (data) => api.post('/it-courses/expenses', data),
};

// Office
export const officeAPI = {
  getOverview: () => api.get('/office/overview'),
  getExpenses: (params) => api.get('/office/expenses', { params }),
  createExpense: (data) => api.post('/office/expenses', data),
  updateExpense: (id, data) => api.put(`/office/expenses/${id}`, data),
  deleteExpense: (id) => api.delete(`/office/expenses/${id}`),
  getSalaries: (params) => api.get('/office/salaries', { params }),
  createSalary: (data) => api.post('/office/salaries', data),
  getApprovals: () => api.get('/office/approvals'),
  bulkActionApprovals: (data) => api.post('/office/approvals/bulk-action', data),
  getBudgets: (params) => api.get('/office/budgets/variance', { params }),
  getBudgetPeriodStatus: (params) => api.get('/office/budgets/period-status', { params }),
  getBudgetHistory: (params) => api.get('/office/budgets/history', { params }),
  rollForwardBudgets: (data) => api.post('/office/budgets/roll-forward', data),
  exportBudgets: (params) => api.get('/office/budgets/export', { params, responseType: 'blob' }),
  saveBudget: (data) => api.post('/office/budgets', data),
  deleteBudget: (id) => api.delete(`/office/budgets/${id}`),
  getRecurringExpenses: () => api.get('/office/recurring-expenses'),
  saveRecurringExpense: (data) => api.post('/office/recurring-expenses', data),
  updateRecurringExpense: (id, data) => api.put(`/office/recurring-expenses/${id}`, data),
  deleteRecurringExpense: (id) => api.delete(`/office/recurring-expenses/${id}`),
  runRecurring: () => api.post('/office/recurring-expenses/run'),
  getReportSummary: (params) => api.get('/office/reports/summary', { params }),
  exportCSV: (params) => api.get('/office/reports/export', { params, responseType: 'blob' }),
  exportReportPDF: (params) => api.get('/office/reports/export/pdf', { params, responseType: 'blob' }),
  seedSample: () => api.post('/office/seed-sample'),
  resetPanel: () => api.post('/office/reset'),
  getAttachments: (id) => api.get(`/office/expenses/${id}/attachments`),
  addAttachment: (id, data) => api.post(`/office/expenses/${id}/attachments`, data),
};

// Reports
export const reportsAPI = {
  getMonthly: (params) => api.get('/reports/monthly', { params }),
  getYearly: (params) => api.get('/reports/yearly', { params }),
  exportExcel: (params) => api.get('/reports/export/excel', { params, responseType: 'blob' }),
  exportPDF: (params) => api.get('/reports/export/pdf', { params, responseType: 'blob' }),
};

// Approvals
export const approvalsAPI = {
  getPending: () => api.get('/approvals/pending'),
  takeAction: (id, action, comments) => api.post(`/approvals/${id}/action`, { action, comments }),
};

// Notifications
export const notificationsAPI = {
  getRecent: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// Finance
export const financeAPI = {
  getBankAccounts: () => api.get('/finance/bank-accounts'),
  createBankAccount: (data) => api.post('/finance/bank-accounts', data),
  getBudgets: (params) => api.get('/finance/budgets', { params }),
  saveBudget: (data) => api.post('/finance/budgets', data),
  getTaxes: () => api.get('/finance/taxes'),
  createTax: (data) => api.post('/finance/taxes', data),
  getCashflowForecast: (days) => api.get('/finance/cashflow/forecast', { params: { days } }),
  getScenarios: () => api.get('/finance/scenarios'),
  createScenario: (data) => api.post('/finance/scenarios', data),
  getAging: (params) => api.get('/finance/aging', { params }),
  getProfitability: (params) => api.get('/finance/profitability', { params }),
  runRecurringBilling: () => api.post('/finance/recurring/run'),
};

// --- Operational Workflows ---
export const opsAPI = {
  // Ecom
  getQuotes: () => api.get('/ecom-ops/quotes'),
  createQuote: (data) => api.post('/ecom-ops/quotes', data),
  updateQuote: (id, data) => api.put(`/ecom-ops/quotes/${id}`, data),
  deleteQuote: (id) => api.delete(`/ecom-ops/quotes/${id}`),
  getMilestones: (projectId) => api.get(`/ecom-ops/projects/${projectId}/milestones`),
  createMilestone: (projectId, data) => api.post(`/ecom-ops/projects/${projectId}/milestones`, data),
  invoiceMilestone: (id) => api.post(`/ecom-ops/milestones/${id}/invoice`),

  // UrbanFit
  updateOrderStatus: (id, status) => api.patch(`/urbanfit-ops/orders/${id}/status`, { status }),
  getReturns: () => api.get('/urbanfit-ops/returns'),
  createReturn: (data) => api.post('/urbanfit-ops/returns', data),
  updateReturn: (id, data) => api.put(`/urbanfit-ops/returns/${id}`, data),
  deleteReturn: (id) => api.delete(`/urbanfit-ops/returns/${id}`),

  // School SaaS
  getRenewals: () => api.get('/school-saas-ops/renewals'),
  getSaaSMetrics: () => api.get('/school-saas-ops/metrics'),

  // Physical School
  getChallans: (params) => api.get('/physical-school-ops/challans', { params }),
  generateChallan: (data) => api.post('/physical-school-ops/challans/generate', data),
  updateChallan: (id, data) => api.put(`/physical-school-ops/challans/${id}`, data),
  updateChallanStatus: (id, status, data = {}) => api.patch(`/physical-school-ops/challans/${id}/status`, { status, ...data }),
  sendChallanReminder: (id) => api.post(`/physical-school-ops/challans/${id}/reminder`),
  deleteChallan: (id) => api.delete(`/physical-school-ops/challans/${id}`),
  getEscalations: () => api.get('/physical-school-ops/defaulters/escalations'),

  // IT Courses
  getAttendance: (batchId) => api.get(`/it-courses-ops/batches/${batchId}/attendance`),
  recordAttendance: (data) => api.post('/it-courses-ops/attendance', data),
  getInstructorPayouts: () => api.get('/it-courses-ops/payouts'),
  requestPayout: (data) => api.post('/it-courses-ops/payouts', data),
  updatePayoutStatus: (id, data) => api.patch(`/it-courses-ops/payouts/${id}/status`, data),

  // Office
  getVendors: () => api.get('/office-ops/vendors'),
  createVendor: (data) => api.post('/office-ops/vendors', data),
  updateVendor: (id, data) => api.put(`/office-ops/vendors/${id}`, data),
  deleteVendor: (id) => api.delete(`/office-ops/vendors/${id}`),
  getPOs: () => api.get('/office-ops/purchase-orders'),
  createPO: (data) => api.post('/office-ops/purchase-orders', data),
  updatePO: (id, data) => api.put(`/office-ops/purchase-orders/${id}`, data),
  deletePO: (id) => api.delete(`/office-ops/purchase-orders/${id}`),
};

export default api;
