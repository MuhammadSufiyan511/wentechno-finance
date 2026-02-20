import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  getOverview: () => api.get('/dashboard/overview'),
  getBusinessUnits: () => api.get('/dashboard/business-units'),
};

// Ecom
export const ecomAPI = {
  getOverview: () => api.get('/ecom/overview'),
  getClients: () => api.get('/ecom/clients'),
  createClient: (data) => api.post('/ecom/clients', data),
  getProjects: () => api.get('/ecom/projects'),
  createProject: (data) => api.post('/ecom/projects', data),
  updateProject: (id, data) => api.put(`/ecom/projects/${id}`, data),
  getInvoices: () => api.get('/ecom/invoices'),
  createInvoice: (data) => api.post('/ecom/invoices', data),
  updateInvoice: (id, data) => api.put(`/ecom/invoices/${id}`, data),
  getRevenue: (params) => api.get('/ecom/revenue', { params }),
  createRevenue: (data) => api.post('/ecom/revenue', data),
  getExpenses: (params) => api.get('/ecom/expenses', { params }),
  createExpense: (data) => api.post('/ecom/expenses', data),
};

// UrbanFit
export const urbanfitAPI = {
  getOverview: () => api.get('/urbanfit/overview'),
  getOrders: (params) => api.get('/urbanfit/orders', { params }),
  createOrder: (data) => api.post('/urbanfit/orders', data),
  updateOrder: (id, data) => api.put(`/urbanfit/orders/${id}`, data),
  getDailySales: (params) => api.get('/urbanfit/daily-sales', { params }),
  recordDailySales: (data) => api.post('/urbanfit/daily-sales', data),
  createRevenue: (data) => api.post('/urbanfit/revenue', data),
  createExpense: (data) => api.post('/urbanfit/expenses', data),
};

// School SaaS
export const schoolSaasAPI = {
  getOverview: () => api.get('/school-saas/overview'),
  getSchools: () => api.get('/school-saas/schools'),
  createSchool: (data) => api.post('/school-saas/schools', data),
  updateSchool: (id, data) => api.put(`/school-saas/schools/${id}`, data),
  createRevenue: (data) => api.post('/school-saas/revenue', data),
  createExpense: (data) => api.post('/school-saas/expenses', data),
};

// Physical School
export const physicalSchoolAPI = {
  getOverview: () => api.get('/physical-school/overview'),
  getStudents: () => api.get('/physical-school/students'),
  createStudent: (data) => api.post('/physical-school/students', data),
  getFees: (params) => api.get('/physical-school/fees', { params }),
  collectFee: (data) => api.post('/physical-school/fees', data),
  getDefaulters: (params) => api.get('/physical-school/defaulters', { params }),
  createExpense: (data) => api.post('/physical-school/expenses', data),
};

// IT Courses
export const itCoursesAPI = {
  getOverview: () => api.get('/it-courses/overview'),
  getCourses: () => api.get('/it-courses/courses'),
  createCourse: (data) => api.post('/it-courses/courses', data),
  getBatches: () => api.get('/it-courses/batches'),
  createBatch: (data) => api.post('/it-courses/batches', data),
  getEnrollments: () => api.get('/it-courses/enrollments'),
  createEnrollment: (data) => api.post('/it-courses/enrollments', data),
  getTrainers: () => api.get('/it-courses/trainers'),
  createTrainer: (data) => api.post('/it-courses/trainers', data),
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
};

// Reports
export const reportsAPI = {
  getMonthly: (params) => api.get('/reports/monthly', { params }),
  getYearly: (params) => api.get('/reports/yearly', { params }),
  exportExcel: (params) => api.get('/reports/export/excel', { params, responseType: 'blob' }),
  exportPDF: (params) => api.get('/reports/export/pdf', { params, responseType: 'blob' }),
};

export default api;
