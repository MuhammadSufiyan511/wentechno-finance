export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const requestId = req.id || 'N/A';

    console.error(`[${new Date().toISOString()}] [${requestId}] Error:`, err);

    res.status(statusCode).json({
        success: false,
        requestId,
        message: err.message || 'Internal Server Error',
        errors: err.errors || undefined,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};
