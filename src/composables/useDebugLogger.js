import { ref, nextTick } from 'vue'

// Global state for debug logs (shared across all components)
const logs = ref([])
const originalConsole = {}
let isIntercepting = false
let isActive = false

/**
 * Composable for managing console log interception
 * This allows the debug terminal to capture logs across the entire app
 */
export function useDebugLogger() {
  function addLog(type, message) {
    // Prevent recursive calls
    if (isIntercepting) {
      return
    }
    
    isIntercepting = true
    try {
      const time = new Date().toLocaleTimeString()
      logs.value.push({
        type,
        message: String(message),
        time
      })
      
      // Limit log size to prevent memory issues (keep last 1000 logs)
      if (logs.value.length > 1000) {
        logs.value = logs.value.slice(-1000)
      }
    } catch (e) {
      // If something goes wrong, reset the flag
      isIntercepting = false
    } finally {
      // Reset flag after reactive update completes
      nextTick(() => {
        isIntercepting = false
      })
    }
  }

  function clearLogs() {
    logs.value = []
  }

  function interceptConsole() {
    if (isActive) {
      return // Already intercepting
    }

    // Store original console methods
    originalConsole.log = console.log
    originalConsole.error = console.error
    originalConsole.warn = console.warn
    originalConsole.debug = console.debug
    originalConsole.info = console.info

    // Intercept console methods
    const intercept = (method, type) => {
      const originalMethod = originalConsole[method]
      console[method] = (...args) => {
        // Call original method first (before any reactive updates)
        originalMethod(...args)
        
        // Only add to logs if we're not already intercepting (prevent recursion)
        if (!isIntercepting && isActive) {
          // Add to logs
          const message = args.map(arg => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg, null, 2)
              } catch (e) {
                return String(arg)
              }
            }
            return String(arg)
          }).join(' ')
          
          // Use nextTick to defer the reactive update outside the current execution context
          nextTick(() => {
            addLog(type, message)
          })
        }
      }
    }

    intercept('log', 'log')
    intercept('error', 'error')
    intercept('warn', 'warn')
    intercept('debug', 'debug')
    intercept('info', 'info')

    isActive = true
  }

  function restoreConsole() {
    if (!isActive) {
      return // Not intercepting
    }

    // Restore original console methods
    Object.keys(originalConsole).forEach(method => {
      if (originalConsole[method]) {
        console[method] = originalConsole[method]
      }
    })

    isActive = false
  }

  function startInterception() {
    if (!isActive) {
      interceptConsole()
    }
  }

  function stopInterception() {
    if (isActive) {
      restoreConsole()
      clearLogs()
    }
  }

  return {
    logs,
    clearLogs,
    startInterception,
    stopInterception,
    isActive: () => isActive
  }
}

