/**
 * Utility for standardizing API responses
 */

/**
 * Creates a success response
 * @param {Object} data - The data to include in the response
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} - Formatted success response
 */
const success = (data = null, message = 'Operation successful', statusCode = 200) => {
  return {
    success: true,
    message,
    statusCode,
    data,
    timestamp: Date.now()
  };
};

/**
 * Creates an error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Object} errors - Optional additional error details
 * @returns {Object} - Formatted error response
 */
const error = (message = 'An error occurred', statusCode = 500, errors = null) => {
  return {
    success: false,
    message,
    statusCode,
    errors,
    timestamp: Date.now()
  };
};

/**
 * Creates a paginated response
 * @param {Array} data - The data array to paginate
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {string} message - Optional success message
 * @returns {Object} - Formatted paginated response
 */
const paginated = (data, page, limit, total, message = 'Data retrieved successfully') => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    success: true,
    message,
    statusCode: 200,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : null,
      prevPage: hasPrev ? page - 1 : null
    },
    timestamp: Date.now()
  };
};

module.exports = {
  success,
  error,
  paginated
};
