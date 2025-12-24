# G3ZKP Messenger

## Overview
G3ZKP Messenger is a secure, decentralized peer-to-peer messaging platform focused on privacy. It uses zero-knowledge proofs (ZKP) for private message verification and end-to-end encryption via X3DH key exchange and Double Ratchet. The system is local-first, P2P, and operates without cloud dependencies, featuring an anti-trafficking detection system. Its ambition is to provide highly secure and private communication, integrate advanced features like 3D tensor object visualization, client-side background removal, and a privacy-focused flight tracking and anonymous booking system, all while adhering to a strong privacy-by-design philosophy.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
The project uses a Turborepo monorepo with packages for `core`, `crypto`, `zkp`, `network`, `storage`, `anti-trafficking`, and a `g3tzkp-messenger UI` (React frontend).

### Frontend Architecture
A React 18+ application with TypeScript, Vite, and Tailwind CSS, featuring a cyberpunk/matrix theme. It uses React Context for state management and integrates with backend packages via `G3ZKPContext`. UI components include GeodesicMap, DiegeticTerminal, ZKPVerifier, and MatrixRain.

### Cryptographic Design
Employs X3DH for key exchange, Double Ratchet for forward secrecy, HKDF for key derivation, and AEAD encryption with NaCl crypto_box (XSalsa20-Poly1305). ZKP circuits (Circom) verify message authorization, delivery, and key deletion, with a Node.js-based ZKP engine using `snarkjs`. It operates in Production Mode (real `snarkjs` proofs) or Simulation Mode (deterministic simulated proofs) depending on circuit availability.

### Network Layer
Based on `libp2p` supporting multiple transports (TCP, WebSockets, WebRTC), Noise protocol for encryption, GossipSub for pub/sub, and Kad-DHT for peer discovery.

### Storage Design
Utilizes LevelDB for local persistent, encrypted storage with an LRU cache. The frontend uses IndexedDB for messages, contacts, sessions, keys, settings, and media.

### Media Pipeline
Handles file transfers, conversion of image/video pixel data into 3D tensor fields using PHI-PI geodesic mapping, and rendering of these as 3D tensor objects via the Acute Reality V7 raymarching manifold renderer. Includes client-side background removal for images.

### Flight Tracking & Anonymous Booking System
Integrates a production-grade flight search, tracking, and anonymous booking platform with multi-source aggregation, anonymous booking with URL sanitization and secure iframe isolation, and privacy-preserving mechanisms.

### Acute Reality V7 Raymarching Engine
A production-grade volumetric raymarching system for tensor visualization, featuring a custom `ShaderMaterial` with RBBRRBR stitching, rotor harmonics, luma-to-depth extrusion, and ZKP proof consistency controls.

### Navigator Node
Provides privacy-focused navigation using OpenStreetMap and OSRM, a 2D Leaflet Map, real-time European flight tracking via OpenSky Network API, live GPS tracking with privacy obfuscation, and route planning via Nominatim API.

### European Transit Integration
Supports Europe-wide transit planning with backend API proxies to providers like TfL, BVG, SBB, NS, SNCF, and OpenStreetMap fallbacks, including country detection, caching, and retry logic.

### Sacred Geometry - Flower of Life
Implements a Flower of Life visualization with 19 circles for sacred geometry requirements, integrated into Leaflet markers and compatible with Three.js rendering.

### Business Verification & Integration Protocol
A decentralized business verification system using Companies House UK as the trust anchor. It includes services for CRN validation, API integration, business profile creation, cryptographic signing, and P2P network broadcast. Profiles are stored securely in IndexedDB.

### Design Principles
Primary encryption via ZKP, X3DH, and AEAD. Cyberpunk/Matrix aesthetic (cyan, green, black). All settings persist to localStorage. Mobile/tablet responsive design.

## External Dependencies

### Core Dependencies
- **libp2p**: P2P networking stack.
- **level**: LevelDB bindings.
- **snarkjs**: ZKP generation and verification.
- **tweetnacl**: NaCl cryptographic library.
- **lru-cache**: In-memory caching.

### Frontend Dependencies
- **React**: UI framework.
- **Vite**: Build tool.
- **Tailwind CSS**: CSS framework.
- **lucide-react**: Icon library.
- **framer-motion**: Animation library.
- **@google/genai**: Google AI integration.
- **@zxing/browser**: QR code scanning.
- **qrcode**: QR code generation.

### Flight Tracking Integration
- **OpenSky Network API**: Live flight data.
- **Aerodatabox (RapidAPI)**: Flight data proxy.
- **AviationStack**: Flight data proxy.

### European Transit Integration
- **TfL (UK)**
- **BVG (Germany)**
- **SBB (Switzerland)**
- **NS (Netherlands)**
- **SNCF (France)**
- **Nominatim API**: Geocoding.
- **OSRM**: Routing.
- **OSM Overpass API**: Transit data fallback.

## Recent Changes (December 2025)

- **LibP2P P2P Integration**: Full integration of LibP2PService into MessagingService with hybrid messaging (P2P + relay fallback). Auto-initialization on socket connect and offline fallback. Smart message queue that supports both transports with automatic retry on failures.
- **FaceTimeCall UI Fixes**: Added working onClick handlers for previously broken buttons: Effects/Sparkles, Users/Groups, Keypad, Message buttons now have real functionality.
- **MeshPage Chat UI Cleanup**: Removed redundant Phone/Video/MoreVertical buttons from chat headers (both mobile and desktop). Call controls now only appear in group sidebar to avoid duplication.
- **GroupManagementService**: Comprehensive group management service with invite link generation, member add/remove/kick with role hierarchy, permission system using MeshGroupRole enum.
- **GroupAdminPanel Component**: Full admin interface with 4 tabs (members, requests, settings, invites) for group management.