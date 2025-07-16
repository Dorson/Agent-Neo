# Agent Neo - Decentralized AI Agent DApp

![Agent Neo Logo](assets/icons/icon-192x192.png)

## Overview

Agent Neo is a cutting-edge decentralized AI agent built as a Progressive Web App (PWA) that implements a modular "hive mind" architecture with ethics-driven task processing and peer-to-peer network connectivity. This project represents a new paradigm in decentralized AI systems, combining advanced web technologies with ethical AI principles.

## 🌟 Key Features

### Core Capabilities
- **Modular Hive Mind Architecture**: Self-evolving AI agent with pluggable modules
- **Ethics Framework**: Built-in ethical decision-making system with configurable levels
- **P2P Network Integration**: Decentralized connectivity using libp2p and IPFS protocols
- **Progressive Web App**: Installable, offline-capable web application
- **Resource Management**: Intelligent resource allocation and monitoring
- **Real-time Chat Interface**: Natural language interaction with the AI agent
- **Multi-theme Support**: Dark, light, high-contrast, cyberpunk, and matrix themes

### Technical Features
- **Native JavaScript**: No framework dependencies, runs on any modern browser
- **Event-Driven Architecture**: Loosely coupled modules communicating via events
- **State Management**: Centralized, reactive state using Observable patterns
- **Offline Functionality**: Service worker implementation with smart caching
- **Mobile Responsive**: Touch-optimized interface for all device sizes
- **Performance Optimized**: Lazy loading, code splitting, and efficient rendering

## 🏗️ Architecture

### System Design

Agent Neo follows a sophisticated modular architecture as outlined in the whitepaper:

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Neo DApp                        │
├─────────────────────────────────────────────────────────┤
│  UI Layer (Progressive Enhancement)                     │
│  ├── Theme System (5 themes)                           │
│  ├── Component System (BEM methodology)                │
│  └── Responsive Design (Mobile-first)                  │
├─────────────────────────────────────────────────────────┤
│  Core Systems                                           │
│  ├── EventBus (Event-driven communication)             │
│  ├── StateManager (Observable state management)        │
│  ├── AgentNeo (Central coordinator)                    │
│  └── UIManager (Component rendering)                   │
├─────────────────────────────────────────────────────────┤
│  Modules (Pluggable Architecture)                      │
│  ├── EthicsModule (Decision-making framework)          │
│  ├── TaskManager (Task processing and queuing)         │
│  ├── NetworkManager (P2P connectivity)                 │
│  ├── ResourceMonitor (System resource tracking)        │
│  └── IndexedDBManager (Local data persistence)         │
├─────────────────────────────────────────────────────────┤
│  Web Technologies                                       │
│  ├── Service Worker (Offline capability, caching)      │
│  ├── IndexedDB (Local data storage)                    │
│  ├── Web Workers (Background processing)               │
│  └── WebRTC (P2P communication)                        │
└─────────────────────────────────────────────────────────┘
```

### Core Modules

#### EventBus
- High-performance event system using native EventTarget API
- Request-response patterns for module communication
- Event history and debugging capabilities
- Performance metrics and error handling

#### StateManager
- Centralized state management with Observable patterns
- Nested state paths with dot notation
- Middleware support for state transformations
- State history and time-travel debugging

#### AgentNeo Core
- Central coordinator implementing the hive mind concept
- Module lifecycle management (register, start, stop)
- Ethics framework integration
- Task processing with safety limits

#### UIManager
- Component-based rendering system
- Progressive enhancement principles
- Efficient DOM updates with request animation frame
- Theme management and responsive behavior

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome 88+, Firefox 85+, Safari 14+, Edge 88+)
- Web server (for development: `python -m http.server` or similar)
- No build tools or dependencies required!

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/agent-neo.git
   cd agent-neo
   ```

2. **Start a local web server**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser**
   Navigate to `http://localhost:8000`

4. **Install as PWA** (optional)
   - Click the install button in your browser's address bar
   - Or use the browser menu: "Install Agent Neo..."

### First Run

1. **Initialize the system**: The app will automatically initialize all core modules
2. **Start the agent**: Click the "Start Node" button in the header
3. **Configure settings**: Access settings via the gear icon
4. **Begin interaction**: Use the chat interface to communicate with Agent Neo

## 💬 Usage Guide

### Dashboard View
- **System Metrics**: Monitor CPU, memory, and network usage
- **Performance Stats**: View tasks completed, success rate, response times
- **Node Status**: Check P2P connections and IPFS status
- **Resource Monitor**: Real-time resource usage visualization

### Chat Interface
- **Text Input**: Type messages and press Enter
- **Voice Input**: Click the microphone button (if enabled)
- **Message History**: Persistent conversation history
- **AI Responses**: Ethics-aware, context-sensitive replies

### Settings Configuration
- **Resource Limits**: Set maximum CPU and memory usage
- **Network Settings**: Configure P2P connection limits
- **Ethics Level**: Choose from conservative, balanced, or progressive
- **Voice Control**: Enable/disable voice input functionality
- **Theme Selection**: Cycle through available themes

### Network View
- **P2P Connections**: View active peer connections
- **IPFS Status**: Monitor distributed storage connectivity
- **Bandwidth Usage**: Track upload/download statistics
- **Network Health**: Real-time network diagnostics

## 🎨 Theming System

Agent Neo includes 5 carefully crafted themes:

### Dark Theme (Default)
- Primary: Cybernetic green (#00ff9f)
- Background: Deep space blue (#0f0f1a)
- Optimal for extended use and low-light environments

### Light Theme
- Clean, professional appearance
- High contrast for accessibility
- Optimized for daylight use

### High Contrast
- WCAG AAA compliance
- Enhanced accessibility features
- Bold, clear visual elements

### Cyberpunk Theme
- Neon colors with animated effects
- Futuristic aesthetic
- Enhanced visual feedback

### Matrix Theme
- Classic green-on-black matrix style
- Retro computing nostalgia
- Unique visual experience

## 🔧 Configuration

### Environment Variables
- `DEBUG_MODE`: Enable debug logging and development tools
- `MAX_PEERS`: Maximum number of P2P connections (default: 10)
- `CACHE_VERSION`: Service worker cache version

### Local Storage Settings
- `agentneo_ui_theme`: Selected theme preference
- `agentneo_ui_currentView`: Last active view
- `agentneo_debug`: Debug mode toggle
- `agentneo_saved_state`: Application state backup

## 🛠️ Development

### Architecture Principles

1. **Progressive Enhancement**: Works without JavaScript, enhanced with it
2. **Mobile First**: Responsive design starting from mobile devices
3. **Accessibility**: WCAG 2.1 AA compliance throughout
4. **Performance**: Optimized for low-power devices and slow networks
5. **Security**: Client-side only, no server dependencies

### Code Organization

```
agent-neo/
├── index.html              # Main application entry point
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── src/
│   ├── main.js             # Application initialization
│   ├── core/               # Core system modules
│   │   ├── EventBus.js     # Event system
│   │   ├── StateManager.js # State management
│   │   └── AgentNeo.js     # Main coordinator
│   ├── ui/                 # User interface
│   │   └── UIManager.js    # UI component system
│   └── styles/             # CSS architecture
│       ├── reset.css       # CSS reset
│       ├── variables.css   # Design system
│       ├── main.css        # Core styles
│       ├── components.css  # Component styles
│       └── themes.css      # Theme system
├── assets/                 # Static assets
│   ├── icons/              # PWA icons
│   └── screenshots/        # App store screenshots
└── attached_assets/        # Project documentation
    └── agent-neo-whitepaper_1752631046238.txt
```

### Adding New Modules

1. **Create module file** in appropriate directory
2. **Implement module interface**:
   ```javascript
   class MyModule {
       constructor() {
           this.name = 'MyModule';
           this.version = '1.0.0';
       }
       
       async start() {
           // Module initialization
       }
       
       async stop() {
           // Module cleanup
       }
   }
   ```
3. **Register with AgentNeo**:
   ```javascript
   agentNeo.registerModule({
       name: 'MyModule',
       module: new MyModule()
   });
   ```

### Event System Usage

```javascript
// Emit events
eventBus.emit('my:event', { data: 'value' });

// Listen for events
eventBus.on('my:event', (eventData) => {
    console.log('Received:', eventData);
});

// Request-response pattern
const response = await eventBus.request('my:request', { query: 'data' });
```

### State Management

```javascript
// Set state
stateManager.setState('user.preferences.theme', 'dark');

// Get state
const theme = stateManager.getState('user.preferences.theme', 'default');

// Subscribe to changes
const unsubscribe = stateManager.subscribe('user.preferences', (newValue, oldValue) => {
    console.log('Preferences changed:', newValue);
});
```

## 🔒 Security Considerations

- **Client-side Only**: No server-side dependencies reduce attack surface
- **Content Security Policy**: Strict CSP headers prevent XSS attacks
- **Sandboxed Environment**: Web Workers isolate potentially unsafe operations
- **Ethics Framework**: Built-in safeguards against harmful operations
- **Resource Limits**: Prevent resource exhaustion attacks

## 🌐 Browser Compatibility

### Minimum Requirements
- **Chrome**: 88+ (2021)
- **Firefox**: 85+ (2021)
- **Safari**: 14+ (2020)
- **Edge**: 88+ (2021)

### Progressive Enhancement
- **Basic functionality**: Works in older browsers with reduced features
- **Enhanced features**: Full functionality in modern browsers
- **Offline support**: Available in PWA-capable browsers

## 📱 Mobile Support

- **Responsive Design**: Optimized for all screen sizes
- **Touch Gestures**: Swipe navigation and touch interactions
- **Viewport Optimization**: Proper scaling on mobile devices
- **Performance**: Efficient rendering on low-power devices
- **PWA Features**: Add to home screen, splash screen, etc.

## 🚧 Roadmap

### Phase 1: Foundation (Current)
- ✅ Core architecture implementation
- ✅ Basic UI and theming system
- ✅ PWA functionality
- ✅ Local state management

### Phase 2: Intelligence
- 🔄 AI model integration
- 🔄 Advanced ethics framework
- 🔄 Learning and adaptation
- 🔄 Context understanding

### Phase 3: Networking
- 📋 P2P protocol implementation
- 📋 IPFS integration
- 📋 Distributed consensus
- 📋 Swarm intelligence

### Phase 4: Evolution
- 📋 Self-modifying code
- 📋 Module marketplace
- 📋 Collective learning
- 📋 Emergent behaviors

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Standards
- **ES6+**: Modern JavaScript features
- **No build tools**: Keep it simple and native
- **Documentation**: Comment complex logic
- **Testing**: Manual testing in multiple browsers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WebRTC Community**: For P2P communication protocols
- **IPFS Team**: For distributed storage inspiration
- **Progressive Web App Community**: For PWA best practices
- **Ethics in AI Researchers**: For ethical framework guidance

## 📧 Contact

- **Project Lead**: [Your Name](mailto:your.email@example.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/agent-neo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/agent-neo/discussions)

---

**Agent Neo** - *Evolving the future of decentralized AI, one decision at a time.*