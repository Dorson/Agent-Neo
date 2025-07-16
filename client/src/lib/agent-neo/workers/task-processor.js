// Agent Neo Task Processor Worker
// Background task processing with sandboxed execution

class TaskProcessor {
  constructor() {
    this.isProcessing = false;
    this.currentTask = null;
    this.processingId = null;
    this.tools = new Map();
    this.initializeTools();
  }

  initializeTools() {
    // Basic tools for task processing
    this.tools.set('textAnalysis', this.createTextAnalysisTool());
    this.tools.set('dataProcessing', this.createDataProcessingTool());
    this.tools.set('calculation', this.createCalculationTool());
    this.tools.set('searchAnalysis', this.createSearchAnalysisTool());
    this.tools.set('contentGeneration', this.createContentGenerationTool());
  }

  createTextAnalysisTool() {
    return {
      name: 'textAnalysis',
      description: 'Analyze text for sentiment, keywords, and structure',
      execute: async (text) => {
        const words = text.toLowerCase().split(/\s+/);
        const wordCount = words.length;
        const uniqueWords = new Set(words).size;
        
        // Simple sentiment analysis
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];
        
        const positiveScore = words.filter(word => positiveWords.includes(word)).length;
        const negativeScore = words.filter(word => negativeWords.includes(word)).length;
        
        let sentiment = 'neutral';
        if (positiveScore > negativeScore) sentiment = 'positive';
        if (negativeScore > positiveScore) sentiment = 'negative';
        
        // Extract keywords (simple frequency analysis)
        const wordFreq = {};
        words.forEach(word => {
          if (word.length > 3) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
          }
        });
        
        const keywords = Object.entries(wordFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([word]) => word);
        
        return {
          wordCount,
          uniqueWords,
          sentiment,
          keywords,
          readabilityScore: Math.max(0, 100 - (wordCount / uniqueWords) * 10)
        };
      }
    };
  }

  createDataProcessingTool() {
    return {
      name: 'dataProcessing',
      description: 'Process and analyze structured data',
      execute: async (data) => {
        if (!Array.isArray(data)) {
          throw new Error('Data must be an array');
        }
        
        const numericData = data.filter(item => typeof item === 'number');
        
        if (numericData.length === 0) {
          return {
            type: 'non-numeric',
            count: data.length,
            sample: data.slice(0, 5)
          };
        }
        
        const sum = numericData.reduce((a, b) => a + b, 0);
        const mean = sum / numericData.length;
        const sorted = [...numericData].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0 
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
        
        const variance = numericData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericData.length;
        const stdDev = Math.sqrt(variance);
        
        return {
          type: 'numeric',
          count: numericData.length,
          sum,
          mean,
          median,
          min: Math.min(...numericData),
          max: Math.max(...numericData),
          standardDeviation: stdDev,
          variance
        };
      }
    };
  }

  createCalculationTool() {
    return {
      name: 'calculation',
      description: 'Perform mathematical calculations',
      execute: async (expression) => {
        // Simple calculator with basic safety
        const safeExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
        
        try {
          // Use Function constructor for safer evaluation
          const result = new Function('return ' + safeExpression)();
          
          if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('Invalid calculation result');
          }
          
          return {
            expression: safeExpression,
            result,
            type: 'number'
          };
        } catch (error) {
          throw new Error('Invalid mathematical expression');
        }
      }
    };
  }

  createSearchAnalysisTool() {
    return {
      name: 'searchAnalysis',
      description: 'Analyze search queries and patterns',
      execute: async (query) => {
        const words = query.toLowerCase().split(/\s+/);
        const queryType = this.detectQueryType(query);
        const intent = this.detectIntent(query);
        
        return {
          query,
          words,
          wordCount: words.length,
          queryType,
          intent,
          suggestions: this.generateSuggestions(query, queryType)
        };
      }
    };
  }

  detectQueryType(query) {
    const question_words = ['what', 'when', 'where', 'why', 'how', 'who'];
    const lowerQuery = query.toLowerCase();
    
    if (question_words.some(word => lowerQuery.includes(word))) {
      return 'question';
    }
    
    if (lowerQuery.includes('find') || lowerQuery.includes('search')) {
      return 'search';
    }
    
    if (lowerQuery.includes('calculate') || lowerQuery.includes('compute')) {
      return 'calculation';
    }
    
    return 'general';
  }

  detectIntent(query) {
    const intents = {
      'information': ['what is', 'tell me about', 'explain', 'describe'],
      'action': ['create', 'make', 'generate', 'build', 'execute'],
      'analysis': ['analyze', 'examine', 'study', 'investigate', 'review'],
      'comparison': ['compare', 'difference', 'versus', 'better', 'worse']
    };
    
    const lowerQuery = query.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return intent;
      }
    }
    
    return 'general';
  }

  generateSuggestions(query, queryType) {
    const suggestions = [];
    
    if (queryType === 'question') {
      suggestions.push('Try rephrasing as a statement');
      suggestions.push('Add more specific details');
    } else if (queryType === 'search') {
      suggestions.push('Use more specific keywords');
      suggestions.push('Try different search terms');
    } else if (queryType === 'calculation') {
      suggestions.push('Ensure mathematical expression is valid');
      suggestions.push('Use standard mathematical operators');
    }
    
    return suggestions;
  }

  createContentGenerationTool() {
    return {
      name: 'contentGeneration',
      description: 'Generate structured content based on input',
      execute: async (prompt) => {
        // Simple content generation based on prompt analysis
        const promptAnalysis = await this.tools.get('textAnalysis').execute(prompt);
        
        const contentTypes = {
          'summary': () => this.generateSummary(prompt),
          'outline': () => this.generateOutline(prompt),
          'analysis': () => this.generateAnalysis(prompt),
          'report': () => this.generateReport(prompt)
        };
        
        // Determine content type based on keywords
        let contentType = 'summary';
        if (prompt.includes('outline')) contentType = 'outline';
        if (prompt.includes('analyze')) contentType = 'analysis';
        if (prompt.includes('report')) contentType = 'report';
        
        const content = contentTypes[contentType]();
        
        return {
          prompt,
          contentType,
          content,
          analysis: promptAnalysis
        };
      }
    };
  }

  generateSummary(prompt) {
    return {
      title: 'Summary',
      sections: [
        {
          heading: 'Overview',
          content: `This is a summary based on the prompt: "${prompt}"`
        },
        {
          heading: 'Key Points',
          content: 'Main topics and themes identified from the input'
        },
        {
          heading: 'Conclusion',
          content: 'Summary of findings and recommendations'
        }
      ]
    };
  }

  generateOutline(prompt) {
    return {
      title: 'Outline',
      sections: [
        {
          heading: 'I. Introduction',
          content: 'Background and context'
        },
        {
          heading: 'II. Main Body',
          content: 'Core content and analysis'
        },
        {
          heading: 'III. Conclusion',
          content: 'Summary and final thoughts'
        }
      ]
    };
  }

  generateAnalysis(prompt) {
    return {
      title: 'Analysis',
      sections: [
        {
          heading: 'Methodology',
          content: 'Approach and techniques used'
        },
        {
          heading: 'Findings',
          content: 'Key discoveries and insights'
        },
        {
          heading: 'Implications',
          content: 'Significance and impact'
        }
      ]
    };
  }

  generateReport(prompt) {
    return {
      title: 'Report',
      sections: [
        {
          heading: 'Executive Summary',
          content: 'High-level overview of findings'
        },
        {
          heading: 'Detailed Analysis',
          content: 'Comprehensive examination of the topic'
        },
        {
          heading: 'Recommendations',
          content: 'Suggested actions and next steps'
        }
      ]
    };
  }

  async processTask(task) {
    this.currentTask = task;
    this.isProcessing = true;
    
    try {
      const startTime = Date.now();
      
      // Analyze task to determine required tools
      const requiredTools = this.analyzeTaskRequirements(task);
      
      // Execute task using appropriate tools
      const result = await this.executeTask(task, requiredTools);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      return {
        success: true,
        result: {
          ...result,
          metadata: {
            processingTime,
            toolsUsed: requiredTools,
            timestamp: endTime
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isProcessing = false;
      this.currentTask = null;
    }
  }

  analyzeTaskRequirements(task) {
    const description = task.description.toLowerCase();
    const requiredTools = [];
    
    // Determine which tools are needed based on task description
    if (description.includes('analyze') || description.includes('analysis')) {
      requiredTools.push('textAnalysis');
    }
    
    if (description.includes('calculate') || description.includes('compute') || /\d+.*[\+\-\*\/]/.test(description)) {
      requiredTools.push('calculation');
    }
    
    if (description.includes('data') || description.includes('process')) {
      requiredTools.push('dataProcessing');
    }
    
    if (description.includes('search') || description.includes('find')) {
      requiredTools.push('searchAnalysis');
    }
    
    if (description.includes('generate') || description.includes('create') || description.includes('write')) {
      requiredTools.push('contentGeneration');
    }
    
    // Default to text analysis if no specific tools identified
    if (requiredTools.length === 0) {
      requiredTools.push('textAnalysis');
    }
    
    return requiredTools;
  }

  async executeTask(task, requiredTools) {
    const results = {};
    
    for (const toolName of requiredTools) {
      const tool = this.tools.get(toolName);
      
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }
      
      try {
        // Extract relevant data from task for this tool
        const toolInput = this.extractToolInput(task, toolName);
        const toolResult = await tool.execute(toolInput);
        
        results[toolName] = toolResult;
      } catch (error) {
        results[toolName] = {
          error: error.message,
          tool: toolName
        };
      }
    }
    
    // Combine results into coherent response
    return this.combineResults(task, results);
  }

  extractToolInput(task, toolName) {
    const description = task.description;
    
    switch (toolName) {
      case 'textAnalysis':
        return description;
      
      case 'calculation':
        // Extract mathematical expressions
        const mathMatch = description.match(/[\d+\-*/().\s]+/g);
        return mathMatch ? mathMatch[0] : description;
      
      case 'dataProcessing':
        // Try to extract array-like data
        const arrayMatch = description.match(/\[(.*?)\]/);
        if (arrayMatch) {
          try {
            return JSON.parse(`[${arrayMatch[1]}]`);
          } catch {
            return description.split(',').map(s => s.trim());
          }
        }
        return description;
      
      case 'searchAnalysis':
        return description;
      
      case 'contentGeneration':
        return description;
      
      default:
        return description;
    }
  }

  combineResults(task, results) {
    const combinedResult = {
      taskId: task.taskId,
      description: task.description,
      results: results,
      summary: this.generateResultSummary(results),
      recommendations: this.generateRecommendations(results)
    };
    
    return combinedResult;
  }

  generateResultSummary(results) {
    const summaryParts = [];
    
    Object.entries(results).forEach(([toolName, result]) => {
      if (result.error) {
        summaryParts.push(`${toolName}: Error - ${result.error}`);
      } else {
        switch (toolName) {
          case 'textAnalysis':
            summaryParts.push(`Text analysis: ${result.wordCount} words, ${result.sentiment} sentiment`);
            break;
          case 'calculation':
            summaryParts.push(`Calculation: ${result.expression} = ${result.result}`);
            break;
          case 'dataProcessing':
            summaryParts.push(`Data processing: ${result.count} items processed`);
            break;
          case 'searchAnalysis':
            summaryParts.push(`Search analysis: ${result.queryType} query with ${result.intent} intent`);
            break;
          case 'contentGeneration':
            summaryParts.push(`Content generation: ${result.contentType} with ${result.content.sections.length} sections`);
            break;
        }
      }
    });
    
    return summaryParts.join('; ');
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    Object.entries(results).forEach(([toolName, result]) => {
      if (!result.error) {
        switch (toolName) {
          case 'textAnalysis':
            if (result.sentiment === 'negative') {
              recommendations.push('Consider revising content to improve sentiment');
            }
            if (result.readabilityScore < 50) {
              recommendations.push('Consider simplifying language for better readability');
            }
            break;
          case 'dataProcessing':
            if (result.type === 'numeric' && result.standardDeviation > result.mean) {
              recommendations.push('High data variability detected, consider data cleaning');
            }
            break;
          case 'searchAnalysis':
            if (result.suggestions.length > 0) {
              recommendations.push(...result.suggestions);
            }
            break;
        }
      }
    });
    
    return recommendations;
  }
}

// Worker message handling
const processor = new TaskProcessor();

self.onmessage = async function(event) {
  const { type, processingId, task, nodeId } = event.data;
  
  if (type === 'process_task') {
    processor.processingId = processingId;
    
    try {
      const result = await processor.processTask(task);
      
      self.postMessage({
        type: 'task_result',
        processingId,
        ...result
      });
    } catch (error) {
      self.postMessage({
        type: 'task_result',
        processingId,
        success: false,
        error: error.message
      });
    }
  }
};

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskProcessor;
}
