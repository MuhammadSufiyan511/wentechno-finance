import express, { json, urlencoded } from 'express';
import cors from 'cors';
import 'dotenv/config';

import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import ecomRoutes from './routes/ecom.js';
import urbanfitRoutes from './routes/urbanfit.js';
import schoolSaasRoutes from './routes/schoolSaas.js';
import physicalSchoolRoutes from './routes/physicalSchool.js';
import itCoursesRoutes from './routes/itCourses.js';
import officeRoutes from './routes/office.js';
import reportRoutes from './routes/reports.js';
import approvalRoutes from './routes/approvals.js';
import notificationRoutes from './routes/notifications.js';
import financeRoutes from './routes/finance.js';
import ecomOpsRoutes from './routes/ecom_ops.js';
import urbanfitOpsRoutes from './routes/urbanfit_ops.js';
import schoolSaasOpsRoutes from './routes/school_saas_ops.js';
import physicalSchoolOpsRoutes from './routes/physical_school_ops.js';
import itCoursesOpsRoutes from './routes/it_courses_ops.js';
import officeOpsRoutes from './routes/office_ops.js';

const app = express();

// Middleware
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(logger);

const mountApiRoutes = (prefix) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/dashboard`, dashboardRoutes);
  app.use(`${prefix}/ecom`, ecomRoutes);
  app.use(`${prefix}/urbanfit`, urbanfitRoutes);
  app.use(`${prefix}/school-saas`, schoolSaasRoutes);
  app.use(`${prefix}/physical-school`, physicalSchoolRoutes);
  app.use(`${prefix}/it-courses`, itCoursesRoutes);
  app.use(`${prefix}/office`, officeRoutes);
  app.use(`${prefix}/reports`, reportRoutes);
  app.use(`${prefix}/approvals`, approvalRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/finance`, financeRoutes);
  app.use(`${prefix}/ecom-ops`, ecomOpsRoutes);
  app.use(`${prefix}/urbanfit-ops`, urbanfitOpsRoutes);
  app.use(`${prefix}/school-saas-ops`, schoolSaasOpsRoutes);
  app.use(`${prefix}/physical-school-ops`, physicalSchoolOpsRoutes);
  app.use(`${prefix}/it-courses-ops`, itCoursesOpsRoutes);
  app.use(`${prefix}/office-ops`, officeOpsRoutes);
};

// Mount both canonical and legacy API prefixes
mountApiRoutes('/api/v1');
mountApiRoutes('/api');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), requestId: req.id });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', requestId: req.id });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Financial Tracker API ready`);
});
