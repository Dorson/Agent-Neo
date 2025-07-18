/**
 * Logger Module
 * 
 * Centralized logging utility for debugging and monitoring with configurable
 * verbosity as specified in the Agent Neo implementation plan Step 9.
 * 
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Configurable verbosity
 * - Log rotation and size limits
 * - Persistent logging to IndexedDB
 * - Performance-optimized batch writing
 * - Structured logging with metadata
 */

import { config } from './config.js';
import indexedDBManager from '../storage/IndexedDBManager.js';

class Logger {
    constructor() {
        this.initialized = false;
        this.version = '1.0.0';
        
        // Log levels
        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        };
        
        // Current log level from config
        this.currentLevel = this.levels[config.logging?.level?.toUpperCase()] || this.levels.INFO;
        
        // Configuration
        this.config = {
            level: config.logging?.level || 'info',
            maxLogSize: config.logging?.maxLogSize || 10 * 1024 * 1024, // 10MB
            retentionDays: config.logging?.retentionDays || 30,
            enableConsole: config.logging?.enableConsole !== false,
            enablePersistent: config.logging?.enablePersistent !== false,
            batchSize: 100, // Batch writes for performance
            flushInterval: 5000 // Flush every 5 seconds
        };
        
        // Log buffer for batch writing
        this.logBuffer = [];
        this.flushTimer = null;
        
        // Statistics
        this.stats = {
            totalLogs: 0,
            debugLogs: 0,
            infoLogs: 0,
            warnLogs: 0,
            errorLogs: 0,
            startTime: Date.now(),
            lastFlush: Date.now()
        };
        
        // Session ID for log correlation
        this.sessionId = this.generateSessionId();
        
        this.init();
    }

    async init() {
        try {
            console.log('📝 Logger initializing...');
            
            // Initialize storage if persistent logging is enabled
            if (this.config.enablePersistent) {
                await this.initializeStorage();
            }
            
            // Start batch flushing
            this.startBatchFlushing();
            
            // Set up cleanup
            this.setupCleanup();
            
            this.initialized = true;
            this.info('Logger initialized successfully', { 
                level: this.config.level,
                sessionId: this.sessionId 
            });
            
        } catch (error) {
            console.error('❌ Logger initialization failed:', error);
            throw error;
        }
    }

    async initializeStorage() {
        try {
            await indexedDBManager.ensureStore('logs');
            await this.performLogRotation();
        } catch (error) {
            console.error('❌ Failed to initialize logger storage:', error);
            throw error;
        }
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Debug level logging
     */
    debug(message, metadata = {}) {
        this.log('DEBUG', message, metadata);
    }

    /**
     * Info level logging
     */
    info(message, metadata = {}) {
        this.log('INFO', message, metadata);
    }

    /**
     * Warning level logging
     */
    warn(message, metadata = {}) {
        this.log('WARN', message, metadata);
    }

    /**
     * Error level logging
     */
    error(message, metadata = {}) {
        this.log('ERROR', message, metadata);
    }

    /**
     * Core logging method
     */
    log(level, message, metadata = {}) {
        try {
            const levelValue = this.levels[level];
            
            // Check if log level meets threshold
            if (levelValue < this.currentLevel) {
                return;
            }

            // Create log entry
            const logEntry = {
                id: this.generateLogId(),
                timestamp: new Date().toISOString(),
                level: level,
                message: message,
                metadata: metadata,
                sessionId: this.sessionId,
                
                // Additional context
                userAgent: navigator.userAgent,
                url: window.location.href,
                
                // Performance data
                memoryUsage: this.getMemoryUsage(),
                stackTrace: level === 'ERROR' ? this.getStackTrace() : null
            };

            // Console output if enabled
            if (this.config.enableConsole) {
                this.logToConsole(logEntry);
            }

            // Add to buffer for persistent storage
            if (this.config.enablePersistent) {
                this.addToBuffer(logEntry);
            }

            // Update statistics
            this.updateStats(level);

        } catch (error) {
            // Fallback to console if logging fails
            console.error('❌ Logging failed:', error, { level, message, metadata });
        }
    }

    /**
     * Log to browser console with appropriate styling
     */
    logToConsole(logEntry) {
        try {
            const { level, message, metadata, timestamp } = logEntry;
            const timeStr = new Date(timestamp).toLocaleTimeString();
            
            // Style based on level
            const styles = {
                DEBUG: 'color: #888; font-size: 11px;',
                INFO: 'color: #2196F3; font-weight: normal;',
                WARN: 'color: #FF9800; font-weight: bold;',
                ERROR: 'color: #F44336; font-weight: bold; background: #ffebee;'
            };

            const style = styles[level] || styles.INFO;
            const prefix = `%c[${timeStr}] ${level}:`;
            
            if (Object.keys(metadata).length > 0) {
                console.log(prefix, style, message, metadata);
            } else {
                console.log(prefix, style, message);
            }

        } catch (error) {
            console.error('❌ Console logging failed:', error);
        }
    }

    /**
     * Add log entry to buffer for batch writing
     */
    addToBuffer(logEntry) {
        try {
            this.logBuffer.push(logEntry);
            
            // Flush if buffer is full
            if (this.logBuffer.length >= this.config.batchSize) {
                this.flushBuffer();
            }

        } catch (error) {
            console.error('❌ Failed to add to log buffer:', error);
        }
    }

    /**
     * Start periodic batch flushing
     */
    startBatchFlushing() {
        this.flushTimer = setInterval(() => {
            if (this.logBuffer.length > 0) {
                this.flushBuffer();
            }
        }, this.config.flushInterval);
    }

    /**
     * Flush log buffer to persistent storage
     */
    async flushBuffer() {
        try {
            if (this.logBuffer.length === 0) return;

            const logsToFlush = [...this.logBuffer];
            this.logBuffer = [];

            // Store each log entry
            for (const logEntry of logsToFlush) {
                await indexedDBManager.put('logs', logEntry, logEntry.id);
            }

            this.stats.lastFlush = Date.now();

        } catch (error) {
            console.error('❌ Failed to flush log buffer:', error);
            
            // Return logs to buffer on failure
            this.logBuffer = [...this.logBuffer, ...logsToFlush];
        }
    }

    /**
     * Update logging statistics
     */
    updateStats(level) {
        try {
            this.stats.totalLogs++;
            
            switch (level) {
                case 'DEBUG':
                    this.stats.debugLogs++;
                    break;
                case 'INFO':
                    this.stats.infoLogs++;
                    break;
                case 'WARN':
                    this.stats.warnLogs++;
                    break;
                case 'ERROR':
                    this.stats.errorLogs++;
                    break;
            }

        } catch (error) {
            console.error('❌ Failed to update stats:', error);
        }
    }

    /**
     * Generate unique log ID
     */
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get memory usage information
     */
    getMemoryUsage() {
        try {
            if (performance.memory) {
                return {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get stack trace for errors
     */
    getStackTrace() {
        try {
            const stack = new Error().stack;
            return stack ? stack.split('\n').slice(2) : null; // Remove first 2 lines
        } catch (error) {
            return null;
        }
    }

    /**
     * Perform log rotation and cleanup
     */
    async performLogRotation() {
        try {
            if (!this.config.enablePersistent) return;

            const cutoffDate = new Date(Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000));
            const allLogs = await indexedDBManager.getAll('logs');
            
            let deletedCount = 0;
            let totalSize = 0;

            for (const log of allLogs) {
                const logDate = new Date(log.timestamp);
                const logSize = JSON.stringify(log).length;
                
                // Delete old logs
                if (logDate < cutoffDate) {
                    await indexedDBManager.delete('logs', log.id);
                    deletedCount++;
                } else {
                    totalSize += logSize;
                }
            }

            // Check total size and remove oldest if exceeding limit
            if (totalSize > this.config.maxLogSize) {
                const remainingLogs = await indexedDBManager.getAll('logs');
                remainingLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                let currentSize = totalSize;
                for (const log of remainingLogs) {
                    if (currentSize <= this.config.maxLogSize * 0.8) break; // Keep 80% of limit
                    
                    const logSize = JSON.stringify(log).length;
                    await indexedDBManager.delete('logs', log.id);
                    currentSize -= logSize;
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                this.info('Log rotation completed', { 
                    deletedLogs: deletedCount,
                    remainingSize: totalSize - deletedCount
                });
            }

        } catch (error) {
            this.error('Log rotation failed', { error: error.message });
        }
    }

    /**
     * Set up cleanup processes
     */
    setupCleanup() {
        // Perform log rotation daily
        setInterval(() => {
            this.performLogRotation();
        }, 24 * 60 * 60 * 1000); // 24 hours

        // Flush on page unload
        window.addEventListener('beforeunload', () => {
            if (this.logBuffer.length > 0) {
                // Try to flush remaining logs
                this.flushBuffer().catch(() => {
                    // Ignore errors during unload
                });
            }
        });
    }

    /**
     * Set log level dynamically
     */
    setLevel(level) {
        try {
            const levelUpper = level.toUpperCase();
            if (this.levels[levelUpper] !== undefined) {
                this.currentLevel = this.levels[levelUpper];
                this.config.level = level;
                this.info('Log level changed', { newLevel: level });
            } else {
                this.warn('Invalid log level', { attempted: level });
            }
        } catch (error) {
            this.error('Failed to set log level', { error: error.message });
        }
    }

    /**
     * Get recent logs
     */
    async getRecentLogs(limit = 100, level = null) {
        try {
            if (!this.config.enablePersistent) {
                return [];
            }

            const allLogs = await indexedDBManager.getAll('logs');
            
            let filteredLogs = allLogs;
            if (level) {
                filteredLogs = allLogs.filter(log => log.level === level.toUpperCase());
            }

            // Sort by timestamp (newest first) and limit
            return filteredLogs
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);

        } catch (error) {
            this.error('Failed to get recent logs', { error: error.message });
            return [];
        }
    }

    /**
     * Search logs by message content
     */
    async searchLogs(query, limit = 100) {
        try {
            if (!this.config.enablePersistent) {
                return [];
            }

            const allLogs = await indexedDBManager.getAll('logs');
            const queryLower = query.toLowerCase();

            return allLogs
                .filter(log => 
                    log.message.toLowerCase().includes(queryLower) ||
                    JSON.stringify(log.metadata).toLowerCase().includes(queryLower)
                )
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);

        } catch (error) {
            this.error('Failed to search logs', { error: error.message });
            return [];
        }
    }

    /**
     * Get logging statistics
     */
    getStats() {
        return {
            ...this.stats,
            sessionId: this.sessionId,
            currentLevel: this.config.level,
            uptime: Date.now() - this.stats.startTime,
            bufferSize: this.logBuffer.length
        };
    }

    /**
     * Export logs as JSON
     */
    async exportLogs(startDate = null, endDate = null) {
        try {
            if (!this.config.enablePersistent) {
                throw new Error('Persistent logging not enabled');
            }

            const allLogs = await indexedDBManager.getAll('logs');
            
            let filteredLogs = allLogs;
            
            if (startDate) {
                filteredLogs = filteredLogs.filter(log => 
                    new Date(log.timestamp) >= new Date(startDate)
                );
            }
            
            if (endDate) {
                filteredLogs = filteredLogs.filter(log => 
                    new Date(log.timestamp) <= new Date(endDate)
                );
            }

            return {
                exportDate: new Date().toISOString(),
                sessionId: this.sessionId,
                totalLogs: filteredLogs.length,
                dateRange: {
                    start: startDate,
                    end: endDate
                },
                logs: filteredLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            };

        } catch (error) {
            this.error('Failed to export logs', { error: error.message });
            throw error;
        }
    }

    /**
     * Clear all logs
     */
    async clearLogs() {
        try {
            if (!this.config.enablePersistent) {
                return;
            }

            const allLogs = await indexedDBManager.getAll('logs');
            
            for (const log of allLogs) {
                await indexedDBManager.delete('logs', log.id);
            }

            // Clear buffer
            this.logBuffer = [];

            // Reset stats
            this.stats = {
                totalLogs: 0,
                debugLogs: 0,
                infoLogs: 0,
                warnLogs: 0,
                errorLogs: 0,
                startTime: Date.now(),
                lastFlush: Date.now()
            };

            this.info('All logs cleared');

        } catch (error) {
            this.error('Failed to clear logs', { error: error.message });
            throw error;
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        try {
            if (this.flushTimer) {
                clearInterval(this.flushTimer);
                this.flushTimer = null;
            }

            // Final flush
            if (this.logBuffer.length > 0) {
                this.flushBuffer().catch(() => {
                    // Ignore errors during cleanup
                });
            }

            this.info('Logger destroyed');

        } catch (error) {
            console.error('❌ Logger cleanup failed:', error);
        }
    }
}

// Create and export singleton instance
const logger = new Logger();
export default logger;