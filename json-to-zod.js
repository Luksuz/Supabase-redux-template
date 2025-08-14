import { z } from 'zod';

// Quick and simple schema converter with proper coercion
export function createZodFromSchema(jsonSchema, options = {}) {
  const { coerce = false } = options;
  
  function parseSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return z.any();
    }

    switch (schema.type) {
      case 'string':
        return parseString(schema);
      case 'number':
        return parseNumber(schema);
      case 'integer':
        return parseNumber(schema, true);
      case 'boolean':
        return coerce ? z.coerce.boolean() : z.boolean();
      case 'array':
        return parseArray(schema);
      case 'object':
        return parseObject(schema);
      default:
        if (schema.enum) return parseEnum(schema);
        return z.any();
    }
  }

  function parseString(schema) {
    let zodSchema = coerce ? z.coerce.string() : z.string();
    
    if (schema.enum) {
      return z.enum(schema.enum);
    }
    if (schema.minLength) zodSchema = zodSchema.min(schema.minLength);
    if (schema.maxLength) zodSchema = zodSchema.max(schema.maxLength);
    if (schema.pattern) zodSchema = zodSchema.regex(new RegExp(schema.pattern));
    if (schema.format === 'email') zodSchema = zodSchema.email();
    if (schema.format === 'url') zodSchema = zodSchema.url();
    
    return zodSchema;
  }

  function parseNumber(schema, isInteger = false) {
    let zodSchema = coerce ? z.coerce.number() : z.number();
    if (isInteger) zodSchema = zodSchema.int();
    
    if (schema.minimum !== undefined) zodSchema = zodSchema.min(schema.minimum);
    if (schema.maximum !== undefined) zodSchema = zodSchema.max(schema.maximum);
    
    return zodSchema;
  }

  function parseArray(schema) {
    const itemSchema = schema.items ? parseSchema(schema.items) : z.any();
    let zodSchema = z.array(itemSchema);
    
    if (schema.minItems) zodSchema = zodSchema.min(schema.minItems);
    if (schema.maxItems) zodSchema = zodSchema.max(schema.maxItems);
    
    return zodSchema;
  }

  function parseObject(schema) {
    const shape = {};
    const required = schema.required || [];
    
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        let propZod = parseSchema(propSchema);
        if (!required.includes(key)) {
          propZod = propZod.optional();
        }
        shape[key] = propZod;
      }
    }
    
    return z.object(shape);
  }

  function parseEnum(schema) {
    if (schema.enum.every(v => typeof v === 'string')) {
      return z.enum(schema.enum);
    }
    return z.union(schema.enum.map(v => z.literal(v)));
  }

  return parseSchema(jsonSchema);
}

// Test the fixed version
const testSchema = {
  "type": "object",
  "required": ["name", "age"],
  "properties": {
    "name": { "type": "string", "minLength": 2 },
    "age": { "type": "number", "minimum": 0, "maximum": 120 },
    "isActive": { "type": "boolean" },
    "role": { "type": "string", "enum": ["admin", "user", "guest"] }
  }
};

console.log("=== Testing Fixed Coercion ===");

const coerciveSchema = createZodFromSchema(testSchema, { coerce: true });

const coerciveTestData = {
  name: "Jane Smith",
  age: "25", // String that should coerce to number
  isActive: "true", // String that should coerce to boolean
  role: "user"
};

const result = coerciveSchema.safeParse(coerciveTestData);

if (result.success) {
  console.log("✅ Coercion successful!");
  console.log("Age:", result.data.age, "(type:", typeof result.data.age, ")");
  console.log("IsActive:", result.data.isActive, "(type:", typeof result.data.isActive, ")");
} else {
  console.log("❌ Coercion failed:", result.error.errors);
}

// Test non-coercive version
const strictSchema = createZodFromSchema(testSchema, { coerce: false });
const strictResult = strictSchema.safeParse(coerciveTestData);

console.log("\n=== Testing Strict (No Coercion) ===");
if (strictResult.success) {
  console.log("✅ Strict validation passed");
} else {
  console.log("❌ Strict validation failed (expected):");
  strictResult.error.errors.forEach(err => {
    console.log(`  - ${err.path.join('.')}: ${err.message}`);
  });
}