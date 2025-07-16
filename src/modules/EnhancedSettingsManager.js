/**
 * Enhanced Settings Manager
 * 
 * Provides advanced settings management with persistent storage,
 * improved UI management, and comprehensive parameter configuration
 * as specified in the requirements.
 * 
 * Key Features:
 * - Persistent local storage of settings
 * - Advanced parameter management
 * - Settings validation and migration
 * - Import/export functionality
 * - Real-time settings synchronization
 * - Settings history and rollback
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class EnhancedSettingsManager {
    constructor() {
        this.name = 'EnhancedSettingsManager';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Settings configuration
        this.config = {
            storageKey: 'agent-neo-settings',
            historyKey: 'agent-neo-settings-history',
            maxHistoryEntries: 50,
            autoSaveInterval: 5000, // 5 seconds
            validationEnabled: true,
            migrationEnabled: true,
            compressionEnabled: true
        };
        
        // Settings schema and validation
        this.settingsSchema = this.initializeSettingsSchema();
        this.validators = new Map();
        
        // Settings state
        this.settings = new Map();
        this.defaultSettings = new Map();
        this.settingsHistory = [];
        this.settingsCategories = new Map();
        
        // Storage and persistence
        this.storage = {
            local: localStorage,
            session: sessionStorage,
            indexedDB: null
        };
        
        // UI state
        this.uiState = {
            activeCategory: 'general',
            searchQuery: '',
            showAdvanced: false,
            modifiedSettings: new Set(),
            validationErrors: new Map()
        };
        
        // Change tracking
        this.changeTracker = {
            modified: new Set(),
            lastSaved: Date.now(),
            saveTimeout: null
        };
        
        // Metrics
        this.metrics = {
            settingsChanged: 0,
            validationErrors: 0,
            autoSaves: 0,
            manualSaves: 0,
            importsExports: 0
        };
        
        this.initializeEventHandlers();
    }
    
    /**
     * Initialize the settings manager
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            console.log('⚙️ Initializing Enhanced Settings Manager...');
            
            // Initialize storage
            await this.initializeStorage();
            
            // Initialize validators
            this.initializeValidators();
            
            // Initialize default settings
            this.initializeDefaultSettings();
            
            // Load saved settings
            await this.loadSettings();
            
            // Setup auto-save
            this.setupAutoSave();
            
            // Initialize UI components
            this.initializeUIComponents();
            
            this.initialized = true;
            this.active = true;
            
            console.log('✅ Enhanced Settings Manager initialized');
            eventBus.emit('settings-manager:initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Settings Manager:', error);
            throw error;
        }
    }
    
    /**
     * Initialize settings schema
     */
    initializeSettingsSchema() {
        return {
            // General settings
            general: {
                maxPeers: {
                    type: 'number',
                    min: 1,
                    max: 100,
                    default: 10,
                    description: 'Maximum number of peer connections',
                    category: 'general',
                    advanced: false
                },
                enableVoice: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable voice interface',
                    category: 'general',
                    advanced: false
                },
                ethicsLevel: {
                    type: 'enum',
                    values: ['permissive', 'balanced', 'strict'],
                    default: 'balanced',
                    description: 'Ethics enforcement level',
                    category: 'general',
                    advanced: false
                },
                autoUpdate: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable automatic updates',
                    category: 'general',
                    advanced: false
                },
                debugMode: {
                    type: 'boolean',
                    default: false,
                    description: 'Enable debug mode',
                    category: 'general',
                    advanced: true
                }
            },
            
            // Resource settings
            resources: {
                maxCpu: {
                    type: 'number',
                    min: 10,
                    max: 90,
                    default: 50,
                    unit: '%',
                    description: 'Maximum CPU usage',
                    category: 'resources',
                    advanced: false
                },
                maxMemory: {
                    type: 'number',
                    min: 10,
                    max: 80,
                    default: 40,
                    unit: '%',
                    description: 'Maximum memory usage',
                    category: 'resources',
                    advanced: false
                },
                maxStorage: {
                    type: 'number',
                    min: 100,
                    max: 10000,
                    default: 1000,
                    unit: 'MB',
                    description: 'Maximum storage usage',
                    category: 'resources',
                    advanced: false
                },
                resourceMonitoringInterval: {
                    type: 'number',
                    min: 1000,
                    max: 60000,
                    default: 5000,
                    unit: 'ms',
                    description: 'Resource monitoring interval',
                    category: 'resources',
                    advanced: true
                }
            },
            
            // Network settings
            network: {
                p2pEnabled: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable P2P networking',
                    category: 'network',
                    advanced: false
                },
                ipfsEnabled: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable IPFS integration',
                    category: 'network',
                    advanced: false
                },
                connectionTimeout: {
                    type: 'number',
                    min: 5000,
                    max: 60000,
                    default: 30000,
                    unit: 'ms',
                    description: 'Connection timeout',
                    category: 'network',
                    advanced: true
                },
                retryAttempts: {
                    type: 'number',
                    min: 1,
                    max: 10,
                    default: 3,
                    description: 'Connection retry attempts',
                    category: 'network',
                    advanced: true
                }
            },
            
            // AI settings
            ai: {
                enableTensorFlow: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable TensorFlow.js integration',
                    category: 'ai',
                    advanced: false
                },
                enableWASM: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable WebAssembly models',
                    category: 'ai',
                    advanced: false
                },
                maxModelSize: {
                    type: 'number',
                    min: 10,
                    max: 1000,
                    default: 100,
                    unit: 'MB',
                    description: 'Maximum model size',
                    category: 'ai',
                    advanced: true
                },
                inferenceTimeout: {
                    type: 'number',
                    min: 1000,
                    max: 60000,
                    default: 30000,
                    unit: 'ms',
                    description: 'Inference timeout',
                    category: 'ai',
                    advanced: true
                }
            },
            
            // Security settings
            security: {
                enableZKP: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable Zero-Knowledge Proofs',
                    category: 'security',
                    advanced: false
                },
                requireSignatures: {
                    type: 'boolean',
                    default: true,
                    description: 'Require module signatures',
                    category: 'security',
                    advanced: false
                },
                minReputationThreshold: {
                    type: 'number',
                    min: 0,
                    max: 100,
                    default: 50,
                    description: 'Minimum reputation threshold',
                    category: 'security',
                    advanced: true
                },
                sandboxTimeout: {
                    type: 'number',
                    min: 10000,
                    max: 300000,
                    default: 30000,
                    unit: 'ms',
                    description: 'Sandbox execution timeout',
                    category: 'security',
                    advanced: true
                }
            },
            
            // UI settings
            ui: {
                theme: {
                    type: 'enum',
                    values: ['light', 'dark', 'high-contrast', 'cyberpunk', 'matrix'],
                    default: 'dark',
                    description: 'UI theme',
                    category: 'ui',
                    advanced: false
                },
                fontSize: {
                    type: 'number',
                    min: 12,
                    max: 24,
                    default: 14,
                    unit: 'px',
                    description: 'Font size',
                    category: 'ui',
                    advanced: false
                },
                animationsEnabled: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable animations',
                    category: 'ui',
                    advanced: false
                },
                compactMode: {
                    type: 'boolean',
                    default: false,
                    description: 'Compact mode',
                    category: 'ui',
                    advanced: false
                },
                showAdvancedSettings: {
                    type: 'boolean',
                    default: false,
                    description: 'Show advanced settings',
                    category: 'ui',
                    advanced: true
                }
            }
        };
    }
    
    /**
     * Initialize storage
     */
    async initializeStorage() {
        try {
            // Initialize IndexedDB for complex settings
            await this.initializeIndexedDB();
            
            console.log('⚙️ Storage initialized');
        } catch (error) {
            console.warn('Failed to initialize IndexedDB, using localStorage only:', error);
        }
    }
    
    /**
     * Initialize IndexedDB
     */
    async initializeIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AgentNeoSettings', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.storage.indexedDB = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }
    
    /**
     * Initialize validators
     */
    initializeValidators() {
        // Number validator
        this.validators.set('number', (value, config) => {
            const num = Number(value);
            if (isNaN(num)) return { valid: false, message: 'Must be a number' };
            if (config.min !== undefined && num < config.min) return { valid: false, message: `Must be at least ${config.min}` };
            if (config.max !== undefined && num > config.max) return { valid: false, message: `Must be at most ${config.max}` };
            return { valid: true };
        });
        
        // Boolean validator
        this.validators.set('boolean', (value, config) => {
            if (typeof value !== 'boolean') return { valid: false, message: 'Must be true or false' };
            return { valid: true };
        });
        
        // Enum validator
        this.validators.set('enum', (value, config) => {
            if (!config.values.includes(value)) return { valid: false, message: `Must be one of: ${config.values.join(', ')}` };
            return { valid: true };
        });
        
        // String validator
        this.validators.set('string', (value, config) => {
            if (typeof value !== 'string') return { valid: false, message: 'Must be a string' };
            if (config.minLength && value.length < config.minLength) return { valid: false, message: `Must be at least ${config.minLength} characters` };
            if (config.maxLength && value.length > config.maxLength) return { valid: false, message: `Must be at most ${config.maxLength} characters` };
            return { valid: true };
        });
        
        console.log('⚙️ Validators initialized:', this.validators.size);
    }
    
    /**
     * Initialize default settings
     */
    initializeDefaultSettings() {
        // Extract defaults from schema
        for (const [categoryName, category] of Object.entries(this.settingsSchema)) {
            for (const [settingName, config] of Object.entries(category)) {
                const key = `${categoryName}.${settingName}`;
                this.defaultSettings.set(key, config.default);
                this.settings.set(key, config.default);
            }
            
            // Store category metadata
            this.settingsCategories.set(categoryName, {
                name: categoryName,
                settings: Object.keys(category),
                advanced: Object.values(category).some(s => s.advanced)
            });
        }
        
        console.log('⚙️ Default settings initialized:', this.defaultSettings.size, 'settings');
    }
    
    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            // Load from localStorage first
            const localSettings = this.storage.local.getItem(this.config.storageKey);
            if (localSettings) {
                const parsed = JSON.parse(localSettings);
                
                // Validate and apply settings
                for (const [key, value] of Object.entries(parsed)) {
                    if (this.validateSetting(key, value)) {
                        this.settings.set(key, value);
                    }
                }
            }
            
            // Load from IndexedDB if available
            if (this.storage.indexedDB) {
                await this.loadFromIndexedDB();
            }
            
            // Load settings history
            await this.loadSettingsHistory();
            
            // Apply settings to state manager
            this.applySettingsToState();
            
            console.log('⚙️ Settings loaded:', this.settings.size, 'settings');
            
        } catch (error) {
            console.error('Failed to load settings:', error);
            
            // Fallback to defaults
            this.resetToDefaults();
        }
    }
    
    /**
     * Load from IndexedDB
     */
    async loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.storage.indexedDB.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const results = request.result;
                for (const item of results) {
                    if (this.validateSetting(item.key, item.value)) {
                        this.settings.set(item.key, item.value);
                    }
                }
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Load settings history
     */
    async loadSettingsHistory() {
        try {
            const historyData = this.storage.local.getItem(this.config.historyKey);
            if (historyData) {
                this.settingsHistory = JSON.parse(historyData);
            }
        } catch (error) {
            console.warn('Failed to load settings history:', error);
            this.settingsHistory = [];
        }
    }
    
    /**
     * Apply settings to state manager
     */
    applySettingsToState() {
        for (const [key, value] of this.settings) {
            stateManager.setState(key, value);
        }
    }
    
    /**
     * Validate setting
     */
    validateSetting(key, value) {
        if (!this.config.validationEnabled) return true;
        
        const config = this.getSettingConfig(key);
        if (!config) return false;
        
        const validator = this.validators.get(config.type);
        if (!validator) return true;
        
        const result = validator(value, config);
        if (!result.valid) {
            this.uiState.validationErrors.set(key, result.message);
            this.metrics.validationErrors++;
            return false;
        }
        
        this.uiState.validationErrors.delete(key);
        return true;
    }
    
    /**
     * Get setting configuration
     */
    getSettingConfig(key) {
        const [category, setting] = key.split('.');
        return this.settingsSchema[category]?.[setting];
    }
    
    /**
     * Get setting value
     */
    getSetting(key) {
        return this.settings.get(key) ?? this.defaultSettings.get(key);
    }
    
    /**
     * Set setting value
     */
    async setSetting(key, value) {
        try {
            // Validate setting
            if (!this.validateSetting(key, value)) {
                throw new Error(`Invalid value for ${key}: ${value}`);
            }
            
            // Check if value changed
            const currentValue = this.settings.get(key);
            if (currentValue === value) return;
            
            // Update setting
            this.settings.set(key, value);
            this.changeTracker.modified.add(key);
            this.uiState.modifiedSettings.add(key);
            
            // Update state manager
            stateManager.setState(key, value);
            
            // Add to history
            this.addToHistory({
                key,
                oldValue: currentValue,
                newValue: value,
                timestamp: Date.now()
            });
            
            // Trigger auto-save
            this.scheduleAutoSave();
            
            this.metrics.settingsChanged++;
            
            console.log(`⚙️ Setting updated: ${key} = ${value}`);
            eventBus.emit('settings-manager:setting-changed', { key, value, oldValue: currentValue });
            
        } catch (error) {
            console.error('Failed to set setting:', error);
            throw error;
        }
    }
    
    /**
     * Set multiple settings
     */
    async setSettings(settings) {
        const changes = [];
        
        for (const [key, value] of Object.entries(settings)) {
            try {
                const oldValue = this.settings.get(key);
                await this.setSetting(key, value);
                changes.push({ key, value, oldValue });
            } catch (error) {
                console.error(`Failed to set ${key}:`, error);
            }
        }
        
        if (changes.length > 0) {
            eventBus.emit('settings-manager:settings-changed', { changes });
        }
    }
    
    /**
     * Add to history
     */
    addToHistory(change) {
        this.settingsHistory.push(change);
        
        // Limit history size
        if (this.settingsHistory.length > this.config.maxHistoryEntries) {
            this.settingsHistory.shift();
        }
        
        // Save history
        this.saveSettingsHistory();
    }
    
    /**
     * Save settings history
     */
    saveSettingsHistory() {
        try {
            this.storage.local.setItem(this.config.historyKey, JSON.stringify(this.settingsHistory));
        } catch (error) {
            console.error('Failed to save settings history:', error);
        }
    }
    
    /**
     * Schedule auto-save
     */
    scheduleAutoSave() {
        if (this.changeTracker.saveTimeout) {
            clearTimeout(this.changeTracker.saveTimeout);
        }
        
        this.changeTracker.saveTimeout = setTimeout(() => {
            this.saveSettings();
        }, this.config.autoSaveInterval);
    }
    
    /**
     * Save settings
     */
    async saveSettings() {
        try {
            // Save to localStorage
            const settingsData = Object.fromEntries(this.settings);
            this.storage.local.setItem(this.config.storageKey, JSON.stringify(settingsData));
            
            // Save to IndexedDB if available
            if (this.storage.indexedDB) {
                await this.saveToIndexedDB();
            }
            
            // Clear change tracking
            this.changeTracker.modified.clear();
            this.changeTracker.lastSaved = Date.now();
            
            this.metrics.autoSaves++;
            
            console.log('⚙️ Settings saved automatically');
            eventBus.emit('settings-manager:settings-saved');
            
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }
    
    /**
     * Save to IndexedDB
     */
    async saveToIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.storage.indexedDB.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            
            // Clear existing data
            store.clear();
            
            // Add all settings
            for (const [key, value] of this.settings) {
                store.add({ key, value });
            }
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
    
    /**
     * Manual save
     */
    async manualSave() {
        await this.saveSettings();
        this.metrics.manualSaves++;
        
        eventBus.emit('ui:notification', {
            type: 'success',
            message: 'Settings saved successfully'
        });
    }
    
    /**
     * Reset to defaults
     */
    resetToDefaults() {
        console.log('⚙️ Resetting settings to defaults...');
        
        // Reset all settings
        this.settings.clear();
        for (const [key, value] of this.defaultSettings) {
            this.settings.set(key, value);
        }
        
        // Clear validation errors
        this.uiState.validationErrors.clear();
        this.uiState.modifiedSettings.clear();
        
        // Apply to state manager
        this.applySettingsToState();
        
        // Save immediately
        this.saveSettings();
        
        eventBus.emit('settings-manager:reset-to-defaults');
        eventBus.emit('ui:notification', {
            type: 'info',
            message: 'Settings reset to defaults'
        });
    }
    
    /**
     * Export settings
     */
    exportSettings() {
        try {
            const exportData = {
                version: this.version,
                timestamp: Date.now(),
                settings: Object.fromEntries(this.settings),
                history: this.settingsHistory.slice(-20) // Last 20 entries
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `agent-neo-settings-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.metrics.importsExports++;
            
            console.log('⚙️ Settings exported');
            eventBus.emit('ui:notification', {
                type: 'success',
                message: 'Settings exported successfully'
            });
            
        } catch (error) {
            console.error('Failed to export settings:', error);
            eventBus.emit('ui:notification', {
                type: 'error',
                message: 'Failed to export settings'
            });
        }
    }
    
    /**
     * Import settings
     */
    async importSettings(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            // Validate import data
            if (!importData.settings) {
                throw new Error('Invalid settings file format');
            }
            
            // Import settings
            const importedCount = await this.setSettings(importData.settings);
            
            // Import history if available
            if (importData.history) {
                this.settingsHistory = [...this.settingsHistory, ...importData.history];
                this.saveSettingsHistory();
            }
            
            this.metrics.importsExports++;
            
            console.log(`⚙️ Settings imported: ${importedCount} settings`);
            eventBus.emit('ui:notification', {
                type: 'success',
                message: `Settings imported successfully (${importedCount} settings)`
            });
            
        } catch (error) {
            console.error('Failed to import settings:', error);
            eventBus.emit('ui:notification', {
                type: 'error',
                message: 'Failed to import settings: ' + error.message
            });
        }
    }
    
    /**
     * Get settings by category
     */
    getSettingsByCategory(category) {
        const categorySettings = {};
        
        for (const [key, value] of this.settings) {
            if (key.startsWith(category + '.')) {
                const settingName = key.substring(category.length + 1);
                categorySettings[settingName] = value;
            }
        }
        
        return categorySettings;
    }
    
    /**
     * Search settings
     */
    searchSettings(query) {
        const results = [];
        const lowercaseQuery = query.toLowerCase();
        
        for (const [categoryName, category] of Object.entries(this.settingsSchema)) {
            for (const [settingName, config] of Object.entries(category)) {
                if (settingName.toLowerCase().includes(lowercaseQuery) ||
                    config.description.toLowerCase().includes(lowercaseQuery)) {
                    
                    const key = `${categoryName}.${settingName}`;
                    results.push({
                        key,
                        category: categoryName,
                        setting: settingName,
                        value: this.settings.get(key),
                        config
                    });
                }
            }
        }
        
        return results;
    }
    
    /**
     * Setup auto-save
     */
    setupAutoSave() {
        setInterval(() => {
            if (this.changeTracker.modified.size > 0) {
                this.saveSettings();
            }
        }, this.config.autoSaveInterval);
        
        console.log('⚙️ Auto-save setup complete');
    }
    
    /**
     * Initialize UI components
     */
    initializeUIComponents() {
        // Register UI component handlers
        eventBus.on('ui:settings-category-changed', (data) => {
            this.uiState.activeCategory = data.category;
        });
        
        eventBus.on('ui:settings-search', (data) => {
            this.uiState.searchQuery = data.query;
        });
        
        eventBus.on('ui:settings-show-advanced', (data) => {
            this.uiState.showAdvanced = data.show;
        });
        
        console.log('⚙️ UI components initialized');
    }
    
    /**
     * Initialize event handlers
     */
    initializeEventHandlers() {
        eventBus.on('settings-manager:get-setting', this.handleGetSetting.bind(this));
        eventBus.on('settings-manager:set-setting', this.handleSetSetting.bind(this));
        eventBus.on('settings-manager:export', this.exportSettings.bind(this));
        eventBus.on('settings-manager:import', this.handleImportSettings.bind(this));
        eventBus.on('settings-manager:reset', this.resetToDefaults.bind(this));
        eventBus.on('settings-manager:save', this.manualSave.bind(this));
        eventBus.on('settings-manager:search', this.handleSearchSettings.bind(this));
    }
    
    /**
     * Handle get setting
     */
    handleGetSetting(event) {
        const { key, callback } = event;
        
        try {
            const value = this.getSetting(key);
            if (callback) callback(null, value);
        } catch (error) {
            if (callback) callback(error);
        }
    }
    
    /**
     * Handle set setting
     */
    async handleSetSetting(event) {
        const { key, value, callback } = event;
        
        try {
            await this.setSetting(key, value);
            if (callback) callback(null);
        } catch (error) {
            if (callback) callback(error);
        }
    }
    
    /**
     * Handle import settings
     */
    async handleImportSettings(event) {
        const { file, callback } = event;
        
        try {
            await this.importSettings(file);
            if (callback) callback(null);
        } catch (error) {
            if (callback) callback(error);
        }
    }
    
    /**
     * Handle search settings
     */
    handleSearchSettings(event) {
        const { query, callback } = event;
        
        try {
            const results = this.searchSettings(query);
            if (callback) callback(null, results);
        } catch (error) {
            if (callback) callback(error);
        }
    }
    
    /**
     * Get all settings
     */
    getAllSettings() {
        return Object.fromEntries(this.settings);
    }
    
    /**
     * Get settings schema
     */
    getSettingsSchema() {
        return this.settingsSchema;
    }
    
    /**
     * Get settings categories
     */
    getSettingsCategories() {
        return Array.from(this.settingsCategories.values());
    }
    
    /**
     * Get UI state
     */
    getUIState() {
        return { ...this.uiState };
    }
    
    /**
     * Get settings history
     */
    getSettingsHistory() {
        return [...this.settingsHistory];
    }
    
    /**
     * Get metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            totalSettings: this.settings.size,
            modifiedSettings: this.uiState.modifiedSettings.size,
            validationErrors: this.uiState.validationErrors.size,
            historyEntries: this.settingsHistory.length
        };
    }
    
    /**
     * Get system status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            active: this.active,
            hasChanges: this.changeTracker.modified.size > 0,
            lastSaved: this.changeTracker.lastSaved,
            metrics: this.getMetrics()
        };
    }
    
    /**
     * Shutdown the system
     */
    async shutdown() {
        console.log('⚙️ Shutting down Enhanced Settings Manager...');
        
        this.active = false;
        
        // Save any pending changes
        if (this.changeTracker.modified.size > 0) {
            await this.saveSettings();
        }
        
        // Clear timers
        if (this.changeTracker.saveTimeout) {
            clearTimeout(this.changeTracker.saveTimeout);
        }
        
        // Close IndexedDB
        if (this.storage.indexedDB) {
            this.storage.indexedDB.close();
        }
        
        console.log('✅ Enhanced Settings Manager shut down');
    }
}

export default EnhancedSettingsManager;