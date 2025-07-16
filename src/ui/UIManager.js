/**
 * Agent Neo UI Manager
 * 
 * Implements the Component Rendering System as specified in the whitepaper
 * section 4.2. Creates reusable UI components that are self-contained and
 * update efficiently using Progressive Enhancement principles.
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class UIManager {
    constructor() {
        this.components = new Map();
        this.currentView = 'dashboard';
        this.initialized = false;
        this.animations = new Map();
        this.touchStartY = 0;
        this.touchStartX = 0;
        
        // Performance optimization
        this.updateQueue = new Set();
        this.updateScheduled = false;
        
        this.init();
    }

    async init() {
        try {
            console.log('🎨 UIManager initializing...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Initialize components
            this.initializeComponents();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up state subscriptions
            this.setupStateSubscriptions();
            
            // Initialize theme
            this.initializeTheme();
            
            // Setup responsive behavior
            this.setupResponsiveBehavior();
            
            // Hide loading screen and show app
            this.showApplication();
            
            this.initialized = true;
            
            console.log('✅ UIManager initialized successfully');
            
        } catch (error) {
            console.error('❌ UIManager initialization failed:', error);
            throw error;
        }
    }

    initializeComponents() {
        // Navigation component
        this.components.set('navigation', {
            element: document.getElementById('sidebar'),
            update: this.updateNavigation.bind(this),
            events: ['click']
        });
        
        // Header component
        this.components.set('header', {
            element: document.querySelector('.app-header'),
            update: this.updateHeader.bind(this),
            events: ['click']
        });
        
        // Dashboard component
        this.components.set('dashboard', {
            element: document.getElementById('dashboardView'),
            update: this.updateDashboard.bind(this),
            events: []
        });
        
        // Chat component
        this.components.set('chat', {
            element: document.getElementById('chatView'),
            update: this.updateChat.bind(this),
            events: ['click', 'keypress', 'input']
        });
        
        // Settings modal
        this.components.set('settings', {
            element: document.getElementById('settingsModal'),
            update: this.updateSettings.bind(this),
            events: ['click', 'input', 'change']
        });
        
        // Resource monitor
        this.components.set('resourceMonitor', {
            element: document.querySelector('.resource-monitor'),
            update: this.updateResourceMonitor.bind(this),
            events: []
        });
        
        console.log(`📦 ${this.components.size} UI components registered`);
    }

    setupEventListeners() {
        // Navigation events
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if (view) {
                    this.switchView(view);
                }
            });
        });
        
        // Node control events
        const toggleNodeBtn = document.getElementById('toggleNodeBtn');
        if (toggleNodeBtn) {
            toggleNodeBtn.addEventListener('click', this.toggleNode.bind(this));
        }
        
        // Settings events
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', this.openSettings.bind(this));
        }
        
        const closeSettings = document.getElementById('closeSettings');
        if (closeSettings) {
            closeSettings.addEventListener('click', this.closeSettings.bind(this));
        }
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', this.toggleTheme.bind(this));
        }
        
        // Chat events
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const voiceBtn = document.getElementById('voiceBtn');
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', this.sendMessage.bind(this));
        }
        
        if (voiceBtn) {
            voiceBtn.addEventListener('click', this.toggleVoiceInput.bind(this));
        }
        
        // Settings form events
        this.setupSettingsEventListeners();
        
        // Modal overlay events
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', this.closeSettings.bind(this));
        }
        
        // Touch events for mobile
        this.setupTouchEvents();
        
        console.log('👆 Event listeners configured');
    }

    setupStateSubscriptions() {
        // Subscribe to state changes that affect UI
        stateManager.subscribe('node.status', this.onNodeStatusChange.bind(this));
        stateManager.subscribe('ui.currentView', this.onViewChange.bind(this));
        stateManager.subscribe('ui.theme', this.onThemeChange.bind(this));
        stateManager.subscribe('resources', this.onResourcesChange.bind(this), { deep: true });
        stateManager.subscribe('performance', this.onPerformanceChange.bind(this), { deep: true });
        stateManager.subscribe('chat.messages', this.onMessagesChange.bind(this));
        stateManager.subscribe('settings', this.onSettingsChange.bind(this), { deep: true });
        
        console.log('📊 State subscriptions configured');
    }

    switchView(viewName) {
        if (this.currentView === viewName) return;
        
        // Hide current view
        const currentViewElement = document.getElementById(`${this.currentView}View`);
        if (currentViewElement) {
            currentViewElement.classList.remove('active');
        }
        
        // Show new view
        const newViewElement = document.getElementById(`${viewName}View`);
        if (newViewElement) {
            newViewElement.classList.add('active');
        }
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });
        
        // Update state
        this.currentView = viewName;
        stateManager.setState('ui.currentView', viewName);
        
        // Emit event
        eventBus.emit('ui:view:changed', { view: viewName });
        
        console.log(`📱 Switched to view: ${viewName}`);
    }

    async toggleNode() {
        const currentStatus = stateManager.getState('node.status', 'offline');
        const btn = document.getElementById('toggleNodeBtn');
        
        if (!btn) return;
        
        try {
            // Update button state
            btn.disabled = true;
            btn.classList.add('btn--loading');
            
            if (currentStatus === 'offline' || currentStatus === 'error') {
                eventBus.emit('agent:start');
            } else {
                eventBus.emit('agent:stop');
            }
            
        } catch (error) {
            console.error('Error toggling node:', error);
            this.showNotification('Error toggling node: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.classList.remove('btn--loading');
        }
    }

    toggleTheme() {
        const currentTheme = stateManager.getState('ui.theme', 'dark');
        const themes = ['dark', 'light', 'high-contrast', 'cyberpunk', 'matrix'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        
        stateManager.setState('ui.theme', nextTheme);
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input || !input.value.trim()) return;
        
        const message = input.value.trim();
        input.value = '';
        
        // Add user message to state
        const messages = stateManager.getState('chat.messages', []);
        const userMessage = {
            id: `msg_${Date.now()}`,
            type: 'user',
            content: message,
            timestamp: Date.now()
        };
        
        stateManager.setState('chat.messages', [...messages, userMessage]);
        
        // Emit task submission event
        eventBus.emit('task:submit', {
            task: {
                type: 'chat',
                description: message,
                priority: 'normal'
            }
        });
        
        // Simulate agent response (in real implementation, this would come from the AI)
        setTimeout(() => {
            const agentMessage = {
                id: `msg_${Date.now()}`,
                type: 'agent',
                content: `I understand you want to: "${message}". I'm processing this request while respecting ethical boundaries and resource limits.`,
                timestamp: Date.now()
            };
            
            const currentMessages = stateManager.getState('chat.messages', []);
            stateManager.setState('chat.messages', [...currentMessages, agentMessage]);
        }, 1000 + Math.random() * 2000);
    }

    toggleVoiceInput() {
        const isEnabled = stateManager.getState('chat.voiceEnabled', true);
        
        if (!isEnabled) {
            this.showNotification('Voice input is disabled in settings', 'warning');
            return;
        }
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showNotification('Speech recognition not supported in this browser', 'error');
            return;
        }
        
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.classList.add('btn--loading');
            
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    chatInput.value = transcript;
                    chatInput.focus();
                }
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.showNotification('Voice recognition error: ' + event.error, 'error');
            };
            
            recognition.onend = () => {
                voiceBtn.classList.remove('btn--loading');
            };
            
            recognition.start();
            
        } catch (error) {
            console.error('Voice input error:', error);
            this.showNotification('Voice input failed', 'error');
        }
    }

    openSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('hidden');
            stateManager.setState('ui.settingsOpen', true);
            
            // Load current settings
            this.loadSettingsValues();
        }
    }

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('hidden');
            stateManager.setState('ui.settingsOpen', false);
        }
    }

    loadSettingsValues() {
        // Load current values into settings form
        const maxCpuSlider = document.getElementById('maxCpuUsage');
        const maxCpuValue = document.getElementById('maxCpuValue');
        const maxMemorySlider = document.getElementById('maxMemoryUsage');
        const maxMemoryValue = document.getElementById('maxMemoryValue');
        const maxPeersInput = document.getElementById('maxPeers');
        const enableVoiceCheck = document.getElementById('enableVoice');
        const ethicsLevelSelect = document.getElementById('ethicsLevel');
        
        if (maxCpuSlider && maxCpuValue) {
            const value = stateManager.getState('resources.maxCpu', 50);
            maxCpuSlider.value = value;
            maxCpuValue.textContent = value + '%';
        }
        
        if (maxMemorySlider && maxMemoryValue) {
            const value = stateManager.getState('resources.maxMemory', 40);
            maxMemorySlider.value = value;
            maxMemoryValue.textContent = value + '%';
        }
        
        if (maxPeersInput) {
            maxPeersInput.value = stateManager.getState('settings.maxPeers', 10);
        }
        
        if (enableVoiceCheck) {
            enableVoiceCheck.checked = stateManager.getState('settings.enableVoice', true);
        }
        
        if (ethicsLevelSelect) {
            ethicsLevelSelect.value = stateManager.getState('settings.ethicsLevel', 'balanced');
        }
    }

    setupSettingsEventListeners() {
        // CPU slider
        const maxCpuSlider = document.getElementById('maxCpuUsage');
        const maxCpuValue = document.getElementById('maxCpuValue');
        if (maxCpuSlider && maxCpuValue) {
            maxCpuSlider.addEventListener('input', (e) => {
                maxCpuValue.textContent = e.target.value + '%';
            });
        }
        
        // Memory slider
        const maxMemorySlider = document.getElementById('maxMemoryUsage');
        const maxMemoryValue = document.getElementById('maxMemoryValue');
        if (maxMemorySlider && maxMemoryValue) {
            maxMemorySlider.addEventListener('input', (e) => {
                maxMemoryValue.textContent = e.target.value + '%';
            });
        }
        
        // Save settings button
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', this.saveSettings.bind(this));
        }
        
        // Reset settings button
        const resetBtn = document.getElementById('resetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', this.resetSettings.bind(this));
        }
    }

    saveSettings() {
        const settings = {
            maxCpu: parseInt(document.getElementById('maxCpuUsage')?.value || 50),
            maxMemory: parseInt(document.getElementById('maxMemoryUsage')?.value || 40),
            maxPeers: parseInt(document.getElementById('maxPeers')?.value || 10),
            enableVoice: document.getElementById('enableVoice')?.checked || true,
            ethicsLevel: document.getElementById('ethicsLevel')?.value || 'balanced'
        };
        
        // Update state
        stateManager.batchUpdate({
            'resources.maxCpu': settings.maxCpu,
            'resources.maxMemory': settings.maxMemory,
            'settings.maxPeers': settings.maxPeers,
            'settings.enableVoice': settings.enableVoice,
            'settings.ethicsLevel': settings.ethicsLevel,
            'chat.voiceEnabled': settings.enableVoice
        });
        
        // Emit configuration update event
        eventBus.emit('agent:config:update', { config: settings });
        
        this.showNotification('Settings saved successfully', 'success');
        this.closeSettings();
    }

    resetSettings() {
        // Reset to default values
        const defaults = {
            maxCpu: 50,
            maxMemory: 40,
            maxPeers: 10,
            enableVoice: true,
            ethicsLevel: 'balanced'
        };
        
        // Update form values
        document.getElementById('maxCpuUsage').value = defaults.maxCpu;
        document.getElementById('maxCpuValue').textContent = defaults.maxCpu + '%';
        document.getElementById('maxMemoryUsage').value = defaults.maxMemory;
        document.getElementById('maxMemoryValue').textContent = defaults.maxMemory + '%';
        document.getElementById('maxPeers').value = defaults.maxPeers;
        document.getElementById('enableVoice').checked = defaults.enableVoice;
        document.getElementById('ethicsLevel').value = defaults.ethicsLevel;
        
        this.showNotification('Settings reset to defaults', 'info');
    }

    setupTouchEvents() {
        // Add touch support for mobile devices
        document.addEventListener('touchstart', (e) => {
            this.touchStartY = e.touches[0].clientY;
            this.touchStartX = e.touches[0].clientX;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (!this.touchStartY || !this.touchStartX) return;
            
            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;
            const diffY = this.touchStartY - touchEndY;
            const diffX = this.touchStartX - touchEndX;
            
            // Detect swipe gestures
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Swipe left - could open sidebar on mobile
                    eventBus.emit('ui:gesture:swipe-left');
                } else {
                    // Swipe right - could close sidebar on mobile
                    eventBus.emit('ui:gesture:swipe-right');
                }
            }
            
            this.touchStartY = 0;
            this.touchStartX = 0;
        }, { passive: true });
    }

    setupResponsiveBehavior() {
        // Handle window resize
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));
        
        // Initial resize handling
        this.handleResize();
    }

    handleResize() {
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            document.body.classList.add('mobile');
        } else {
            document.body.classList.remove('mobile');
        }
        
        eventBus.emit('ui:resize', { 
            width: window.innerWidth, 
            height: window.innerHeight,
            isMobile 
        });
    }

    initializeTheme() {
        const savedTheme = stateManager.getState('ui.theme', 'dark');
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    showApplication() {
        const loadingScreen = document.getElementById('loadingScreen');
        const app = document.getElementById('app');
        
        if (loadingScreen && app) {
            // Fade out loading screen
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                app.classList.remove('hidden');
                app.style.opacity = '1';
            }, 500);
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.innerHTML = `
            <div class="notification__content">
                <span class="notification__icon">${this.getNotificationIcon(type)}</span>
                <span class="notification__message">${message}</span>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('notification--show'), 100);
        
        // Auto remove
        setTimeout(() => {
            notification.classList.remove('notification--show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    getNotificationIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || icons.info;
    }

    // State change handlers
    onNodeStatusChange(status) {
        const statusElement = document.getElementById('nodeStatus');
        const indicator = statusElement?.querySelector('.status-indicator');
        const text = statusElement?.querySelector('.status-text');
        const toggleBtn = document.getElementById('toggleNodeBtn');
        const btnText = toggleBtn?.querySelector('.btn-text');
        const btnIcon = toggleBtn?.querySelector('.btn-icon');
        
        if (indicator && text) {
            indicator.className = `status-indicator ${status}`;
            text.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
        
        if (toggleBtn && btnText && btnIcon) {
            if (status === 'online') {
                btnText.textContent = 'Stop Node';
                btnIcon.textContent = '🛑';
                toggleBtn.classList.remove('btn-primary');
                toggleBtn.classList.add('btn-secondary');
            } else {
                btnText.textContent = 'Start Node';
                btnIcon.textContent = '⚡';
                toggleBtn.classList.remove('btn-secondary');
                toggleBtn.classList.add('btn-primary');
            }
        }
        
        this.scheduleUpdate('header');
    }

    onViewChange(view) {
        if (view !== this.currentView) {
            this.switchView(view);
        }
    }

    onThemeChange(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme toggle button
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.setAttribute('data-theme', theme);
        }
    }

    onResourcesChange() {
        this.scheduleUpdate('resourceMonitor');
        this.scheduleUpdate('dashboard');
    }

    onPerformanceChange() {
        this.scheduleUpdate('dashboard');
    }

    onMessagesChange(messages) {
        this.updateChatMessages(messages);
    }

    onSettingsChange() {
        if (stateManager.getState('ui.settingsOpen', false)) {
            this.loadSettingsValues();
        }
    }

    // Component update methods
    updateNavigation() {
        // Navigation updates are handled by view switching
    }

    updateHeader() {
        // Header updates are handled by state change handlers
    }

    updateDashboard() {
        // Update dashboard metrics
        const elements = {
            p2pConnections: document.getElementById('p2pConnections'),
            ipfsStatus: document.getElementById('ipfsStatus'),
            uptime: document.getElementById('uptime'),
            tasksCompleted: document.getElementById('tasksCompleted'),
            successRate: document.getElementById('successRate'),
            avgResponseTime: document.getElementById('avgResponseTime'),
            metabolicLoad: document.getElementById('metabolicLoad')
        };
        
        if (elements.p2pConnections) {
            elements.p2pConnections.textContent = stateManager.getState('node.connections', 0);
        }
        
        if (elements.ipfsStatus) {
            elements.ipfsStatus.textContent = stateManager.getState('node.ipfsStatus', 'Disconnected');
        }
        
        if (elements.uptime) {
            const uptime = stateManager.getState('node.uptime', 0);
            elements.uptime.textContent = this.formatUptime(uptime);
        }
        
        if (elements.tasksCompleted) {
            elements.tasksCompleted.textContent = stateManager.getState('performance.tasksCompleted', 0);
        }
        
        if (elements.successRate) {
            elements.successRate.textContent = stateManager.getState('performance.successRate', 0) + '%';
        }
        
        if (elements.avgResponseTime) {
            elements.avgResponseTime.textContent = stateManager.getState('performance.avgResponseTime', 0) + 'ms';
        }
        
        if (elements.metabolicLoad) {
            elements.metabolicLoad.textContent = stateManager.getState('performance.metabolicLoad', 'Low');
        }
    }

    updateChat() {
        // Chat updates are handled by message change handler
    }

    updateSettings() {
        // Settings updates are handled by settings change handler
    }

    updateResourceMonitor() {
        const elements = {
            cpuUsage: document.getElementById('cpuUsage'),
            cpuValue: document.getElementById('cpuValue'),
            memoryUsage: document.getElementById('memoryUsage'),
            memoryValue: document.getElementById('memoryValue'),
            trustBalance: document.getElementById('trustBalance'),
            reputation: document.getElementById('reputation')
        };
        
        const cpu = stateManager.getState('resources.cpu', 0);
        const memory = stateManager.getState('resources.memory', 0);
        
        if (elements.cpuUsage) {
            elements.cpuUsage.style.width = cpu + '%';
        }
        if (elements.cpuValue) {
            elements.cpuValue.textContent = cpu + '%';
        }
        
        if (elements.memoryUsage) {
            elements.memoryUsage.style.width = memory + '%';
        }
        if (elements.memoryValue) {
            elements.memoryValue.textContent = memory + '%';
        }
        
        if (elements.trustBalance) {
            elements.trustBalance.textContent = stateManager.getState('resources.trust', 100);
        }
        
        if (elements.reputation) {
            elements.reputation.textContent = stateManager.getState('resources.reputation', 0);
        }
    }

    updateChatMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || !Array.isArray(messages)) return;
        
        // Clear existing messages (in real implementation, this would be optimized)
        chatMessages.innerHTML = '';
        
        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            chatMessages.appendChild(messageElement);
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    createMessageElement(message) {
        const element = document.createElement('div');
        element.className = `message ${message.type}-message`;
        
        const avatar = message.type === 'agent' ? '🤖' : '👤';
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        element.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <p>${this.escapeHtml(message.content)}</p>
            </div>
            <div class="message-time">${time}</div>
        `;
        
        return element;
    }

    // Utility methods
    scheduleUpdate(componentName) {
        this.updateQueue.add(componentName);
        
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(() => {
                this.processUpdateQueue();
                this.updateScheduled = false;
            });
        }
    }

    processUpdateQueue() {
        for (const componentName of this.updateQueue) {
            const component = this.components.get(componentName);
            if (component && typeof component.update === 'function') {
                try {
                    component.update();
                } catch (error) {
                    console.error(`Error updating component ${componentName}:`, error);
                }
            }
        }
        this.updateQueue.clear();
    }

    formatUptime(milliseconds) {
        if (milliseconds === 0) return '0h 0m';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    destroy() {
        // Clean up event listeners and intervals
        this.components.clear();
        this.updateQueue.clear();
        
        console.log('🔥 UIManager destroyed');
    }
}

// Create and export singleton instance
const uiManager = new UIManager();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.AgentNeoUIManager = uiManager;
}

export default uiManager;