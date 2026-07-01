## 15. Conformance

### 15.1 Document Conformance

A conforming MCP Description document MUST:

1. Be a valid JSON document (Section 14).
2. Include the `mcpdesc` property with a recognized specification version (Section 4).
3. Include the `info` object with at least `name` and `version` (Section 5).
4. Include the `transports` array with at least one transport object (Section 6).
5. Include at least one of: `tools`, `resources`, `resourceTemplates`, or `prompts` (Section 3.3).
6. Validate against the JSON Schema for the declared `mcpdesc` version.
7. Not contain unknown properties at the root level except specification extensions matching `^x-`.

### 15.2 Implementation Conformance

A conforming implementation (tool, validator, or platform) MUST:

1. Accept and correctly parse documents conforming to this specification.
2. Reject documents that fail the requirements in Section 15.1.
3. Ignore unrecognized specification extensions without error (Section 13.4).
4. Preserve specification extensions when processing and re-serializing documents (Section 13.4).

A conforming implementation SHOULD:

1. Support at least the current specification version.
2. Provide clear error messages when rejecting non-conforming documents.
3. Support JSON Schema validation against the published schema.

### 15.3 Partial Conformance

Implementations that support only a subset of the specification (e.g., only tools, or only a specific transport type) SHOULD document their limitations clearly.

### 15.4 Versioned Conformance

Conformance is assessed against a specific specification version. An implementation claiming conformance MUST state which `mcpdesc` version(s) it supports.

---

## Appendix A: Icon Object

The Icon object is used throughout the specification for UI display.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `src` | string (URI) | **Yes** | URI pointing to an icon resource (HTTP/HTTPS URL or `data:` URI). |
| `mimeType` | string | No | MIME type override (e.g., `"image/png"`, `"image/svg+xml"`). |
| `sizes` | array\<string\> | No | Sizes at which the icon can be used (e.g., `"48x48"`, `"96x96"`, `"any"`). |
| `theme` | string | No | Theme this icon is designed for: `"light"` or `"dark"`. |

Clients MUST support `image/png` and `image/jpeg`. Clients SHOULD also support `image/svg+xml` and `image/webp`.

---

## Appendix B: Complete Example

See [examples/full-featured.yaml](../examples/full-featured.yaml) for a complete MCP Description document demonstrating all features of this specification.

---

## Appendix C: JSON Schema

The normative JSON Schema for this specification version is available at:

- [../../schemas/mcp-description/0.7.0.json](../../schemas/mcp-description/0.7.0.json)
- `https://developer.cisco.com/mcp-description/schema/0.7.0`

---

## Appendix D: References

### Normative References

- **[RFC 2119]** Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", RFC 2119, March 1997.
- **[RFC 3986]** Berners-Lee, T., Fielding, R., and L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax", RFC 3986, January 2005.
- **[RFC 6570]** Gregorio, J., Fielding, R., Hadley, M., Nottingham, M., and D. Orchard, "URI Template", RFC 6570, March 2012.
- **[RFC 8259]** Bray, T., "The JavaScript Object Notation (JSON) Data Interchange Format", RFC 8259, December 2017.
- **[JSON Schema]** Wright, A., Andrews, H., Hutton, B., "JSON Schema: A Media Type for Describing JSON Documents", draft-bhutton-json-schema-01, June 2022.

### Informative References

- **[MCP Protocol]** Anthropic, "Model Context Protocol Specification", https://modelcontextprotocol.io
- **[OpenAPI 3.1]** OpenAPI Initiative, "OpenAPI Specification v3.1.0", https://spec.openapis.org/oas/v3.1.0
- **[Semantic Versioning]** Preston-Werner, T., "Semantic Versioning 2.0.0", https://semver.org

