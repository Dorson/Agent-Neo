/**
 * Skill Module Sandbox System
 * 
 * Provides sandboxed testing and verification of skill modules before
 * deployment to peer networks. Implements security boundaries and 
 * verification protocols as described in the whitepaper.
 * 
 * Key Features:
 * - Isolated execution environments for skill modules
 * - Security validation and testing
 * - Peer verification protocol
 * - Resource monitoring and limits
 * - Performance benchmarking
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class SkillModuleSandbox {
    constructor() {
        this.name = 'SkillModuleSandbox';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Sandbox configuration
        this.config = {
            maxExecutionTime: 30000, // 30 seconds
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB
            maxCpuUsage: 80, // 80% CPU
            maxNetworkCalls: 10,
            allowedAPIs: [
                'console',
                'JSON',
                'Math',
                'Date',
                'Array',
                'Object',
                'String',
                'Number',
                'Boolean'
            ],
            blockedAPIs: [
                'eval',
                'Function',
                'XMLHttpRequest',
                'fetch',
                'WebSocket',
                'localStorage',
                'sessionStorage',
                'document',
                'window'
            ],
            testSuiteTimeout: 300000, // 5 minutes
            maxConcurrentSandboxes: 5
        };
        
        // Active sandboxes
        this.activeSandboxes = new Map();
        this.sandboxWorkers = new Map();
        this.testResults = new Map();
        this.verificationResults = new Map();
        
        // Security policies
        this.securityPolicies = new Map();
        
        // Performance benchmarks
        this.benchmarks = new Map();
        
        // Peer verification network
        this.peerVerifiers = new Set();
        this.verificationConsensus = new Map();
        
        // Metrics
        this.metrics = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            securityViolations: 0,
            avgExecutionTime: 0,
            avgMemoryUsage: 0,
            peerVerifications: 0
        };
        
        this.initializeEventHandlers();
    }
    
    /**
     * Initialize the sandbox system
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            console.log('🧪 Initializing Skill Module Sandbox...');
            
            // Initialize security policies
            await this.initializeSecurityPolicies();
            
            // Initialize test framework
            await this.initializeTestFramework();
            
            // Initialize peer verification network
            await this.initializePeerVerification();
            
            // Setup monitoring
            this.setupResourceMonitoring();
            
            this.initialized = true;
            this.active = true;
            
            console.log('✅ Skill Module Sandbox initialized');
            eventBus.emit('sandbox:initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Sandbox:', error);
            throw error;
        }
    }
    
    /**
     * Initialize security policies
     */
    async initializeSecurityPolicies() {
        // API access policy
        this.securityPolicies.set('api_access', {
            name: 'API Access Control',
            description: 'Controls which APIs modules can access',
            check: (code) => {
                const blockedFound = this.config.blockedAPIs.some(api => 
                    code.includes(api)
                );
                return {
                    passed: !blockedFound,
                    message: blockedFound ? 'Contains blocked API calls' : 'API access OK'
                };
            }
        });
        
        // Code injection policy
        this.securityPolicies.set('code_injection', {
            name: 'Code Injection Prevention',
            description: 'Prevents dynamic code execution',
            check: (code) => {
                const dangerousPatterns = [
                    /eval\s*\(/,
                    /Function\s*\(/,
                    /new\s+Function/,
                    /setTimeout\s*\(\s*['"`]/,
                    /setInterval\s*\(\s*['"`]/
                ];
                
                const violations = dangerousPatterns.filter(pattern => pattern.test(code));
                return {
                    passed: violations.length === 0,
                    message: violations.length > 0 ? 'Contains dangerous code patterns' : 'Code injection check passed'
                };
            }
        });
        
        // Resource usage policy
        this.securityPolicies.set('resource_limits', {
            name: 'Resource Usage Limits',
            description: 'Enforces resource consumption limits',
            check: (code, metadata) => {
                const estimatedComplexity = this.estimateCodeComplexity(code);
                const withinLimits = estimatedComplexity < 1000; // Arbitrary complexity limit
                
                return {
                    passed: withinLimits,
                    message: withinLimits ? 'Resource usage OK' : 'Estimated resource usage too high'
                };
            }
        });
        
        // Data access policy
        this.securityPolicies.set('data_access', {
            name: 'Data Access Control',
            description: 'Controls data access permissions',
            check: (code) => {
                const sensitiveAccess = [
                    'localStorage',
                    'sessionStorage',
                    'indexedDB',
                    'WebSQL',
                    'cookies'
                ];
                
                const violations = sensitiveAccess.filter(access => 
                    code.includes(access)
                );
                
                return {
                    passed: violations.length === 0,
                    message: violations.length > 0 ? 'Contains unauthorized data access' : 'Data access OK'
                };
            }
        });
        
        console.log('🔒 Security policies initialized:', this.securityPolicies.size);
    }
    
    /**
     * Initialize test framework
     */
    async initializeTestFramework() {
        this.testFramework = {
            // Basic test runner
            runTests: async (module, tests) => {
                const results = [];
                
                for (const test of tests) {
                    const result = await this.runSingleTest(module, test);
                    results.push(result);
                }
                
                return {
                    total: tests.length,
                    passed: results.filter(r => r.passed).length,
                    failed: results.filter(r => !r.passed).length,
                    results
                };
            },
            
            // Performance benchmarks
            runBenchmarks: async (module, benchmarks) => {
                const results = [];
                
                for (const benchmark of benchmarks) {
                    const result = await this.runBenchmark(module, benchmark);
                    results.push(result);
                }
                
                return results;
            },
            
            // Security tests
            runSecurityTests: async (module) => {
                const results = [];
                
                for (const [policyName, policy] of this.securityPolicies) {
                    const result = policy.check(module.code, module.metadata);
                    results.push({
                        policy: policyName,
                        ...result
                    });
                }
                
                return results;
            }
        };
        
        console.log('🧪 Test framework initialized');
    }
    
    /**
     * Initialize peer verification network
     */
    async initializePeerVerification() {
        this.peerVerification = {
            // Request verification from peers
            requestVerification: async (moduleId, moduleCode, testResults) => {
                const verificationRequest = {
                    moduleId,
                    moduleCode,
                    testResults,
                    requester: stateManager.getState().agentId,
                    timestamp: Date.now()
                };
                
                eventBus.emit('peer:verification-request', verificationRequest);
                
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve(this.verificationConsensus.get(moduleId) || []);
                    }, 60000); // 1 minute timeout
                    
                    const handler = (response) => {
                        if (response.moduleId === moduleId) {
                            clearTimeout(timeout);
                            resolve(response.consensus);
                        }
                    };
                    
                    eventBus.once('peer:verification-response', handler);
                });
            },
            
            // Handle verification requests from peers
            handleVerificationRequest: async (request) => {
                const { moduleId, moduleCode, testResults, requester } = request;
                
                try {
                    // Verify the module independently
                    const verificationResult = await this.verifyModule(moduleCode, testResults);
                    
                    // Send response back to requester
                    eventBus.emit('peer:verification-response', {
                        moduleId,
                        verifier: stateManager.getState().agentId,
                        result: verificationResult,
                        timestamp: Date.now()
                    });
                    
                } catch (error) {
                    console.error('Peer verification failed:', error);
                }
            },
            
            // Process verification consensus
            processConsensus: (moduleId, verifications) => {
                const consensus = {
                    moduleId,
                    totalVerifiers: verifications.length,
                    approvals: verifications.filter(v => v.approved).length,
                    rejections: verifications.filter(v => !v.approved).length,
                    consensusReached: false,
                    approved: false
                };
                
                // Simple majority consensus
                if (consensus.approvals > consensus.rejections) {
                    consensus.consensusReached = true;
                    consensus.approved = true;
                } else if (consensus.rejections > consensus.approvals) {
                    consensus.consensusReached = true;
                    consensus.approved = false;
                }
                
                this.verificationConsensus.set(moduleId, consensus);
                return consensus;
            }
        };
        
        console.log('🤝 Peer verification network initialized');
    }
    
    /**
     * Create a new sandbox for module testing
     */
    async createSandbox(moduleId, moduleCode, metadata = {}) {
        try {
            if (this.activeSandboxes.size >= this.config.maxConcurrentSandboxes) {
                throw new Error('Maximum concurrent sandboxes reached');
            }
            
            // Create isolated worker for the module
            const sandbox = await this.createSandboxWorker(moduleId, moduleCode, metadata);
            
            this.activeSandboxes.set(moduleId, sandbox);
            
            console.log(`🧪 Created sandbox for module: ${moduleId}`);
            eventBus.emit('sandbox:created', { moduleId, sandbox });
            
            return sandbox;
            
        } catch (error) {
            console.error('Failed to create sandbox:', error);
            throw error;
        }
    }
    
    /**
     * Create sandbox worker
     */
    async createSandboxWorker(moduleId, moduleCode, metadata) {
        const workerScript = `
            // Sandbox Worker Environment
            const sandbox = {
                moduleId: '${moduleId}',
                startTime: Date.now(),
                resourceUsage: {
                    memory: 0,
                    cpu: 0,
                    networkCalls: 0
                },
                allowedAPIs: ${JSON.stringify(this.config.allowedAPIs)},
                blockedAPIs: ${JSON.stringify(this.config.blockedAPIs)},
                limits: {
                    executionTime: ${this.config.maxExecutionTime},
                    memoryUsage: ${this.config.maxMemoryUsage},
                    cpuUsage: ${this.config.maxCpuUsage},
                    networkCalls: ${this.config.maxNetworkCalls}
                }
            };
            
            // Security wrapper
            const secureEval = (code) => {
                // Check for blocked APIs
                for (const blockedAPI of sandbox.blockedAPIs) {
                    if (code.includes(blockedAPI)) {
                        throw new Error('Blocked API detected: ' + blockedAPI);
                    }
                }
                
                // Create restricted environment
                const restrictedGlobals = {
                    console: {
                        log: (...args) => self.postMessage({ type: 'log', args }),
                        error: (...args) => self.postMessage({ type: 'error', args }),
                        warn: (...args) => self.postMessage({ type: 'warn', args })
                    },
                    JSON: JSON,
                    Math: Math,
                    Date: Date,
                    Array: Array,
                    Object: Object,
                    String: String,
                    Number: Number,
                    Boolean: Boolean
                };
                
                // Execute in restricted context
                const func = new Function('globals', 'with(globals) { return ' + code + '; }');
                return func(restrictedGlobals);
            };
            
            // Resource monitoring
            const monitor = {
                checkLimits: () => {
                    const elapsed = Date.now() - sandbox.startTime;
                    if (elapsed > sandbox.limits.executionTime) {
                        throw new Error('Execution time limit exceeded');
                    }
                    
                    if (sandbox.resourceUsage.networkCalls > sandbox.limits.networkCalls) {
                        throw new Error('Network call limit exceeded');
                    }
                },
                
                trackMemory: () => {
                    // Estimate memory usage (simplified)
                    sandbox.resourceUsage.memory = performance.memory?.usedJSHeapSize || 0;
                    
                    if (sandbox.resourceUsage.memory > sandbox.limits.memoryUsage) {
                        throw new Error('Memory usage limit exceeded');
                    }
                },
                
                trackCPU: () => {
                    // Simplified CPU tracking
                    sandbox.resourceUsage.cpu = Math.min(100, (Date.now() - sandbox.startTime) / 1000);
                }
            };
            
            // Message handler
            self.onmessage = async (e) => {
                const { type, data, id } = e.data;
                
                try {
                    monitor.checkLimits();
                    monitor.trackMemory();
                    monitor.trackCPU();
                    
                    let result;
                    
                    switch (type) {
                        case 'execute':
                            result = await secureEval(data.code);
                            break;
                        case 'test':
                            result = await executeTest(data.test);
                            break;
                        case 'benchmark':
                            result = await executeBenchmark(data.benchmark);
                            break;
                        case 'getStatus':
                            result = {
                                moduleId: sandbox.moduleId,
                                uptime: Date.now() - sandbox.startTime,
                                resourceUsage: sandbox.resourceUsage
                            };
                            break;
                        default:
                            throw new Error('Unknown command: ' + type);
                    }
                    
                    self.postMessage({ id, success: true, result });
                    
                } catch (error) {
                    self.postMessage({ id, success: false, error: error.message });
                }
            };
            
            // Test execution
            async function executeTest(test) {
                const startTime = Date.now();
                
                try {
                    const result = await secureEval(test.code);
                    const expected = test.expected;
                    
                    const passed = JSON.stringify(result) === JSON.stringify(expected);
                    
                    return {
                        name: test.name,
                        passed,
                        result,
                        expected,
                        executionTime: Date.now() - startTime
                    };
                    
                } catch (error) {
                    return {
                        name: test.name,
                        passed: false,
                        error: error.message,
                        executionTime: Date.now() - startTime
                    };
                }
            }
            
            // Benchmark execution
            async function executeBenchmark(benchmark) {
                const startTime = Date.now();
                const startMemory = sandbox.resourceUsage.memory;
                
                try {
                    const result = await secureEval(benchmark.code);
                    
                    return {
                        name: benchmark.name,
                        executionTime: Date.now() - startTime,
                        memoryUsage: sandbox.resourceUsage.memory - startMemory,
                        result
                    };
                    
                } catch (error) {
                    return {
                        name: benchmark.name,
                        executionTime: Date.now() - startTime,
                        error: error.message
                    };
                }
            }
            
            // Initialize module
            const moduleCode = \`${moduleCode}\`;
            self.postMessage({ type: 'ready', moduleId: sandbox.moduleId });
        `;
        
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        
        const sandbox = {
            moduleId,
            worker,
            metadata,
            created: Date.now(),
            resourceUsage: {
                memory: 0,
                cpu: 0,
                networkCalls: 0
            },
            status: 'initializing'
        };
        
        // Setup worker message handling
        worker.onmessage = (e) => {
            this.handleSandboxMessage(moduleId, e.data);
        };
        
        worker.onerror = (error) => {
            console.error(`Sandbox worker error for ${moduleId}:`, error);
            this.handleSandboxError(moduleId, error);
        };
        
        this.sandboxWorkers.set(moduleId, worker);
        
        return sandbox;
    }
    
    /**
     * Test a module in sandbox
     */
    async testModule(moduleId, tests) {
        try {
            const sandbox = this.activeSandboxes.get(moduleId);
            if (!sandbox) {
                throw new Error(`Sandbox not found for module: ${moduleId}`);
            }
            
            const testResults = await this.testFramework.runTests(sandbox, tests);
            
            // Store results
            this.testResults.set(moduleId, {
                ...testResults,
                timestamp: Date.now(),
                moduleId
            });
            
            // Update metrics
            this.metrics.totalTests += testResults.total;
            this.metrics.passedTests += testResults.passed;
            this.metrics.failedTests += testResults.failed;
            
            console.log(`🧪 Module ${moduleId} tests completed:`, testResults);
            eventBus.emit('sandbox:test-completed', { moduleId, testResults });
            
            return testResults;
            
        } catch (error) {
            console.error('Module testing failed:', error);
            throw error;
        }
    }
    
    /**
     * Run a single test
     */
    async runSingleTest(sandbox, test) {
        const operationId = this.generateOperationId();
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    name: test.name,
                    passed: false,
                    error: 'Test timeout',
                    executionTime: this.config.maxExecutionTime
                });
            }, this.config.maxExecutionTime);
            
            const handler = (message) => {
                if (message.id === operationId) {
                    clearTimeout(timeout);
                    resolve(message.success ? message.result : {
                        name: test.name,
                        passed: false,
                        error: message.error,
                        executionTime: 0
                    });
                }
            };
            
            // Store handler temporarily
            this.tempHandlers = this.tempHandlers || new Map();
            this.tempHandlers.set(operationId, handler);
            
            // Send test to worker
            sandbox.worker.postMessage({
                type: 'test',
                data: { test },
                id: operationId
            });
        });
    }
    
    /**
     * Run benchmark
     */
    async runBenchmark(sandbox, benchmark) {
        const operationId = this.generateOperationId();
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    name: benchmark.name,
                    executionTime: this.config.maxExecutionTime,
                    error: 'Benchmark timeout'
                });
            }, this.config.maxExecutionTime);
            
            const handler = (message) => {
                if (message.id === operationId) {
                    clearTimeout(timeout);
                    resolve(message.success ? message.result : {
                        name: benchmark.name,
                        error: message.error,
                        executionTime: 0
                    });
                }
            };
            
            this.tempHandlers = this.tempHandlers || new Map();
            this.tempHandlers.set(operationId, handler);
            
            sandbox.worker.postMessage({
                type: 'benchmark',
                data: { benchmark },
                id: operationId
            });
        });
    }
    
    /**
     * Verify module through peer network
     */
    async verifyModuleWithPeers(moduleId, moduleCode, testResults) {
        try {
            console.log(`🤝 Requesting peer verification for module: ${moduleId}`);
            
            // Request verification from peers
            const verifications = await this.peerVerification.requestVerification(
                moduleId,
                moduleCode,
                testResults
            );
            
            // Process consensus
            const consensus = this.peerVerification.processConsensus(moduleId, verifications);
            
            // Store verification result
            this.verificationResults.set(moduleId, {
                consensus,
                verifications,
                timestamp: Date.now()
            });
            
            this.metrics.peerVerifications++;
            
            console.log(`🤝 Peer verification completed for ${moduleId}:`, consensus);
            eventBus.emit('sandbox:peer-verification-completed', { moduleId, consensus });
            
            return consensus;
            
        } catch (error) {
            console.error('Peer verification failed:', error);
            throw error;
        }
    }
    
    /**
     * Verify module independently
     */
    async verifyModule(moduleCode, testResults) {
        try {
            // Run security checks
            const securityResults = await this.testFramework.runSecurityTests({
                code: moduleCode
            });
            
            // Check if all security policies passed
            const securityPassed = securityResults.every(result => result.passed);
            
            // Verify test results integrity
            const testIntegrity = this.verifyTestIntegrity(testResults);
            
            return {
                approved: securityPassed && testIntegrity,
                securityResults,
                testIntegrity,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Module verification failed:', error);
            return {
                approved: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Verify test results integrity
     */
    verifyTestIntegrity(testResults) {
        // Check that test results are valid
        if (!testResults || typeof testResults !== 'object') {
            return false;
        }
        
        // Check required fields
        const required = ['total', 'passed', 'failed', 'results'];
        if (!required.every(field => field in testResults)) {
            return false;
        }
        
        // Check consistency
        if (testResults.total !== testResults.passed + testResults.failed) {
            return false;
        }
        
        // Check results array
        if (!Array.isArray(testResults.results)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Estimate code complexity
     */
    estimateCodeComplexity(code) {
        let complexity = 0;
        
        // Count various complexity indicators
        complexity += (code.match(/function/g) || []).length * 10;
        complexity += (code.match(/for|while|do/g) || []).length * 5;
        complexity += (code.match(/if|else|switch|case/g) || []).length * 3;
        complexity += (code.match(/try|catch|finally/g) || []).length * 5;
        complexity += (code.match(/new/g) || []).length * 2;
        complexity += Math.floor(code.length / 100); // Length factor
        
        return complexity;
    }
    
    /**
     * Handle sandbox messages
     */
    handleSandboxMessage(moduleId, message) {
        const { type, id, success, result, error } = message;
        
        // Handle temporary handlers
        if (this.tempHandlers && this.tempHandlers.has(id)) {
            const handler = this.tempHandlers.get(id);
            handler(message);
            this.tempHandlers.delete(id);
            return;
        }
        
        // Handle different message types
        switch (type) {
            case 'ready':
                this.handleSandboxReady(moduleId);
                break;
            case 'log':
                console.log(`[${moduleId}]`, ...message.args);
                break;
            case 'error':
                console.error(`[${moduleId}]`, ...message.args);
                break;
            case 'warn':
                console.warn(`[${moduleId}]`, ...message.args);
                break;
            default:
                console.log(`Unknown message from sandbox ${moduleId}:`, message);
        }
    }
    
    /**
     * Handle sandbox ready event
     */
    handleSandboxReady(moduleId) {
        const sandbox = this.activeSandboxes.get(moduleId);
        if (sandbox) {
            sandbox.status = 'ready';
            console.log(`🧪 Sandbox ${moduleId} is ready`);
            eventBus.emit('sandbox:ready', { moduleId });
        }
    }
    
    /**
     * Handle sandbox error
     */
    handleSandboxError(moduleId, error) {
        const sandbox = this.activeSandboxes.get(moduleId);
        if (sandbox) {
            sandbox.status = 'error';
            sandbox.error = error;
            
            console.error(`🧪 Sandbox ${moduleId} error:`, error);
            eventBus.emit('sandbox:error', { moduleId, error });
        }
    }
    
    /**
     * Destroy sandbox
     */
    async destroySandbox(moduleId) {
        try {
            const sandbox = this.activeSandboxes.get(moduleId);
            if (!sandbox) return;
            
            // Terminate worker
            const worker = this.sandboxWorkers.get(moduleId);
            if (worker) {
                worker.terminate();
                this.sandboxWorkers.delete(moduleId);
            }
            
            // Clean up
            this.activeSandboxes.delete(moduleId);
            
            console.log(`🧪 Destroyed sandbox: ${moduleId}`);
            eventBus.emit('sandbox:destroyed', { moduleId });
            
        } catch (error) {
            console.error('Failed to destroy sandbox:', error);
        }
    }
    
    /**
     * Setup resource monitoring
     */
    setupResourceMonitoring() {
        setInterval(() => {
            this.monitorResources();
        }, 5000); // Monitor every 5 seconds
    }
    
    /**
     * Monitor resource usage
     */
    monitorResources() {
        for (const [moduleId, sandbox] of this.activeSandboxes) {
            if (sandbox.status === 'ready') {
                // Request status from worker
                const operationId = this.generateOperationId();
                sandbox.worker.postMessage({
                    type: 'getStatus',
                    id: operationId
                });
            }
        }
    }
    
    /**
     * Generate operation ID
     */
    generateOperationId() {
        return 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Initialize event handlers
     */
    initializeEventHandlers() {
        eventBus.on('sandbox:create', this.handleCreateSandbox.bind(this));
        eventBus.on('sandbox:test', this.handleTestRequest.bind(this));
        eventBus.on('sandbox:verify', this.handleVerifyRequest.bind(this));
        eventBus.on('sandbox:destroy', this.handleDestroySandbox.bind(this));
        eventBus.on('peer:verification-request', this.peerVerification.handleVerificationRequest.bind(this.peerVerification));
    }
    
    /**
     * Handle create sandbox request
     */
    async handleCreateSandbox(event) {
        const { moduleId, moduleCode, metadata, callback } = event;
        
        try {
            const sandbox = await this.createSandbox(moduleId, moduleCode, metadata);
            if (callback) callback(null, sandbox);
        } catch (error) {
            if (callback) callback(error);
        }
    }
    
    /**
     * Handle test request
     */
    async handleTestRequest(event) {
        const { moduleId, tests, callback } = event;
        
        try {
            const results = await this.testModule(moduleId, tests);
            if (callback) callback(null, results);
        } catch (error) {
            if (callback) callback(error);
        }
    }
    
    /**
     * Handle verify request
     */
    async handleVerifyRequest(event) {
        const { moduleId, moduleCode, testResults, callback } = event;
        
        try {
            const consensus = await this.verifyModuleWithPeers(moduleId, moduleCode, testResults);
            if (callback) callback(null, consensus);
        } catch (error) {
            if (callback) callback(error);
        }
    }
    
    /**
     * Handle destroy sandbox request
     */
    async handleDestroySandbox(event) {
        const { moduleId, callback } = event;
        
        try {
            await this.destroySandbox(moduleId);
            if (callback) callback(null);
        } catch (error) {
            if (callback) callback(error);
        }
    }
    
    /**
     * Get system metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            activeSandboxes: this.activeSandboxes.size,
            testResults: this.testResults.size,
            verificationResults: this.verificationResults.size,
            peerVerifiers: this.peerVerifiers.size
        };
    }
    
    /**
     * Get sandbox status
     */
    getSandboxStatus(moduleId) {
        const sandbox = this.activeSandboxes.get(moduleId);
        return sandbox ? {
            moduleId,
            status: sandbox.status,
            created: sandbox.created,
            uptime: Date.now() - sandbox.created,
            resourceUsage: sandbox.resourceUsage
        } : null;
    }
    
    /**
     * Get test results
     */
    getTestResults(moduleId) {
        return this.testResults.get(moduleId);
    }
    
    /**
     * Get verification results
     */
    getVerificationResults(moduleId) {
        return this.verificationResults.get(moduleId);
    }
    
    /**
     * Shutdown the system
     */
    async shutdown() {
        console.log('🧪 Shutting down Skill Module Sandbox...');
        
        this.active = false;
        
        // Destroy all active sandboxes
        for (const moduleId of this.activeSandboxes.keys()) {
            await this.destroySandbox(moduleId);
        }
        
        console.log('✅ Skill Module Sandbox shut down');
    }
}

export default SkillModuleSandbox;