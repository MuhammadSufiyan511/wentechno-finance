import express, { json, urlencoded } from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import ecomRoutes from './routes/ecom.js';
import urbanfitRoutes from './routes/urbanfit.js';
import schoolSaasRoutes from './routes/schoolSaas.js';
import physicalSchoolRoutes from './routes/physicalSchool.js';
import itCoursesRoutes from './routes/itCourses.js';
import officeRoutes from './routes/office.js';
import reportRoutes from './routes/reports.js';

const app = express();

// Middleware
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ecom', ecomRoutes);
app.use('/api/urbanfit', urbanfitRoutes);
app.use('/api/school-saas', schoolSaasRoutes);
app.use('/api/physical-school', physicalSchoolRoutes);
app.use('/api/it-courses', itCoursesRoutes);
app.use('/api/office', officeRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Financial Tracker API ready`);
});
