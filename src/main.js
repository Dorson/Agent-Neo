/**
 * Agent Neo Main Entry Point
 * 
 * This is the main entry point that initializes and orchestrates all modules
 * according to the Agent Neo architecture described in the whitepaper.
 * 
 * Features implemented:
 * - Module loading and initialization
 * - Event-driven architecture
 * - Progressive enhancement
 * - Error handling and recovery
 * - Performance monitoring
 * - Service worker registration (PWA)
 */

import eventBus from './core/EventBus.js';
import stateManager from './core/StateManager.js';
import agentNeo from './core/AgentNeo.js';
import uiManager from './ui/UIManager.js';

class AgentNeoApp {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
        this.startTime = Date.now();
        this.modules = new Map();
        this.initializationPromise = null;
        
        this.init();
    }

    async init() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        this.initializationPromise = this.performInitialization();
        return this.initializationPromise;
    }

    async performInitialization() {
        try {
            console.log('🚀 Agent Neo starting initialization...');
            console.log(`📦 Version: ${this.version}`);
            
            // Show loading progress
            this.updateLoadingProgress('Initializing core systems...', 10);
            
            // Initialize error handling first
            this.setupGlobalErrorHandling();
            
            // Initialize core systems
            this.updateLoadingProgress('Setting up event bus...', 20);
            await this.initializeEventBus();
            
            this.updateLoadingProgress('Setting up state management...', 30);
            await this.initializeStateManager();
            
            this.updateLoadingProgress('Initializing Agent Neo core...', 50);
            await this.initializeAgentNeo();
            
            this.updateLoadingProgress('Loading UI components...', 70);
            await this.initializeUIManager();
            
            this.updateLoadingProgress('Registering service worker...', 80);
            await this.registerServiceWorker();
            
            this.updateLoadingProgress('Setting up module communication...', 90);
            await this.setupModuleCommunication();
            
            this.updateLoadingProgress('Starting system monitoring...', 95);
            this.startSystemMonitoring();
            
            this.updateLoadingProgress('Finalizing initialization...', 98);
            await this.finalizeInitialization();
            
            this.updateLoadingProgress('Complete!', 100);
            
            this.initialized = true;
            const initTime = Date.now() - this.startTime;
            
            console.log(`✅ Agent Neo initialized successfully in ${initTime}ms`);
            
            // Emit initialization complete event
            eventBus.emit('app:initialized', {
                version: this.version,
                initTime,
                timestamp: Date.now()
            });
            
            // Auto-start if configured
            const autoStart = stateManager.getState('settings.autoStart', false);
            if (autoStart) {
                setTimeout(() => {
                    eventBus.emit('agent:start');
                }, 1000);
            }
            
        } catch (error) {
            console.error('❌ Agent Neo initialization failed:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }

    async initializeEventBus() {
        // EventBus is already initialized as a singleton
        eventBus.setDebugMode(this.isDebugMode());
        
        // Set up app-level event listeners
        eventBus.on('app:error', this.handleAppError.bind(this));
        eventBus.on('app:restart', this.restart.bind(this));
        eventBus.on('app:shutdown', this.shutdown.bind(this));
        
        console.log('📡 EventBus initialized');
    }

    async initializeStateManager() {
        // StateManager is already initialized as a singleton
        stateManager.setDebugMode(this.isDebugMode());
        
        // Add middleware for logging state changes in debug mode
        if (this.isDebugMode()) {
            stateManager.addMiddleware((action) => {
                console.log('🔄 State change:', action);
                return action;
            });
        }
        
        console.log('🗄️ StateManager initialized');
    }

    async initializeAgentNeo() {
        // AgentNeo is already initialized as a singleton
        // Wait for it to complete initialization
        if (!agentNeo.initialized) {
            await new Promise(resolve => {
                if (agentNeo.initialized) {
                    resolve();
                } else {
                    eventBus.once('agent:initialized', resolve);
                }
            });
        }
        
        console.log('🤖 Agent Neo core initialized');
    }

    async initializeUIManager() {
        // UIManager is already initialized as a singleton
        // Wait for it to complete initialization
        if (!uiManager.initialized) {
            await new Promise(resolve => {
                const checkInitialized = () => {
                    if (uiManager.initialized) {
                        resolve();
                    } else {
                        setTimeout(checkInitialized, 100);
                    }
                };
                checkInitialized();
            });
        }
        
        console.log('🎨 UI Manager initialized');
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('📱 Service Worker registered:', registration);
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 Service Worker update found');
                    eventBus.emit('app:update-available');
                });
                
                stateManager.setState('app.serviceWorkerRegistered', true);
                
            } catch (error) {
                console.warn('⚠️ Service Worker registration failed:', error);
                stateManager.setState('app.serviceWorkerRegistered', false);
            }
        } else {
            console.warn('⚠️ Service Worker not supported');
            stateManager.setState('app.serviceWorkerRegistered', false);
        }
    }

    async setupModuleCommunication() {
        // Set up inter-module communication patterns
        
        // Task completion updates performance metrics
        eventBus.on('task:completed', ({ duration }) => {
            const completed = stateManager.getState('performance.tasksCompleted', 0);
            stateManager.setState('performance.tasksCompleted', completed + 1);
        });
        
        // Resource limit enforcement
        eventBus.on('resources:limit-exceeded', ({ resource, value, limit }) => {
            console.warn(`⚠️ Resource limit exceeded: ${resource} (${value}/${limit})`);
            eventBus.emit('agent:throttle', { resource, value, limit });
        });
        
        // Ethics violations handling
        eventBus.on('ethics:violation', ({ violation, context }) => {
            console.warn('⚠️ Ethics violation detected:', violation, context);
            stateManager.setState('ethics.violations', [
                ...stateManager.getState('ethics.violations', []),
                { violation, context, timestamp: Date.now() }
            ]);
        });
        
        // UI state persistence
        eventBus.on('ui:state:save', ({ key, value }) => {
            try {
                localStorage.setItem(`agentneo_ui_${key}`, JSON.stringify(value));
            } catch (error) {
                console.warn('Failed to save UI state:', error);
            }
        });
        
        console.log('🔗 Module communication established');
    }

    startSystemMonitoring() {
        // Monitor system health
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Every 30 seconds
        
        // Monitor memory usage
        this.memoryCheckInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, 10000); // Every 10 seconds
        
        // Monitor performance
        this.performanceCheckInterval = setInterval(() => {
            this.checkPerformance();
        }, 5000); // Every 5 seconds
        
        console.log('📊 System monitoring started');
    }

    async finalizeInitialization() {
        // Load saved UI state
        this.loadSavedUIState();
        
        // Set up periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60000); // Every minute
        
        // Mark app as ready
        stateManager.setState('app.ready', true);
        stateManager.setState('app.version', this.version);
        stateManager.setState('app.initialized', Date.now());
        
        // Hide any remaining loading indicators
        document.body.classList.add('app-ready');
    }

    setupGlobalErrorHandling() {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);
            this.handleAppError({
                error: event.error,
                source: 'window.error',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleAppError({
                error: event.reason,
                source: 'unhandledrejection'
            });
        });
        
        // Handle service worker errors
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('error', (event) => {
                console.error('Service Worker error:', event);
                this.handleAppError({
                    error: event,
                    source: 'serviceWorker'
                });
            });
        }
        
        console.log('🛡️ Global error handling set up');
    }

    performHealthCheck() {
        const status = {
            timestamp: Date.now(),
            eventBus: eventBus.getMetrics(),
            stateManager: stateManager.getMetrics(),
            agentNeo: agentNeo.getStatus(),
            memory: this.getMemoryInfo(),
            performance: this.getPerformanceInfo()
        };
        
        // Check for issues
        const issues = [];
        
        if (status.eventBus.errorCount > 10) {
            issues.push('High event bus error count');
        }
        
        if (status.memory.usedJSHeapSize > 100 * 1024 * 1024) { // 100MB
            issues.push('High memory usage');
        }
        
        if (status.performance.responseTime > 5000) {
            issues.push('Slow response times');
        }
        
        stateManager.setState('system.health', {
            status: issues.length === 0 ? 'healthy' : 'warning',
            issues,
            lastCheck: status.timestamp
        });
        
        if (issues.length > 0) {
            console.warn('⚠️ Health check issues:', issues);
            eventBus.emit('system:health:warning', { issues });
        }
    }

    checkMemoryUsage() {
        const memInfo = this.getMemoryInfo();
        if (memInfo.usedJSHeapSize) {
            const usagePercent = (memInfo.usedJSHeapSize / memInfo.totalJSHeapSize) * 100;
            stateManager.setState('resources.memory', Math.round(usagePercent));
            
            if (usagePercent > 80) {
                console.warn('⚠️ High memory usage:', usagePercent + '%');
                eventBus.emit('resources:memory:high', { usage: usagePercent });
            }
        }
    }

    checkPerformance() {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
            const metrics = {
                loadTime: navigation.loadEventEnd - navigation.loadEventStart,
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                firstPaint: this.getFirstPaintTime(),
                responseTime: stateManager.getState('performance.avgResponseTime', 0)
            };
            
            stateManager.setState('performance.metrics', metrics);
        }
    }

    performCleanup() {
        // Clean up old event history
        eventBus.clearHistory();
        
        // Clean up old state history
        const history = stateManager.getHistory();
        if (history.length > 100) {
            stateManager.reset();
        }
        
        // Clean up performance entries
        if (performance.getEntries().length > 1000) {
            performance.clearResourceTimings();
        }
    }

    loadSavedUIState() {
        try {
            // Load theme preference
            const savedTheme = localStorage.getItem('agentneo_ui_theme');
            if (savedTheme) {
                stateManager.setState('ui.theme', JSON.parse(savedTheme));
            }
            
            // Load other UI preferences
            const savedView = localStorage.getItem('agentneo_ui_currentView');
            if (savedView) {
                stateManager.setState('ui.currentView', JSON.parse(savedView));
            }
            
        } catch (error) {
            console.warn('Failed to load saved UI state:', error);
        }
    }

    updateLoadingProgress(message, percent) {
        const progressElement = document.querySelector('.loading-progress');
        const messageElement = document.querySelector('.loading-message');
        
        if (progressElement) {
            progressElement.style.width = percent + '%';
        }
        
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        stateManager.setState('app.loading', { message, percent });
    }

    handleInitializationError(error) {
        const errorElement = document.querySelector('.loading-content');
        if (errorElement) {
            errorElement.innerHTML = `
                <div class="error-message">
                    <h2>🚨 Initialization Failed</h2>
                    <p>Agent Neo failed to start properly.</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary">
                        <span class="btn-icon">🔄</span>
                        <span class="btn-text">Retry</span>
                    </button>
                </div>
            `;
        }
        
        stateManager.setState('app.error', {
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    }

    handleAppError({ error, source, context }) {
        console.error(`🚨 Application error [${source}]:`, error);
        
        const errorInfo = {
            message: error.message || error,
            source,
            context,
            timestamp: Date.now(),
            stack: error.stack
        };
        
        stateManager.setState('system.lastError', errorInfo);
        
        // Emit error event for other modules to handle
        eventBus.emit('app:error', errorInfo);
        
        // Show user notification for critical errors
        if (source === 'critical') {
            this.showErrorNotification(error.message);
        }
    }

    showErrorNotification(message) {
        if (uiManager && typeof uiManager.showNotification === 'function') {
            uiManager.showNotification(`Error: ${message}`, 'error');
        }
    }

    async restart() {
        console.log('🔄 Restarting Agent Neo...');
        
        try {
            await this.shutdown();
            setTimeout(() => {
                location.reload();
            }, 1000);
        } catch (error) {
            console.error('Error during restart:', error);
            location.reload(); // Force reload on error
        }
    }

    async shutdown() {
        console.log('🛑 Shutting down Agent Neo...');
        
        try {
            // Clear intervals
            if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
            if (this.memoryCheckInterval) clearInterval(this.memoryCheckInterval);
            if (this.performanceCheckInterval) clearInterval(this.performanceCheckInterval);
            if (this.cleanupInterval) clearInterval(this.cleanupInterval);
            
            // Stop Agent Neo
            if (agentNeo) {
                await agentNeo.stop();
            }
            
            // Save current state
            this.saveCurrentState();
            
            // Clean up modules
            if (uiManager && typeof uiManager.destroy === 'function') {
                uiManager.destroy();
            }
            
            eventBus.emit('app:shutdown', { timestamp: Date.now() });
            
            console.log('✅ Agent Neo shutdown complete');
            
        } catch (error) {
            console.error('Error during shutdown:', error);
        }
    }

    saveCurrentState() {
        try {
            const currentState = {
                theme: stateManager.getState('ui.theme'),
                view: stateManager.getState('ui.currentView'),
                settings: stateManager.getState('settings'),
                timestamp: Date.now()
            };
            
            localStorage.setItem('agentneo_saved_state', JSON.stringify(currentState));
        } catch (error) {
            console.warn('Failed to save current state:', error);
        }
    }

    getMemoryInfo() {
        if (performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return {};
    }

    getPerformanceInfo() {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
            loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
            responseTime: stateManager.getState('performance.avgResponseTime', 0)
        };
    }

    getFirstPaintTime() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : 0;
    }

    isDebugMode() {
        return location.hostname === 'localhost' || 
               location.search.includes('debug=true') ||
               localStorage.getItem('agentneo_debug') === 'true';
    }

    getStatus() {
        return {
            version: this.version,
            initialized: this.initialized,
            uptime: Date.now() - this.startTime,
            modules: Array.from(this.modules.keys()),
            health: stateManager.getState('system.health'),
            metrics: {
                eventBus: eventBus.getMetrics(),
                stateManager: stateManager.getMetrics(),
                memory: this.getMemoryInfo(),
                performance: this.getPerformanceInfo()
            }
        };
    }
}

// Initialize the application
const app = new AgentNeoApp();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.AgentNeoApp = app;
    
    // Add debug helpers
    window.AgentNeoDebug = {
        eventBus,
        stateManager,
        agentNeo,
        uiManager,
        app,
        getStatus: () => app.getStatus(),
        restart: () => app.restart(),
        shutdown: () => app.shutdown()
    };
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('📱 App hidden - reducing activity');
        eventBus.emit('app:background');
    } else {
        console.log('📱 App visible - resuming activity');
        eventBus.emit('app:foreground');
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    app.saveCurrentState();
});

console.log('🎯 Agent Neo main module loaded');
export default app;