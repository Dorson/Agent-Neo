import { useEffect, useState } from 'react';

declare global {
  interface Window {
    AgentNeo: {
      init: () => void;
      getMetrics: () => any;
      toggleNode: (state: boolean) => void;
      submitTask: (task: any) => void;
      updateResourceLimits: (limits: any) => void;
    };
  }
}

export default function AgentNeo() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [nodeActive, setNodeActive] = useState(true);
  const [metrics, setMetrics] = useState({
    nodeUptime: '0h 0m',
    tasksProcessed: 0,
    networkPeers: 0,
    resourceUsage: 0
  });
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    description: '',
    priority: 'medium',
    resourceStake: 50
  });
  const [resourceLimits, setResourceLimits] = useState({
    cpu: 50,
    memory: 512,
    bandwidth: 10
  });

  useEffect(() => {
    const initializeAgent = async () => {
      let attempts = 0;
      const maxAttempts = 50;
      
      // Wait for AgentNeo to be available
      while (!window.AgentNeo && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (window.AgentNeo) {
        try {
          await window.AgentNeo.init();
          updateMetrics();
        } catch (error) {
          console.error('Failed to initialize Agent Neo:', error);
        }
      }
    };

    initializeAgent();

    // Set up interval to update metrics
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateMetrics = () => {
    if (window.AgentNeo) {
      try {
        const newMetrics = window.AgentNeo.getMetrics();
        setMetrics(newMetrics);
      } catch (error) {
        console.error('Error getting metrics:', error);
      }
    }
  };

  const handleNodeToggle = (checked: boolean) => {
    setNodeActive(checked);
    if (window.AgentNeo) {
      window.AgentNeo.toggleNode(checked);
    }
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (window.AgentNeo) {
      window.AgentNeo.submitTask(newTask);
      setNewTask({ description: '', priority: 'medium', resourceStake: 50 });
    }
  };

  const handleResourceLimitChange = (type: string, value: number) => {
    const newLimits = { ...resourceLimits, [type]: value };
    setResourceLimits(newLimits);
    if (window.AgentNeo) {
      window.AgentNeo.updateResourceLimits(newLimits);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <a href="#" className="header-brand">Agent Neo</a>
        <div className="header-status">
          <div className="status-indicator">
            <div className={`status-dot ${nodeActive ? '' : 'error'}`}></div>
            <span>{nodeActive ? 'Node Active' : 'Node Inactive'}</span>
          </div>
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>Connected</span>
          </div>
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>Ethics OK</span>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-nav">
          <button 
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('dashboard')}
          >
            <span className="nav-item-icon">📊</span>
            Dashboard
          </button>
          <button 
            className={`nav-item ${activeSection === 'control' ? 'active' : ''}`}
            onClick={() => setActiveSection('control')}
          >
            <span className="nav-item-icon">🎛️</span>
            Node Control
          </button>
          <button 
            className={`nav-item ${activeSection === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveSection('tasks')}
          >
            <span className="nav-item-icon">📋</span>
            Task Processing
          </button>
          <button 
            className={`nav-item ${activeSection === 'network' ? 'active' : ''}`}
            onClick={() => setActiveSection('network')}
          >
            <span className="nav-item-icon">🌐</span>
            Network
          </button>
          <button 
            className={`nav-item ${activeSection === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveSection('metrics')}
          >
            <span className="nav-item-icon">📈</span>
            Metrics
          </button>
          <button 
            className={`nav-item ${activeSection === 'ethics' ? 'active' : ''}`}
            onClick={() => setActiveSection('ethics')}
          >
            <span className="nav-item-icon">🛡️</span>
            Ethics Module
          </button>
          <button 
            className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveSection('settings')}
          >
            <span className="nav-item-icon">⚙️</span>
            Settings
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {/* Dashboard Section */}
        {activeSection === 'dashboard' && (
          <section className="content-section active fade-in">
            <div className="section-header">
              <h1 className="section-title">Agent Neo Dashboard</h1>
              <p className="section-description">Monitor your decentralized AI agent node performance and network status</p>
            </div>

            <div className="grid grid-cols-4 mb-8">
              <div className="card">
                <div className="metric-label">Node Uptime</div>
                <div className="metric-value">{metrics.nodeUptime}</div>
                <div className="metric-change positive">+2.3% from yesterday</div>
              </div>
              <div className="card">
                <div className="metric-label">Tasks Processed</div>
                <div className="metric-value">{metrics.tasksProcessed}</div>
                <div className="metric-change positive">+12 in last hour</div>
              </div>
              <div className="card">
                <div className="metric-label">Network Peers</div>
                <div className="metric-value">{metrics.networkPeers}</div>
                <div className="metric-change positive">+3 connected</div>
              </div>
              <div className="card">
                <div className="metric-label">Resource Usage</div>
                <div className="metric-value">{metrics.resourceUsage}%</div>
                <div className="metric-change negative">+5% from average</div>
              </div>
            </div>

            <div className="grid grid-cols-2">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Recent Tasks</h3>
                  <button className="btn btn-secondary">View All</button>
                </div>
                <div className="task-item">
                  <div className="task-info">
                    <div className="task-title">Analyze market trends</div>
                    <div className="task-meta">Started 2 minutes ago • Priority: High</div>
                  </div>
                  <div className="task-status processing">Processing</div>
                </div>
                <div className="task-item">
                  <div className="task-info">
                    <div className="task-title">Generate content summary</div>
                    <div className="task-meta">Completed 5 minutes ago • Priority: Medium</div>
                  </div>
                  <div className="task-status completed">Completed</div>
                </div>
                <div className="task-item">
                  <div className="task-info">
                    <div className="task-title">Process natural language query</div>
                    <div className="task-meta">Queued 8 minutes ago • Priority: Low</div>
                  </div>
                  <div className="task-status pending">Pending</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Network Activity</h3>
                  <button className="btn btn-secondary">Details</button>
                </div>
                <div className="mb-4">
                  <div className="metric-label">Active Connections</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: '68%' }}></div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span style={{ color: 'var(--primary-400)', fontSize: '12px' }}>0</span>
                    <span style={{ color: 'var(--primary-400)', fontSize: '12px' }}>68/100</span>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="metric-label">Data Throughput</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: '42%' }}></div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span style={{ color: 'var(--primary-400)', fontSize: '12px' }}>2.1 MB/s</span>
                    <span style={{ color: 'var(--primary-400)', fontSize: '12px' }}>5.0 MB/s</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="network-node"></div>
                  <div className="network-node"></div>
                  <div className="network-node"></div>
                  <div className="network-node warning"></div>
                  <div className="network-node"></div>
                  <div className="network-node"></div>
                  <div className="network-node offline"></div>
                  <div className="network-node"></div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Node Control Section */}
        {activeSection === 'control' && (
          <section className="content-section active">
            <div className="section-header">
              <h1 className="section-title">Node Control</h1>
              <p className="section-description">Start, stop, and configure your Agent Neo node</p>
            </div>

            <div className="grid grid-cols-2">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Node Status</h3>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={nodeActive}
                      onChange={(e) => handleNodeToggle(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="mb-4">
                  <div className="metric-label">Current State</div>
                  <div className="metric-value" style={{ fontSize: '24px', color: nodeActive ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                    {nodeActive ? 'ACTIVE' : 'INACTIVE'}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="metric-label">Last Started</div>
                  <div style={{ color: 'var(--primary-300)' }}>Today at 09:23 AM</div>
                </div>
                <div className="flex gap-4">
                  <button className="btn btn-primary" onClick={() => handleNodeToggle(true)}>Start Node</button>
                  <button className="btn btn-warning" onClick={() => handleNodeToggle(false)}>Pause Node</button>
                  <button className="btn btn-danger" onClick={() => handleNodeToggle(false)}>Stop Node</button>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Resource Limits</h3>
                </div>
                <div className="form-group">
                  <label className="form-label">CPU Usage Limit (%)</label>
                  <input 
                    type="range" 
                    className="form-input" 
                    min="10" 
                    max="100" 
                    value={resourceLimits.cpu}
                    onChange={(e) => handleResourceLimitChange('cpu', parseInt(e.target.value))}
                  />
                  <div className="text-right" style={{ color: 'var(--primary-400)', fontSize: '12px' }}>{resourceLimits.cpu}%</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Memory Usage Limit (MB)</label>
                  <input 
                    type="range" 
                    className="form-input" 
                    min="64" 
                    max="2048" 
                    value={resourceLimits.memory}
                    onChange={(e) => handleResourceLimitChange('memory', parseInt(e.target.value))}
                  />
                  <div className="text-right" style={{ color: 'var(--primary-400)', fontSize: '12px' }}>{resourceLimits.memory} MB</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Network Bandwidth (Mbps)</label>
                  <input 
                    type="range" 
                    className="form-input" 
                    min="1" 
                    max="100" 
                    value={resourceLimits.bandwidth}
                    onChange={(e) => handleResourceLimitChange('bandwidth', parseInt(e.target.value))}
                  />
                  <div className="text-right" style={{ color: 'var(--primary-400)', fontSize: '12px' }}>{resourceLimits.bandwidth} Mbps</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Task Processing Section */}
        {activeSection === 'tasks' && (
          <section className="content-section active">
            <div className="section-header">
              <h1 className="section-title">Task Processing</h1>
              <p className="section-description">Monitor and manage task processing and auction system</p>
            </div>

            <div className="grid grid-cols-2">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Submit New Task</h3>
                </div>
                <form onSubmit={handleSubmitTask}>
                  <div className="form-group">
                    <label className="form-label">Task Description</label>
                    <textarea 
                      className="form-input" 
                      rows={3} 
                      placeholder="Describe the task you want to process..."
                      value={newTask.description}
                      onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority Level</label>
                    <select 
                      className="form-select"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Resource Commitment</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Enter resource stake amount" 
                      min="1" 
                      max="1000" 
                      value={newTask.resourceStake}
                      onChange={(e) => setNewTask({...newTask, resourceStake: parseInt(e.target.value)})}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-full">Submit Task</button>
                </form>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Task Queue</h3>
                  <button className="btn btn-secondary">Clear Completed</button>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <div className="task-item">
                    <div className="task-info">
                      <div className="task-title">Analyze cryptocurrency market trends</div>
                      <div className="task-meta">ID: task_001 • Stake: 75 • Bids: 3</div>
                    </div>
                    <div className="task-status processing">Processing</div>
                  </div>
                  <div className="task-item">
                    <div className="task-info">
                      <div className="task-title">Generate marketing content</div>
                      <div className="task-meta">ID: task_002 • Stake: 50 • Bids: 7</div>
                    </div>
                    <div className="task-status pending">Bidding</div>
                  </div>
                  <div className="task-item">
                    <div className="task-info">
                      <div className="task-title">Code review and optimization</div>
                      <div className="task-meta">ID: task_003 • Stake: 100 • Bids: 2</div>
                    </div>
                    <div className="task-status completed">Completed</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Network Section */}
        {activeSection === 'network' && (
          <section className="content-section active">
            <div className="section-header">
              <h1 className="section-title">Network Status</h1>
              <p className="section-description">Monitor P2P network connectivity and peer relationships</p>
            </div>

            <div className="grid grid-cols-3">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Network Health</h3>
                </div>
                <div className="resource-gauge">
                  <div className="gauge-circle">
                    <div className="gauge-value">92%</div>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <div className="metric-change positive">Network is healthy</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Connection Stats</h3>
                </div>
                <div className="mb-4">
                  <div className="metric-label">Active Peers</div>
                  <div className="metric-value" style={{ fontSize: '24px' }}>{metrics.networkPeers}</div>
                </div>
                <div className="mb-4">
                  <div className="metric-label">Total Connections</div>
                  <div className="metric-value" style={{ fontSize: '24px' }}>156</div>
                </div>
                <div className="mb-4">
                  <div className="metric-label">Bandwidth Usage</div>
                  <div className="metric-value" style={{ fontSize: '24px' }}>2.1 MB/s</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Protocol Status</h3>
                </div>
                <div className="mb-4">
                  <div className="metric-label">WebRTC Connections</div>
                  <div className="metric-value" style={{ fontSize: '18px', color: 'var(--accent-emerald)' }}>ACTIVE</div>
                </div>
                <div className="mb-4">
                  <div className="metric-label">WebSocket Fallback</div>
                  <div className="metric-value" style={{ fontSize: '18px', color: 'var(--accent-emerald)' }}>READY</div>
                </div>
                <div className="mb-4">
                  <div className="metric-label">IPFS Integration</div>
                  <div className="metric-value" style={{ fontSize: '18px', color: 'var(--accent-blue)' }}>SYNCING</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Other sections would follow similar pattern */}
      </main>
    </div>
  );
}
