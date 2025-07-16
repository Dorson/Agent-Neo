/**
 * EventBus.js - Event-Driven Architecture for Inter-Module Communication
 * 
 * Implements robust event bus using native EventTarget API for all
 * communication between Agent Neo's core modules as required by
 * whitepaper section 4.7
 */

class EventBus extends EventTarget {
  constructor() {
    super();
    
    // Event registry for debugging and monitoring
    this.eventRegistry = new Map();
    this.listenerCount = new Map();
    
    // Event history for debugging (limited to last 1000 events)
    this.eventHistory = [];
    this.maxHistorySize = 1000;
    
    // Event middleware for processing
    this.middleware = [];
    
    // Error handling
    this.errorHandlers = new Set();
    
    // Performance monitoring
    this.performanceMetrics = {
      eventsEmitted: 0,
      eventsProcessed: 0,
      averageProcessingTime: 0,
      errors: 0
    };
    
    // Queue for batched events
    this.eventQueue = [];
    this.batchProcessing = false;
    this.batchTimeout = null;
    
    console.log('EventBus initialized');
  }

  /**
   * Enhanced emit with middleware support and error handling
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   * @param {object} options - Options (priority, batch, etc.)
   */
  emit(eventName, data = null, options = {}) {
    const startTime = performance.now();
    
    try {
      // Create enhanced event object
      const eventData = {
        type: eventName,
        data,
        timestamp: Date.now(),
        id: this.generateEventId(),
        source: options.source || 'unknown',
        priority: options.priority || 'normal',
        metadata: options.metadata || {}
      };

      // Apply middleware
      const processedEvent = this.applyMiddleware(eventData);
      
      if (!processedEvent) {
        // Event was cancelled by middleware
        return false;
      }

      // Handle batching if requested
      if (options.batch) {
        this.addToBatch(processedEvent);
        return true;
      }

      // Emit the event
      const success = this.dispatchEvent(new CustomEvent(eventName, {
        detail: processedEvent,
        bubbles: false,
        cancelable: true
      }));

      // Update metrics
      this.updateMetrics(eventName, startTime);
      
      // Add to history
      this.addToHistory(processedEvent);
      
      return success;
    } catch (error) {
      this.handleError(error, eventName, data);
      return false;
    }
  }

  /**
   * Enhanced addEventListener with automatic cleanup and error handling
   * @param {string} eventName - Event name
   * @param {function} handler - Event handler
   * @param {object} options - Options
   * @returns {function} Cleanup function
   */
  on(eventName, handler, options = {}) {
    const wrappedHandler = (event) => {
      try {
        const startTime = performance.now();
        
        // Call the original handler
        handler(event.detail, event);
        
        // Update processing metrics
        const processingTime = performance.now() - startTime;
        this.updateProcessingMetrics(processingTime);
        
      } catch (error) {
        this.handleError(error, eventName, event.detail);
      }
    };

    // Add to listener count
    this.listenerCount.set(eventName, (this.listenerCount.get(eventName) || 0) + 1);
    
    // Add event listener
    this.addEventListener(eventName, wrappedHandler, options);
    
    // Store for cleanup
    if (!this.eventRegistry.has(eventName)) {
      this.eventRegistry.set(eventName, new Set());
    }
    this.eventRegistry.get(eventName).add(wrappedHandler);
    
    // Return cleanup function
    return () => {
      this.off(eventName, wrappedHandler);
    };
  }

  /**
   * Remove event listener
   * @param {string} eventName - Event name
   * @param {function} handler - Event handler
   */
  off(eventName, handler) {
    this.removeEventListener(eventName, handler);
    
    // Update registry
    if (this.eventRegistry.has(eventName)) {
      this.eventRegistry.get(eventName).delete(handler);
      if (this.eventRegistry.get(eventName).size === 0) {
        this.eventRegistry.delete(eventName);
      }
    }
    
    // Update listener count
    const count = this.listenerCount.get(eventName) || 0;
    if (count > 1) {
      this.listenerCount.set(eventName, count - 1);
    } else {
      this.listenerCount.delete(eventName);
    }
  }

  /**
   * Listen for event once
   * @param {string} eventName - Event name
   * @param {function} handler - Event handler
   * @returns {Promise} Promise that resolves with event data
   */
  once(eventName, handler = null) {
    if (handler) {
      const cleanup = this.on(eventName, (data, event) => {
        cleanup();
        handler(data, event);
      });
      return cleanup;
    } else {
      // Return promise if no handler provided
      return new Promise((resolve) => {
        const cleanup = this.on(eventName, (data) => {
          cleanup();
          resolve(data);
        });
      });
    }
  }

  /**
   * Wait for multiple events
   * @param {array} eventNames - Array of event names
   * @param {number} timeout - Timeout in ms
   * @returns {Promise} Promise that resolves when all events are received
   */
  async waitForAll(eventNames, timeout = 10000) {
    const promises = eventNames.map(eventName => this.once(eventName));
    
    if (timeout > 0) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout waiting for events: ${eventNames.join(', ')}`)), timeout);
      });
      
      return Promise.race([Promise.all(promises), timeoutPromise]);
    }
    
    return Promise.all(promises);
  }

  /**
   * Add middleware for event processing
   * @param {function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Remove middleware
   * @param {function} middleware - Middleware function
   */
  removeMiddleware(middleware) {
    const index = this.middleware.indexOf(middleware);
    if (index > -1) {
      this.middleware.splice(index, 1);
    }
  }

  /**
   * Add error handler
   * @param {function} handler - Error handler
   */
  addErrorHandler(handler) {
    this.errorHandlers.add(handler);
  }

  /**
   * Remove error handler
   * @param {function} handler - Error handler
   */
  removeErrorHandler(handler) {
    this.errorHandlers.delete(handler);
  }

  /**
   * Batch multiple events and emit them together
   * @param {array} events - Array of {name, data, options}
   */
  emitBatch(events) {
    const batchId = this.generateEventId();
    const batchData = {
      id: batchId,
      events: events.map(event => ({
        name: event.name,
        data: event.data,
        options: event.options || {}
      })),
      timestamp: Date.now()
    };

    this.emit('batch', batchData, { source: 'EventBus' });
  }

  /**
   * Apply middleware to event
   * @private
   */
  applyMiddleware(eventData) {
    let processedEvent = eventData;
    
    for (const middleware of this.middleware) {
      try {
        processedEvent = middleware(processedEvent);
        if (!processedEvent) {
          // Middleware cancelled the event
          return null;
        }
      } catch (error) {
        console.error('Middleware error:', error);
        this.handleError(error, 'middleware', eventData);
      }
    }
    
    return processedEvent;
  }

  /**
   * Add event to batch queue
   * @private
   */
  addToBatch(eventData) {
    this.eventQueue.push(eventData);
    
    // Auto-flush batch after short delay
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, 10); // 10ms batch window
  }

  /**
   * Flush batched events
   * @private
   */
  flushBatch() {
    if (this.eventQueue.length === 0) return;
    
    const events = this.eventQueue.splice(0);
    this.emitBatch(events);
    this.batchTimeout = null;
  }

  /**
   * Handle errors
   * @private
   */
  handleError(error, eventName, data) {
    this.performanceMetrics.errors++;
    
    const errorEvent = {
      error,
      eventName,
      data,
      timestamp: Date.now()
    };

    // Notify error handlers
    for (const handler of this.errorHandlers) {
      try {
        handler(errorEvent);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }

    // Emit error event (avoid infinite loops)
    if (eventName !== 'error') {
      setTimeout(() => {
        this.emit('error', errorEvent, { source: 'EventBus' });
      }, 0);
    }

    console.error('EventBus error:', error);
  }

  /**
   * Update performance metrics
   * @private
   */
  updateMetrics(eventName, startTime) {
    this.performanceMetrics.eventsEmitted++;
    const processingTime = performance.now() - startTime;
    
    // Update average processing time
    const totalEvents = this.performanceMetrics.eventsEmitted;
    const currentAvg = this.performanceMetrics.averageProcessingTime;
    this.performanceMetrics.averageProcessingTime = 
      (currentAvg * (totalEvents - 1) + processingTime) / totalEvents;
  }

  /**
   * Update processing metrics
   * @private
   */
  updateProcessingMetrics(processingTime) {
    this.performanceMetrics.eventsProcessed++;
  }

  /**
   * Add event to history
   * @private
   */
  addToHistory(eventData) {
    this.eventHistory.push(eventData);
    
    // Keep history size manageable
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Generate unique event ID
   * @private
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current listener count for event
   * @param {string} eventName - Event name
   * @returns {number} Listener count
   */
  getListenerCount(eventName) {
    return this.listenerCount.get(eventName) || 0;
  }

  /**
   * Get all registered events
   * @returns {array} Array of event names
   */
  getRegisteredEvents() {
    return Array.from(this.eventRegistry.keys());
  }

  /**
   * Get event history
   * @param {number} limit - Maximum number of events to return
   * @returns {array} Event history
   */
  getEventHistory(limit = 100) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get performance metrics
   * @returns {object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.performanceMetrics,
      activeListeners: Array.from(this.listenerCount.entries()),
      registeredEvents: this.getRegisteredEvents(),
      historySize: this.eventHistory.length
    };
  }

  /**
   * Clear all listeners and reset
   */
  reset() {
    // Remove all listeners
    for (const [eventName, listeners] of this.eventRegistry) {
      for (const listener of listeners) {
        this.removeEventListener(eventName, listener);
      }
    }
    
    // Clear registries
    this.eventRegistry.clear();
    this.listenerCount.clear();
    this.eventHistory.length = 0;
    
    // Reset metrics
    this.performanceMetrics = {
      eventsEmitted: 0,
      eventsProcessed: 0,
      averageProcessingTime: 0,
      errors: 0
    };
    
    console.log('EventBus reset');
  }

  /**
   * Create namespaced event bus
   * @param {string} namespace - Namespace prefix
   * @returns {object} Namespaced event bus
   */
  createNamespace(namespace) {
    const namespacedBus = {
      emit: (eventName, data, options) => 
        this.emit(`${namespace}:${eventName}`, data, { ...options, source: namespace }),
      
      on: (eventName, handler, options) => 
        this.on(`${namespace}:${eventName}`, handler, options),
      
      off: (eventName, handler) => 
        this.off(`${namespace}:${eventName}`, handler),
      
      once: (eventName, handler) => 
        this.once(`${namespace}:${eventName}`, handler)
    };
    
    return namespacedBus;
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      eventRegistry: Object.fromEntries(
        Array.from(this.eventRegistry.entries()).map(([key, value]) => [key, value.size])
      ),
      listenerCount: Object.fromEntries(this.listenerCount),
      recentEvents: this.getEventHistory(10),
      metrics: this.getMetrics(),
      middlewareCount: this.middleware.length,
      errorHandlerCount: this.errorHandlers.size
    };
  }
}

// Create singleton instance
const eventBus = new EventBus();

// Make globally available for integration with other modules
window.eventBus = eventBus;

// Add some default middleware for logging in development
if (process.env.NODE_ENV === 'development') {
  eventBus.addMiddleware((eventData) => {
    console.debug(`Event: ${eventData.type}`, eventData);
    return eventData;
  });
}

// Export for use in other modules
export default eventBus;