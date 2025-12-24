/**
 * Circuit Registry - Manages ZKP circuit metadata and loading
 * Supports both real compiled circuits and simulated circuits for development
 */
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CircuitInfo {
  id: string;
  name: string;
  description?: string;
  wasmPath?: string;
  zkeyPath?: string;
  verificationKey?: any;
  constraints: number;
  publicInputs: string[];
  privateInputs: string[];
}

const CIRCUIT_DEFINITIONS: Record<string, {
  name: string;
  description: string;
  constraints: number;
  publicInputs: string[];
  privateInputs: string[];
}> = {
  'authentication': {
    name: 'Authentication Circuit',
    description: 'Proves identity ownership without revealing identity secret',
    constraints: 2000,
    publicInputs: ['identityCommitment', 'nullifierHash', 'externalNullifier'],
    privateInputs: ['identitySecret', 'identityNullifier']
  },
  'message_security': {
    name: 'Message Security Circuit',
    description: 'Proves message integrity and proper encryption without revealing content',
    constraints: 3000,
    publicInputs: ['messageRoot', 'timestamp', 'senderCommitment', 'receiverCommitment'],
    privateInputs: ['messageHash', 'encryptionKeyHash', 'senderSecret', 'receiverSecret', 'nonce']
  },
  'forward_secrecy': {
    name: 'Forward Secrecy Circuit',
    description: 'Proves forward secrecy properties and key deletion',
    constraints: 1500,
    publicInputs: ['oldKeyCommitment', 'newKeyCommitment', 'deletionProof'],
    privateInputs: ['oldKeySecret', 'newKeySecret', 'rotationNonce']
  },
  'MessageSendProof': {
    name: 'Message Send Proof',
    description: 'Proves a message was sent with proper encryption and authorization',
    constraints: 1000,
    publicInputs: ['messageHash', 'senderPublicKey', 'recipientPublicKey', 'timestamp'],
    privateInputs: ['plaintextHash', 'encryptionKey', 'nonce']
  },
  'MessageDeliveryProof': {
    name: 'Message Delivery Proof',
    description: 'Proves a message was delivered correctly with confirmation',
    constraints: 800,
    publicInputs: ['messageHash', 'recipientPublicKey', 'deliveryTimestamp'],
    privateInputs: ['decryptionProof', 'ackNonce']
  },
  'ForwardSecrecyProof': {
    name: 'Forward Secrecy Proof',
    description: 'Proves forward secrecy properties and key deletion',
    constraints: 500,
    publicInputs: ['keyCommitment', 'deletionTimestamp'],
    privateInputs: ['oldKey', 'newKey']
  }
};

export class CircuitRegistry {
  private circuits: Map<string, CircuitInfo> = new Map();
  private basePath: string;
  private loaded: boolean = false;

  constructor(basePath: string = './zkp-circuits/build') {
    this.basePath = basePath;
  }

  /**
   * Load all available circuits
   */
  async loadCircuits(): Promise<void> {
    if (this.loaded) return;

    // Try to load real circuits from build directory
    const realCircuits = await this.loadRealCircuits();
    
    // Also register known circuit definitions (for simulation fallback)
    for (const [id, def] of Object.entries(CIRCUIT_DEFINITIONS)) {
      if (!this.circuits.has(id)) {
        this.circuits.set(id, {
          id,
          name: def.name,
          description: def.description,
          constraints: def.constraints,
          publicInputs: def.publicInputs,
          privateInputs: def.privateInputs,
          verificationKey: this.generateSimulatedVerificationKey(id)
        });
      }
    }

    this.loaded = true;
    console.log(`Circuit Registry loaded ${this.circuits.size} circuits (${realCircuits} with compiled artifacts)`);
  }

  /**
   * Load real compiled circuits from the build directory
   */
  private async loadRealCircuits(): Promise<number> {
    let count = 0;

    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const circuitId = entry.name;
          const circuitPath = path.join(this.basePath, circuitId);
          
          try {
            const wasmPath = path.join(circuitPath, `${circuitId}.wasm`);
            const zkeyPath = path.join(circuitPath, `${circuitId}.zkey`);
            const vkeyPath = path.join(circuitPath, 'verification_key.json');
            
            // Check if compiled files exist
            await fs.access(wasmPath);
            await fs.access(zkeyPath);
            
            // Load verification key if available
            let verificationKey;
            try {
              const vkeyContent = await fs.readFile(vkeyPath, 'utf-8');
              verificationKey = JSON.parse(vkeyContent);
            } catch {
              verificationKey = this.generateSimulatedVerificationKey(circuitId);
            }

            const def = CIRCUIT_DEFINITIONS[circuitId];
            
            this.circuits.set(circuitId, {
              id: circuitId,
              name: def?.name || this.formatCircuitName(circuitId),
              description: def?.description,
              wasmPath,
              zkeyPath,
              verificationKey,
              constraints: verificationKey?.nPublic || def?.constraints || 1000,
              publicInputs: def?.publicInputs || [],
              privateInputs: def?.privateInputs || []
            });

            count++;
            console.log(`Loaded compiled circuit: ${circuitId}`);
          } catch (error) {
            // Circuit files not found - skip
          }
        }
      }
    } catch (error) {
      // Build directory doesn't exist - use simulated circuits
    }

    return count;
  }

  /**
   * Get circuit by ID
   */
  getCircuit(id: string): CircuitInfo | undefined {
    return this.circuits.get(id);
  }

  /**
   * List all circuits
   */
  listCircuits(): CircuitInfo[] {
    return [...this.circuits.values()];
  }

  /**
   * Check if a circuit exists
   */
  hasCircuit(id: string): boolean {
    return this.circuits.has(id);
  }

  /**
   * Check if a circuit has real compiled artifacts
   */
  hasCompiledCircuit(id: string): boolean {
    const circuit = this.circuits.get(id);
    return !!(circuit?.wasmPath && circuit?.zkeyPath);
  }

  /**
   * Register a custom circuit
   */
  registerCircuit(info: CircuitInfo): void {
    this.circuits.set(info.id, info);
  }

  /**
   * Generate a simulated verification key for development
   */
  private generateSimulatedVerificationKey(circuitId: string): any {
    const def = CIRCUIT_DEFINITIONS[circuitId];
    const nPublic = def?.publicInputs.length || 4;

    return {
      protocol: 'groth16',
      curve: 'bn128',
      nPublic,
      vk_alpha_1: [
        '20491192805390485299153009773594534940189261866228447918068658471970481763042',
        '9383485363053290200918347156157836566562967994039712273449902621266178545958',
        '1'
      ],
      vk_beta_2: [
        [
          '6375614351688725206403948262868962793625744043794305715222011528459656738731',
          '4252822878758300859123897981450591353533073413197771768651442665752259397132'
        ],
        [
          '10505242626370262277552901082094356697409835680220590971873171140371331206856',
          '21847035105528745403288232691147584728191162732299865338377159692350059136679'
        ],
        ['1', '0']
      ],
      vk_gamma_2: [
        [
          '10857046999023057135944570762232829481370756359578518086990519993285655852781',
          '11559732032986387107991004021392285783925812861821192530917403151452391805634'
        ],
        [
          '8495653923123431417604973247489272438418190587263600148770280649306958101930',
          '4082367875863433681332203403145435568316851327593401208105741076214120093531'
        ],
        ['1', '0']
      ],
      vk_delta_2: [
        [
          '10857046999023057135944570762232829481370756359578518086990519993285655852781',
          '11559732032986387107991004021392285783925812861821192530917403151452391805634'
        ],
        [
          '8495653923123431417604973247489272438418190587263600148770280649306958101930',
          '4082367875863433681332203403145435568316851327593401208105741076214120093531'
        ],
        ['1', '0']
      ],
      IC: Array(nPublic + 1).fill([
        '1234567890123456789012345678901234567890123456789012345678901234567890',
        '9876543210987654321098765432109876543210987654321098765432109876543210',
        '1'
      ])
    };
  }

  /**
   * Format circuit name from ID
   */
  private formatCircuitName(id: string): string {
    return id
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\s/, '')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalCircuits: number;
    compiledCircuits: number;
    simulatedCircuits: number;
  } {
    let compiled = 0;
    let simulated = 0;

    for (const circuit of this.circuits.values()) {
      if (circuit.wasmPath && circuit.zkeyPath) {
        compiled++;
      } else {
        simulated++;
      }
    }

    return {
      totalCircuits: this.circuits.size,
      compiledCircuits: compiled,
      simulatedCircuits: simulated
    };
  }
}
