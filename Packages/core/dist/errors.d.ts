export declare class G3ZKPError extends Error {
    code: string;
    details?: Record<string, any> | undefined;
    constructor(message: string, code: string, details?: Record<string, any> | undefined);
}
export declare class SecurityError extends G3ZKPError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class NetworkError extends G3ZKPError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class CryptoError extends G3ZKPError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class ZKPError extends G3ZKPError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class ValidationError extends G3ZKPError {
    constructor(message: string, details?: Record<string, any>);
}
//# sourceMappingURL=errors.d.ts.map