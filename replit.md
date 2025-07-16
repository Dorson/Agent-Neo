# Agent Neo - Decentralized AI Agent DApp

## Overview

Agent Neo is a decentralized AI agent application built as a DApp (Decentralized Application) that runs on user devices in a peer-to-peer network. The project combines a React frontend with an Express backend, featuring a modular architecture for handling distributed AI processing, ethics validation, and P2P networking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time Communication**: WebSocket server for P2P messaging
- **Session Management**: Connect-pg-simple for session storage
- **API Design**: RESTful endpoints with WebSocket integration

### Agent Neo Core System
The application features a modular JavaScript-based AI agent system with:
- **Core Module**: Main orchestration and initialization
- **P2P Networking**: WebRTC and WebSocket-based peer connections
- **Ethics Engine**: Constitutional AI framework for ethical decision making
- **Task Management**: Distributed task processing with proof-of-performance economy
- **Voice Interface**: Web Speech API integration
- **Resource Monitoring**: System resource usage tracking
- **Local Storage**: IndexedDB-based decentralized storage

## Key Components

### Database Schema
- **Users**: User authentication and management
- **Agent Nodes**: Node configuration and status tracking
- **Tasks**: Task lifecycle management with bidding system
- **Network Peers**: P2P network peer management
- **Ethics Logs**: Ethical evaluation audit trail

### Agent Neo Modules
1. **Core Module** (`core.js`): Central orchestration and module initialization
2. **P2P Manager** (`p2p.js`): Handles WebRTC connections and peer discovery
3. **Ethics Engine** (`ethics.js`): Constitutional AI framework with immutable principles
4. **Task Manager** (`tasks.js`): Distributed task processing and auction system
5. **Voice Interface** (`voice.js`): Speech recognition and synthesis
6. **Metrics Collector** (`metrics.js`): Real-time performance monitoring
7. **Local Storage** (`storage.js`): IndexedDB-based data persistence

### WebSocket Integration
- Real-time P2P communication
- Node status broadcasting
- Task bidding system
- Peer discovery protocol
- Ethics validation requests

## Data Flow

1. **User Interaction**: Users interact through the React frontend
2. **Agent Initialization**: Core module initializes all subsystems
3. **P2P Network**: Nodes connect via WebSocket and establish WebRTC connections
4. **Task Processing**: Tasks are distributed across the network with ethical validation
5. **Resource Monitoring**: Continuous monitoring ensures resource limits are respected
6. **Data Persistence**: All data is stored locally using IndexedDB

## External Dependencies

### Frontend Dependencies
- React ecosystem (React, React DOM, React Router alternative)
- UI components from Radix UI
- TanStack Query for data fetching
- Tailwind CSS for styling
- Class Variance Authority for component variants

### Backend Dependencies
- Express.js for server framework
- Drizzle ORM for database operations
- WebSocket (ws) for real-time communication
- Neon Database serverless driver for PostgreSQL
- Connect-pg-simple for session management

### Database
- PostgreSQL database (configured for Neon serverless)
- Drizzle migrations in `/migrations` directory
- Schema definitions in `/shared/schema.ts`

## Deployment Strategy

### Development
- Vite dev server for frontend hot reloading
- tsx for TypeScript execution in development
- Concurrent frontend and backend development

### Production
- Frontend built with Vite and served as static files
- Backend compiled with esbuild for optimal performance
- Database migrations managed through Drizzle Kit
- Environment-based configuration for DATABASE_URL

### Resource Management
- Self-imposed local resource limits to prevent device drain
- Configurable CPU, memory, and bandwidth limits
- Resource monitoring with automatic throttling
- Graceful degradation when limits are exceeded

The application is designed to be framework-agnostic at its core, with the Agent Neo modules implemented in vanilla JavaScript to ensure compatibility across different environments and minimal external dependencies.