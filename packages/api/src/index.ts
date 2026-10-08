// Rin API - Shared API types and schemas
// Used by both client and server

// Types
export * from './types';

// Shared error codes
export * from './error-codes';

// Schemas for server-side validation
export * from './schemas';

// Schema validator
export { t, validateSchema, isEmail, EMAIL_PATTERN } from './schema-validator';
export type {
  Schema,
  SchemaValidationIssue,
  SchemaValidationResult,
} from './schema-validator';
