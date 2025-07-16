/**
 * Agent Neo State Manager
 * 
 * Implements the Global State Management System using Observable Pattern
 * as specified in the whitepaper section 4.1. Provides a centralized,
 * reactive store for Agent Neo's UI state and core system state.
 */

import eventBus from './EventBus.js';

class StateManager {
    constructor() {
        this.state = new Map();
        this.subscribers = new Map();
        this.middleware = [];
        this.history = [];
        this.maxHistorySize = 100;
        this.debugMode = false;
        
        // Performance tracking
        this.metrics = {
            stateUpdates: 0,
            subscriptionCount: 0,
            averageUpdateTime: 0
        };
        
        this.init();
    }

    init() {
        // Initialize default state
        this.initializeDefaultState();
        
        // Listen for EventBus events to update state
        this.setupEventBusIntegration();
        
        this.log('StateManager initialized');
    }

    initializeDefaultState() {
        // Node Status
        this.setState('node.status', 'offline');
        this.setState('node.uptime', 0);
        this.setState('node.connections', 0);
        this.setState('node.ipfsStatus', 'disconnected');
        
        // Resource Metrics
        this.setState('resources.cpu', 0);
        this.setState('resources.memory', 0);
        this.setState('resources.trust', 100);
        this.setState('resources.reputation', 0);
        this.setState('resources.maxCpu', 50);
        this.setState('resources.maxMemory', 40);
        
        // Performance Metrics
        this.setState('performance.tasksCompleted', 0);
        this.setState('performance.successRate', 0);
        this.setState('performance.avgResponseTime', 0);
        this.setState('performance.metabolicLoad', 'low');
        
        // UI State
        this.setState('ui.currentView', 'dashboard');
        this.setState('ui.sidebarOpen', true);
        this.setState('ui.theme', 'dark');
        this.setState('ui.settingsOpen', false);
        this.setState('ui.loading', false);
        
        // Chat State
        this.setState('chat.messages', []);
        this.setState('chat.isTyping', false);
        this.setState('chat.voiceEnabled', true);
        this.setState('chat.currentTask', null);
        this.setState('chat.taskPaused', false);
        
        // Network State
        this.setState('network.peers', []);
        this.setState('network.protocol', 'libp2p');
        this.setState('network.bandwidth', { up: 0, down: 0 });
        
        // Module State
        this.setState('modules.loaded', []);
        this.setState('modules.active', []);
        this.setState('modules.failed', []);
        
        // Ethics State
        this.setState('ethics.level', 'balanced');
        this.setState('ethics.violations', []);
        this.setState('ethics.decisions', []);
        
        // Knowledge State
        this.setState('knowledge.graphSize', 0);
        this.setState('knowledge.lastSync', null);
        this.setState('knowledge.facts', []);
        
        // Settings
        this.setState('settings.maxPeers', 10);
        this.setState('settings.enableVoice', true);
        this.setState('settings.ethicsLevel', 'balanced');
        this.setState('settings.autoUpdate', true);
    }

    setupEventBusIntegration() {
        // Listen for state update events from other modules
        eventBus.on('state:update', ({ path, value }) => {
            this.setState(path, value);
        });

        eventBus.on('state:get', ({ path, requestId }) => {
            const value = this.getState(path);
            eventBus.respond('state:get', requestId, { path, value });
        });

        eventBus.on('state:subscribe', ({ path, requestId }) => {
            // For now, just return current value
            // Real subscription would be handled through EventBus
            const value = this.getState(path);
            eventBus.respond('state:subscribe', requestId, { path, value });
        });
    }

    /**
     * Set a state value
     * @param {string} path - Dot-separated path to the state value
     * @param {*} value - The value to set
     * @param {Object} options - Optional configuration
     */
    setState(path, value, options = {}) {
        const startTime = performance.now();
        
        try {
            const oldValue = this.getState(path);
            
            // Check if value actually changed
            if (this.deepEqual(oldValue, value) && !options.force) {
                return this;
            }

            // Run middleware
            const action = {
                type: 'SET_STATE',
                path,
                value,
                oldValue,
                timestamp: Date.now(),
                ...options
            };

            const processedAction = this.runMiddleware(action);
            if (!processedAction) {
                return this; // Middleware cancelled the action
            }

            // Set the value
            this.setNestedValue(this.state, path, processedAction.value);
            
            // Add to history
            this.addToHistory(action);
            
            // Notify subscribers
            this.notifySubscribers(path, processedAction.value, oldValue);
            
            // Emit event for other modules
            eventBus.emit('state:changed', {
                path,
                value: processedAction.value,
                oldValue,
                timestamp: action.timestamp
            }, { source: 'StateManager' });

            // Update metrics
            this.metrics.stateUpdates++;
            this.metrics.averageUpdateTime = 
                ((this.metrics.averageUpdateTime * (this.metrics.stateUpdates - 1)) + 
                 (performance.now() - startTime)) / this.metrics.stateUpdates;

            if (this.debugMode) {
                this.log(`State updated: ${path}`, { oldValue, newValue: processedAction.value });
            }

        } catch (error) {
            console.error('StateManager setState error:', error);
            eventBus.emit('state:error', { error, path, value });
        }

        return this;
    }

    /**
     * Get a state value
     * @param {string} path - Dot-separated path to the state value
     * @param {*} defaultValue - Default value if path doesn't exist
     */
    getState(path, defaultValue = undefined) {
        try {
            return this.getNestedValue(this.state, path, defaultValue);
        } catch (error) {
            console.error('StateManager getState error:', error);
            return defaultValue;
        }
    }

    /**
     * Subscribe to state changes
     * @param {string} path - Dot-separated path to watch
     * @param {Function} callback - Function to call when state changes
     * @param {Object} options - Optional configuration
     */
    subscribe(path, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }

        const subscription = {
            callback,
            options,
            id: this.generateSubscriptionId(),
            created: Date.now()
        };

        this.subscribers.get(path).add(subscription);
        this.metrics.subscriptionCount++;

        if (this.debugMode) {
            this.log(`Subscribed to: ${path}`);
        }

        // Return unsubscribe function
        return () => this.unsubscribe(path, subscription);
    }

    /**
     * Unsubscribe from state changes
     * @param {string} path - The path that was subscribed to
     * @param {Object} subscription - The subscription object
     */
    unsubscribe(path, subscription) {
        if (this.subscribers.has(path)) {
            const pathSubscribers = this.subscribers.get(path);
            pathSubscribers.delete(subscription);
            
            if (pathSubscribers.size === 0) {
                this.subscribers.delete(path);
            }
            
            this.metrics.subscriptionCount--;
            
            if (this.debugMode) {
                this.log(`Unsubscribed from: ${path}`);
            }
        }
    }

    /**
     * Batch multiple state updates
     * @param {Object} updates - Object with path-value pairs
     */
    batchUpdate(updates) {
        const startTime = performance.now();
        
        try {
            // Suspend notifications temporarily
            const oldNotifications = [];
            
            for (const [path, value] of Object.entries(updates)) {
                const oldValue = this.getState(path);
                this.setNestedValue(this.state, path, value);
                oldNotifications.push({ path, value, oldValue });
            }
            
            // Send all notifications at once
            for (const { path, value, oldValue } of oldNotifications) {
                this.notifySubscribers(path, value, oldValue);
                eventBus.emit('state:changed', { path, value, oldValue });
            }

            if (this.debugMode) {
                this.log('Batch update completed', { 
                    updates: Object.keys(updates).length,
                    duration: performance.now() - startTime 
                });
            }

        } catch (error) {
            console.error('StateManager batchUpdate error:', error);
            eventBus.emit('state:error', { error, updates });
        }

        return this;
    }

    /**
     * Add middleware to process state changes
     * @param {Function} middleware - Middleware function
     */
    addMiddleware(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        
        this.middleware.push(middleware);
        return this;
    }

    /**
     * Get the complete state tree (for debugging)
     */
    getAllState() {
        return this.mapToObject(this.state);
    }

    /**
     * Reset state to default values
     */
    reset() {
        this.state.clear();
        this.history = [];
        this.initializeDefaultState();
        
        eventBus.emit('state:reset', { timestamp: Date.now() });
        this.log('State reset to defaults');
        
        return this;
    }

    /**
     * Get state history for debugging
     * @param {number} limit - Maximum number of history entries
     */
    getHistory(limit = 50) {
        return this.history.slice(-limit);
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            stateSize: this.state.size,
            subscriberCount: Array.from(this.subscribers.values())
                .reduce((total, set) => total + set.size, 0),
            historySize: this.history.length
        };
    }

    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Clean up and destroy the state manager
     */
    destroy() {
        this.state.clear();
        this.subscribers.clear();
        this.middleware = [];
        this.history = [];
        
        this.log('StateManager destroyed');
    }

    // Private methods

    setNestedValue(map, path, value) {
        const keys = path.split('.');
        let current = map;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current.has(key)) {
                current.set(key, new Map());
            }
            current = current.get(key);
        }
        
        current.set(keys[keys.length - 1], value);
    }

    getNestedValue(map, path, defaultValue) {
        const keys = path.split('.');
        let current = map;
        
        for (const key of keys) {
            if (current instanceof Map && current.has(key)) {
                current = current.get(key);
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }

    notifySubscribers(path, value, oldValue) {
        // Notify exact path subscribers
        if (this.subscribers.has(path)) {
            for (const subscription of this.subscribers.get(path)) {
                try {
                    subscription.callback(value, oldValue, path);
                } catch (error) {
                    console.error('Subscriber callback error:', error);
                }
            }
        }

        // Notify parent path subscribers if configured
        const pathParts = path.split('.');
        for (let i = 1; i < pathParts.length; i++) {
            const parentPath = pathParts.slice(0, i).join('.');
            if (this.subscribers.has(parentPath)) {
                for (const subscription of this.subscribers.get(parentPath)) {
                    if (subscription.options.deep) {
                        try {
                            subscription.callback(
                                this.getState(parentPath), 
                                null, 
                                parentPath
                            );
                        } catch (error) {
                            console.error('Deep subscriber callback error:', error);
                        }
                    }
                }
            }
        }
    }

    runMiddleware(action) {
        let processedAction = action;
        
        for (const middleware of this.middleware) {
            try {
                processedAction = middleware(processedAction);
                if (!processedAction) {
                    return null; // Middleware cancelled the action
                }
            } catch (error) {
                console.error('Middleware error:', error);
            }
        }
        
        return processedAction;
    }

    addToHistory(action) {
        this.history.push(action);
        
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;
        
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            for (const key of keysA) {
                if (!keysB.includes(key)) return false;
                if (!this.deepEqual(a[key], b[key])) return false;
            }
            
            return true;
        }
        
        return false;
    }

    mapToObject(map) {
        const obj = {};
        for (const [key, value] of map) {
            obj[key] = value instanceof Map ? this.mapToObject(value) : value;
        }
        return obj;
    }

    log(message, data = null) {
        if (this.debugMode) {
            console.log(`[StateManager] ${message}`, data || '');
        }
    }
}

// Create and export singleton instance
const stateManager = new StateManager();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.AgentNeoStateManager = stateManager;
}

export default stateManager;