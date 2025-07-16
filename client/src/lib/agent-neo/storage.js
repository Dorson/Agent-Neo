// Agent Neo Local Storage Module
// IndexedDB-based decentralized storage system

export class LocalStorage {
  constructor(core) {
    this.core = core;
    this.db = null;
    this.dbName = 'AgentNeoStorage';
    this.dbVersion = 1;
    this.stores = {
      configuration: 'configuration',
      tasks: 'tasks',
      peers: 'peers',
      metrics: 'metrics',
      metricsHistory: 'metricsHistory',
      ethicsLogs: 'ethicsLogs',
      knowledge: 'knowledge',
      files: 'files'
    };
  }

  async init() {
    try {
      await this.openDatabase();
      await this.initializeStores();
      
      console.log('Local Storage initialized');
    } catch (error) {
      console.error('Error initializing Local Storage:', error);
      throw error;
    }
  }

  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains(this.stores.configuration)) {
          db.createObjectStore(this.stores.configuration, { keyPath: 'key' });
        }
        
        if (!db.objectStoreNames.contains(this.stores.tasks)) {
          const taskStore = db.createObjectStore(this.stores.tasks, { keyPath: 'taskId' });
          taskStore.createIndex('status', 'status', { unique: false });
          taskStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.peers)) {
          const peerStore = db.createObjectStore(this.stores.peers, { keyPath: 'peerId' });
          peerStore.createIndex('status', 'status', { unique: false });
          peerStore.createIndex('reputation', 'reputation', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.metrics)) {
          db.createObjectStore(this.stores.metrics, { keyPath: 'timestamp' });
        }
        
        if (!db.objectStoreNames.contains(this.stores.metricsHistory)) {
          const historyStore = db.createObjectStore(this.stores.metricsHistory, { keyPath: 'id', autoIncrement: true });
          historyStore.createIndex('type', 'type', { unique: false });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.ethicsLogs)) {
          const ethicsStore = db.createObjectStore(this.stores.ethicsLogs, { keyPath: 'id', autoIncrement: true });
          ethicsStore.createIndex('taskId', 'taskId', { unique: false });
          ethicsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.knowledge)) {
          const knowledgeStore = db.createObjectStore(this.stores.knowledge, { keyPath: 'id', autoIncrement: true });
          knowledgeStore.createIndex('type', 'type', { unique: false });
          knowledgeStore.createIndex('relevance', 'relevance', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.files)) {
          const fileStore = db.createObjectStore(this.stores.files, { keyPath: 'hash' });
          fileStore.createIndex('type', 'type', { unique: false });
          fileStore.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  async initializeStores() {
    // Initialize default configuration if not exists
    const defaultConfig = {
      key: 'default',
      nodeName: 'neo-node-local',
      region: 'auto',
      voiceEnabled: true,
      autoStart: true,
      maxPeers: 50,
      connectionTimeout: 30000,
      debugLogging: true,
      resourceLimits: {
        cpu: 50,
        memory: 512,
        bandwidth: 10
      }
    };

    const existingConfig = await this.getConfiguration();
    if (!existingConfig) {
      await this.saveConfiguration(defaultConfig);
    }
  }

  async performTransaction(storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);
      
      transaction.onerror = () => {
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      const request = operation(store);
      
      request.onerror = () => {
        reject(new Error(`Operation failed: ${request.error}`));
      };
      
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  // Configuration methods
  async getConfiguration() {
    try {
      const result = await this.performTransaction(
        this.stores.configuration,
        'readonly',
        (store) => store.get('default')
      );
      return result?.value || null;
    } catch (error) {
      console.error('Error getting configuration:', error);
      return null;
    }
  }

  async saveConfiguration(config) {
    try {
      await this.performTransaction(
        this.stores.configuration,
        'readwrite',
        (store) => store.put({ key: 'default', value: config, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }

  // Task methods
  async saveTask(task) {
    try {
      await this.performTransaction(
        this.stores.tasks,
        'readwrite',
        (store) => store.put({ ...task, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error saving task:', error);
      throw error;
    }
  }

  async getTask(taskId) {
    try {
      return await this.performTransaction(
        this.stores.tasks,
        'readonly',
        (store) => store.get(taskId)
      );
    } catch (error) {
      console.error('Error getting task:', error);
      return null;
    }
  }

  async getTasks(status = null) {
    try {
      return await this.performTransaction(
        this.stores.tasks,
        'readonly',
        (store) => {
          if (status) {
            return store.index('status').getAll(status);
          }
          return store.getAll();
        }
      );
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  }

  async deleteTask(taskId) {
    try {
      await this.performTransaction(
        this.stores.tasks,
        'readwrite',
        (store) => store.delete(taskId)
      );
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  // Peer methods
  async savePeer(peer) {
    try {
      await this.performTransaction(
        this.stores.peers,
        'readwrite',
        (store) => store.put({ ...peer, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error saving peer:', error);
      throw error;
    }
  }

  async getPeer(peerId) {
    try {
      return await this.performTransaction(
        this.stores.peers,
        'readonly',
        (store) => store.get(peerId)
      );
    } catch (error) {
      console.error('Error getting peer:', error);
      return null;
    }
  }

  async getPeers() {
    try {
      return await this.performTransaction(
        this.stores.peers,
        'readonly',
        (store) => store.getAll()
      );
    } catch (error) {
      console.error('Error getting peers:', error);
      return [];
    }
  }

  async deletePeer(peerId) {
    try {
      await this.performTransaction(
        this.stores.peers,
        'readwrite',
        (store) => store.delete(peerId)
      );
    } catch (error) {
      console.error('Error deleting peer:', error);
      throw error;
    }
  }

  // Metrics methods
  async saveMetrics(metrics) {
    try {
      await this.performTransaction(
        this.stores.metrics,
        'readwrite',
        (store) => store.put({ ...metrics, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error saving metrics:', error);
      throw error;
    }
  }

  async getMetrics() {
    try {
      const all = await this.performTransaction(
        this.stores.metrics,
        'readonly',
        (store) => store.getAll()
      );
      return all.length > 0 ? all[all.length - 1] : null;
    } catch (error) {
      console.error('Error getting metrics:', error);
      return null;
    }
  }

  async saveMetricsHistory(history) {
    try {
      const transaction = this.db.transaction([this.stores.metricsHistory], 'readwrite');
      const store = transaction.objectStore(this.stores.metricsHistory);
      
      // Save each history type
      for (const [type, data] of Object.entries(history)) {
        for (const entry of data) {
          await new Promise((resolve, reject) => {
            const request = store.put({ type, ...entry });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
      }
    } catch (error) {
      console.error('Error saving metrics history:', error);
      throw error;
    }
  }

  async getMetricsHistory() {
    try {
      const all = await this.performTransaction(
        this.stores.metricsHistory,
        'readonly',
        (store) => store.getAll()
      );
      
      // Group by type
      const grouped = {};
      all.forEach(entry => {
        if (!grouped[entry.type]) {
          grouped[entry.type] = [];
        }
        grouped[entry.type].push(entry);
      });
      
      return grouped;
    } catch (error) {
      console.error('Error getting metrics history:', error);
      return {};
    }
  }

  // Ethics methods
  async saveEthicsLog(log) {
    try {
      await this.performTransaction(
        this.stores.ethicsLogs,
        'readwrite',
        (store) => store.put({ ...log, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error saving ethics log:', error);
      throw error;
    }
  }

  async getEthicsLogs(taskId = null) {
    try {
      return await this.performTransaction(
        this.stores.ethicsLogs,
        'readonly',
        (store) => {
          if (taskId) {
            return store.index('taskId').getAll(taskId);
          }
          return store.getAll();
        }
      );
    } catch (error) {
      console.error('Error getting ethics logs:', error);
      return [];
    }
  }

  // Knowledge methods
  async saveKnowledge(knowledge) {
    try {
      await this.performTransaction(
        this.stores.knowledge,
        'readwrite',
        (store) => store.put({ ...knowledge, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error saving knowledge:', error);
      throw error;
    }
  }

  async getKnowledge(type = null) {
    try {
      return await this.performTransaction(
        this.stores.knowledge,
        'readonly',
        (store) => {
          if (type) {
            return store.index('type').getAll(type);
          }
          return store.getAll();
        }
      );
    } catch (error) {
      console.error('Error getting knowledge:', error);
      return [];
    }
  }

  // File methods (for IPFS-like functionality)
  async saveFile(hash, data, metadata = {}) {
    try {
      const file = {
        hash,
        data,
        metadata,
        type: metadata.type || 'unknown',
        size: data.length || data.size || 0,
        timestamp: Date.now()
      };
      
      await this.performTransaction(
        this.stores.files,
        'readwrite',
        (store) => store.put(file)
      );
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }

  async getFile(hash) {
    try {
      return await this.performTransaction(
        this.stores.files,
        'readonly',
        (store) => store.get(hash)
      );
    } catch (error) {
      console.error('Error getting file:', error);
      return null;
    }
  }

  async getFiles(type = null) {
    try {
      return await this.performTransaction(
        this.stores.files,
        'readonly',
        (store) => {
          if (type) {
            return store.index('type').getAll(type);
          }
          return store.getAll();
        }
      );
    } catch (error) {
      console.error('Error getting files:', error);
      return [];
    }
  }

  async deleteFile(hash) {
    try {
      await this.performTransaction(
        this.stores.files,
        'readwrite',
        (store) => store.delete(hash)
      );
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  // Utility methods
  async getStorageUsage() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          quota: estimate.quota || 0,
          percentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
        };
      }
      return { used: 0, quota: 0, percentage: 0 };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { used: 0, quota: 0, percentage: 0 };
    }
  }

  async clearStorage() {
    try {
      const transaction = this.db.transaction(Object.values(this.stores), 'readwrite');
      
      for (const storeName of Object.values(this.stores)) {
        const store = transaction.objectStore(storeName);
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      
      console.log('Storage cleared successfully');
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  async exportData() {
    try {
      const data = {};
      
      for (const [key, storeName] of Object.entries(this.stores)) {
        data[key] = await this.performTransaction(
          storeName,
          'readonly',
          (store) => store.getAll()
        );
      }
      
      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(data) {
    try {
      for (const [key, storeName] of Object.entries(this.stores)) {
        if (data[key]) {
          const transaction = this.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          
          for (const item of data[key]) {
            await new Promise((resolve, reject) => {
              const request = store.put(item);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          }
        }
      }
      
      console.log('Data imported successfully');
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  // Hash utility for IPFS-like functionality
  async hashData(data) {
    const encoder = new TextEncoder();
    const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
