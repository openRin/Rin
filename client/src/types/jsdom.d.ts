declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: unknown);
    window: Window & typeof globalThis;
  }
}
