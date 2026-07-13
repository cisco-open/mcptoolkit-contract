## Version 1.0.0-2026-06-30 - 2026-07-02


MAJOR release with 4 breaking changes, 1 new feature, and 2 updates.

- **Breaking Changes**: 4
- **New**: 1 features added
- **Updates**: 2 features changed
- **Deleted**: 1 features removed

This release focuses on backward-incompatible changes and requires migration planning.

### Summary

#### Tools (5)

**Breaking Changes:**
- [Tool `microsoft_docs_search`](#microsoft_docs_search): tool output schema changed
- [Tool `microsoft_code_sample_search`](#microsoft_code_sample_search): tool output schema changed

**Updates:**
- [Tool `microsoft_docs_search`](#microsoft_docs_search): description changed
- [Tool `microsoft_docs_fetch`](#microsoft_docs_fetch): description changed

**Deleted:**
- [Tool `microsoft_docs_search`](#microsoft_docs_search): parameter `question` removed

#### Server Info (3)

**Breaking Changes:**
- [Server `listChanged`](#listChanged): capability property changed
- [Server `listChanged`](#listChanged): capability property changed

**New:**
- [Server `corsSupport`](#corsSupport): cors detection added

---

### Detailed Changes

#### Tools

##### `microsoft_docs_search`

- tool output schema changed

  - **After**: {
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": [
              "string",
              "null"
            ]
          },
          "title": {
            "type": "string"
          },
          "content": {
            "type": [
              "string",
              "null"
            ]
          },
          "contentUrl": {
            "type": "string"
          },
          "content_omitted": {
            "type": "boolean"
          },
          "extensionData": {
            "type": [
              "object",
              "null"
            ]
          }
        }
      }
    }
  }
}


- description changed

  | Before | After |
  |--------|-------|
  | …<br><br>The `question` parameter is no longer used, use `query` instead.<br><br>## Follow-up Pattern<br>To ensure completeness, use microsoft_docs_fetch when high-value pages are identified by search. The fetch tool complements search by providing the full detail. This is a required step for comprehensive results. | …<br><br>## Follow-up Pattern<br>To ensure completeness, use microsoft_docs_fetch when high-value pages are identified by search. The fetch tool complements search by providing the full detail. This is a required step for comprehensive results. |


- parameter `question` removed
  - **Before**: {
  "description": "this parameter is no longer used, use query instead.",
  "type": "string",
  "default": null
}



##### `microsoft_code_sample_search`

- tool output schema changed

  - **After**: {
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": {
            "type": "string"
          },
          "codeSnippet": {
            "type": [
              "string",
              "null"
            ]
          },
          "link": {
            "type": "string"
          },
          "language": {
            "type": "string"
          },
          "content_omitted": {
            "type": "boolean"
          }
        }
      }
    }
  }
}


##### `microsoft_docs_fetch`

- description changed

  | Before | After |
  |--------|-------|
  | Fetch and convert a Microsoft Learn documentation page to markdown format. This tool retrieves the latest complete content of Microsoft documentation pages including Azure, .NET, Microsoft 365, and other Microsoft technologies.<br><br>## When to Use This Tool<br>- When search results provide incomplete information or truncated content<br>- When you need complete step-by-step procedures or tutorials<br>- When you need troubleshooting sections, prerequisites, or detailed explanations<br>- When search results reference a specific page that seems highly relevant<br>- For comprehensive guides that require full context<br><br>## Usage Pattern<br>Use this tool AFTER microsoft_docs_search when you identify specific high-value pages that need complete content. The search tool gives you an overview; this tool gives you the complete picture.<br><br>## URL Requirements<br>- The URL must be a valid link from the microsoft.com domain.<br><br>… | Fetch and convert a Microsoft Learn documentation webpage to markdown format. This tool retrieves the latest complete content of Microsoft documentation webpages including Azure, .NET, Microsoft 365, and other Microsoft technologies.<br><br>## When to Use This Tool<br>- When search results provide incomplete information or truncated content<br>- When you need complete step-by-step procedures or tutorials<br>- When you need troubleshooting sections, prerequisites, or detailed explanations<br>- When search results reference a specific page that seems highly relevant<br>- For comprehensive guides that require full context<br><br>## Usage Pattern<br>Use this tool AFTER microsoft_docs_search when you identify specific high-value pages that need complete content. The search tool gives you an overview; this tool gives you the complete picture.<br><br>## URL Requirements<br>- The URL must be a valid HTML documentation webpage from the microsoft.com domain<br>- Binary files (PDF, DOCX, images, etc.) are not supported<br><br>… |


#### Server Info

##### `listChanged`

- capability property changed

  - **After**: true
  - **Migration**: Document capability changes clearly and evaluate impact on clients

- capability property changed

  - **After**: true
  - **Migration**: Document capability changes clearly and evaluate impact on clients

##### `corsSupport`

- cors detection added

  - **After**: {
  "browserReady": false,
  "responseHeaders": {},
  "preflight": {
    "tested": true,
    "status": 204,
    "accessControlAllowOrigin": "*",
    "accessControlAllowMethods": [
      "POST"
    ],
    "accessControlAllowHeaders": [
      "Content-Type",
      "Mcp-Session-Id"
    ]
  }
}

