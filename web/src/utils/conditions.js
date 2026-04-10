/**
 * Parse a conditions JSON string into an array of condition objects.
 * Returns { conditions, error } where error is truthy if parsing failed.
 */
export function parseConditions(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return { conditions: parsed, error: false };
    if (parsed.op && parsed.items) return { conditions: parsed.items, error: false };
    return { conditions: [parsed], error: false };
  } catch {
    return { conditions: [], error: true };
  }
}
