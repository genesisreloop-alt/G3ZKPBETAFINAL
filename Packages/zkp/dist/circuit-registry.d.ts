export interface CircuitInfo {
    id: string;
    name: string;
    wasmPath?: string;
    zkeyPath?: string;
    verificationKey?: any;
    constraints: number;
}
export declare class CircuitRegistry {
    private circuits;
    private basePath;
    constructor(basePath?: string);
    loadCircuits(): Promise<void>;
    getCircuit(id: string): CircuitInfo | undefined;
    listCircuits(): CircuitInfo[];
    hasCircuit(id: string): boolean;
    private generateLocalVerificationKey;
    private getConstraintsForCircuit;
    private getPublicInputCount;
}
//# sourceMappingURL=circuit-registry.d.ts.map