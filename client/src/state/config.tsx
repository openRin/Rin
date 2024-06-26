import { createContext } from "react";

export class ConfigWrapper {
    config: any;
    constructor(config: any) {
        this.config = config;
    }
    get(key: string) {
        return this.config[key];
    }
    getOrDefault<T>(key: string, value: T) {
        if (this.config[key] != undefined) {
            return this.config[key] as T;
        }
        return value;
    }
}

export const ClientConfigContext = createContext<ConfigWrapper>(new ConfigWrapper({}));
export const ServerConfigContext = createContext<ConfigWrapper>(new ConfigWrapper({}));
