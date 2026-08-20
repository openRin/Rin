// Small runtime schema format shared by the client contract package and server.

export type Schema = {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array' | 'file';
  optional?: boolean;
  integer?: boolean;
  minLength?: number;
  format?: 'date-time';
  properties?: Record<string, Schema>;
  items?: Schema;
  additionalProperties?: boolean;
};

type OptionalOptions = { optional?: boolean };
type StringOptions = OptionalOptions & { minLength?: number };

export const t = {
  Object: (properties: Record<string, Schema>, options?: { additionalProperties?: boolean }): Schema => ({
    type: 'object',
    properties,
    ...options,
  }),
  String: (options?: StringOptions): Schema => ({
    type: 'string',
    optional: options?.optional,
    minLength: options?.minLength,
  }),
  Number: (options?: OptionalOptions): Schema => ({ type: 'number', optional: options?.optional }),
  Boolean: (options?: OptionalOptions): Schema => ({ type: 'boolean', optional: options?.optional }),
  Integer: (options?: OptionalOptions): Schema => ({ type: 'number', integer: true, optional: options?.optional }),
  Date: (options?: OptionalOptions): Schema => ({ type: 'string', format: 'date-time', optional: options?.optional }),
  Array: (items: Schema, options?: OptionalOptions): Schema => ({ type: 'array', items, optional: options?.optional }),
  File: (options?: OptionalOptions): Schema => ({ type: 'file', optional: options?.optional }),
  Optional: (schema: Schema): Schema => ({ ...schema, optional: true }),
  Numeric: (options?: OptionalOptions): Schema => ({ type: 'number', optional: options?.optional }),
};

export interface SchemaValidationIssue {
  path: string;
  message: string;
}

export type SchemaValidationResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; issues: SchemaValidationIssue[] };

function describePath(path: string) {
  return path || 'value';
}

function isFile(value: unknown) {
  if (typeof File !== 'undefined' && value instanceof File) {
    return true;
  }

  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as { name?: unknown }).name === 'string'
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function',
  );
}

function collectIssues(schema: Schema, value: unknown, path: string, issues: SchemaValidationIssue[]) {
  const label = describePath(path);

  if (value === undefined) {
    if (!schema.optional) {
      issues.push({ path, message: `${label} is required` });
    }
    return;
  }

  switch (schema.type) {
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        issues.push({ path, message: `${label} must be an object` });
        return;
      }

      const record = value as Record<string, unknown>;
      const properties = schema.properties ?? {};
      for (const [key, childSchema] of Object.entries(properties)) {
        collectIssues(childSchema, record[key], path ? `${path}.${key}` : key, issues);
      }

      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in properties)) {
            const childPath = path ? `${path}.${key}` : key;
            issues.push({ path: childPath, message: `${childPath} is not allowed` });
          }
        }
      }
      return;
    }
    case 'string':
      if (typeof value !== 'string') {
        issues.push({ path, message: `${label} must be a string` });
      } else if (schema.minLength !== undefined && value.length < schema.minLength) {
        issues.push({ path, message: `${label} must not be empty` });
      } else if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
        issues.push({ path, message: `${label} must be a valid date-time` });
      }
      return;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ path, message: `${label} must be a number` });
      } else if (schema.integer && !Number.isInteger(value)) {
        issues.push({ path, message: `${label} must be an integer` });
      }
      return;
    case 'boolean':
      if (typeof value !== 'boolean') {
        issues.push({ path, message: `${label} must be a boolean` });
      }
      return;
    case 'array':
      if (!Array.isArray(value)) {
        issues.push({ path, message: `${label} must be an array` });
        return;
      }
      value.forEach((item, index) => collectIssues(schema.items!, item, `${path}[${index}]`, issues));
      return;
    case 'file':
      if (!isFile(value)) {
        issues.push({ path, message: `${label} must be a file` });
      }
  }
}

export function validateSchema<T = unknown>(schema: Schema, value: unknown): SchemaValidationResult<T> {
  const issues: SchemaValidationIssue[] = [];
  collectIssues(schema, value, '', issues);

  if (issues.length > 0) {
    return { success: false, issues };
  }

  return { success: true, data: value as T };
}
