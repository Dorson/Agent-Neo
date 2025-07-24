# Agent Neo - Code Contribution Guidelines


Welcome to the Agent Neo project! We are building a self-evolving, decentralized AI agent designed with user sovereignty, privacy, and security at its core. To maintain the quality, scalability, and integrity of this complex system, all contributions must adhere to the following guidelines. This document is the single source of truth for the architectural and quality standards of the project.

---
---

## Table of Contents

- Core Principles
- The Principles of Dynamic Evolution (Anti-Hardcoding Mandates)
- Contribution Workflow
- Code Quality and Style
- Architectural Patterns
- Security Best Practices
- Testing and Validation
- UI/UX Guidelines
- Developing a New Module: A Step-by-Step Guide
- Code Review Process
- Documentation

---
---

## Core Principles


- USER SOVEREIGNTY AND PRIVACY FIRST: The agent runs entirely on the user's device. Code must NEVER assume access to a backend server. All user data is private by default and stored locally in IndexedDB. Any data shared with the network must be done with explicit user intent and strong cryptographic guarantees.

- DECENTRALIZATION BY DEFAULT: Avoid introducing centralized points of failure. All core functionalities—communication, data storage, consensus—MUST operate over the peer-to-peer network.

- PERFORMANCE IS A FEATURE (The "Metabolic Load" Principle): Agent Neo is designed to run on a wide range of devices, including mid-level mobile phones. Performance is critical.
    - Non-Blocking UI: The main UI thread must NEVER be blocked. Any task that could take more than 50ms to complete (e.g., cryptography, complex calculations, file parsing, AI inference) MUST be offloaded to a Web Worker via the `webWorkers.js` service.
    - Resource Efficiency: All code must be written with resource efficiency in mind, respecting the "Metabolic Load" concept. Every function should be as lightweight as possible. New modules must declare their expected resource usage in their manifest so the `resourceBalancer` can make intelligent decisions.
    - Offline-First: The application must be fully functional offline. Network-dependent actions must be gracefully queued via the `p2pService` and executed when connectivity is restored. Modules should be designed to handle intermittent connectivity without failing.

- SECURITY IS NON-NEGOTIABLE (Zero Trust Environment): We operate in a low-trust, potentially hostile P2P environment. Every contribution must be written defensively. Assume all external input (from users or peers) is potentially malicious until proven otherwise.

- MODULARITY AND EVOLVABILITY: The agent's ability to evolve depends on its modularity. Modules are the unit of evolution. They must be self-contained, decoupled, and interact ONLY through the well-defined, event-driven interfaces described in the architectural patterns.

- PROOF-OF-PERFORMANCE ECONOMY: All actions and contributions have consequences within the agent's internal economy. Evolution is not random; it is driven by verifiable performance. Modules that are efficient, reliable, and provide value to the user and the network are rewarded with "Trust" and "Reputation," allowing them to take on more responsibility. This economic feedback loop is the primary driver of the agent's growth and alignment.

---
---

## The Principles of Dynamic Evolution (Anti-Hardcoding Mandates)

To ensure Agent Neo can truly evolve without requiring constant, centralized code updates ("hard forks"), the following principles are **MANDATORY**. They prevent the most common architectural pitfalls that lead to a static, brittle system.

### 1. Configuration Management: Static vs. Dynamic

**Principle:** Configuration must be evolvable at runtime. A distinction must be made between static, build-time constants and dynamic, user-configurable settings.

**Rule:**
- **Static Configuration (`src/core/staticConfig.js`):** This file is for values that are truly static and will **NEVER** change at runtime. This includes bootstrap peer lists, database names, and core cryptographic constants.
- **Dynamic Configuration (`settingsManager.js`):** All other parameters—especially economic weights, guild sizes, timeouts, and resource limits—MUST be managed by the `settingsManager.js`. Default values are defined by core services (`src/core/coreModuleConfig.js`) and individual modules (in their `module.json` manifests). The `settingsManager` aggregates these defaults and provides the canonical value at runtime, which can be changed by the user or by the agent's own governance.

### 2. Module Discovery and Loading: The Registry is Truth

**Principle:** The application core must be agnostic to its specific modules. The agent must be able to discover, install, and load a completely novel module without any changes to the core application code.

**Rule:** **NEVER** maintain a central, hard-coded list or dictionary of module paths (e.g., in `app.js`). All modules, including UI views and services, MUST be discovered and loaded via the `moduleRegistry.js`. The registry is the single source of truth for what modules are available and where their entry points are located.

**Correct implementation example:**
```javascript
// in app.js
async function initializeModule(name) {
    const moduleInfo = moduleRegistry.getModule(name);
    if (moduleInfo && moduleInfo.entrypoint) {
        const module = await import(moduleInfo.entrypoint);
        // ... initialize module
    }
}
```

### 3. Communication Protocols: Self-Description over Central Definition

**Principle:** Communication protocols must be self-describing and defined by the modules that use them, allowing the network's "language" to evolve without hard forks.

**Rule:** **NEVER** hard-code P2P pub/sub topic strings or other protocol identifiers as constants in service logic. A module that exposes a network service MUST define its communication topics in a `protocols` object within its `module.json` manifest. Core services like `p2pService.js` or other modules MUST query the module's protocol via the `selfEvolvingProtocolRegistry.js` to get the correct topic at runtime.

**Correct Implementation example:**
```javascript
// in /public/modules/games/skill-racer/module.json
{
  "id": "skill-racer",
  "protocols": {
    "matchmaking": {
      "topic": "agent-neo-skill-racer-matchmaking-GAMER",
      "version": "1.0.0"
    }
  }
}

// in skillRacerService.js
import protocolRegistry from './selfEvolvingProtocolRegistry.js';
const topic = protocolRegistry.getTopic('skill-racer', 'matchmaking');
p2pService.publish(topic, message);
```

### 4. AI Prompts and Artifacts: Treat as Data, Not Code

**Principle:** AI artifacts, such as prompts and system instructions, are a form of dynamic knowledge, not static code. They must be evolvable by the agent itself.

**Rule:** **DO NOT** export prompts as hard-coded JavaScript strings from a `.js` file. Prompt templates and system instructions MUST be stored as evolvable configuration managed by `settingsManager.js`. Their default values should be defined within the `dynamicConfig` section of the relevant module's `module.json` manifest. This allows the `selfReflection` module to analyze their performance and propose new, improved versions without requiring a code change.

**Correct Implementation example:**
```javascript
// A setting managed by settingsManager.js, with its default in a module.json
// { "prompts": { "plannerSystem": "You are an AI..." } }

// in planner.js
import settingsManager from './settingsManager.js';
const promptTemplate = await settingsManager.getSetting('prompts.plannerSystem');
// ... use the dynamically retrieved prompt
```

---
---

## Contribution Workflow


To maintain a clean and manageable codebase, we follow a standard fork-and-pull-request model.

1. Fork the Repository: Create your own fork of the main Agent Neo repository.

2. Create a Branch: Create a new branch in your fork for your feature or fix. Use a descriptive naming convention:
    - Features: `feature/describe-the-feature` (e.g., `feature/add-game-history-dialog`)
    - Fixes: `fix/describe-the-bug` (e.g., `fix/correct-p2p-disconnect-logic`)

3. Code and Commit: Make your changes, adhering to all guidelines in this document.

4. Commit Messages: We follow the Conventional Commits specification. This helps us automate changelogs and makes the history readable.
    - Format: `<type>(<scope>): <subject>`
    - Example `feat(ui)`: `Add game history dialog to chess module`
    - Example `fix(p2p)`: `Prevent race condition in matchmaking service`

5. Pull Request: Open a pull request from your branch to the `main` branch of the upstream repository.
    - Provide a clear title and a detailed description of your changes.
    - Explain why the change is being made and link to any relevant issues or whitepaper sections.
    - Describe how you tested your changes.

---
---


## Code Quality and Style

- JavaScript: Use modern ECMAScript (ES2022+). All code must be in strict mode. `async/await` is the REQUIRED pattern for handling asynchronous operations.

- Readability: Code is read more often than it is written.
    - Use clear, descriptive names for variables, functions, and classes.
    - Keep functions small and focused on a single responsibility (Single Responsibility Principle).

- Dependencies: Agent Neo avoids external frameworks. Any third-party library MUST be carefully vetted for security and performance and placed in the `src/vendor/` directory. Explain the rationale for any new dependency in your pull request.

- Singletons for Core Services: Core managers and services (e.g., `p2pService`, `identityManager`) are implemented as singletons using the `getInstance()` pattern. Do not create new instances; import the existing one.

- Error Handling and Logging: All I/O operations (network, IndexedDB), API calls, and asynchronous logic MUST be wrapped in `try...catch` blocks. Use the central `logger.js` for reporting (`logger.error`, `logger.warn`). DO NOT use `console.log` or `console.error` directly for application logic; this allows us to control log verbosity and persistence centrally.

---
---


## Architectural Patterns


Adherence to these patterns is MANDATORY to maintain the system's integrity and evolvability.

### The Global Event Bus (The Decoupled Core)

This is the **MOST CRITICAL PATTERN** in Agent Neo. All communication between major, stateful services MUST happen through the global `eventBus`.

- **No Direct Dependencies:** A core module like the `planner` MUST NOT import or directly call a service module like `geminiService`. This is **FORBIDDEN**. Direct coupling between major systems makes the agent brittle and impossible to evolve safely.

- **When Direct Imports ARE Allowed:** It is acceptable and encouraged to directly import stateless utility modules (e.g., `utils.js`, `sanitizer.js`) or core, foundational primitives that do not manage a complex internal state (e.g., `crypto.js`). The event bus is for orchestrating actions between stateful managers.

- **Request/Response via Events:** To request an action from another service, a module must follow this asynchronous, event-driven pattern to prevent tight coupling.

**Correct Implementation example**:
```javascript
// In planner.js - Requesting a plan from Gemini
async function getPlanFromGemini(goal) {
    return new Promise((resolve, reject) => {
        const requestId = `plan-${Date.now()}`;

        const onResponse = (e) => {
            if (e.detail.requestId === requestId) {
                cleanup();
                resolve(e.detail.plan);
            }
        };

        const onFail = (e) => {
            if (e.detail.requestId === requestId) {
                cleanup();
                reject(new Error(e.detail.error));
            }
        };

        const cleanup = () => {
             eventBus.off('gemini:planReady', onResponse);
             eventBus.off('gemini:planFailed', onFail);
        };

        eventBus.on('gemini:planReady', onResponse);
        eventBus.on('gemini:planFailed', onFail);

        eventBus.emit('gemini:generatePlanRequest', { goal, requestId });
    });
}
```

---
---


### Web Workers and Micro-Execution Environments

Any task that could take more than 50ms MUST be offloaded to a Web Worker via the `webWorkers.js` manager.

- **Dedicated Workers:** For persistent services (e.g., `networking-worker.js`).
- **Sandboxed Execution:** For dynamically loaded or untrusted code, like Skill Modules, you MUST use `webWorkers.executeInWasmSandbox()` to provide a secure, isolated environment.



### State Management (`stateManager.js`)

All global UI state is managed by `stateManager.js`, which uses a `Proxy` for reactivity.
- **Do Not Mutate State Directly:** To change a global state property, assign it via the proxy: `stateManager.state.p2pStatus = 'online';`.
- **React to Changes:** UI modules should listen for `state:changed:<propertyName>` or the generic `state:changed` events to update their views, rather than polling for changes.



### IndexedDB and Dynamic Schemas

All persistent application state, from user settings to the local ledger, MUST be stored in IndexedDB via the `indexedDb.js` manager. Do not use `localStorage` for critical data.
- **Module-Specific Schemas:** Modules that require their own data stores MUST declare the schema (object store names, key paths, and indexes) within an `indexedDb` object in their `module.json` manifest. The `indexedDb.js` manager will automatically handle creating and migrating these stores.



### The Local Micro-Blockchain (`localLedger.js`)

All significant, auditable events MUST be recorded as a transaction in the `localLedger.js`. This is a core security and economic primitive. This includes:
- All economic actions (rewards, penalties, staking) governed by `economy.js`.
- Governance votes and proposal creations.
- Critical security events or task failures recorded by `proprioceptionModule.js`.
- The creation or receipt of knowledge proposals via `knowledgeStore.js`.



### The Proof-of-Performance (PoP) Economy

A module's evolution and success are tied to the PoP economy. Contributions should be designed to generate verifiable outcomes that can be measured and fed back into the system via events that `economy.js` and `guildTrustVerifier.js` can process.



### Module Design and API Contracts (The "Good Neighbor" Policy)

- **Stateless by Default:** Modules, especially UI components, should be designed to be as stateless as possible. Their primary role is to render state provided to them and emit events based on user interaction. All persistent state must be managed by dedicated services (`sessionContext`, `settingsManager`) or stored in IndexedDB. A module should be able to be destroyed and re-created without losing critical information.
- **Mandatory `destroy()` Method:** Every UI module or long-running service that registers listeners on the global `eventBus` or on DOM elements outside its own encapsulated view MUST implement a `destroy()` method. This method is responsible for cleaning up all subscriptions and event listeners to prevent memory leaks when a tab is closed or a module is uninstalled.
- **Configuration Over Code:** Modules must not contain hard-coded values that are likely to change (e.g., API endpoints, scoring weights, timeouts). Such values should be defined in the module's `module.json` manifest or loaded from the central `config.js` file. This allows for easier tuning and adaptation without requiring code changes.



### State Management and Data Flow (The "Unidirectional Flow" Mandate)

- **Formalize Event Bus Payload Schemas:** The global `eventBus` is our nervous system. To prevent it from becoming chaotic, any new event that carries a complex data payload MUST have its schema documented (e.g., using JSDoc in the emitting module). This ensures that modules have a clear contract for communication.
- **Read-Only State Principle:** UI components should treat the global state from `stateManager` as read-only. To modify the state, a component MUST emit an event (e.g., `ui:setting_changed`). A dedicated service (like `settingsManager`) listens for this event, validates the change, and then updates the `stateManager`. This enforces a strict, predictable, unidirectional data flow.
- **Strict Data Ownership:** A module MUST only write to the IndexedDB object stores it has explicitly declared in its `module.json` manifest. It is strictly forbidden for a module to directly access or modify the data stores belonging to another module. Inter-module data exchange must happen through the `eventBus` or by reading from shared, read-only data services.



### Versioning and Backward Compatibility (The "No Agent Left Behind" Rule)

- **Semantic Versioning (SemVer) for Everything:** We must formally adopt SemVer (`MAJOR.MINOR.PATCH`) for:
    - Modules: The `version` in `module.json`. A `MAJOR` version change signifies a breaking change in its API or event payloads.
    - Event Bus Payloads: The `protocolVersion` in our P2P message envelope should be extended to the `eventBus`. Events with breaking changes should be versioned (e.g., `p2p:message_received_v2`).
    - Data Schemas: The schemas in `schemas.js` and IndexedDB must be versioned.
- **Graceful Degradation for Inter-Module Communication:** In a decentralized network, nodes will update at different times. A module MUST be written to handle events from older versions of other modules gracefully. If a module receives an event payload with an older schema, it should not crash. It should attempt to process it if possible, or log a warning and ignore it if not.
- **Explicit IndexedDB Migration Paths:** When a module's IndexedDB schema changes (a `MAJOR` version bump), the module's JavaScript MUST include migration logic within the `onupgradeneeded` event handler in `indexedDb.js`. The `indexedDb` manager can be enhanced to call module-specific migration functions. This ensures that users who update do not lose their existing data.

---
---

## Security Best Practices


- **Input Sanitization:** Never trust input from any external source (user UI, P2P network). All HTML content rendered in the DOM MUST be passed through `sanitizer.sanitizeHTML()`. All data used in logic must be validated against its expected type and format.

- **Cryptographic Integrity:** All messages transmitted over the P2P network MUST be created and cryptographically signed using `createSignedMessage` from `messageProtocol.js`.

- **Never Handle Private Keys Directly:** All signing operations MUST go through `identityManager.sign()`. Modules must never have access to raw private keys. The `identityManager` handles the secure lifecycle of the in-memory operational key and clears it when the session is locked.

- **No Direct DOM Access from Core Logic:** Core logic modules in `src/core/` and `src/modules/` must not directly interact with the DOM. They emit events that the UI layer (`src/ui/`) consumes to update the view.

- **Dependency Security:** Be cautious when adding new third-party libraries to `src/vendor/`. Ensure they are well-maintained and from a trusted source to mitigate supply-chain attacks.
- **Principle of Least Privilege:** Modules should be designed with the minimum capabilities necessary to function. A module should not have access to services or information it does not strictly need. For example, a game module should not have access to `identityManager`. This limits the "blast radius" if a module is compromised or buggy.

### Security and Sandboxing (The "Zero Trust Module" Principle)

- **Principle of Least Privilege:** A module should only have access to the resources and information it absolutely needs to perform its function. This should be enforced architecturally. For example, the `skillValidator.js` is a perfect implementation of this—it runs code in a completely isolated environment. This principle must be applied to all new features.
- **Module Permissions Manifest (Future-Proofing):** To formalize the Principle of Least Privilege, we should plan to extend the `module.json` manifest to include a `permissions` object. This would declare the module's intent, for example: ` "permissions": { "indexedDb": ["read-only"], "p2p": ["subscribe-only"], "notifications": true }`. This would allow the `moduleInstaller` to set up sandboxing rules and, in the future, even prompt the user for consent.

---
---

## Testing and Validation

- **Manual Testing:** All new features or bug fixes must be thoroughly tested manually. In your pull request, describe the test cases you ran (e.g., "Tested on Chrome and Firefox," "Tested offline mode by disconnecting Wi-Fi").

- **Automated Testing (Future):** We aim to introduce a lightweight, native testing framework. New contributions should be written in a way that is easily testable, with pure functions and clear separation of concerns.

---
---

## UI/UX Guidelines


- **Accessibility (A11y):** All interactive elements must be keyboard-accessible and have appropriate ARIA attributes (`aria-label`, `role`, etc.).

- **Responsiveness:** All UI components must be fully responsive and functional on both mobile and desktop screens.

- **Consistency:** Use the predefined CSS variables in `public/css/base.css` for all colors, fonts, and spacing. Re-use existing components from `components.css`. Use the central `dialogManager.js` for all modal interactions.

- **PWA Best Practices:** Ensure that any changes to core assets are reflected in the `public/service-worker.js` cache list to maintain offline functionality.

---
---

## Developing a New Module: A Step-by-Step Guide

New capabilities are added as self-contained modules. A new UI view or game MUST follow this checklist:

1. Create the Module Folder and Manifest
    - [ ] Create a new folder in `public/modules/your-module-name/`.
    - [ ] Create a `module.json` file inside. This manifest is REQUIRED and tells the `moduleRegistry` how to load your module.

    **Example `module.json`:**
    ```json
    {
      "id": "your-module-id",
      "type": "view",
      "title": "Your Module Title",
      "entrypoint": "/public/modules/your-module-name/your-module.js",
      "html": "your-module.html",
      "css": "your-module.css",
      "indexedDb": {
        "stores": [
          {
            "name": "my_data_store",
            "options": { "keyPath": "id" }
          }
        ]
      }
    }
    ```
---
---

2. Implement the Entrypoint JavaScript

    - [ ] Create `your-module.js`. It MUST export a default class.
    - [ ] Implement the `postRender()` method. This is called *after* your HTML is added to the DOM. Use it to query elements and add event listeners.
    - [ ] Implement the `initialize()` method for one-time setup (like subscribing to long-lived events).
    - [ ] Implement the `destroy()` method to clean up all event listeners and intervals to prevent memory leaks when the module's tab is closed.

    **Boilerplate `your-module.js`:**
    ```javascript
    import eventBus from '../../../src/core/eventBus.js';
    import logger from '../../../src/core/logger.js';

    class YourModuleComponent {
        constructor() {
            this.elements = {};
            this._boundEventHandler = this._handleEvent.bind(this);
            // Bind any other handlers that will be used as event listeners
        }
        
        initialize() {
            // One-time setup: Subscribe to long-lived application events
            eventBus.on('some:globalEvent', this._boundEventHandler);
        }

        postRender() {
            // Called every time the module's view is displayed.
            // Query for elements within this module's view.
            this.elements.container = document.getElementById('your-module-container');
            if (!this.elements.container) {
                logger.error('YourModuleComponent could not find its container element.');
                return;
            }

            this.elements.myButton = this.elements.container.querySelector('.my-button');
            
            // Add DOM-specific event listeners here
            this.elements.myButton?.addEventListener('click', () => {
                logger.info('Button clicked!');
                eventBus.emit('ui:your-module:action_taken', { some: 'data' });
            });
        }

        _handleEvent(event) {
            // Handle events from the global event bus
        }

        destroy() {
            // Clean up all listeners to prevent memory leaks when the tab is closed.
            // 1. Clean up global event bus listeners
            eventBus.off('some:globalEvent', this._boundEventHandler);
            
            // 2. Clean up DOM event listeners added in postRender
            // (If listeners were added directly without using a bound handler, you
            // would need to manage them here to remove them properly).
        }
    }

    export default YourModuleComponent;
    ```
---
---

3. Create the UI and Styling


    - [ ] Create your `your-module.html` and `your-module.css` files.
    - [ ] The HTML should be a single root element (e.g., `<div id="your-module-container" class="panel your-module-panel">...</div>`).
    - [ ] Scope all CSS classes with a unique parent class (e.g., `.your-module-panel .btn`) to avoid conflicts.

4. Register the Module
    - [ ] Add the path to your module's folder (e.g., `"your-module-name"`) to the array in `public/modules/manifest.json`.

---
---

## Code Review Process

- **Be Respectful:** All communication should be constructive and respectful.
- **Reviewer Checklist:** Reviewers will check for:
    - Adherence to all guidelines in this document.
    - Clear logic and code readability.
    - Proper error handling.
    - Security considerations.
    - Sufficient manual testing described in the PR.
- **Responding to Feedback:** Address all feedback from the reviewer. Use `git commit --amend` and `git push --force` to update your branch with changes, keeping the history clean.

---
---

## Documentation


- **JSDoc:** Provide JSDoc comments for all new public-facing functions, classes, and methods. Explain what they do, their parameters (`@param`), and what they return (`@returns`).
- **Updating `CODE_GUIDELINES.md`:** If your change addresses an item in this document, please note this in your pull request.

By following these guidelines, you help ensure that Agent Neo remains a secure, robust, and truly decentralized platform for the future of AI.
