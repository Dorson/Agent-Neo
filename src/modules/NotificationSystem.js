/**
 * Notification System - Real-time Event Notifications
 * 
 * Implements a comprehensive notification system for Agent Neo.
 * Features:
 * - Real-time event notifications
 * - Multiple notification types (info, warning, error, success)
 * - Persistent notification history
 * - Configurable notification preferences
 * - Browser notification API integration
 * - Sound alerts and visual feedback
 * - Notification queuing and batching
 * - Auto-dismiss and manual control
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class NotificationSystem {
    constructor() {
        this.name = 'NotificationSystem';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Notification state
        this.notifications = [];
        this.notificationHistory = [];
        this.notificationQueue = [];
        this.activeNotifications = new Map();
        
        // UI elements
        this.container = null;
        this.notificationContainer = null;
        this.badgeElement = null;
        
        // Configuration
        this.config = {
            maxNotifications: 5,
            defaultDuration: 5000,
            enableSound: true,
            enableBrowserNotifications: true,
            enableVibration: true,
            queueSize: 50,
            historySize: 200,
            batchDelay: 1000
        };
        
        // Notification types
        this.types = {
            info: {
                icon: 'ℹ️',
                color: '#2196F3',
                sound: 'notification-info.mp3'
            },
            success: {
                icon: '✅',
                color: '#4CAF50',
                sound: 'notification-success.mp3'
            },
            warning: {
                icon: '⚠️',
                color: '#FF9800',
                sound: 'notification-warning.mp3'
            },
            error: {
                icon: '❌',
                color: '#F44336',
                sound: 'notification-error.mp3'
            },
            task: {
                icon: '📋',
                color: '#9C27B0',
                sound: 'notification-task.mp3'
            },
            network: {
                icon: '🌐',
                color: '#00BCD4',
                sound: 'notification-network.mp3'
            },
            voice: {
                icon: '🎤',
                color: '#FF5722',
                sound: 'notification-voice.mp3'
            },
            system: {
                icon: '⚙️',
                color: '#607D8B',
                sound: 'notification-system.mp3'
            }
        };
        
        // Browser notification permission
        this.browserNotificationPermission = 'default';
        
        // Batching state
        this.batchTimeout = null;
        this.batchedNotifications = [];
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🔔 Initializing Notification System...');
            
            this.setupEventListeners();
            this.loadConfiguration();
            this.initializeUI();
            await this.requestPermissions();
            this.setupBrowserNotifications();
            
            this.initialized = true;
            console.log('✅ Notification System initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['notifications', 'alerts', 'browser_notifications']
            });
            
        } catch (error) {
            console.error('❌ Notification System initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // System events
        eventBus.on('system:startup', () => {
            this.notify('System started successfully', 'success', 'system');
        });
        
        eventBus.on('system:shutdown', () => {
            this.notify('System is shutting down', 'info', 'system');
        });
        
        eventBus.on('system:error', (data) => {
            this.notify(`System error: ${data.message}`, 'error', 'system');
        });
        
        // Task events
        eventBus.on('task:completed', (data) => {
            this.notify(`Task completed: ${data.taskId}`, 'success', 'task');
        });
        
        eventBus.on('task:failed', (data) => {
            this.notify(`Task failed: ${data.error}`, 'error', 'task');
        });
        
        eventBus.on('task:started', (data) => {
            this.notify(`Task started: ${data.taskId}`, 'info', 'task');
        });
        
        // Network events
        eventBus.on('network:peer-connected', (data) => {
            this.notify(`Peer connected: ${data.peerId}`, 'success', 'network');
        });
        
        eventBus.on('network:peer-disconnected', (data) => {
            this.notify(`Peer disconnected: ${data.peerId}`, 'warning', 'network');
        });
        
        eventBus.on('network:connection-lost', () => {
            this.notify('Network connection lost', 'error', 'network');
        });
        
        eventBus.on('network:connection-restored', () => {
            this.notify('Network connection restored', 'success', 'network');
        });
        
        // Voice events
        eventBus.on('voice:listening-started', () => {
            this.notify('Voice recognition started', 'info', 'voice');
        });
        
        eventBus.on('voice:error', (data) => {
            this.notify(`Voice error: ${data.message}`, 'error', 'voice');
        });
        
        // Resource events
        eventBus.on('resource:alert', (data) => {
            this.notify(data.message, data.severity === 'critical' ? 'error' : 'warning', 'system');
        });
        
        eventBus.on('resource:optimization-complete', () => {
            this.notify('Resource optimization completed', 'success', 'system');
        });
        
        // Ethics events
        eventBus.on('ethics:violation', (data) => {
            this.notify(`Ethics violation: ${data.violation}`, 'error', 'system');
        });
        
        // UI events
        eventBus.on('ui:notification-dismiss', this.dismissNotification.bind(this));
        eventBus.on('ui:notification-clear-all', this.clearAllNotifications.bind(this));
        eventBus.on('ui:notification-settings', this.showSettings.bind(this));
        
        // Settings events
        eventBus.on('settings:notification-config', this.updateConfiguration.bind(this));
        
        // Module lifecycle
        eventBus.on('module:start', this.handleModuleStart.bind(this));
        eventBus.on('module:stop', this.handleModuleStop.bind(this));
    }
    
    loadConfiguration() {
        const savedConfig = stateManager.getState('notifications.config', {});
        this.config = { ...this.config, ...savedConfig };
        
        // Load notification history
        this.notificationHistory = stateManager.getState('notifications.history', []);
        
        // Limit history size
        if (this.notificationHistory.length > this.config.historySize) {
            this.notificationHistory = this.notificationHistory.slice(-this.config.historySize);
        }
    }
    
    initializeUI() {
        // Create notification container
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        this.notificationContainer.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">Notifications</span>
                <div class="notification-actions">
                    <button class="btn btn-small" id="clearNotifications">Clear All</button>
                    <button class="btn btn-small" id="notificationSettings">Settings</button>
                </div>
            </div>
            <div class="notification-list" id="notificationList"></div>
        `;
        
        // Find or create badge element
        this.updateBadge();
        
        // Add to body
        document.body.appendChild(this.notificationContainer);
        
        // Initially hidden
        this.notificationContainer.style.display = 'none';
        
        // Bind events
        this.bindUIEvents();
        
        console.log('🔔 Notification UI initialized');
    }
    
    bindUIEvents() {
        // Clear all notifications
        const clearBtn = this.notificationContainer.querySelector('#clearNotifications');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearAllNotifications();
            });
        }
        
        // Settings
        const settingsBtn = this.notificationContainer.querySelector('#notificationSettings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettings();
            });
        }
        
        // Close on outside click
        document.addEventListener('click', (event) => {
            if (!this.notificationContainer.contains(event.target) && 
                !event.target.closest('.notification-badge')) {
                this.hideNotifications();
            }
        });
    }
    
    async requestPermissions() {
        // Request browser notification permission
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            this.browserNotificationPermission = permission;
            console.log('🔔 Browser notification permission:', permission);
        }
        
        // Request vibration permission (automatically granted)
        if ('vibrate' in navigator) {
            console.log('🔔 Vibration API available');
        }
    }
    
    setupBrowserNotifications() {
        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, enable browser notifications
                this.browserNotificationsEnabled = true;
            } else {
                // Page is visible, disable browser notifications
                this.browserNotificationsEnabled = false;
            }
        });
    }
    
    // Main notification method
    notify(message, type = 'info', category = 'system', options = {}) {
        const notification = this.createNotification(message, type, category, options);
        
        // Add to queue for batching
        this.batchedNotifications.push(notification);
        
        // Process batch
        this.processBatch();
        
        return notification.id;
    }
    
    createNotification(message, type, category, options) {
        const notification = {
            id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            message: message,
            type: type,
            category: category,
            timestamp: Date.now(),
            read: false,
            dismissed: false,
            persistent: options.persistent || false,
            duration: options.duration || this.config.defaultDuration,
            actions: options.actions || [],
            data: options.data || {}
        };
        
        // Add type-specific properties
        const typeConfig = this.types[type] || this.types.info;
        notification.icon = options.icon || typeConfig.icon;
        notification.color = options.color || typeConfig.color;
        notification.sound = options.sound || typeConfig.sound;
        
        return notification;
    }
    
    processBatch() {
        // Clear existing timeout
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        // Set new timeout
        this.batchTimeout = setTimeout(() => {
            this.processBatchedNotifications();
        }, this.config.batchDelay);
    }
    
    processBatchedNotifications() {
        if (this.batchedNotifications.length === 0) return;
        
        // Process notifications
        this.batchedNotifications.forEach(notification => {
            this.processNotification(notification);
        });
        
        // Clear batch
        this.batchedNotifications = [];
        this.batchTimeout = null;
    }
    
    processNotification(notification) {
        // Add to history
        this.notificationHistory.push(notification);
        
        // Limit history size
        if (this.notificationHistory.length > this.config.historySize) {
            this.notificationHistory.shift();
        }
        
        // Add to active notifications
        this.notifications.push(notification);
        this.activeNotifications.set(notification.id, notification);
        
        // Limit active notifications
        if (this.notifications.length > this.config.maxNotifications) {
            const oldestNotification = this.notifications.shift();
            this.activeNotifications.delete(oldestNotification.id);
        }
        
        // Show notification
        this.showNotification(notification);
        
        // Play sound
        if (this.config.enableSound) {
            this.playSound(notification.sound);
        }
        
        // Show browser notification
        if (this.config.enableBrowserNotifications && this.browserNotificationsEnabled) {
            this.showBrowserNotification(notification);
        }
        
        // Vibrate
        if (this.config.enableVibration && navigator.vibrate) {
            this.vibrate(notification.type);
        }
        
        // Auto-dismiss
        if (!notification.persistent && notification.duration > 0) {
            setTimeout(() => {
                this.dismissNotification({ notificationId: notification.id });
            }, notification.duration);
        }
        
        // Update UI
        this.updateNotificationList();
        this.updateBadge();
        
        // Save to state
        this.saveState();
        
        // Emit event
        eventBus.emit('notification:created', notification);
    }
    
    showNotification(notification) {
        // Create notification element
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification notification-${notification.type}`;
        notificationElement.id = `notification-${notification.id}`;
        notificationElement.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${notification.icon}</div>
                <div class="notification-body">
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-timestamp">${this.formatTime(notification.timestamp)}</div>
                </div>
                <div class="notification-actions">
                    ${notification.actions.map(action => `
                        <button class="btn btn-small notification-action" data-action="${action.id}">
                            ${action.label}
                        </button>
                    `).join('')}
                    ${!notification.persistent ? `
                        <button class="btn btn-small notification-dismiss" data-id="${notification.id}">
                            ×
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add event listeners
        const dismissBtn = notificationElement.querySelector('.notification-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                this.dismissNotification({ notificationId: notification.id });
            });
        }
        
        // Action buttons
        const actionButtons = notificationElement.querySelectorAll('.notification-action');
        actionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const actionId = button.dataset.action;
                this.handleNotificationAction(notification.id, actionId);
            });
        });
        
        // Add to DOM
        const toastContainer = this.getToastContainer();
        toastContainer.appendChild(notificationElement);
        
        // Animate in
        requestAnimationFrame(() => {
            notificationElement.classList.add('notification-enter');
        });
        
        // Store reference
        notification.element = notificationElement;
    }
    
    getToastContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    showBrowserNotification(notification) {
        if (this.browserNotificationPermission !== 'granted') return;
        
        const browserNotification = new Notification(notification.message, {
            icon: '/assets/icon-192x192.png',
            body: notification.message,
            tag: notification.id,
            requireInteraction: notification.persistent
        });
        
        browserNotification.onclick = () => {
            window.focus();
            this.handleNotificationClick(notification.id);
            browserNotification.close();
        };
        
        // Auto-close after duration
        if (!notification.persistent && notification.duration > 0) {
            setTimeout(() => {
                browserNotification.close();
            }, notification.duration);
        }
    }
    
    playSound(soundFile) {
        try {
            const audio = new Audio(`/assets/sounds/${soundFile}`);
            audio.volume = 0.5;
            audio.play().catch(error => {
                console.warn('Could not play notification sound:', error);
            });
        } catch (error) {
            console.warn('Sound playback failed:', error);
        }
    }
    
    vibrate(type) {
        const patterns = {
            info: [100],
            success: [100, 50, 100],
            warning: [200, 100, 200],
            error: [300, 100, 300, 100, 300]
        };
        
        const pattern = patterns[type] || patterns.info;
        navigator.vibrate(pattern);
    }
    
    dismissNotification(data) {
        const { notificationId } = data;
        const notification = this.activeNotifications.get(notificationId);
        
        if (!notification) return;
        
        // Mark as dismissed
        notification.dismissed = true;
        notification.dismissedAt = Date.now();
        
        // Remove from active notifications
        this.activeNotifications.delete(notificationId);
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index > -1) {
            this.notifications.splice(index, 1);
        }
        
        // Remove from DOM
        if (notification.element) {
            notification.element.classList.add('notification-exit');
            setTimeout(() => {
                if (notification.element.parentNode) {
                    notification.element.parentNode.removeChild(notification.element);
                }
            }, 300);
        }
        
        // Update UI
        this.updateNotificationList();
        this.updateBadge();
        
        // Save state
        this.saveState();
        
        // Emit event
        eventBus.emit('notification:dismissed', notification);
    }
    
    clearAllNotifications() {
        console.log('🔔 Clearing all notifications');
        
        // Dismiss all active notifications
        this.notifications.forEach(notification => {
            this.dismissNotification({ notificationId: notification.id });
        });
        
        // Clear arrays
        this.notifications = [];
        this.activeNotifications.clear();
        
        // Update UI
        this.updateNotificationList();
        this.updateBadge();
        
        // Save state
        this.saveState();
        
        // Emit event
        eventBus.emit('notification:cleared-all');
    }
    
    handleNotificationClick(notificationId) {
        const notification = this.activeNotifications.get(notificationId);
        if (notification) {
            notification.read = true;
            
            // Handle based on category
            switch (notification.category) {
                case 'task':
                    eventBus.emit('ui:navigate', { view: 'tasks' });
                    break;
                case 'network':
                    eventBus.emit('ui:navigate', { view: 'network' });
                    break;
                case 'voice':
                    eventBus.emit('ui:navigate', { view: 'chat' });
                    break;
                default:
                    eventBus.emit('ui:navigate', { view: 'dashboard' });
            }
            
            // Update UI
            this.updateNotificationList();
            
            // Emit event
            eventBus.emit('notification:clicked', notification);
        }
    }
    
    handleNotificationAction(notificationId, actionId) {
        const notification = this.activeNotifications.get(notificationId);
        if (!notification) return;
        
        const action = notification.actions.find(a => a.id === actionId);
        if (!action) return;
        
        // Execute action
        if (action.handler) {
            action.handler(notification);
        } else {
            // Emit generic action event
            eventBus.emit('notification:action', {
                notificationId: notificationId,
                actionId: actionId,
                notification: notification
            });
        }
        
        // Auto-dismiss if action is dismissive
        if (action.dismissive !== false) {
            this.dismissNotification({ notificationId: notificationId });
        }
    }
    
    updateNotificationList() {
        const listElement = this.notificationContainer.querySelector('#notificationList');
        if (!listElement) return;
        
        if (this.notifications.length === 0) {
            listElement.innerHTML = `
                <div class="no-notifications">
                    <div class="icon">🔔</div>
                    <div class="message">No notifications</div>
                </div>
            `;
            return;
        }
        
        const sortedNotifications = [...this.notifications].sort((a, b) => b.timestamp - a.timestamp);
        
        listElement.innerHTML = sortedNotifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" 
                 data-id="${notification.id}">
                <div class="notification-icon">${notification.icon}</div>
                <div class="notification-content">
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-meta">
                        <span class="notification-time">${this.formatTime(notification.timestamp)}</span>
                        <span class="notification-category">${notification.category}</span>
                    </div>
                </div>
                ${!notification.persistent ? `
                    <button class="btn btn-small notification-dismiss" onclick="eventBus.emit('ui:notification-dismiss', { notificationId: '${notification.id}' })">
                        ×
                    </button>
                ` : ''}
            </div>
        `).join('');
        
        // Add click handlers
        const items = listElement.querySelectorAll('.notification-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const notificationId = item.dataset.id;
                this.handleNotificationClick(notificationId);
            });
        });
    }
    
    updateBadge() {
        // Find or create badge element
        let badge = document.querySelector('.notification-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'notification-badge';
            
            // Find header or create one
            const header = document.querySelector('.app-header');
            if (header) {
                header.appendChild(badge);
            } else {
                document.body.appendChild(badge);
            }
        }
        
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            badge.style.display = 'block';
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.onclick = () => this.toggleNotifications();
        } else {
            badge.style.display = 'none';
        }
        
        this.badgeElement = badge;
    }
    
    toggleNotifications() {
        const isVisible = this.notificationContainer.style.display === 'block';
        
        if (isVisible) {
            this.hideNotifications();
        } else {
            this.showNotifications();
        }
    }
    
    showNotifications() {
        this.notificationContainer.style.display = 'block';
        this.updateNotificationList();
        
        // Mark all as read
        this.notifications.forEach(notification => {
            notification.read = true;
        });
        
        this.updateBadge();
    }
    
    hideNotifications() {
        this.notificationContainer.style.display = 'none';
    }
    
    showSettings() {
        // This would open notification settings
        console.log('🔔 Opening notification settings');
        eventBus.emit('ui:show-notification-settings');
    }
    
    updateConfiguration(config) {
        this.config = { ...this.config, ...config };
        this.saveState();
        
        console.log('🔔 Notification configuration updated:', config);
        eventBus.emit('notification:config-updated', this.config);
    }
    
    saveState() {
        stateManager.setState('notifications.config', this.config);
        stateManager.setState('notifications.history', this.notificationHistory);
    }
    
    // Event handlers
    handleModuleStart(data) {
        if (data.name === this.name) {
            this.active = true;
        }
    }
    
    handleModuleStop(data) {
        if (data.name === this.name) {
            this.active = false;
        }
    }
    
    // Utility methods
    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            return `${Math.floor(diff / 60000)}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            return `${Math.floor(diff / 3600000)}h ago`;
        } else {
            return new Date(timestamp).toLocaleDateString();
        }
    }
    
    // Public API
    getNotifications() {
        return [...this.notifications];
    }
    
    getNotificationHistory() {
        return [...this.notificationHistory];
    }
    
    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }
    
    getConfiguration() {
        return { ...this.config };
    }
    
    // Quick notification methods
    success(message, options = {}) {
        return this.notify(message, 'success', 'system', options);
    }
    
    error(message, options = {}) {
        return this.notify(message, 'error', 'system', options);
    }
    
    warning(message, options = {}) {
        return this.notify(message, 'warning', 'system', options);
    }
    
    info(message, options = {}) {
        return this.notify(message, 'info', 'system', options);
    }
    
    // Module lifecycle
    async start() {
        if (this.active) return;
        
        console.log('▶️ Starting Notification System...');
        this.active = true;
        
        eventBus.emit('module:started', {
            name: this.name,
            timestamp: Date.now()
        });
    }
    
    async stop() {
        if (!this.active) return;
        
        console.log('⏹️ Stopping Notification System...');
        this.active = false;
        
        // Clear all notifications
        this.clearAllNotifications();
        
        // Clear batching
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        
        eventBus.emit('module:stopped', {
            name: this.name,
            timestamp: Date.now()
        });
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            activeNotifications: this.notifications.length,
            unreadCount: this.getUnreadCount(),
            historySize: this.notificationHistory.length,
            browserPermission: this.browserNotificationPermission,
            config: this.config
        };
    }
}

export default NotificationSystem;