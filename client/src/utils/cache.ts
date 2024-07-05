import React from "react";

export type Keys =
    | "title"
    | "content"
    | "tags"
    | "summary"
    | "draft"
    | "alias"
    | "listed"
    | "preview"
    ;
const keys: Keys[] = [
    "title",
    "content",
    "tags",
    "summary",
    "draft",
    "alias",
    "listed",
    "preview",
];

export class Cache {
    static with(id?: number) {
        return new Cache(id);
    }
    private id: string;
    constructor(id?: number) {
        this.id = `${id ?? "new"}`;
    }
    public get(key: Keys) {
        return localStorage.getItem(`${this.id}/${key}`);
    }
    public set(key: Keys, value: string) {
        if (value === "") localStorage.removeItem(`${this.id}/${key}`);
        else localStorage.setItem(`${this.id}/${key}`, value);
    }
    clear() {
        keys.forEach((key) => {
            localStorage.removeItem(`${this.id}/${key}`);
        });
    }
    public useCache<T>(key: Keys, initialValue: T) {
        const [value, setValue] = React.useState<T>(this.get(key) as T ?? initialValue);
        const setCache = (value: T) => {
            this.set(key, value as string);
            setValue(value);
        }
        return [value, setCache] as const;
    }
}

export function useCache<T>(key: Keys, initialValue: T) {
    return new Cache().useCache(key, initialValue)
}