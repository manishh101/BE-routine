/**
 * Response Utilities
 * Helper functions for API responses
 */

/**
 * Format successful response
 */
function formatResponse(data, message = 'Success', status = 200) {
  return {
    success: true,
    status,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Format error response
 */
function formatErrorResponse(error, message = 'Internal server error', status = 500) {
  return {
    success: false,
    status,
    message,
    error: process.env.NODE_ENV === 'development' ? error : undefined,
    timestamp: new Date().toISOString()
  };
}

/**
 * Handle error middleware
 */
function handleError(error, req, res, next) {
  console.error('Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json(formatErrorResponse(error.message, 'Validation Error', 400));
  }
  
  if (error.name === 'MongoError' && error.code === 11000) {
    return res.status(409).json(formatErrorResponse(error.message, 'Duplicate Entry', 409));
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json(formatErrorResponse(error.message, 'Invalid ID Format', 400));
  }
  
  res.status(500).json(formatErrorResponse(error.message, 'Internal Server Error', 500));
}

/**
 * Pagination helper
 */
function getPaginationOptions(req) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Format pagination metadata
 */
function formatPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

module.exports = {
  formatResponse,
  formatErrorResponse,
  handleError,
  getPaginationOptions,
  formatPaginationMeta
};
