import { G3ZKPConfig } from './types';
export declare class ConfigurationManager {
    private config;
    private configPath;
    constructor(partial?: Partial<G3ZKPConfig>, configPath?: string);
    private buildConfig;
    getConfig(): G3ZKPConfig;
    saveConfig(): Promise<void>;
    loadConfig(): Promise<ConfigurationManager>;
    static fromFile(configPath?: string): Promise<ConfigurationManager>;
    static fromEnvironment(): ConfigurationManager;
}
//# sourceMappingURL=config.d.ts.map