/**
 * Debug Logger Utility
 * Only logs when DEBUG=true in environment
 */

const isDebugEnabled = (): boolean => {
  return process.env.DEBUG === 'true';
};

export const debug = {
  log: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.log('[INFO]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.warn('[WARN]', ...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors
    console.error('[ERROR]', ...args);
  },
  
  startup: (...args: any[]) => {
    // Always log startup messages (important for service discovery)
    console.log(...args);
  },
};

export default debug;
