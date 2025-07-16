/**
 * Agent Neo Settings Component
 * 
 * Handles settings-specific functionality and configuration management
 */

import eventBus from '../../core/EventBus.js';
import stateManager from '../../core/StateManager.js';

class Settings {
    constructor() {
        this.name = 'Settings';
        this.version = '1.0.0';
        this.initialized = false;
        
        this.init();
    }

    init() {
        console.log('⚙️ Settings component loaded');
        this.initialized = true;
        
        // Subscribe to settings state changes
        stateManager.subscribe('settings', this.onSettingsUpdate.bind(this), { deep: true });
        
        // Listen for settings-specific events
        eventBus.on('settings:export', this.exportSettings.bind(this));
        eventBus.on('settings:import', this.importSettings.bind(this));
        eventBus.on('settings:reset', this.resetToDefaults.bind(this));
    }

    onSettingsUpdate(settings) {
        // Settings updates are handled by UIManager
        // This could be extended for validation and processing
        this.validateSettings(settings);
    }

    validateSettings(settings) {
        // Basic validation - could be expanded
        if (settings.maxPeers && (settings.maxPeers < 1 || settings.maxPeers > 100)) {
            console.warn('⚠️ Invalid maxPeers value:', settings.maxPeers);
        }
        
        if (settings.ethicsLevel && !['permissive', 'balanced', 'strict'].includes(settings.ethicsLevel)) {
            console.warn('⚠️ Invalid ethicsLevel value:', settings.ethicsLevel);
        }
    }

    exportSettings() {
        console.log('⚙️ Exporting settings...');
        const settings = stateManager.getState('settings', {});
        const resources = stateManager.getState('resources', {});
        
        const exportData = {
            export_date: new Date().toISOString(),
            version: '1.0.0',
            settings: {
                ...settings,
                maxCpu: resources.maxCpu,
                maxMemory: resources.maxMemory
            }
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-neo-settings-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importSettings(file) {
        console.log('⚙️ Importing settings...');
        
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (importData.settings) {
                // Validate and apply settings
                this.validateSettings(importData.settings);
                
                // Update state
                Object.entries(importData.settings).forEach(([key, value]) => {
                    if (key === 'maxCpu' || key === 'maxMemory') {
                        stateManager.setState(`resources.${key}`, value);
                    } else {
                        stateManager.setState(`settings.${key}`, value);
                    }
                });
                
                eventBus.emit('ui:notification', {
                    type: 'success',
                    message: 'Settings imported successfully'
                });
            }
        } catch (error) {
            console.error('Failed to import settings:', error);
            eventBus.emit('ui:notification', {
                type: 'error',
                message: 'Failed to import settings: Invalid file format'
            });
        }
    }

    resetToDefaults() {
        console.log('⚙️ Resetting settings to defaults...');
        
        const defaults = {
            maxPeers: 10,
            enableVoice: true,
            ethicsLevel: 'balanced',
            autoUpdate: true
        };
        
        const resourceDefaults = {
            maxCpu: 50,
            maxMemory: 40
        };
        
        // Apply defaults
        Object.entries(defaults).forEach(([key, value]) => {
            stateManager.setState(`settings.${key}`, value);
        });
        
        Object.entries(resourceDefaults).forEach(([key, value]) => {
            stateManager.setState(`resources.${key}`, value);
        });
        
        eventBus.emit('ui:notification', {
            type: 'info',
            message: 'Settings reset to defaults'
        });
    }

    destroy() {
        console.log('⚙️ Settings component destroyed');
    }
}

// Create instance and make available globally for debugging
const settings = new Settings();

if (typeof window !== 'undefined') {
    window.AgentNeoSettings = settings;
}

export default settings;