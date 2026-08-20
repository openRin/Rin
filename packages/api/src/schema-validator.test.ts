import { describe, expect, it } from "bun:test";
import { t, validateSchema } from "./schema-validator";

describe('validateSchema', () => {
  it('validates nested objects, arrays, optionals, and date-times', () => {
    const schema = t.Object({
      title: t.String(),
      publishedAt: t.Date({ optional: true }),
      tags: t.Array(t.String()),
    }, { additionalProperties: false });

    expect(validateSchema(schema, {
      title: 'Rin',
      publishedAt: '2026-08-19T00:00:00.000Z',
      tags: ['architecture'],
    }).success).toBe(true);

    const invalid = validateSchema(schema, {
      title: 1,
      publishedAt: 'not-a-date',
      tags: ['architecture', 2],
      extra: true,
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.issues.map((issue) => issue.path)).toEqual([
        'title',
        'publishedAt',
        'tags[1]',
        'extra',
      ]);
    }
  });

  it('distinguishes finite numbers and integers', () => {
    expect(validateSchema(t.Number(), Number.NaN).success).toBe(false);
    expect(validateSchema(t.Integer(), 1.5).success).toBe(false);
    expect(validateSchema(t.Integer(), 2).success).toBe(true);
  });

  it('supports non-empty string contracts', () => {
    expect(validateSchema(t.String({ minLength: 1 }), '').success).toBe(false);
    expect(validateSchema(t.String({ minLength: 1 }), 'Rin').success).toBe(true);
  });
});
