/**
 * Module Seeding/Mutation System
 * 
 * Implements controlled module evolution through seeding and mutation as described
 * in the whitepaper. High-performing modules can create mutated versions of themselves
 * to explore new evolutionary paths while maintaining safety through resource constraints.
 * 
 * Key Features:
 * - Module seeding (controlled mutation)
 * - Code analysis and safe mutation
 * - Resource-constrained evolution
 * - Performance tracking and selection
 * - Skill-chaining (compositional evolution)
 * - Evolutionary lineage tracking
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class ModuleSeedingSystem {
    constructor() {
        this.name = 'ModuleSeedingSystem';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Module registry and lineage
        this.modules = new Map();
        this.moduleLineage = new Map();
        this.seedingHistory = new Map();
        this.mutationTemplates = new Map();
        
        // Performance tracking
        this.performanceMetrics = new Map();
        this.evolutionaryFitness = new Map();
        this.generationalStats = new Map();
        
        // Learned skills (compositional evolution)
        this.learnedSkills = new Map();
        this.skillChains = new Map();
        this.skillUsageStats = new Map();
        
        // Configuration
        this.config = {
            minTrustForSeeding: 1000,
            seedingCost: 500, // Trust tokens required
            maxMutationsPerModule: 3,
            maxGenerations: 10,
            mutationProbability: 0.1,
            skillExtractionThreshold: 5, // Successful uses before skill extraction
            maxSkillChainLength: 10,
            evaluationPeriod: 86400000, // 24 hours
            survivalThreshold: 0.7 // Performance threshold for survival
        };
        
        // Mutation strategies
        this.mutationStrategies = new Map([
            ['parameter_tweaking', {
                description: 'Modify numerical parameters within safe bounds',
                risk: 'low',
                successRate: 0.8
            }],
            ['logic_branching', {
                description: 'Add conditional logic paths',
                risk: 'medium',
                successRate: 0.6
            }],
            ['function_composition', {
                description: 'Combine existing functions in new ways',
                risk: 'low',
                successRate: 0.9
            }],
            ['interface_expansion', {
                description: 'Add new input/output capabilities',
                risk: 'medium',
                successRate: 0.7
            }],
            ['optimization_variants', {
                description: 'Try different algorithmic approaches',
                risk: 'high',
                successRate: 0.4
            }]
        ]);
        
        // Code analysis patterns
        this.codePatterns = new Map([
            ['function_declaration', /function\s+(\w+)\s*\([^)]*\)\s*{/g],
            ['class_declaration', /class\s+(\w+)(?:\s+extends\s+\w+)?\s*{/g],
            ['variable_declaration', /(?:let|const|var)\s+(\w+)\s*=/g],
            ['method_call', /\.(\w+)\s*\(/g],
            ['async_function', /async\s+function\s+(\w+)/g],
            ['arrow_function', /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g]
        ]);
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🧬 Initializing Module Seeding System...');
            
            this.setupEventListeners();
            await this.loadEvolutionaryData();
            this.initializeMutationTemplates();
            this.startEvolutionaryProcesses();
            
            this.initialized = true;
            console.log('✅ Module Seeding System initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                mutationStrategies: this.mutationStrategies.size,
                learnedSkills: this.learnedSkills.size
            });
            
        } catch (error) {
            console.error('❌ Module Seeding System initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Module seeding events
        eventBus.on('module:seed', this.seedModule.bind(this));
        eventBus.on('module:mutate', this.mutateModule.bind(this));
        eventBus.on('module:evaluate', this.evaluateModule.bind(this));
        
        // Skill learning events
        eventBus.on('skill:extract', this.extractSkillFromExecution.bind(this));
        eventBus.on('skill:chain', this.createSkillChain.bind(this));
        eventBus.on('skill:use', this.useLearnedSkill.bind(this));
        
        // Performance tracking
        eventBus.on('task:complete', this.recordPerformance.bind(this));
        eventBus.on('task:fail', this.recordFailure.bind(this));
        
        // Evolution management
        eventBus.on('evolution:prune', this.pruneUnderperformers.bind(this));
        eventBus.on('evolution:promote', this.promoteSuccessfulMutations.bind(this));
    }
    
    async loadEvolutionaryData() {
        try {
            const stored = localStorage.getItem('agent-neo-evolution-data');
            if (stored) {
                const data = JSON.parse(stored);
                this.moduleLineage = new Map(data.lineage || []);
                this.learnedSkills = new Map(data.skills || []);
                this.skillChains = new Map(data.chains || []);
                console.log('🧬 Loaded evolutionary data:', {
                    lineage: this.moduleLineage.size,
                    skills: this.learnedSkills.size,
                    chains: this.skillChains.size
                });
            }
        } catch (error) {
            console.warn('Failed to load evolutionary data:', error);
        }
    }
    
    initializeMutationTemplates() {
        // Parameter tweaking templates
        this.mutationTemplates.set('parameter_tweaking', {
            numerical: {
                pattern: /(\d+(?:\.\d+)?)/g,
                mutator: (value) => {
                    const num = parseFloat(value);
                    const variation = num * 0.1 * (Math.random() - 0.5); // ±5% variation
                    return Math.max(0, num + variation).toFixed(2);
                }
            },
            boolean: {
                pattern: /\b(true|false)\b/g,
                mutator: (value) => Math.random() < 0.1 ? (value === 'true' ? 'false' : 'true') : value
            },
            string: {
                pattern: /"([^"]+)"/g,
                mutator: (value) => {
                    // Safe string mutations (add/remove characters)
                    if (Math.random() < 0.05) {
                        return value + '_v2';
                    }
                    return value;
                }
            }
        });
        
        // Logic branching templates
        this.mutationTemplates.set('logic_branching', {
            conditional: {
                pattern: /(if\s*\([^)]+\))/g,
                mutator: (condition) => {
                    // Add additional conditions
                    const additions = [
                        ' && Math.random() > 0.1',
                        ' || this.config.experimentalMode',
                        ' && this.performanceMetrics.successRate > 0.8'
                    ];
                    return condition + additions[Math.floor(Math.random() * additions.length)];
                }
            }
        });
        
        console.log('🧬 Mutation templates initialized:', this.mutationTemplates.size);
    }
    
    async seedModule(seedingData) {
        const { moduleId, parentModuleId, trustBalance, reputation } = seedingData;
        
        // Validate seeding requirements
        if (trustBalance < this.config.minTrustForSeeding) {
            throw new Error('Insufficient trust balance for module seeding');
        }
        
        const parentModule = this.modules.get(parentModuleId);
        if (!parentModule) {
            throw new Error('Parent module not found');
        }
        
        // Check if parent can seed more modules
        const lineage = this.moduleLineage.get(parentModuleId) || { generation: 0, children: [] };
        if (lineage.children.length >= this.config.maxMutationsPerModule) {
            throw new Error('Parent module has reached maximum seeding limit');
        }
        
        // Deduct seeding cost
        eventBus.emit('economy:deduct-trust', {
            moduleId: parentModuleId,
            amount: this.config.seedingCost,
            reason: 'module_seeding'
        });
        
        // Create mutated module
        const mutatedModule = await this.createMutatedModule(parentModule, moduleId);
        
        // Register new module
        this.modules.set(moduleId, mutatedModule);
        
        // Update lineage
        const newLineage = {
            parent: parentModuleId,
            generation: lineage.generation + 1,
            children: [],
            createdAt: Date.now(),
            mutations: mutatedModule.mutations,
            initialStake: this.config.seedingCost * 0.5 // Parent provides initial stake
        };
        
        this.moduleLineage.set(moduleId, newLineage);
        lineage.children.push(moduleId);
        this.moduleLineage.set(parentModuleId, lineage);
        
        // Initialize performance tracking
        this.performanceMetrics.set(moduleId, {
            tasksCompleted: 0,
            successRate: 0,
            averageExecutionTime: 0,
            resourceEfficiency: 0,
            createdAt: Date.now(),
            lastEvaluated: Date.now()
        });
        
        console.log(`🧬 Module seeded: ${moduleId} from parent ${parentModuleId}`);
        
        // Broadcast seeding event
        eventBus.emit('network:broadcast', {
            topic: '/agent-neo/evolution/seeding',
            message: {
                type: 'module_seeded',
                moduleId,
                parentModuleId,
                generation: newLineage.generation,
                mutations: mutatedModule.mutations
            }
        });
        
        this.saveEvolutionaryData();
        return mutatedModule;
    }
    
    async createMutatedModule(parentModule, newModuleId) {
        const sourceCode = parentModule.source || parentModule.code;
        if (!sourceCode) {
            throw new Error('Parent module has no source code to mutate');
        }
        
        // Analyze code structure
        const codeAnalysis = this.analyzeCode(sourceCode);
        
        // Select mutation strategy based on code analysis
        const strategy = this.selectMutationStrategy(codeAnalysis);
        
        // Apply mutations
        const mutatedCode = await this.applyMutations(sourceCode, strategy);
        
        // Create new module metadata
        const mutatedModule = {
            id: newModuleId,
            name: `${parentModule.name}_mutated_${Date.now()}`,
            version: '1.0.0',
            source: mutatedCode,
            parent: parentModule.id,
            mutations: strategy.mutations,
            capabilities: [...parentModule.capabilities], // Inherit capabilities
            createdAt: Date.now(),
            status: 'testing'
        };
        
        // Validate mutated code
        const validation = await this.validateMutatedCode(mutatedCode);
        if (!validation.safe) {
            throw new Error(`Unsafe mutation detected: ${validation.issues.join(', ')}`);
        }
        
        return mutatedModule;
    }
    
    analyzeCode(sourceCode) {
        const analysis = {
            functions: [],
            classes: [],
            variables: [],
            methods: [],
            complexity: 0,
            patterns: new Map()
        };
        
        // Extract code patterns
        for (const [patternName, regex] of this.codePatterns) {
            const matches = [...sourceCode.matchAll(regex)];
            analysis.patterns.set(patternName, matches);
            
            switch (patternName) {
                case 'function_declaration':
                    analysis.functions = matches.map(m => m[1]);
                    break;
                case 'class_declaration':
                    analysis.classes = matches.map(m => m[1]);
                    break;
                case 'variable_declaration':
                    analysis.variables = matches.map(m => m[1]);
                    break;
                case 'method_call':
                    analysis.methods = matches.map(m => m[1]);
                    break;
            }
        }
        
        // Calculate complexity score
        analysis.complexity = this.calculateComplexity(sourceCode);
        
        return analysis;
    }
    
    calculateComplexity(code) {
        // Simple complexity metric based on control structures
        const controlStructures = [
            /\bif\s*\(/g,
            /\bfor\s*\(/g,
            /\bwhile\s*\(/g,
            /\bswitch\s*\(/g,
            /\btry\s*{/g,
            /\bcatch\s*\(/g
        ];
        
        let complexity = 1; // Base complexity
        
        for (const pattern of controlStructures) {
            const matches = code.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }
    
    selectMutationStrategy(codeAnalysis) {
        const strategies = [];
        
        // Parameter tweaking if numerical values present
        if (codeAnalysis.patterns.get('variable_declaration')?.length > 0) {
            strategies.push('parameter_tweaking');
        }
        
        // Logic branching if conditionals present
        if (codeAnalysis.complexity > 3) {
            strategies.push('logic_branching');
        }
        
        // Function composition if multiple functions
        if (codeAnalysis.functions.length > 1) {
            strategies.push('function_composition');
        }
        
        // Select strategy based on success rates
        let bestStrategy = 'parameter_tweaking'; // Default
        let bestScore = 0;
        
        for (const strategy of strategies) {
            const info = this.mutationStrategies.get(strategy);
            const score = info.successRate * (1 - this.getRiskPenalty(info.risk));
            if (score > bestScore) {
                bestScore = score;
                bestStrategy = strategy;
            }
        }
        
        return {
            type: bestStrategy,
            mutations: [],
            riskLevel: this.mutationStrategies.get(bestStrategy).risk
        };
    }
    
    getRiskPenalty(riskLevel) {
        const penalties = { low: 0, medium: 0.2, high: 0.5 };
        return penalties[riskLevel] || 0;
    }
    
    async applyMutations(sourceCode, strategy) {
        let mutatedCode = sourceCode;
        const mutations = [];
        
        const templates = this.mutationTemplates.get(strategy.type);
        if (!templates) {
            console.warn(`No mutation templates found for strategy: ${strategy.type}`);
            return sourceCode;
        }
        
        // Apply mutations based on strategy
        for (const [templateName, template] of Object.entries(templates)) {
            if (Math.random() < this.config.mutationProbability) {
                const originalCode = mutatedCode;
                mutatedCode = mutatedCode.replace(template.pattern, (match, ...args) => {
                    const mutatedValue = template.mutator(match, ...args);
                    mutations.push({
                        type: templateName,
                        original: match,
                        mutated: mutatedValue,
                        position: originalCode.indexOf(match)
                    });
                    return mutatedValue;
                });
            }
        }
        
        strategy.mutations = mutations;
        return mutatedCode;
    }
    
    async validateMutatedCode(code) {
        const validation = {
            safe: true,
            issues: [],
            warnings: []
        };
        
        // Check for dangerous patterns
        const dangerousPatterns = [
            /eval\s*\(/g,
            /Function\s*\(/g,
            /document\.write/g,
            /innerHTML\s*=/g,
            /outerHTML\s*=/g,
            /exec\s*\(/g
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(code)) {
                validation.safe = false;
                validation.issues.push(`Dangerous pattern detected: ${pattern.toString()}`);
            }
        }
        
        // Check for infinite loops (basic heuristic)
        if (/while\s*\(\s*true\s*\)/.test(code) && !/break/.test(code)) {
            validation.safe = false;
            validation.issues.push('Potential infinite loop detected');
        }
        
        // Syntax validation
        try {
            new Function(code);
        } catch (error) {
            validation.safe = false;
            validation.issues.push(`Syntax error: ${error.message}`);
        }
        
        return validation;
    }
    
    async extractSkillFromExecution(executionData) {
        const { taskId, toolSequence, success, executionTime, resourceUsage } = executionData;
        
        // Only extract skills from successful executions
        if (!success || toolSequence.length < 2) {
            return;
        }
        
        // Create skill signature
        const skillSignature = this.createSkillSignature(toolSequence);
        
        // Check if skill already exists
        let skill = this.learnedSkills.get(skillSignature);
        if (!skill) {
            skill = {
                id: skillSignature,
                name: `skill_${Date.now()}`,
                toolSequence: toolSequence,
                parameters: this.extractParameters(toolSequence),
                createdAt: Date.now(),
                usageCount: 0,
                successRate: 0,
                averageExecutionTime: 0,
                averageResourceUsage: 0
            };
            this.learnedSkills.set(skillSignature, skill);
        }
        
        // Update skill statistics
        skill.usageCount++;
        skill.successRate = (skill.successRate * (skill.usageCount - 1) + 1) / skill.usageCount;
        skill.averageExecutionTime = (skill.averageExecutionTime * (skill.usageCount - 1) + executionTime) / skill.usageCount;
        skill.averageResourceUsage = (skill.averageResourceUsage * (skill.usageCount - 1) + resourceUsage) / skill.usageCount;
        
        // Extract skill if it meets threshold
        if (skill.usageCount >= this.config.skillExtractionThreshold) {
            eventBus.emit('skill:extracted', {
                skillId: skillSignature,
                skill: skill,
                extractedAt: Date.now()
            });
            
            console.log(`🔧 Skill extracted: ${skill.name} (${skill.usageCount} uses)`);
        }
        
        this.saveEvolutionaryData();
    }
    
    createSkillSignature(toolSequence) {
        // Create a unique signature based on tool sequence
        const signature = toolSequence.map(tool => `${tool.name}:${tool.action}`).join('-');
        return `skill_${this.hashString(signature)}`;
    }
    
    extractParameters(toolSequence) {
        const parameters = [];
        for (const tool of toolSequence) {
            if (tool.parameters) {
                for (const [key, value] of Object.entries(tool.parameters)) {
                    if (typeof value === 'string' && value.startsWith('$')) {
                        // This is a parameter placeholder
                        parameters.push({
                            name: key,
                            type: 'string',
                            placeholder: value
                        });
                    }
                }
            }
        }
        return parameters;
    }
    
    async createSkillChain(chainData) {
        const { skills, name, description } = chainData;
        
        if (skills.length > this.config.maxSkillChainLength) {
            throw new Error('Skill chain too long');
        }
        
        // Validate all skills exist
        for (const skillId of skills) {
            if (!this.learnedSkills.has(skillId)) {
                throw new Error(`Skill not found: ${skillId}`);
            }
        }
        
        const chainId = `chain_${Date.now()}`;
        const skillChain = {
            id: chainId,
            name: name || `Chain_${Date.now()}`,
            description: description || 'Auto-generated skill chain',
            skills: skills,
            createdAt: Date.now(),
            usageCount: 0,
            successRate: 0,
            averageExecutionTime: 0
        };
        
        this.skillChains.set(chainId, skillChain);
        
        console.log(`⛓️ Skill chain created: ${skillChain.name} (${skills.length} skills)`);
        
        eventBus.emit('skill:chain-created', {
            chainId,
            skillChain
        });
        
        this.saveEvolutionaryData();
        return chainId;
    }
    
    async recordPerformance(performanceData) {
        const { moduleId, success, executionTime, resourceUsage, taskComplexity } = performanceData;
        
        let metrics = this.performanceMetrics.get(moduleId);
        if (!metrics) {
            metrics = {
                tasksCompleted: 0,
                successRate: 0,
                averageExecutionTime: 0,
                resourceEfficiency: 0,
                createdAt: Date.now(),
                lastEvaluated: Date.now()
            };
            this.performanceMetrics.set(moduleId, metrics);
        }
        
        // Update metrics
        metrics.tasksCompleted++;
        metrics.successRate = (metrics.successRate * (metrics.tasksCompleted - 1) + (success ? 1 : 0)) / metrics.tasksCompleted;
        metrics.averageExecutionTime = (metrics.averageExecutionTime * (metrics.tasksCompleted - 1) + executionTime) / metrics.tasksCompleted;
        
        // Calculate resource efficiency (inverse of resource usage)
        const efficiency = 1 / (1 + resourceUsage);
        metrics.resourceEfficiency = (metrics.resourceEfficiency * (metrics.tasksCompleted - 1) + efficiency) / metrics.tasksCompleted;
        
        // Calculate evolutionary fitness
        const fitness = (metrics.successRate * 0.5) + (metrics.resourceEfficiency * 0.3) + (1 / (1 + metrics.averageExecutionTime / 1000) * 0.2);
        this.evolutionaryFitness.set(moduleId, fitness);
        
        // Check for promotion opportunities
        if (metrics.tasksCompleted > 10 && fitness > 0.8) {
            eventBus.emit('evolution:promote', { moduleId, fitness });
        }
    }
    
    async pruneUnderperformers() {
        const currentTime = Date.now();
        const modulesToPrune = [];
        
        for (const [moduleId, metrics] of this.performanceMetrics) {
            // Check if module has had enough evaluation time
            if (currentTime - metrics.createdAt < this.config.evaluationPeriod) {
                continue;
            }
            
            const fitness = this.evolutionaryFitness.get(moduleId) || 0;
            
            // Prune if below survival threshold
            if (fitness < this.config.survivalThreshold && metrics.tasksCompleted > 5) {
                modulesToPrune.push(moduleId);
            }
        }
        
        // Remove underperforming modules
        for (const moduleId of modulesToPrune) {
            this.modules.delete(moduleId);
            this.performanceMetrics.delete(moduleId);
            this.evolutionaryFitness.delete(moduleId);
            
            // Update lineage
            const lineage = this.moduleLineage.get(moduleId);
            if (lineage && lineage.parent) {
                const parentLineage = this.moduleLineage.get(lineage.parent);
                if (parentLineage) {
                    parentLineage.children = parentLineage.children.filter(id => id !== moduleId);
                }
            }
            
            console.log(`🗑️ Pruned underperforming module: ${moduleId}`);
        }
        
        if (modulesToPrune.length > 0) {
            eventBus.emit('evolution:pruned', {
                prunedModules: modulesToPrune,
                remainingModules: this.modules.size
            });
        }
    }
    
    hashString(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
    
    saveEvolutionaryData() {
        try {
            const data = {
                lineage: Array.from(this.moduleLineage.entries()),
                skills: Array.from(this.learnedSkills.entries()),
                chains: Array.from(this.skillChains.entries()),
                timestamp: Date.now()
            };
            localStorage.setItem('agent-neo-evolution-data', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save evolutionary data:', error);
        }
    }
    
    startEvolutionaryProcesses() {
        // Periodic pruning of underperformers
        setInterval(() => {
            this.pruneUnderperformers();
        }, this.config.evaluationPeriod);
        
        // Periodic skill extraction analysis
        setInterval(() => {
            this.analyzeSkillExtractionOpportunities();
        }, 300000); // Every 5 minutes
    }
    
    analyzeSkillExtractionOpportunities() {
        // This would analyze recent task executions to identify patterns
        // that could become new skills
        console.log('🔍 Analyzing skill extraction opportunities...');
    }
    
    // Public API methods
    getModuleLineage(moduleId) {
        return this.moduleLineage.get(moduleId);
    }
    
    getLearnedSkills() {
        return Array.from(this.learnedSkills.values());
    }
    
    getSkillChains() {
        return Array.from(this.skillChains.values());
    }
    
    getEvolutionaryStats() {
        return {
            totalModules: this.modules.size,
            totalSkills: this.learnedSkills.size,
            totalChains: this.skillChains.size,
            averageFitness: this.calculateAverageFitness(),
            generationSpread: this.calculateGenerationSpread()
        };
    }
    
    calculateAverageFitness() {
        const fitnessValues = Array.from(this.evolutionaryFitness.values());
        if (fitnessValues.length === 0) return 0;
        return fitnessValues.reduce((sum, fitness) => sum + fitness, 0) / fitnessValues.length;
    }
    
    calculateGenerationSpread() {
        const generations = Array.from(this.moduleLineage.values()).map(lineage => lineage.generation);
        if (generations.length === 0) return { min: 0, max: 0, average: 0 };
        
        return {
            min: Math.min(...generations),
            max: Math.max(...generations),
            average: generations.reduce((sum, gen) => sum + gen, 0) / generations.length
        };
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            modules: this.modules.size,
            skills: this.learnedSkills.size,
            chains: this.skillChains.size,
            evolutionaryStats: this.getEvolutionaryStats()
        };
    }
}

export default ModuleSeedingSystem;