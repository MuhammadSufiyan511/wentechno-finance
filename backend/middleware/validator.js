import { body, validationResult } from 'express-validator';

export const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        res.status(400).json({
            success: false,
            errors: errors.array(),
            message: 'Validation failed'
        });
    };
};

export const transactionRules = [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    body('date').isDate().withMessage('Invalid date format'),
    body('business_unit_id').optional().isInt().withMessage('Invalid business unit ID'),
    body('category').optional().notEmpty().withMessage('Category is required'),
];

export const invoiceRules = [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    body('total_amount').optional().isFloat({ min: 0.01 }).withMessage('Total amount must be positive'),
    body('due_date').optional().isDate().withMessage('Invalid due date'),
];

export const salaryRules = [
    body('base_salary').isFloat({ min: 0.01 }).withMessage('Salary must be positive'),
    body('month').notEmpty().withMessage('Month is required'),
    body('year').isInt({ min: 2000, max: 2100 }).withMessage('Invalid year'),
];

export const studentRules = [
    body('name').notEmpty().withMessage('Student name is required'),
    body('class').notEmpty().withMessage('Class is required'),
    body('monthly_fee').isFloat({ min: 0 }).withMessage('Monthly fee cannot be negative'),
];

export const schoolRules = [
    body('school_name').notEmpty().withMessage('School name is required'),
    body('monthly_fee').isFloat({ min: 0 }).withMessage('Monthly fee cannot be negative'),
];

export const courseRules = [
    body('name').notEmpty().withMessage('Course name is required'),
    body('fee').isFloat({ min: 0 }).withMessage('Fee cannot be negative'),
];

export const trainerRules = [
    body('name').notEmpty().withMessage('Trainer name is required'),
    body('salary').optional().isFloat({ min: 0 }).withMessage('Salary cannot be negative'),
];

export const clientRules = [
    body('name').notEmpty().withMessage('Client name is required'),
    body('email').optional().isEmail().withMessage('Invalid email'),
];

export const projectRules = [
    body('name').notEmpty().withMessage('Project name is required'),
    body('type').notEmpty().withMessage('Project type is required'),
    body('total_amount').isFloat({ min: 0.01 }).withMessage('Total amount must be positive'),
];

export const loginRules = [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
];

export const approvalActionRules = [
    body('action').isIn(['approved', 'rejected']).withMessage('Invalid action'),
    body('comments').optional().isString().withMessage('Comments must be a string'),
];

