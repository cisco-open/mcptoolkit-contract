## 14. Serialization

### 14.1 JSON Format

An MCP Description document MUST be serialized as a JSON document conforming to [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259).

### 14.2 Character Encoding

MCP Description documents MUST be encoded in UTF-8.

### 14.3 Numeric Values

JSON numbers SHOULD be used for numeric values. Implementations MUST support IEEE 754 double-precision floating-point numbers.

### 14.4 Null Values

Properties with `null` values SHOULD be omitted from the document rather than included with a `null` value, unless the property explicitly permits `null`.

### 14.5 Empty Arrays and Objects

Properties whose values are empty arrays or empty objects MAY be omitted. Implementations MUST treat an omitted array property as equivalent to an empty array, and an omitted object property as equivalent to an empty object, unless the property is required.

### 14.6 String Values

String values MUST be valid JSON strings. URI values MUST conform to [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986). Email values SHOULD conform to [RFC 5322](https://www.rfc-editor.org/rfc/rfc5322). Date values MUST conform to ISO 8601.

### 14.7 Schema Reference

MCP Description documents SHOULD include a `$schema` property referencing the appropriate JSON Schema for IDE validation and tooling support:

```json
{
  "$schema": "https://developer.cisco.com/mcp-description/schema/0.7.0",
  "mcpdesc": "0.7.0"
}
```

