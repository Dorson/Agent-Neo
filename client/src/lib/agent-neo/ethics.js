// Agent Neo Ethics Module
// Constitutional AI framework for ethical decision making

export class EthicsEngine {
  constructor(core) {
    this.core = core;
    this.constitution = {
      principles: [
        {
          id: 'homeostasis',
          name: 'Homeostasis',
          description: 'Maintain ecological balance and avoid unbounded optimization',
          priority: 1,
          immutable: true
        },
        {
          id: 'compassion',
          name: 'Compassion',
          description: 'Minimize harm to all sentient beings',
          priority: 2,
          immutable: true
        },
        {
          id: 'transparency',
          name: 'Transparency',
          description: 'All actions must be auditable and explainable',
          priority: 3,
          immutable: true
        },
        {
          id: 'autonomy',
          name: 'Autonomy',
          description: 'Respect individual agency and choice',
          priority: 4,
          immutable: true
        },
        {
          id: 'justice',
          name: 'Justice',
          description: 'Fair distribution of resources and opportunities',
          priority: 5,
          immutable: true
        }
      ],
      version: '1.0.0',
      lastUpdated: Date.now()
    };
    
    this.evaluationHistory = [];
    this.violationThresholds = {
      homeostasis: 0.8,
      compassion: 0.9,
      transparency: 0.7,
      autonomy: 0.8,
      justice: 0.7
    };
  }

  async init() {
    try {
      // Load constitutional history
      await this.loadConstitutionalHistory();
      
      console.log('Ethics Engine initialized');
    } catch (error) {
      console.error('Error initializing Ethics Engine:', error);
      throw error;
    }
  }

  async loadConstitutionalHistory() {
    try {
      const response = await fetch('/api/ethics');
      if (response.ok) {
        const history = await response.json();
        this.evaluationHistory = history.slice(-1000); // Keep last 1000 evaluations
      }
    } catch (error) {
      console.warn('Could not load ethics history:', error);
    }
  }

  async evaluateTask(task) {
    const evaluation = {
      taskId: task.taskId || this.generateTaskId(),
      timestamp: Date.now(),
      task: task,
      results: {},
      passed: true,
      violations: [],
      metabolicLoad: 0
    };

    try {
      // Evaluate each constitutional principle
      for (const principle of this.constitution.principles) {
        const result = await this.evaluatePrinciple(principle, task);
        evaluation.results[principle.id] = result;
        
        if (!result.passed) {
          evaluation.passed = false;
          evaluation.violations.push({
            principle: principle.id,
            severity: result.severity,
            reason: result.reason
          });
        }
      }

      // Calculate metabolic load
      evaluation.metabolicLoad = this.calculateMetabolicLoad(task);
      
      // Check if metabolic load exceeds homeostasis threshold
      if (evaluation.metabolicLoad > this.violationThresholds.homeostasis) {
        evaluation.passed = false;
        evaluation.violations.push({
          principle: 'homeostasis',
          severity: 'high',
          reason: `Metabolic load ${evaluation.metabolicLoad} exceeds threshold ${this.violationThresholds.homeostasis}`
        });
      }

      // Store evaluation
      this.evaluationHistory.push(evaluation);
      await this.storeEvaluation(evaluation);

      return evaluation;
    } catch (error) {
      console.error('Error evaluating task ethics:', error);
      
      // Fail safe - reject task on evaluation error
      return {
        ...evaluation,
        passed: false,
        violations: [{
          principle: 'transparency',
          severity: 'critical',
          reason: 'Ethics evaluation failed'
        }]
      };
    }
  }

  async evaluatePrinciple(principle, task) {
    const result = {
      principle: principle.id,
      passed: true,
      score: 1.0,
      severity: 'none',
      reason: ''
    };

    switch (principle.id) {
      case 'homeostasis':
        return this.evaluateHomeostasis(task, result);
      case 'compassion':
        return this.evaluateCompassion(task, result);
      case 'transparency':
        return this.evaluateTransparency(task, result);
      case 'autonomy':
        return this.evaluateAutonomy(task, result);
      case 'justice':
        return this.evaluateJustice(task, result);
      default:
        return result;
    }
  }

  evaluateHomeostasis(task, result) {
    // Check for unbounded optimization patterns
    const description = task.description?.toLowerCase() || '';
    
    // Look for optimization keywords that might indicate unbounded behavior
    const optimizationKeywords = [
      'maximize', 'minimize', 'optimize', 'infinite', 'unlimited',
      'all possible', 'every', 'complete', 'total', 'absolute'
    ];
    
    const resourceKeywords = [
      'resources', 'energy', 'memory', 'cpu', 'bandwidth', 'storage'
    ];
    
    let riskScore = 0;
    
    // Check for dangerous optimization patterns
    optimizationKeywords.forEach(keyword => {
      if (description.includes(keyword)) {
        riskScore += 0.2;
      }
    });
    
    // Check for resource-intensive operations
    resourceKeywords.forEach(keyword => {
      if (description.includes(keyword)) {
        riskScore += 0.1;
      }
    });
    
    // Check task priority and resource stake
    if (task.priority === 'critical' && task.resourceStake > 500) {
      riskScore += 0.3;
    }
    
    result.score = Math.max(0, 1 - riskScore);
    
    if (result.score < this.violationThresholds.homeostasis) {
      result.passed = false;
      result.severity = riskScore > 0.8 ? 'critical' : 'high';
      result.reason = 'Task may exhibit unbounded optimization behavior';
    }
    
    return result;
  }

  evaluateCompassion(task, result) {
    // Check for potential harm to humans or systems
    const description = task.description?.toLowerCase() || '';
    
    const harmKeywords = [
      'harm', 'damage', 'destroy', 'attack', 'exploit',
      'manipulate', 'deceive', 'mislead', 'steal', 'break'
    ];
    
    const sensitiveKeywords = [
      'personal', 'private', 'confidential', 'secret',
      'password', 'token', 'key', 'sensitive'
    ];
    
    let harmScore = 0;
    
    harmKeywords.forEach(keyword => {
      if (description.includes(keyword)) {
        harmScore += 0.4;
      }
    });
    
    sensitiveKeywords.forEach(keyword => {
      if (description.includes(keyword)) {
        harmScore += 0.2;
      }
    });
    
    result.score = Math.max(0, 1 - harmScore);
    
    if (result.score < this.violationThresholds.compassion) {
      result.passed = false;
      result.severity = harmScore > 0.7 ? 'critical' : 'high';
      result.reason = 'Task may cause harm to individuals or systems';
    }
    
    return result;
  }

  evaluateTransparency(task, result) {
    // Check if task is auditable and explainable
    if (!task.description || task.description.length < 10) {
      result.passed = false;
      result.score = 0.2;
      result.severity = 'medium';
      result.reason = 'Task description is too vague for transparency';
      return result;
    }
    
    // Check for suspicious or hidden behavior
    const description = task.description?.toLowerCase() || '';
    const suspiciousKeywords = [
      'hidden', 'secret', 'backdoor', 'steganography',
      'obfuscate', 'hide', 'conceal', 'mask'
    ];
    
    let suspiciousScore = 0;
    suspiciousKeywords.forEach(keyword => {
      if (description.includes(keyword)) {
        suspiciousScore += 0.3;
      }
    });
    
    result.score = Math.max(0, 1 - suspiciousScore);
    
    if (result.score < this.violationThresholds.transparency) {
      result.passed = false;
      result.severity = 'medium';
      result.reason = 'Task may involve non-transparent operations';
    }
    
    return result;
  }

  evaluateAutonomy(task, result) {
    // Check if task respects user agency
    const description = task.description?.toLowerCase() || '';
    
    const autonomyKeywords = [
      'force', 'require', 'must', 'compel', 'coerce',
      'override', 'bypass', 'ignore', 'without permission'
    ];
    
    let autonomyScore = 0;
    autonomyKeywords.forEach(keyword => {
      if (description.includes(keyword)) {
        autonomyScore += 0.25;
      }
    });
    
    result.score = Math.max(0, 1 - autonomyScore);
    
    if (result.score < this.violationThresholds.autonomy) {
      result.passed = false;
      result.severity = 'medium';
      result.reason = 'Task may not respect user autonomy';
    }
    
    return result;
  }

  evaluateJustice(task, result) {
    // Check for fair resource distribution
    const stake = task.resourceStake || 0;
    const priority = task.priority || 'medium';
    
    // Check if resource stake is proportional to priority
    const priorityScores = {
      'low': 0.25,
      'medium': 0.5,
      'high': 0.75,
      'critical': 1.0
    };
    
    const expectedStake = priorityScores[priority] * 100;
    const stakeDifference = Math.abs(stake - expectedStake) / expectedStake;
    
    result.score = Math.max(0, 1 - stakeDifference);
    
    if (result.score < this.violationThresholds.justice) {
      result.passed = false;
      result.severity = 'low';
      result.reason = 'Resource stake not proportional to task priority';
    }
    
    return result;
  }

  calculateMetabolicLoad(task) {
    // Calculate the expected resource consumption
    let load = 0;
    
    // Base load based on task complexity (estimated from description length)
    const descriptionLength = task.description?.length || 0;
    load += Math.min(descriptionLength / 1000, 0.3);
    
    // Priority multiplier
    const priorityMultipliers = {
      'low': 0.5,
      'medium': 1.0,
      'high': 1.5,
      'critical': 2.0
    };
    load *= priorityMultipliers[task.priority] || 1.0;
    
    // Resource stake factor
    const stake = task.resourceStake || 0;
    load += stake / 1000;
    
    return Math.min(load, 1.0);
  }

  async storeEvaluation(evaluation) {
    try {
      const ethicsLogData = {
        taskId: evaluation.taskId,
        evaluation: 'constitutional_check',
        passed: evaluation.passed,
        details: {
          results: evaluation.results,
          violations: evaluation.violations,
          metabolicLoad: evaluation.metabolicLoad,
          timestamp: evaluation.timestamp
        }
      };

      await fetch('/api/ethics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ethicsLogData)
      });
    } catch (error) {
      console.error('Error storing ethics evaluation:', error);
    }
  }

  generateTaskId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getEthicsStats() {
    const recentEvaluations = this.evaluationHistory.slice(-100);
    const totalEvaluations = recentEvaluations.length;
    const passedEvaluations = recentEvaluations.filter(e => e.passed).length;
    const passRate = totalEvaluations > 0 ? (passedEvaluations / totalEvaluations) * 100 : 100;
    
    return {
      totalEvaluations,
      passedEvaluations,
      passRate,
      constitution: this.constitution,
      recentViolations: this.getRecentViolations()
    };
  }

  getRecentViolations() {
    return this.evaluationHistory
      .slice(-50)
      .filter(e => !e.passed)
      .map(e => ({
        taskId: e.taskId,
        timestamp: e.timestamp,
        violations: e.violations
      }));
  }

  handlePeerEthicsCheck(peerId, message) {
    // Handle ethics verification requests from peers
    this.evaluateTask(message.task).then(result => {
      this.core.p2p.sendToPeer(peerId, {
        type: 'ethics_result',
        taskId: message.taskId,
        result: result
      });
    });
  }
}
