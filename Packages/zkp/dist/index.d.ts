export { ZKPEngine } from './zkp-engine';
export { CircuitRegistry } from './circuit-registry';
export type { CircuitInfo } from './circuit-registry';
export interface ProofInputs {
    [key: string]: bigint | bigint[] | string | number;
}
export interface ProofResult {
    proof: any;
    generationTime: number;
    cached: boolean;
}
//# sourceMappingURL=index.d.ts.map