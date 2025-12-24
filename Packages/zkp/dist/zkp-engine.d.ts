interface ProofInputs {
    [key: string]: bigint | bigint[] | string | number;
}
interface CircuitInfo {
    id: string;
    name: string;
    description: string;
    constraints: number;
    wasmPath?: string;
    zkeyPath?: string;
    verificationKey?: any;
}
export declare class ZKPEngine {
    private circuits;
    private proofCache;
    private initialized;
    constructor();
    initialize(): Promise<void>;
    isInitialized(): boolean;
    generateProof(circuitId: string, inputs: ProofInputs): Promise<any>;
    verifyProof(proof: any): Promise<boolean>;
    listCircuits(): Promise<CircuitInfo[]>;
    private initializeCircuits;
    private generateLocalProof;
    private getCacheKey;
    private generateProofId;
    private pruneCache;
}
export {};
//# sourceMappingURL=zkp-engine.d.ts.map