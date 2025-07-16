/**
 * Agent Neo Dashboard Component
 * 
 * Handles dashboard-specific functionality and data visualization
 */

import eventBus from '../../core/EventBus.js';
import stateManager from '../../core/StateManager.js';

class Dashboard {
    constructor() {
        this.name = 'Dashboard';
        this.version = '1.0.0';
        this.initialized = false;
        
        this.init();
    }

    init() {
        console.log('📊 Dashboard component loaded');
        this.initialized = true;
        
        // Subscribe to relevant state changes
        stateManager.subscribe('performance', this.updateMetrics.bind(this), { deep: true });
        stateManager.subscribe('node', this.updateNodeStatus.bind(this), { deep: true });
        
        // Listen for dashboard-specific events
        eventBus.on('dashboard:refresh', this.refresh.bind(this));
    }

    updateMetrics(metrics) {
        // Dashboard metrics are handled by UIManager
        // This could be extended for more complex dashboard logic
    }

    updateNodeStatus(nodeState) {
        // Node status updates are handled by UIManager
        // This could be extended for more complex status logic
    }

    refresh() {
        console.log('📊 Dashboard refreshing...');
        // Force refresh of all dashboard metrics
        eventBus.emit('ui:dashboard:refresh');
    }

    destroy() {
        console.log('📊 Dashboard component destroyed');
    }
}

// Create instance and make available globally for debugging
const dashboard = new Dashboard();

if (typeof window !== 'undefined') {
    window.AgentNeoDashboard = dashboard;
}

export default dashboard;