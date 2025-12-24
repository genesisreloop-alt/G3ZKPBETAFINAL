// Simplified Circuit Registry for Local P2P Messaging
// Note: This is a simplified version for local implementation
export class CircuitRegistry {
    constructor(basePath = './zkp-circuits/build') {
        this.circuits = new Map();
        this.basePath = basePath;
    }
    async loadCircuits() {
        const circuitDirs = [
            'MessageSendProof',
            'MessageDeliveryProof',
            'ForwardSecrecyProof'
        ];
        for (const dir of circuitDirs) {
            try {
                // For local implementation, register circuits without actual files
                this.circuits.set(dir, {
                    id: dir,
                    name: dir.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    wasmPath: `${this.basePath}/${dir}/${dir}.wasm`,
                    zkeyPath: `${this.basePath}/${dir}/${dir}.zkey`,
                    verificationKey: this.generateLocalVerificationKey(dir),
                    constraints: this.getConstraintsForCircuit(dir)
                });
                console.log(`Loaded circuit: ${dir}`);
            }
            catch (error) {
                console.warn(`Failed to load circuit ${dir}:`, error);
                // Register circuit even if files don't exist (for local implementation)
                this.circuits.set(dir, {
                    id: dir,
                    name: dir.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    verificationKey: this.generateLocalVerificationKey(dir),
                    constraints: this.getConstraintsForCircuit(dir)
                });
            }
        }
    }
    getCircuit(id) {
        return this.circuits.get(id);
    }
    listCircuits() {
        return [...this.circuits.values()];
    }
    hasCircuit(id) {
        return this.circuits.has(id);
    }
    generateLocalVerificationKey(circuitId) {
        // Generate local verification key for demonstration
        return {
            protocol: "groth16",
            curve: "bn128",
            nPublic: this.getPublicInputCount(circuitId),
            vk_a: [BigInt(1), BigInt(2)],
            vk_b: [[BigInt(3), BigInt(4)], [BigInt(5), BigInt(6)]],
            vk_c: [BigInt(7), BigInt(8)],
            vk_g1: [BigInt(9), BigInt(10)],
            vk_g2: [[BigInt(11), BigInt(12)], [BigInt(13), BigInt(14)]]
        };
    }
    getConstraintsForCircuit(circuitId) {
        const constraints = {
            'MessageSendProof': 1000,
            'MessageDeliveryProof': 800,
            'ForwardSecrecyProof': 500
        };
        return constraints[circuitId] || 1000;
    }
    getPublicInputCount(circuitId) {
        const counts = {
            'MessageSendProof': 8,
            'MessageDeliveryProof': 6,
            'ForwardSecrecyProof': 4
        };
        return counts[circuitId] || 5;
    }
}
//# sourceMappingURL=circuit-registry.js.map