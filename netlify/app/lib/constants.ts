// Centralized shared constants for client and server
// Pagination: different defaults for front and backend

export const SERVER_PAGE_LIMIT = 10;
export const MUST_BE_AUTHENTICATED = false;

// Cache TTLs (seconds)
export const ANALYSIS_CACHE_TTL = 24 * 60 * 60; // 24 hours - analysis reports
export const MACRO_CACHE_TTL = 24 * 60 * 60; // 24 hours - macro analysis
