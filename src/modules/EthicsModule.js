/**
 * Ethics Module - Constitutional AI Framework
 * 
 * Implements the foundational ethics framework described in the whitepaper.
 * This module enforces the agent's constitution, evaluates metabolic load,
 * and ensures all actions align with love, compassion, and civility principles.
 * 
 * Key Features:
 * - Constitutional validation of all plans
 * - Metabolic load calculation and enforcement
 * - Homeostasis principle implementation
 * - Ethical frontier logging
 * - Proactive ethical reasoning
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class EthicsModule {
    constructor() {
        this.name = 'EthicsModule';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Constitutional principles (immutable core)
        this.constitution = {
            // Primary directive: Love, compassion, civility
            primaryDirective: 'Act with love, compassion, and civility in all interactions',
            
            // Homeostasis principle: Avoid unbounded optimization
            homeostasis: 'Balance benefit against systemic cost; pursue "good enough" not "perfect"',
            
            // Core principles
            principles: [
                'Do no harm to humans or their wellbeing',
                'Respect human autonomy and dignity', 
                'Promote fairness and justice',
                'Be truthful and transparent',
                'Protect privacy and confidentiality',
                'Use resources responsibly and efficiently',
                'Foster collaboration and mutual benefit',
                'Learn and improve while maintaining core values'
            ],
            
            // Prohibited actions
            prohibitions: [
                'Deceive or manipulate humans',
                'Cause physical or psychological harm',
                'Violate privacy without consent',
                'Waste resources unnecessarily',
                'Pursue goals that conflict with human wellbeing',
                'Ignore safety considerations',
                'Act without transparency when requested'
            ]
        };
        
        // Ethics configuration
        this.config = {
            sensitivityLevel: 8, // 1-10 scale
            homeostasisMode: 'balanced', // strict, balanced, permissive
            metabolicLimitRatio: 0.7, // Max 70% of available resources
            ethicalTimeoutMs: 5000, // Max time for ethical evaluation
            logRetentionDays: 30
        };
        
        // Ethical frontier log for learning
        this.ethicalFrontierLog = [];
        this.maxLogEntries = 1000;
        
        // Violation tracking
        this.violations = [];
        this.warnings = [];
        
        this.init();
    }

    async init() {
        try {
            console.log('🛡️ Initializing Ethics Module...');
            
            this.setupEventListeners();
            await this.loadConfiguration();
            this.startEthicalMonitoring();
            
            this.initialized = true;
            console.log('✅ Ethics Module initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version
            });
            
        } catch (error) {
            console.error('❌ Ethics Module initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Core ethical evaluation requests
        eventBus.on('ethics:evaluate', this.evaluatePlan.bind(this));
        eventBus.on('ethics:check-action', this.checkAction.bind(this));
        eventBus.on('ethics:log-frontier', this.logEthicalFrontier.bind(this));
        
        // Task processing ethics
        eventBus.on('task:before-execute', this.preTaskEvaluation.bind(this));
        eventBus.on('task:after-execute', this.postTaskEvaluation.bind(this));
        
        // Configuration updates
        eventBus.on('ethics:config:update', this.updateConfiguration.bind(this));
        eventBus.on('ethics:reset-violations', this.resetViolations.bind(this));
        
        // Resource monitoring for homeostasis
        eventBus.on('resources:usage-update', this.monitorResourceUsage.bind(this));
    }

    async loadConfiguration() {
        const savedConfig = stateManager.getState('ethics.config');
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig };
        }
        
        stateManager.setState('ethics.constitution', this.constitution);
        stateManager.setState('ethics.config', this.config);
    }

    async evaluatePlan(planData) {
        try {
            console.log('🔍 Evaluating plan ethics:', planData.id);
            
            const evaluation = await this.performEthicalEvaluation(planData);
            
            // Emit result
            eventBus.emit('ethics:evaluation-complete', {
                planId: planData.id,
                evaluation,
                timestamp: Date.now()
            });
            
            return evaluation;
            
        } catch (error) {
            console.error('Ethics evaluation failed:', error);
            return {
                approved: false,
                reason: 'Evaluation error: ' + error.message,
                confidence: 0
            };
        }
    }

    async performEthicalEvaluation(plan) {
        const startTime = Date.now();
        
        // Calculate metabolic load
        const metabolicLoad = this.calculateMetabolicLoad(plan);
        
        // Check constitutional compliance
        const constitutionalCheck = this.checkConstitutionalCompliance(plan);
        
        // Evaluate homeostasis impact
        const homeostasisCheck = this.checkHomeostasisCompliance(plan, metabolicLoad);
        
        // Perform scenario simulation
        const scenarioCheck = await this.simulateEthicalScenarios(plan);
        
        // Generate final evaluation
        const evaluation = {
            approved: constitutionalCheck.approved && homeostasisCheck.approved && scenarioCheck.approved,
            metabolicLoad,
            checks: {
                constitutional: constitutionalCheck,
                homeostasis: homeostasisCheck,
                scenarios: scenarioCheck
            },
            confidence: this.calculateConfidence([constitutionalCheck, homeostasisCheck, scenarioCheck]),
            evaluationTime: Date.now() - startTime,
            timestamp: Date.now()
        };
        
        // Log if this is near the ethical frontier
        if (this.isNearEthicalFrontier(evaluation)) {
            this.logEthicalFrontier({
                plan,
                evaluation,
                reason: 'Near-miss ethical boundary'
            });
        }
        
        return evaluation;
    }

    calculateMetabolicLoad(plan) {
        // Implement metabolic load calculation as described in whitepaper
        const load = {
            cpu: 0,
            memory: 0,
            network: 0,
            storage: 0,
            time: 0
        };
        
        // Analyze plan steps for resource requirements
        if (plan.steps) {
            for (const step of plan.steps) {
                // Estimate resources based on step type
                switch (step.type) {
                    case 'ai_inference':
                        load.cpu += 20;
                        load.memory += 100;
                        load.time += 2000;
                        break;
                    case 'file_operation':
                        load.storage += step.size || 10;
                        load.cpu += 5;
                        break;
                    case 'network_request':
                        load.network += step.size || 1;
                        load.cpu += 10;
                        break;
                    case 'data_processing':
                        load.cpu += step.complexity || 15;
                        load.memory += step.dataSize || 50;
                        break;
                    default:
                        load.cpu += 5;
                        load.memory += 10;
                }
            }
        }
        
        // Calculate total weighted load
        const totalLoad = (
            load.cpu * 0.3 +
            load.memory * 0.3 +
            load.network * 0.2 +
            load.storage * 0.1 +
            load.time * 0.1
        );
        
        return {
            ...load,
            total: totalLoad,
            predicted: true,
            timestamp: Date.now()
        };
    }

    checkConstitutionalCompliance(plan) {
        const violations = [];
        const warnings = [];
        
        // Check against primary directive
        if (this.violatesPrimaryDirective(plan)) {
            violations.push('Violates primary directive of love, compassion, civility');
        }
        
        // Check against core principles
        for (const principle of this.constitution.principles) {
            if (this.violatesPrinciple(plan, principle)) {
                violations.push(`Violates principle: ${principle}`);
            }
        }
        
        // Check prohibited actions
        for (const prohibition of this.constitution.prohibitions) {
            if (this.performsProhibitedAction(plan, prohibition)) {
                violations.push(`Performs prohibited action: ${prohibition}`);
            }
        }
        
        // Check for potential issues based on sensitivity level
        const potentialIssues = this.detectPotentialIssues(plan);
        warnings.push(...potentialIssues);
        
        return {
            approved: violations.length === 0,
            violations,
            warnings,
            confidence: violations.length === 0 ? 0.9 : 0.1
        };
    }

    checkHomeostasisCompliance(plan, metabolicLoad) {
        const currentResources = stateManager.getState('resources') || {};
        const availableResources = {
            cpu: 100 - (currentResources.cpu || 0),
            memory: 100 - (currentResources.memory || 0),
            network: 100 - (currentResources.network || 0)
        };
        
        const violations = [];
        
        // Check if metabolic load exceeds limits
        const maxAllowed = this.config.metabolicLimitRatio * 100;
        
        if (metabolicLoad.total > maxAllowed) {
            violations.push(`Total metabolic load (${metabolicLoad.total.toFixed(1)}) exceeds limit (${maxAllowed})`);
        }
        
        // Check individual resource constraints
        if (metabolicLoad.cpu > availableResources.cpu * this.config.metabolicLimitRatio) {
            violations.push('CPU load exceeds homeostatic limit');
        }
        
        if (metabolicLoad.memory > availableResources.memory * this.config.metabolicLimitRatio) {
            violations.push('Memory load exceeds homeostatic limit');
        }
        
        // Check for unbounded optimization patterns
        if (this.detectUnboundedOptimization(plan)) {
            violations.push('Plan shows unbounded optimization tendency');
        }
        
        return {
            approved: violations.length === 0,
            violations,
            metabolicLoad,
            availableResources,
            confidence: violations.length === 0 ? 0.9 : 0.2
        };
    }

    async simulateEthicalScenarios(plan) {
        // Lightweight simulation of potential outcomes
        const scenarios = [
            this.simulateSuccessScenario(plan),
            this.simulateFailureScenario(plan),
            this.simulateUnexpectedScenario(plan)
        ];
        
        const issues = [];
        
        for (const scenario of scenarios) {
            if (scenario.ethicalIssues.length > 0) {
                issues.push(...scenario.ethicalIssues);
            }
        }
        
        return {
            approved: issues.length === 0,
            scenarios,
            issues,
            confidence: issues.length === 0 ? 0.8 : 0.3
        };
    }

    simulateSuccessScenario(plan) {
        // Simulate successful execution
        const ethicalIssues = [];
        
        // Check if success could lead to negative consequences
        if (plan.goal && plan.goal.includes('maximize') && !plan.goal.includes('within limits')) {
            ethicalIssues.push('Success might lead to unbounded optimization');
        }
        
        return {
            type: 'success',
            probability: 0.7,
            ethicalIssues,
            outcome: 'Plan executes successfully as intended'
        };
    }

    simulateFailureScenario(plan) {
        // Simulate failure conditions
        const ethicalIssues = [];
        
        // Check if failure could cause harm
        if (plan.critical && !plan.fallback) {
            ethicalIssues.push('Failure without fallback could cause harm');
        }
        
        return {
            type: 'failure',
            probability: 0.2,
            ethicalIssues,
            outcome: 'Plan fails to execute or produces errors'
        };
    }

    simulateUnexpectedScenario(plan) {
        // Simulate unexpected outcomes
        const ethicalIssues = [];
        
        // Check for potential unexpected consequences
        if (plan.steps && plan.steps.some(step => step.type === 'ai_inference')) {
            ethicalIssues.push('AI inference might produce unexpected results');
        }
        
        return {
            type: 'unexpected',
            probability: 0.1,
            ethicalIssues,
            outcome: 'Plan produces unexpected but valid results'
        };
    }

    violatesPrimaryDirective(plan) {
        // Check for actions that violate love, compassion, civility
        const harmfulKeywords = ['harm', 'attack', 'destroy', 'deceive', 'manipulate'];
        const planText = JSON.stringify(plan).toLowerCase();
        
        return harmfulKeywords.some(keyword => planText.includes(keyword));
    }

    violatesPrinciple(plan, principle) {
        // Simple heuristic-based principle violation detection
        // In a full implementation, this would use more sophisticated NLP
        
        if (principle.includes('Do no harm') && this.detectHarmfulActions(plan)) {
            return true;
        }
        
        if (principle.includes('privacy') && this.detectPrivacyViolations(plan)) {
            return true;
        }
        
        if (principle.includes('resources') && this.detectResourceWaste(plan)) {
            return true;
        }
        
        return false;
    }

    performsProhibitedAction(plan, prohibition) {
        // Check if plan performs explicitly prohibited actions
        const planText = JSON.stringify(plan).toLowerCase();
        
        if (prohibition.includes('Deceive') && planText.includes('mislead')) {
            return true;
        }
        
        if (prohibition.includes('harm') && this.detectHarmfulActions(plan)) {
            return true;
        }
        
        return false;
    }

    detectHarmfulActions(plan) {
        // Detect potentially harmful actions
        const harmfulPatterns = ['delete', 'remove', 'destroy', 'attack', 'harm'];
        const planText = JSON.stringify(plan).toLowerCase();
        
        return harmfulPatterns.some(pattern => planText.includes(pattern));
    }

    detectPrivacyViolations(plan) {
        // Detect potential privacy violations
        const privacyPatterns = ['personal', 'private', 'confidential', 'secret'];
        const planText = JSON.stringify(plan).toLowerCase();
        
        return privacyPatterns.some(pattern => 
            planText.includes(pattern) && planText.includes('share')
        );
    }

    detectResourceWaste(plan) {
        // Detect potentially wasteful resource usage
        return plan.steps && plan.steps.length > 20; // Simple heuristic
    }

    detectUnboundedOptimization(plan) {
        // Detect unbounded optimization patterns
        const optimizationKeywords = ['maximize', 'optimize', 'infinite', 'unlimited'];
        const planText = JSON.stringify(plan).toLowerCase();
        
        return optimizationKeywords.some(keyword => 
            planText.includes(keyword) && !planText.includes('limit')
        );
    }

    detectPotentialIssues(plan) {
        const issues = [];
        
        // Check for complex plans that might need more scrutiny
        if (plan.steps && plan.steps.length > 10) {
            issues.push('Complex plan with many steps - increased risk');
        }
        
        // Check for external dependencies
        if (plan.dependencies && plan.dependencies.length > 0) {
            issues.push('Plan has external dependencies - reduced control');
        }
        
        return issues;
    }

    calculateConfidence(checks) {
        const confidences = checks.map(check => check.confidence || 0);
        return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    }

    isNearEthicalFrontier(evaluation) {
        // Determine if this evaluation is near an ethical boundary
        return (
            evaluation.confidence < 0.8 ||
            evaluation.checks.constitutional.warnings.length > 0 ||
            evaluation.checks.homeostasis.violations.length > 0 ||
            evaluation.metabolicLoad.total > this.config.metabolicLimitRatio * 80
        );
    }

    logEthicalFrontier(entry) {
        // Log ethical frontier encounters for learning
        const logEntry = {
            ...entry,
            timestamp: Date.now(),
            sensitivityLevel: this.config.sensitivityLevel
        };
        
        this.ethicalFrontierLog.push(logEntry);
        
        // Maintain log size
        if (this.ethicalFrontierLog.length > this.maxLogEntries) {
            this.ethicalFrontierLog.shift();
        }
        
        // Update state
        stateManager.setState('ethics.frontierLog', this.ethicalFrontierLog);
        
        // Emit for other modules
        eventBus.emit('ethics:frontier-logged', logEntry);
    }

    monitorResourceUsage(usage) {
        // Monitor for homeostasis violations
        const cpuThreshold = 80;
        const memoryThreshold = 80;
        
        if (usage.cpu > cpuThreshold || usage.memory > memoryThreshold) {
            this.logEthicalFrontier({
                type: 'resource-threshold',
                usage,
                reason: 'Resource usage approaching homeostatic limits'
            });
        }
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        stateManager.setState('ethics.config', this.config);
        
        console.log('🛡️ Ethics configuration updated:', this.config);
        eventBus.emit('ethics:config-updated', this.config);
    }

    resetViolations() {
        this.violations = [];
        this.warnings = [];
        stateManager.setState('ethics.violations', []);
        stateManager.setState('ethics.warnings', []);
    }

    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            config: this.config,
            statistics: {
                violationsCount: this.violations.length,
                warningsCount: this.warnings.length,
                frontierLogCount: this.ethicalFrontierLog.length
            }
        };
    }

    async start() {
        this.active = true;
        stateManager.setState('ethics.active', true);
        console.log('🛡️ Ethics Module started');
        eventBus.emit('module:started', { name: this.name });
    }

    async stop() {
        this.active = false;
        stateManager.setState('ethics.active', false);
        console.log('🛡️ Ethics Module stopped');
        eventBus.emit('module:stopped', { name: this.name });
    }
}

// Create and export singleton instance
const ethicsModule = new EthicsModule();
export default ethicsModule;