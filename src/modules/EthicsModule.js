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
        
        // Enhanced ethics configuration
        this.config = {
            sensitivityLevel: 8, // 1-10 scale
            homeostasisMode: 'balanced', // strict, balanced, permissive
            metabolicLimitRatio: 0.7, // Max 70% of available resources
            ethicalTimeoutMs: 5000, // Max time for ethical evaluation
            logRetentionDays: 30,
            maxMetabolicLoad: 100, // Maximum acceptable metabolic load
            homeostasisWindow: 0.1, // 10% deviation allowed
            ethicalDecayRate: 0.05, // 5% per period
            violationThreshold: 3, // Max violations before action
            frontierLogRetention: 10000, // Keep last 10k entries
            constitutionVersion: '1.0.0'
        };
        
        // Enhanced ethical frontier log for constitutional evolution
        this.ethicalFrontierLog = [];
        this.metabolicLoadHistory = [];
        this.homeostasisTargets = new Map();
        this.maxLogEntries = this.config.frontierLogRetention;
        
        // Enhanced violation tracking
        this.violations = [];
        this.warnings = [];
        this.ethicsViolations = [];
        
        // Constitutional evolution tracking
        this.constitutionProposals = [];
        this.communityVotes = new Map();
        
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

    /**
     * Enhanced metabolic load calculation as per whitepaper specifications
     * Calculates the comprehensive resource impact of a planned action
     * @param {Object} plan - Action plan to evaluate
     * @returns {Object} Detailed metabolic load analysis
     */
    calculateMetabolicLoad(plan) {
        const load = {
            computational: 0,
            memory: 0,
            network: 0,
            storage: 0,
            social: 0,
            temporal: 0,
            cognitive: 0
        };
        
        // Analyze plan complexity and resource requirements
        if (plan.steps) {
            for (const step of plan.steps) {
                const stepLoad = this.calculateStepLoad(step);
                
                // Accumulate loads
                load.computational += stepLoad.computational;
                load.memory += stepLoad.memory;
                load.network += stepLoad.network;
                load.storage += stepLoad.storage;
                load.social += stepLoad.social;
                load.temporal += stepLoad.temporal;
                load.cognitive += stepLoad.cognitive;
            }
        }
        
        // Factor in plan complexity and interconnections
        const complexityMultiplier = this.calculateComplexityMultiplier(plan);
        
        // Apply homeostasis constraints
        const constrainedLoad = this.applyHomeostasisConstraints(load, complexityMultiplier);
        
        // Calculate total weighted metabolic load
        const totalLoad = (
            constrainedLoad.computational * 0.25 +
            constrainedLoad.memory * 0.2 +
            constrainedLoad.network * 0.15 +
            constrainedLoad.storage * 0.1 +
            constrainedLoad.social * 0.15 +
            constrainedLoad.temporal * 0.1 +
            constrainedLoad.cognitive * 0.05
        );
        
        // Record in history for analysis
        this.metabolicLoadHistory.push({
            planId: plan.id || `plan_${Date.now()}`,
            load: constrainedLoad,
            total: totalLoad,
            complexity: complexityMultiplier,
            timestamp: Date.now()
        });
        
        // Maintain history size
        if (this.metabolicLoadHistory.length > 1000) {
            this.metabolicLoadHistory.shift();
        }
        
        return {
            ...constrainedLoad,
            total: totalLoad,
            complexity: complexityMultiplier,
            homeostasisRating: this.calculateHomeostasisRating(totalLoad),
            predicted: true,
            timestamp: Date.now()
        };
    }

    /**
     * Calculate metabolic load for individual step
     * @param {Object} step - Plan step
     * @returns {Object} Step load breakdown
     */
    calculateStepLoad(step) {
        const baseLoad = {
            computational: 1,
            memory: 1,
            network: 0,
            storage: 0,
            social: 0,
            temporal: 1,
            cognitive: 1
        };
        
        // Step-specific load calculations
        switch (step.type) {
            case 'ai_inference':
                baseLoad.computational = 25 + (step.modelSize || 0) * 0.1;
                baseLoad.memory = 50 + (step.contextSize || 0) * 0.01;
                baseLoad.cognitive = 20 + (step.complexity || 1) * 5;
                baseLoad.temporal = step.estimatedTime || 5000;
                break;
                
            case 'network_request':
                baseLoad.network = (step.dataSize || 1) * 0.1;
                baseLoad.computational = 5;
                baseLoad.temporal = step.timeout || 1000;
                if (step.external) {
                    baseLoad.social = 2; // External interaction cost
                }
                break;
                
            case 'data_processing':
                baseLoad.computational = (step.dataSize || 100) * 0.01;
                baseLoad.memory = (step.dataSize || 100) * 0.005;
                baseLoad.cognitive = step.algorithmComplexity || 5;
                break;
                
            case 'file_operation':
                baseLoad.storage = step.fileSize || 1;
                baseLoad.computational = 2;
                baseLoad.temporal = (step.fileSize || 1) * 0.1;
                break;
                
            case 'guild_interaction':
                baseLoad.social = 10 + (step.memberCount || 1) * 2;
                baseLoad.network = step.messageSize || 0.5;
                baseLoad.cognitive = 5;
                break;
                
            case 'knowledge_synthesis':
                baseLoad.cognitive = 30 + (step.sourceCount || 1) * 5;
                baseLoad.computational = 15;
                baseLoad.memory = 20;
                baseLoad.temporal = 3000;
                break;
                
            default:
                // Conservative default load
                baseLoad.computational = 5;
                baseLoad.memory = 5;
                baseLoad.cognitive = 3;
        }
        
        return baseLoad;
    }

    /**
     * Calculate complexity multiplier based on plan interconnections
     * @param {Object} plan - Action plan
     * @returns {number} Complexity multiplier
     */
    calculateComplexityMultiplier(plan) {
        let complexity = 1.0;
        
        // Factor in step count
        const stepCount = plan.steps ? plan.steps.length : 1;
        complexity += (stepCount - 1) * 0.1; // 10% per additional step
        
        // Factor in dependencies
        if (plan.dependencies && plan.dependencies.length > 0) {
            complexity += plan.dependencies.length * 0.15;
        }
        
        // Factor in parallel processing
        if (plan.parallel) {
            complexity += 0.3; // Parallel coordination overhead
        }
        
        // Factor in external interactions
        const externalSteps = (plan.steps || []).filter(step => step.external).length;
        complexity += externalSteps * 0.2;
        
        // Cap complexity multiplier
        return Math.min(complexity, 3.0);
    }

    /**
     * Apply homeostasis constraints to prevent unbounded optimization
     * @param {Object} load - Calculated load
     * @param {number} complexity - Complexity multiplier
     * @returns {Object} Constrained load
     */
    applyHomeostasisConstraints(load, complexity) {
        const constrainedLoad = { ...load };
        
        // Get current system state
        const systemState = stateManager.getState('resources') || {};
        const currentUtilization = systemState.utilization || 0.5;
        
        // Apply homeostasis window constraints
        const homeostasisFactor = this.calculateHomeostasisFactor(currentUtilization);
        
        // Constrain each resource type
        for (const [key, value] of Object.entries(constrainedLoad)) {
            // Apply homeostasis constraint
            constrainedLoad[key] = value * homeostasisFactor;
            
            // Apply absolute limits
            const maxValues = {
                computational: this.config.maxMetabolicLoad * 0.4,
                memory: this.config.maxMetabolicLoad * 0.3,
                network: this.config.maxMetabolicLoad * 0.2,
                storage: this.config.maxMetabolicLoad * 0.1,
                social: this.config.maxMetabolicLoad * 0.15,
                temporal: 30000, // 30 seconds max
                cognitive: this.config.maxMetabolicLoad * 0.25
            };
            
            if (maxValues[key]) {
                constrainedLoad[key] = Math.min(constrainedLoad[key], maxValues[key]);
            }
        }
        
        return constrainedLoad;
    }

    /**
     * Calculate homeostasis factor based on current system state
     * @param {number} currentUtilization - Current resource utilization (0-1)
     * @returns {number} Homeostasis constraint factor
     */
    calculateHomeostasisFactor(currentUtilization) {
        // Ideal utilization target
        const targetUtilization = 0.6;
        const deviation = Math.abs(currentUtilization - targetUtilization);
        
        // If we're within the homeostasis window, allow normal operation
        if (deviation <= this.config.homeostasisWindow) {
            return 1.0;
        }
        
        // If utilization is too high, reduce allowed load
        if (currentUtilization > targetUtilization) {
            const excessFactor = (currentUtilization - targetUtilization) / (1.0 - targetUtilization);
            return Math.max(0.1, 1.0 - excessFactor * 0.8);
        }
        
        // If utilization is too low, we can afford slightly more load
        const underFactor = (targetUtilization - currentUtilization) / targetUtilization;
        return Math.min(1.5, 1.0 + underFactor * 0.3);
    }

    /**
     * Calculate homeostasis rating for a given load
     * @param {number} totalLoad - Total metabolic load
     * @returns {string} Homeostasis rating
     */
    calculateHomeostasisRating(totalLoad) {
        if (totalLoad <= this.config.maxMetabolicLoad * 0.3) return 'excellent';
        if (totalLoad <= this.config.maxMetabolicLoad * 0.6) return 'good';
        if (totalLoad <= this.config.maxMetabolicLoad * 0.8) return 'acceptable';
        if (totalLoad <= this.config.maxMetabolicLoad) return 'concerning';
        return 'excessive';
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