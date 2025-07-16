/**
 * Agent Neo Event Bus
 * 
 * Implements the Event-Driven Architecture (EDA) for inter-module communication
 * as specified in the whitepaper section 4.7. This decouples modules and makes
 * them highly independent and easier to evolve or replace.
 * 
 * Uses native EventTarget API for high performance and browser compatibility.
 */

class EventBus extends EventTarget {
    constructor() {
        super();
        this.eventHistory = new Map();
        this.subscribers = new Map();
        this.debugMode = false;
        this.maxHistorySize = 1000;
        
        // Performance monitoring
        this.metrics = {
            eventsEmitted: 0,
            eventsReceived: 0,
            averageProcessingTime: 0,
            errorCount: 0
        };
        
        this.init();
    }

    init() {
        this.log('EventBus initialized');
        
        // Listen for unhandled errors in event handlers
        this.addEventListener('error', this.handleEventError.bind(this));
        
        // Periodically clean up old events from history
        setInterval(() => this.cleanupHistory(), 60000); // Clean every minute
    }

    /**
     * Emit an event with optional data
     * @param {string} eventType - The type of event to emit
     * @param {*} data - Optional data to send with the event
     * @param {Object} options - Optional configuration
     */
    emit(eventType, data = null, options = {}) {
        const startTime = performance.now();
        
        try {
            const eventDetail = {
                type: eventType,
                data,
                timestamp: Date.now(),
                id: this.generateEventId(),
                source: options.source || 'unknown',
                priority: options.priority || 'normal',
                ...options
            };

            // Store in history for debugging and replay
            this.storeEventInHistory(eventType, eventDetail);

            // Create and dispatch the custom event
            const customEvent = new CustomEvent(eventType, {
                detail: eventDetail,
                bubbles: options.bubbles || false,
                cancelable: options.cancelable || true
            });

            const result = this.dispatchEvent(customEvent);
            
            this.metrics.eventsEmitted++;
            this.updateProcessingTime(performance.now() - startTime);
            
            if (this.debugMode) {
                this.log(`Event emitted: ${eventType}`, eventDetail);
            }

            return result;
            
        } catch (error) {
            this.metrics.errorCount++;
            this.handleEventError(error, eventType, data);
            return false;
        }
    }

    /**
     * Subscribe to an event type
     * @param {string} eventType - The type of event to listen for
     * @param {Function} handler - The handler function to call
     * @param {Object} options - Optional configuration
     */
    on(eventType, handler, options = {}) {
        const wrappedHandler = (event) => {
            const startTime = performance.now();
            
            try {
                this.metrics.eventsReceived++;
                
                if (this.debugMode) {
                    this.log(`Event received: ${eventType}`, event.detail);
                }

                // Call the actual handler
                const result = handler(event.detail, event);
                
                this.updateProcessingTime(performance.now() - startTime);
                return result;
                
            } catch (error) {
                this.metrics.errorCount++;
                this.handleEventError(error, eventType, event.detail);
            }
        };

        // Store the mapping for easy removal
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, new Map());
        }
        this.subscribers.get(eventType).set(handler, wrappedHandler);

        // Add the wrapped handler to the DOM event system
        this.addEventListener(eventType, wrappedHandler, {
            once: options.once || false,
            passive: options.passive || false,
            capture: options.capture || false
        });

        if (this.debugMode) {
            this.log(`Subscribed to event: ${eventType}`);
        }

        return this;
    }

    /**
     * Unsubscribe from an event type
     * @param {string} eventType - The type of event to stop listening for
     * @param {Function} handler - The specific handler to remove
     */
    off(eventType, handler) {
        if (this.subscribers.has(eventType)) {
            const eventSubscribers = this.subscribers.get(eventType);
            
            if (eventSubscribers.has(handler)) {
                const wrappedHandler = eventSubscribers.get(handler);
                this.removeEventListener(eventType, wrappedHandler);
                eventSubscribers.delete(handler);
                
                if (eventSubscribers.size === 0) {
                    this.subscribers.delete(eventType);
                }
                
                if (this.debugMode) {
                    this.log(`Unsubscribed from event: ${eventType}`);
                }
            }
        }
        
        return this;
    }

    /**
     * Subscribe to an event type, but only trigger once
     * @param {string} eventType - The type of event to listen for
     * @param {Function} handler - The handler function to call
     * @param {Object} options - Optional configuration
     */
    once(eventType, handler, options = {}) {
        return this.on(eventType, handler, { ...options, once: true });
    }

    /**
     * Wait for a specific event to occur (returns a Promise)
     * @param {string} eventType - The type of event to wait for
     * @param {number} timeout - Optional timeout in milliseconds
     */
    waitFor(eventType, timeout = 0) {
        return new Promise((resolve, reject) => {
            let timeoutId;
            
            const handler = (eventData) => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(eventData);
            };

            this.once(eventType, handler);

            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    this.off(eventType, handler);
                    reject(new Error(`Timeout waiting for event: ${eventType}`));
                }, timeout);
            }
        });
    }

    /**
     * Emit an event and wait for responses
     * @param {string} eventType - The type of event to emit
     * @param {*} data - Data to send with the event
     * @param {number} timeout - Maximum time to wait for responses
     */
    async request(eventType, data = null, timeout = 5000) {
        const requestId = this.generateEventId();
        const responseEvent = `${eventType}:response:${requestId}`;
        
        // Set up response listener
        const responsePromise = this.waitFor(responseEvent, timeout);
        
        // Emit the request
        this.emit(eventType, {
            ...data,
            requestId,
            expectsResponse: true
        });
        
        return responsePromise;
    }

    /**
     * Respond to a request event
     * @param {string} originalEventType - The original event type
     * @param {string} requestId - The request ID
     * @param {*} responseData - The response data
     */
    respond(originalEventType, requestId, responseData) {
        const responseEvent = `${originalEventType}:response:${requestId}`;
        this.emit(responseEvent, responseData);
    }

    /**
     * Get list of active subscribers for debugging
     */
    getSubscribers() {
        const result = {};
        for (const [eventType, handlers] of this.subscribers) {
            result[eventType] = handlers.size;
        }
        return result;
    }

    /**
     * Get event history for debugging
     * @param {string} eventType - Optional event type filter
     * @param {number} limit - Maximum number of events to return
     */
    getEventHistory(eventType = null, limit = 50) {
        if (eventType) {
            return this.eventHistory.get(eventType)?.slice(-limit) || [];
        }
        
        const allEvents = [];
        for (const events of this.eventHistory.values()) {
            allEvents.push(...events);
        }
        
        return allEvents
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Clear all event history
     */
    clearHistory() {
        this.eventHistory.clear();
        this.log('Event history cleared');
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Remove all event listeners and clean up
     */
    destroy() {
        // Remove all subscribers
        for (const [eventType, handlers] of this.subscribers) {
            for (const [original, wrapped] of handlers) {
                this.removeEventListener(eventType, wrapped);
            }
        }
        
        this.subscribers.clear();
        this.eventHistory.clear();
        
        this.log('EventBus destroyed');
    }

    // Private methods

    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    storeEventInHistory(eventType, eventDetail) {
        if (!this.eventHistory.has(eventType)) {
            this.eventHistory.set(eventType, []);
        }
        
        const events = this.eventHistory.get(eventType);
        events.push(eventDetail);
        
        // Keep only the most recent events
        if (events.length > this.maxHistorySize) {
            events.shift();
        }
    }

    cleanupHistory() {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        
        for (const [eventType, events] of this.eventHistory) {
            const filteredEvents = events.filter(event => event.timestamp > cutoffTime);
            if (filteredEvents.length !== events.length) {
                this.eventHistory.set(eventType, filteredEvents);
            }
        }
    }

    updateProcessingTime(duration) {
        const totalEvents = this.metrics.eventsEmitted + this.metrics.eventsReceived;
        if (totalEvents > 0) {
            this.metrics.averageProcessingTime = 
                ((this.metrics.averageProcessingTime * (totalEvents - 1)) + duration) / totalEvents;
        }
    }

    handleEventError(error, eventType = 'unknown', data = null) {
        console.error(`EventBus error in ${eventType}:`, error, data);
        
        // Emit an error event for error handling modules
        this.dispatchEvent(new CustomEvent('eventbus:error', {
            detail: {
                error,
                eventType,
                data,
                timestamp: Date.now()
            }
        }));
    }

    log(message, data = null) {
        if (this.debugMode || message.includes('error')) {
            console.log(`[EventBus] ${message}`, data || '');
        }
    }
}

// Create and export a singleton instance
const eventBus = new EventBus();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.AgentNeoEventBus = eventBus;
}

export default eventBus;