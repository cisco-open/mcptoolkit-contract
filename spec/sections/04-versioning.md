## 4. Versioning

### 4.1 The `mcpdesc` Field

Every MCP Description document MUST include a `mcpdesc` property at the root level. This property declares which version of this specification the document conforms to.

```json
{
  "mcpdesc": "0.7.0"
}
```

### 4.2 Version Format

The `mcpdesc` value MUST be a string matching a published version of this specification. The current version is `"0.7.0"`.

The specification uses [Semantic Versioning](https://semver.org/) for its own version numbers:

- **Major** version changes indicate breaking changes to the document structure
- **Minor** version changes add new optional features in a backward-compatible manner
- **Patch** version changes address errata or clarifications without structural changes

### 4.3 Version Compatibility

Implementations SHOULD support the latest specification version. Implementations MAY support multiple versions.

When processing a document, implementations MUST check the `mcpdesc` value and:

- Accept documents with a recognized `mcpdesc` version
- Reject documents with an unrecognized `mcpdesc` version or provide a clear warning

### 4.4 Forward Compatibility

Implementations SHOULD ignore unknown properties within known objects. This allows documents authored against a newer minor version to be partially processed by implementations supporting an older minor version of the same major version.

### 4.5 Relationship to MCP Protocol Versions

The `mcpdesc` version is independent of the MCP protocol version. The MCP protocol version implemented by a server is declared in `info.protocolVersion`.

A single MCP Description specification version MAY support documents describing servers implementing different MCP protocol versions.

