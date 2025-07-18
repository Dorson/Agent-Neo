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

// Import UI components
import dashboard from './ui/components/Dashboard.js';
import chat from './ui/components/Chat.js';
import settings from './ui/components/Settings.js';
import IdentitySetup from './ui/components/IdentitySetup.js';

// Import existing core modules
import TaskAuctionSystem from './modules/TaskAuctionSystem.js';
import SessionContextModule from './modules/SessionContextModule.js';
import IPFSModule from './modules/IPFSModule.js';
import TaskManager from './modules/TaskManager.js';
import VoiceInterface from './modules/VoiceInterface.js';
import NetworkTopologyOptimizer from './modules/NetworkTopologyOptimizer.js';
import AIModuleManager from './modules/AIModuleManager.js';
import DataResourceManager from './modules/DataResourceManager.js';
import ConsensusManager from './modules/ConsensusManager.js';
import NLPProcessor from './modules/NLPProcessor.js';

// Import new modules for missing functionality
import ZeroKnowledgeProofSystem from './modules/ZeroKnowledgeProofSystem.js';
import SkillModuleSandbox from './modules/SkillModuleSandbox.js';
import DecentralizedSkillModuleLoader from './modules/DecentralizedSkillModuleLoader.js';
import EnhancedSettingsManager from './modules/EnhancedSettingsManager.js';
import GuildManager from './modules/GuildManager.js';
import NativeP2PService from './network/NativeP2PService.js';
import LocalLedger from './core/LocalLedger.js';
import WebWorkersManager from './core/webWorkers.js';
import FederatedLearningModule from './modules/FederatedLearningModule.js';

// Import missing critical modules
import ResourceManager from './data/resourceManager.js';
import GuildMembership from './modules/guilds/guildMembership.js';

// Import critical networking components
import messageProtocol from './networking/messageProtocol.js';
import dataTransport from './networking/dataTransport.js';
import networkMonitor from './networking/networkMonitor.js';

// Import core utilities
import logger from './core/logger.js';
import utils from './core/utils.js';

        // Import new UI components
        import TasksView from './ui/components/TasksView.js';
        
        // Initialize identity setup component
        this.identitySetup = new IdentitySetup();

class AgentNeoApp {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
        this.startTime = Date.now();
        this.modules = new Map();
        this.initializationPromise = null;
        
        // Initialize existing core modules
        this.taskAuctionSystem = new TaskAuctionSystem();
        this.sessionContextModule = new SessionContextModule();
        this.ipfsModule = new IPFSModule();
        this.taskManager = new TaskManager();
        this.voiceInterface = new VoiceInterface();
        this.networkTopologyOptimizer = new NetworkTopologyOptimizer();
        this.aiModuleManager = new AIModuleManager();
        this.dataResourceManager = new DataResourceManager();
        this.consensusManager = new ConsensusManager();
        this.nlpProcessor = new NLPProcessor();
        
        // Initialize new modules for missing functionality
        this.zeroKnowledgeProofSystem = new ZeroKnowledgeProofSystem();
        this.skillModuleSandbox = new SkillModuleSandbox();
        this.decentralizedSkillModuleLoader = new DecentralizedSkillModuleLoader();
        this.enhancedSettingsManager = new EnhancedSettingsManager();
        this.guildManager = new GuildManager();
        this.p2pService = new NativeP2PService();
        this.localLedger = new LocalLedger();
        this.webWorkersManager = WebWorkersManager;
        this.federatedLearningModule = new FederatedLearningModule();
        
        // Initialize missing critical modules
        this.resourceManager = new ResourceManager();
        this.guildMembership = new GuildMembership();
        
        // Initialize critical networking components
        this.messageProtocol = messageProtocol;
        this.dataTransport = dataTransport;
        this.networkMonitor = networkMonitor;
        
        // Initialize core utilities
        this.logger = logger;
        this.utils = utils;
        
        // Initialize identity setup component
        this.identitySetup = new IdentitySetup();
        
        // Performance monitoring
        this.performanceMetrics = {
            initializationTime: 0,
            moduleLoadTime: 0,
            errorCount: 0,
            warningCount: 0
        };
        
        // Error handling
        this.errorHandler = this.setupErrorHandler();
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🚀 Starting Agent Neo Application...');
            const startTime = Date.now();
            
            // Initialize error handling
            this.setupGlobalErrorHandling();
            
            // Initialize modules in order
            await this.initializeModules();
            
            // Initialize UI
            await this.initializeUI();
            
            // Register service worker
            await this.registerServiceWorker();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Mark as initialized
            this.initialized = true;
            this.performanceMetrics.initializationTime = Date.now() - startTime;
            
            console.log(`✅ Agent Neo Application initialized in ${this.performanceMetrics.initializationTime}ms`);
            
            // Emit initialization complete event
            eventBus.emit('app:initialized', {
                version: this.version,
                initializationTime: this.performanceMetrics.initializationTime,
                modules: this.modules.size
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Agent Neo Application:', error);
            this.handleInitializationError(error);
        }
    }
    
    async initializeModules() {
        console.log('📦 Initializing modules...');
        const moduleStartTime = Date.now();
        
        // Define module initialization order (dependencies first)
        const moduleInitOrder = [
            // Core infrastructure first
            { name: 'EnhancedSettingsManager', instance: this.enhancedSettingsManager },
            { name: 'IPFSModule', instance: this.ipfsModule },
            { name: 'DataResourceManager', instance: this.dataResourceManager },
            
            // Network and communication
            { name: 'NetworkTopologyOptimizer', instance: this.networkTopologyOptimizer },
            { name: 'ConsensusManager', instance: this.consensusManager },
            
            // AI and processing
            { name: 'AIModuleManager', instance: this.aiModuleManager },
            { name: 'NLPProcessor', instance: this.nlpProcessor },
            
            // Security and validation
            { name: 'ZeroKnowledgeProofSystem', instance: this.zeroKnowledgeProofSystem },
            { name: 'SkillModuleSandbox', instance: this.skillModuleSandbox },
            
            // Module management
            { name: 'DecentralizedSkillModuleLoader', instance: this.decentralizedSkillModuleLoader },
            
            // Task management
            { name: 'TaskManager', instance: this.taskManager },
            { name: 'TaskAuctionSystem', instance: this.taskAuctionSystem },
            
            // User interaction
            { name: 'VoiceInterface', instance: this.voiceInterface },
            { name: 'SessionContextModule', instance: this.sessionContextModule }
        ];
        
        // Initialize modules sequentially to handle dependencies
        for (const moduleInfo of moduleInitOrder) {
            try {
                console.log(`📦 Initializing ${moduleInfo.name}...`);
                
                if (moduleInfo.instance && typeof moduleInfo.instance.initialize === 'function') {
                    await moduleInfo.instance.initialize();
                }
                
                // Register module
                this.modules.set(moduleInfo.name, moduleInfo.instance);
                
                console.log(`✅ ${moduleInfo.name} initialized successfully`);
                
            } catch (error) {
                console.error(`❌ Failed to initialize ${moduleInfo.name}:`, error);
                this.performanceMetrics.errorCount++;
                
                // Continue with other modules unless it's a critical dependency
                if (this.isCriticalModule(moduleInfo.name)) {
                    throw new Error(`Critical module ${moduleInfo.name} failed to initialize: ${error.message}`);
                }
            }
        }
        
        // Register modules with AgentNeo core
        await this.registerModulesWithCore();
        
        this.performanceMetrics.moduleLoadTime = Date.now() - moduleStartTime;
        console.log(`📦 Modules initialized in ${this.performanceMetrics.moduleLoadTime}ms`);
    }
    
    async registerModulesWithCore() {
        console.log('🔗 Registering modules with AgentNeo core...');
        
        // Register all modules with the core Agent Neo system
        for (const [name, instance] of this.modules) {
            try {
                await agentNeo.registerModule({
                    name,
                    instance,
                    capabilities: instance.capabilities || [],
                    dependencies: instance.dependencies || []
                });
            } catch (error) {
                console.error(`Failed to register module ${name}:`, error);
            }
        }
        
        console.log(`🔗 Registered ${this.modules.size} modules with core`);
    }
    
    async initializeUI() {
        console.log('🎨 Initializing UI...');
        
        try {
            // Initialize UI manager
            await uiManager.init();
            
            // Initialize UI components
            await dashboard.init?.();
            await chat.init?.();
            await settings.init?.();
            
            console.log('✅ UI initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize UI:', error);
            throw error;
        }
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered:', registration);
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 Service Worker update found');
                });
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
                this.performanceMetrics.warningCount++;
            }
        }
    }
    
    setupGlobalErrorHandling() {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            console.error('🚨 Global error:', event.error);
            this.performanceMetrics.errorCount++;
            
            // Emit error event for handling
            eventBus.emit('app:error', {
                error: event.error,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Unhandled promise rejection:', event.reason);
            this.performanceMetrics.errorCount++;
            
            // Emit error event for handling
            eventBus.emit('app:unhandled-rejection', {
                reason: event.reason,
                promise: event.promise
            });
        });
    }
    
    setupErrorHandler() {
        return {
            handleError: (error, context = 'unknown') => {
                console.error(`🚨 Error in ${context}:`, error);
                this.performanceMetrics.errorCount++;
                
                // Emit error event
                eventBus.emit('app:error', { error, context });
                
                // Try to recover if possible
                this.attemptRecovery(error, context);
            },
            
            handleWarning: (warning, context = 'unknown') => {
                console.warn(`⚠️ Warning in ${context}:`, warning);
                this.performanceMetrics.warningCount++;
                
                // Emit warning event
                eventBus.emit('app:warning', { warning, context });
            }
        };
    }
    
    attemptRecovery(error, context) {
        // Basic recovery strategies
        switch (context) {
            case 'module-initialization':
                console.log('🔄 Attempting to reinitialize failed module...');
                // Could implement module reinitialization logic here
                break;
                
            case 'ui-rendering':
                console.log('🔄 Attempting to refresh UI...');
                // Could implement UI refresh logic here
                break;
                
            default:
                console.log('🔄 No specific recovery strategy for context:', context);
        }
    }
    
    isCriticalModule(moduleName) {
        const criticalModules = [
            'EnhancedSettingsManager',
            'IPFSModule',
            'DataResourceManager',
            'AIModuleManager'
        ];
        
        return criticalModules.includes(moduleName);
    }
    
    setupPerformanceMonitoring() {
        // Monitor performance metrics
        setInterval(() => {
            const metrics = this.getPerformanceMetrics();
            
            // Update state manager with metrics
            stateManager.setState('performance', metrics);
            
            // Emit performance update
            eventBus.emit('app:performance-update', metrics);
            
        }, 30000); // Every 30 seconds
        
        console.log('📊 Performance monitoring setup complete');
    }
    
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            uptime: Date.now() - this.startTime,
            memoryUsage: this.getMemoryUsage(),
            moduleCount: this.modules.size,
            initialized: this.initialized
        };
    }
    
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
    
    handleInitializationError(error) {
        console.error('🚨 Initialization failed:', error);
        
        // Show error UI
        document.body.innerHTML = `
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background: #1a1a1a;
                color: #ff6b6b;
                font-family: monospace;
                text-align: center;
            ">
                <div>
                    <h1>⚠️ Agent Neo Initialization Failed</h1>
                    <p>Error: ${error.message}</p>
                    <button onclick="location.reload()" style="
                        background: #ff6b6b;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        margin-top: 20px;
                        cursor: pointer;
                        border-radius: 5px;
                    ">
                        Reload Application
                    </button>
                </div>
            </div>
        `;
        
        // Emit initialization error event
        eventBus.emit('app:initialization-error', { error });
    }
    
    // Public API methods
    getModule(name) {
        return this.modules.get(name);
    }
    
    getAllModules() {
        return Array.from(this.modules.entries());
    }
    
    getApplicationStatus() {
        return {
            version: this.version,
            initialized: this.initialized,
            uptime: Date.now() - this.startTime,
            modules: this.modules.size,
            performance: this.getPerformanceMetrics()
        };
    }
    
    async shutdown() {
        console.log('🛑 Shutting down Agent Neo Application...');
        
        // Shutdown all modules
        for (const [name, instance] of this.modules) {
            try {
                if (instance && typeof instance.shutdown === 'function') {
                    await instance.shutdown();
                    console.log(`✅ ${name} shut down successfully`);
                }
            } catch (error) {
                console.error(`❌ Failed to shut down ${name}:`, error);
            }
        }
        
        // Shutdown core systems
        await agentNeo.shutdown();
        
        // Unregister service worker
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }
        
        console.log('✅ Agent Neo Application shut down complete');
    }
    
    // Development and debugging methods
    debug() {
        return {
            version: this.version,
            modules: Array.from(this.modules.keys()),
            performance: this.getPerformanceMetrics(),
            state: stateManager.getState(),
            eventBus: eventBus.getEventCount?.() || 'Not available'
        };
    }
}

// Initialize the application
const app = new AgentNeoApp();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.AgentNeoApp = app;
    window.AgentNeo = agentNeo;
    window.eventBus = eventBus;
    window.stateManager = stateManager;
    
    // Global debug function
    window.debug = () => app.debug();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (app.initialized) {
        app.shutdown();
    }
});

// Export for module usage
export default app;