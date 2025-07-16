/**
 * AI Module Manager
 * 
 * Provides dynamic AI module loading and management capabilities:
 * - Dynamic loading of TensorFlow.js models
 * - WASM module integration and management
 * - Custom AI module plugin system
 * - Model orchestration and resource management
 * - Performance monitoring and optimization
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class AIModuleManager {
    constructor() {
        this.name = 'AIModuleManager';
        this.version = '1.0.0';
        this.isRunning = false;
        
        // AI module registry
        this.modules = new Map();
        this.moduleTypes = new Map();
        this.loadedModels = new Map();
        this.moduleInstances = new Map();
        
        // Resource management
        this.resourceManager = {
            memoryUsage: new Map(),
            cpuUsage: new Map(),
            loadTimes: new Map(),
            inferenceMetrics: new Map(),
            maxMemoryPerModule: 500 * 1024 * 1024, // 500MB
            maxConcurrentModules: 10,
            gcThreshold: 0.8
        };
        
        // Module configuration
        this.config = {
            autoLoadEnabled: true,
            preloadCommonModels: true,
            enableWebWorkers: true,
            enableWASM: true,
            enableGPUAcceleration: true,
            memoryOptimization: true,
            modelCaching: true,
            compressionEnabled: true,
            quantizationEnabled: true,
            batchProcessing: true
        };
        
        // Built-in module types
        this.registerBuiltinModuleTypes();
        
        this.init();
    }
    
    async init() {
        console.log(`🤖 Initializing ${this.name} v${this.version}`);
        
        // Load configuration
        await this.loadConfiguration();
        
        // Initialize TensorFlow.js
        await this.initializeTensorFlow();
        
        // Initialize WASM runtime
        await this.initializeWASM();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start resource monitoring
        this.startResourceMonitoring();
        
        // Preload common models if enabled
        if (this.config.preloadCommonModels) {
            await this.preloadCommonModels();
        }
        
        this.isRunning = true;
        
        eventBus.emit('ai-module-manager:initialized', {
            version: this.version,
            config: this.config,
            supportedTypes: Array.from(this.moduleTypes.keys())
        });
    }
    
    async loadConfiguration() {
        try {
            const savedConfig = await stateManager.getState('aiModuleManager.config');
            if (savedConfig) {
                this.config = { ...this.config, ...savedConfig };
            }
        } catch (error) {
            console.warn('Failed to load AI module manager configuration:', error);
        }
    }
    
    async initializeTensorFlow() {
        try {
            // Dynamically import TensorFlow.js
            if (typeof window !== 'undefined') {
                const tf = await this.loadTensorFlowJS();
                this.tensorflow = tf;
                
                // Configure TensorFlow.js
                if (this.config.enableGPUAcceleration) {
                    await tf.setBackend('webgl');
                }
                
                // Set memory growth
                if (this.config.memoryOptimization) {
                    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
                }
                
                console.log('✅ TensorFlow.js initialized successfully');
                eventBus.emit('ai-module-manager:tensorflow-ready');
            }
        } catch (error) {
            console.error('Failed to initialize TensorFlow.js:', error);
            this.tensorflow = null;
        }
    }
    
    async loadTensorFlowJS() {
        // Load TensorFlow.js dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js';
        document.head.appendChild(script);
        
        return new Promise((resolve, reject) => {
            script.onload = () => {
                if (window.tf) {
                    resolve(window.tf);
                } else {
                    reject(new Error('TensorFlow.js not loaded'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load TensorFlow.js'));
        });
    }
    
    async initializeWASM() {
        try {
            if (this.config.enableWASM && 'WebAssembly' in window) {
                this.wasmSupported = true;
                console.log('✅ WASM support enabled');
                eventBus.emit('ai-module-manager:wasm-ready');
            } else {
                this.wasmSupported = false;
                console.log('❌ WASM not supported');
            }
        } catch (error) {
            console.error('WASM initialization error:', error);
            this.wasmSupported = false;
        }
    }
    
    setupEventListeners() {
        // Module lifecycle events
        eventBus.on('ai-module-manager:load-module', (data) => this.loadModule(data));
        eventBus.on('ai-module-manager:unload-module', (data) => this.unloadModule(data));
        eventBus.on('ai-module-manager:execute-inference', (data) => this.executeInference(data));
        eventBus.on('ai-module-manager:register-module-type', (data) => this.registerModuleType(data));
        
        // Resource management events
        eventBus.on('ai-module-manager:optimize-memory', () => this.optimizeMemory());
        eventBus.on('ai-module-manager:clear-cache', () => this.clearCache());
        eventBus.on('ai-module-manager:get-status', () => this.getStatus());
        
        // Configuration events
        eventBus.on('ai-module-manager:configure', (config) => this.configure(config));
    }
    
    registerBuiltinModuleTypes() {
        // TensorFlow.js model type
        this.registerModuleType({
            name: 'tensorflow',
            loader: this.loadTensorFlowModel.bind(this),
            executor: this.executeTensorFlowInference.bind(this),
            unloader: this.unloadTensorFlowModel.bind(this),
            resourceEstimator: this.estimateTensorFlowResources.bind(this)
        });
        
        // WASM module type
        this.registerModuleType({
            name: 'wasm',
            loader: this.loadWASMModule.bind(this),
            executor: this.executeWASMInference.bind(this),
            unloader: this.unloadWASMModule.bind(this),
            resourceEstimator: this.estimateWASMResources.bind(this)
        });
        
        // Custom JavaScript module type
        this.registerModuleType({
            name: 'javascript',
            loader: this.loadJavaScriptModule.bind(this),
            executor: this.executeJavaScriptInference.bind(this),
            unloader: this.unloadJavaScriptModule.bind(this),
            resourceEstimator: this.estimateJavaScriptResources.bind(this)
        });
        
        // Pre-trained model type
        this.registerModuleType({
            name: 'pretrained',
            loader: this.loadPretrainedModel.bind(this),
            executor: this.executePretrainedInference.bind(this),
            unloader: this.unloadPretrainedModel.bind(this),
            resourceEstimator: this.estimatePretrainedResources.bind(this)
        });
    }
    
    registerModuleType(moduleType) {
        const { name, loader, executor, unloader, resourceEstimator } = moduleType;
        
        if (!name || !loader || !executor || !unloader) {
            throw new Error('Invalid module type definition');
        }
        
        this.moduleTypes.set(name, {
            name,
            loader,
            executor,
            unloader,
            resourceEstimator: resourceEstimator || (() => ({ memory: 0, cpu: 0 })),
            registeredAt: Date.now()
        });
        
        console.log(`📦 Registered AI module type: ${name}`);
        eventBus.emit('ai-module-manager:module-type-registered', { name, moduleType });
    }
    
    async loadModule(moduleConfig) {
        const { id, type, url, config = {}, priority = 'normal' } = moduleConfig;
        
        try {
            // Check if module already loaded
            if (this.modules.has(id)) {
                console.log(`⚠️ Module ${id} already loaded`);
                return this.modules.get(id);
            }
            
            // Check resource limits
            if (!this.checkResourceLimits(type)) {
                throw new Error(`Resource limits exceeded for module type: ${type}`);
            }
            
            // Get module type handler
            const moduleType = this.moduleTypes.get(type);
            if (!moduleType) {
                throw new Error(`Unknown module type: ${type}`);
            }
            
            const loadStart = performance.now();
            
            console.log(`🔄 Loading AI module: ${id} (type: ${type})`);
            
            // Load the module
            const module = await moduleType.loader(url, config);
            
            const loadTime = performance.now() - loadStart;
            
            // Create module instance
            const moduleInstance = {
                id,
                type,
                url,
                config,
                priority,
                module,
                loadTime,
                loadedAt: Date.now(),
                lastUsed: Date.now(),
                useCount: 0,
                status: 'loaded',
                resources: await moduleType.resourceEstimator(module)
            };
            
            // Store module
            this.modules.set(id, moduleInstance);
            this.moduleInstances.set(id, module);
            
            // Update resource tracking
            this.updateResourceTracking(id, moduleInstance);
            
            console.log(`✅ Module ${id} loaded successfully in ${loadTime.toFixed(2)}ms`);
            
            eventBus.emit('ai-module-manager:module-loaded', {
                id,
                type,
                loadTime,
                resources: moduleInstance.resources
            });
            
            return moduleInstance;
            
        } catch (error) {
            console.error(`❌ Failed to load module ${id}:`, error);
            
            eventBus.emit('ai-module-manager:module-load-failed', {
                id,
                type,
                error: error.message
            });
            
            throw error;
        }
    }
    
    async unloadModule(moduleId) {
        try {
            const moduleInstance = this.modules.get(moduleId);
            if (!moduleInstance) {
                console.log(`⚠️ Module ${moduleId} not found`);
                return;
            }
            
            console.log(`🔄 Unloading AI module: ${moduleId}`);
            
            // Get module type handler
            const moduleType = this.moduleTypes.get(moduleInstance.type);
            if (moduleType && moduleType.unloader) {
                await moduleType.unloader(moduleInstance.module);
            }
            
            // Remove from registries
            this.modules.delete(moduleId);
            this.moduleInstances.delete(moduleId);
            
            // Clean up resource tracking
            this.resourceManager.memoryUsage.delete(moduleId);
            this.resourceManager.cpuUsage.delete(moduleId);
            this.resourceManager.loadTimes.delete(moduleId);
            this.resourceManager.inferenceMetrics.delete(moduleId);
            
            console.log(`✅ Module ${moduleId} unloaded successfully`);
            
            eventBus.emit('ai-module-manager:module-unloaded', { id: moduleId });
            
        } catch (error) {
            console.error(`❌ Failed to unload module ${moduleId}:`, error);
            throw error;
        }
    }
    
    async executeInference(request) {
        const { moduleId, input, config = {} } = request;
        
        try {
            const moduleInstance = this.modules.get(moduleId);
            if (!moduleInstance) {
                throw new Error(`Module ${moduleId} not found`);
            }
            
            // Update usage tracking
            moduleInstance.lastUsed = Date.now();
            moduleInstance.useCount++;
            
            // Get module type handler
            const moduleType = this.moduleTypes.get(moduleInstance.type);
            if (!moduleType || !moduleType.executor) {
                throw new Error(`No executor for module type: ${moduleInstance.type}`);
            }
            
            const inferenceStart = performance.now();
            
            // Execute inference
            const result = await moduleType.executor(moduleInstance.module, input, config);
            
            const inferenceTime = performance.now() - inferenceStart;
            
            // Update inference metrics
            this.updateInferenceMetrics(moduleId, inferenceTime, result);
            
            eventBus.emit('ai-module-manager:inference-complete', {
                moduleId,
                inferenceTime,
                inputSize: this.calculateInputSize(input),
                outputSize: this.calculateOutputSize(result)
            });
            
            return result;
            
        } catch (error) {
            console.error(`❌ Inference failed for module ${moduleId}:`, error);
            
            eventBus.emit('ai-module-manager:inference-failed', {
                moduleId,
                error: error.message
            });
            
            throw error;
        }
    }
    
    // TensorFlow.js specific implementations
    async loadTensorFlowModel(url, config) {
        if (!this.tensorflow) {
            throw new Error('TensorFlow.js not initialized');
        }
        
        const model = await this.tensorflow.loadLayersModel(url, config);
        return model;
    }
    
    async executeTensorFlowInference(model, input, config) {
        // Convert input to tensor if needed
        const inputTensor = this.tensorflow.tensor(input);
        
        // Execute prediction
        const result = model.predict(inputTensor);
        
        // Convert result back to array
        const output = await result.data();
        
        // Clean up tensors
        inputTensor.dispose();
        result.dispose();
        
        return Array.from(output);
    }
    
    async unloadTensorFlowModel(model) {
        if (model && model.dispose) {
            model.dispose();
        }
    }
    
    async estimateTensorFlowResources(model) {
        if (!model) return { memory: 0, cpu: 0 };
        
        // Estimate memory usage based on model parameters
        const memoryUsage = model.countParams() * 4; // 4 bytes per float32
        
        return {
            memory: memoryUsage,
            cpu: 0.5 // Estimated CPU usage
        };
    }
    
    // WASM specific implementations
    async loadWASMModule(url, config) {
        if (!this.wasmSupported) {
            throw new Error('WASM not supported');
        }
        
        const response = await fetch(url);
        const bytes = await response.arrayBuffer();
        const wasmModule = await WebAssembly.instantiate(bytes, config.imports || {});
        
        return {
            instance: wasmModule.instance,
            module: wasmModule.module,
            exports: wasmModule.instance.exports
        };
    }
    
    async executeWASMInference(wasmModule, input, config) {
        const { exports } = wasmModule;
        
        // This would be specific to the WASM module's interface
        if (exports.inference) {
            return exports.inference(input);
        }
        
        throw new Error('WASM module does not export inference function');
    }
    
    async unloadWASMModule(wasmModule) {
        // WASM modules are garbage collected automatically
        // but we can null references
        wasmModule.instance = null;
        wasmModule.module = null;
        wasmModule.exports = null;
    }
    
    async estimateWASMResources(wasmModule) {
        return {
            memory: wasmModule.instance.exports.memory?.buffer?.byteLength || 0,
            cpu: 0.3 // Estimated CPU usage
        };
    }
    
    // JavaScript module implementations
    async loadJavaScriptModule(url, config) {
        const module = await import(url);
        return new module.default(config);
    }
    
    async executeJavaScriptInference(module, input, config) {
        if (module.inference) {
            return module.inference(input, config);
        }
        throw new Error('JavaScript module does not have inference method');
    }
    
    async unloadJavaScriptModule(module) {
        if (module.dispose) {
            await module.dispose();
        }
    }
    
    async estimateJavaScriptResources(module) {
        return {
            memory: module.memoryUsage || 1024 * 1024, // 1MB default
            cpu: 0.4 // Estimated CPU usage
        };
    }
    
    // Pre-trained model implementations
    async loadPretrainedModel(url, config) {
        // Load model metadata
        const response = await fetch(url);
        const modelData = await response.json();
        
        // Create model instance based on metadata
        return {
            metadata: modelData,
            weights: modelData.weights ? await this.loadWeights(modelData.weights) : null,
            architecture: modelData.architecture,
            config: config
        };
    }
    
    async executePretrainedInference(model, input, config) {
        // This would implement the specific inference logic
        // based on the model's architecture
        const { architecture, weights, metadata } = model;
        
        // Simple placeholder implementation
        return {
            prediction: input,
            confidence: 0.95,
            architecture,
            timestamp: Date.now()
        };
    }
    
    async unloadPretrainedModel(model) {
        if (model.weights) {
            model.weights = null;
        }
        model.metadata = null;
        model.architecture = null;
    }
    
    async estimatePretrainedResources(model) {
        const weightsSize = model.weights ? model.weights.byteLength : 0;
        return {
            memory: weightsSize + 1024 * 1024, // weights + 1MB overhead
            cpu: 0.6 // Estimated CPU usage
        };
    }
    
    // Resource management methods
    checkResourceLimits(type) {
        const currentModules = Array.from(this.modules.values());
        const totalMemory = currentModules.reduce((sum, module) => sum + module.resources.memory, 0);
        const moduleCount = currentModules.length;
        
        // Check memory limit
        if (totalMemory > this.resourceManager.maxMemoryPerModule * this.resourceManager.maxConcurrentModules) {
            return false;
        }
        
        // Check module count limit
        if (moduleCount >= this.resourceManager.maxConcurrentModules) {
            return false;
        }
        
        return true;
    }
    
    updateResourceTracking(moduleId, moduleInstance) {
        this.resourceManager.memoryUsage.set(moduleId, moduleInstance.resources.memory);
        this.resourceManager.cpuUsage.set(moduleId, moduleInstance.resources.cpu);
        this.resourceManager.loadTimes.set(moduleId, moduleInstance.loadTime);
    }
    
    updateInferenceMetrics(moduleId, inferenceTime, result) {
        if (!this.resourceManager.inferenceMetrics.has(moduleId)) {
            this.resourceManager.inferenceMetrics.set(moduleId, {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                errors: 0
            });
        }
        
        const metrics = this.resourceManager.inferenceMetrics.get(moduleId);
        metrics.count++;
        metrics.totalTime += inferenceTime;
        metrics.averageTime = metrics.totalTime / metrics.count;
        
        this.resourceManager.inferenceMetrics.set(moduleId, metrics);
    }
    
    async optimizeMemory() {
        console.log('🧹 Optimizing AI module memory usage');
        
        const currentModules = Array.from(this.modules.values());
        const totalMemory = currentModules.reduce((sum, module) => sum + module.resources.memory, 0);
        const memoryThreshold = this.resourceManager.maxMemoryPerModule * this.resourceManager.maxConcurrentModules * this.resourceManager.gcThreshold;
        
        if (totalMemory > memoryThreshold) {
            // Sort modules by last used time and usage count
            const sortedModules = currentModules.sort((a, b) => {
                const scoreA = a.lastUsed / 1000000 + a.useCount;
                const scoreB = b.lastUsed / 1000000 + b.useCount;
                return scoreA - scoreB;
            });
            
            // Unload least used modules
            const modulesToUnload = sortedModules.slice(0, Math.ceil(sortedModules.length * 0.3));
            
            for (const module of modulesToUnload) {
                await this.unloadModule(module.id);
            }
        }
        
        // Trigger garbage collection if available
        if (this.tensorflow && this.tensorflow.dispose) {
            this.tensorflow.dispose();
        }
        
        eventBus.emit('ai-module-manager:memory-optimized', {
            modulesUnloaded: currentModules.length - this.modules.size,
            memoryFreed: totalMemory - this.getTotalMemoryUsage()
        });
    }
    
    async preloadCommonModels() {
        console.log('📦 Preloading common AI models');
        
        const commonModels = [
            {
                id: 'mobilenet',
                type: 'tensorflow',
                url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json',
                config: { inputShape: [224, 224, 3] }
            },
            {
                id: 'sentiment-analysis',
                type: 'pretrained',
                url: '/models/sentiment/model.json',
                config: { vocabSize: 10000 }
            }
        ];
        
        const loadPromises = commonModels.map(model => 
            this.loadModule(model).catch(error => {
                console.warn(`Failed to preload model ${model.id}:`, error);
                return null;
            })
        );
        
        const results = await Promise.allSettled(loadPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        
        console.log(`✅ Preloaded ${successCount}/${commonModels.length} common models`);
    }
    
    startResourceMonitoring() {
        // Monitor resource usage every 10 seconds
        setInterval(() => {
            this.monitorResources();
        }, 10000);
    }
    
    async monitorResources() {
        const totalMemory = this.getTotalMemoryUsage();
        const moduleCount = this.modules.size;
        
        // Check if memory optimization is needed
        if (totalMemory > this.resourceManager.maxMemoryPerModule * this.resourceManager.maxConcurrentModules * this.resourceManager.gcThreshold) {
            await this.optimizeMemory();
        }
        
        // Emit resource status
        eventBus.emit('ai-module-manager:resource-status', {
            totalMemory,
            moduleCount,
            maxMemory: this.resourceManager.maxMemoryPerModule * this.resourceManager.maxConcurrentModules,
            utilizationRatio: totalMemory / (this.resourceManager.maxMemoryPerModule * this.resourceManager.maxConcurrentModules)
        });
    }
    
    // Utility methods
    getTotalMemoryUsage() {
        return Array.from(this.resourceManager.memoryUsage.values()).reduce((sum, usage) => sum + usage, 0);
    }
    
    calculateInputSize(input) {
        if (Array.isArray(input)) {
            return input.length * 4; // Assuming 4 bytes per element
        }
        return JSON.stringify(input).length;
    }
    
    calculateOutputSize(output) {
        if (Array.isArray(output)) {
            return output.length * 4; // Assuming 4 bytes per element
        }
        return JSON.stringify(output).length;
    }
    
    async loadWeights(weightsUrl) {
        const response = await fetch(weightsUrl);
        return await response.arrayBuffer();
    }
    
    async clearCache() {
        console.log('🧹 Clearing AI module cache');
        
        // Unload all modules
        const moduleIds = Array.from(this.modules.keys());
        for (const moduleId of moduleIds) {
            await this.unloadModule(moduleId);
        }
        
        // Clear all caches
        this.modules.clear();
        this.moduleInstances.clear();
        this.resourceManager.memoryUsage.clear();
        this.resourceManager.cpuUsage.clear();
        this.resourceManager.loadTimes.clear();
        this.resourceManager.inferenceMetrics.clear();
        
        eventBus.emit('ai-module-manager:cache-cleared');
    }
    
    // Configuration and status methods
    async configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await stateManager.setState('aiModuleManager.config', this.config);
        
        eventBus.emit('ai-module-manager:configured', { config: this.config });
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            isRunning: this.isRunning,
            config: this.config,
            modules: Array.from(this.modules.keys()),
            moduleTypes: Array.from(this.moduleTypes.keys()),
            resourceUsage: {
                totalMemory: this.getTotalMemoryUsage(),
                moduleCount: this.modules.size,
                maxMemory: this.resourceManager.maxMemoryPerModule * this.resourceManager.maxConcurrentModules,
                utilizationRatio: this.getTotalMemoryUsage() / (this.resourceManager.maxMemoryPerModule * this.resourceManager.maxConcurrentModules)
            },
            capabilities: {
                tensorflowSupported: !!this.tensorflow,
                wasmSupported: this.wasmSupported,
                gpuAcceleration: this.config.enableGPUAcceleration,
                webWorkersEnabled: this.config.enableWebWorkers
            }
        };
    }
    
    async stop() {
        console.log('🛑 Stopping AI Module Manager');
        
        // Unload all modules
        await this.clearCache();
        
        this.isRunning = false;
        
        eventBus.emit('ai-module-manager:stopped');
    }
}

export default AIModuleManager;