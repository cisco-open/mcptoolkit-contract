# Microsoft Learn MCP Server

**Server Version:** 1.0.0 | **MCP Specifications:** 2025-06-18

Reference documentation for the **Microsoft Learn MCP Server** MCP server capabilities.

---

## Summary

### Tools (3)

- [`microsoft_docs_search`](#microsoft_docs_search) - Search official Microsoft/Azure documentation to find the most relevant and trustworthy content for a user's query.
- [`microsoft_code_sample_search`](#microsoft_code_sample_search) - Search for code snippets and examples in official Microsoft Learn documentation.
- [`microsoft_docs_fetch`](#microsoft_docs_fetch) - Fetch and convert a Microsoft Learn documentation webpage to markdown format.




---

## Details

### Tools

#### Tool `microsoft_docs_search`

Search official Microsoft/Azure documentation to find the most relevant and trustworthy content for a user's query. This tool returns up to 10 high-quality content chunks (each max 500 tokens), extracted from Microsoft Learn and other official sources. Each result includes the article title, URL, and a self-contained content excerpt optimized for fast retrieval and reasoning. Always use this tool to quickly ground your answers in accurate, first-party Microsoft/Azure knowledge.

## Follow-up Pattern
To ensure completeness, use microsoft_docs_fetch when high-value pages are identified by search. The fetch tool complements search by providing the full detail. This is a required step for comprehensive results.

**Parameters:**

- **`query`** (string)
  a query or topic about Microsoft/Azure products, services, platforms, developer tools, frameworks, or APIs


---

#### Tool `microsoft_code_sample_search`

Search for code snippets and examples in official Microsoft Learn documentation. This tool retrieves relevant code samples from Microsoft documentation pages providing developers with practical implementation examples and best practices for Microsoft/Azure products and services related coding tasks. This tool will help you use the **LATEST OFFICIAL** code snippets to empower coding capabilities.

## When to Use This Tool
- When you are going to provide sample Microsoft/Azure related code snippets in your answers.
- When you are **generating any Microsoft/Azure related code**.

## Usage Pattern
Input a descriptive query, or SDK/class/method name to retrieve related code samples. The optional parameter `language` can help to filter results.

Eligible values for `language` parameter include: csharp javascript typescript python powershell azurecli al sql java kusto cpp go rust ruby php

**Parameters:**

- **`query`** (string) - *required*
  a descriptive query, SDK name, method name or code snippet related to Microsoft/Azure products, services, platforms, developer tools, frameworks, APIs or SDKs

- **`language`** (string)
  Optional parameter specifying the programming language of code snippets to retrieve. Can significantly improve search quality if provided. Eligible values: csharp javascript typescript python powershell azurecli al sql java kusto cpp go rust ruby php


---

#### Tool `microsoft_docs_fetch`

Fetch and convert a Microsoft Learn documentation webpage to markdown format. This tool retrieves the latest complete content of Microsoft documentation webpages including Azure, .NET, Microsoft 365, and other Microsoft technologies.

## When to Use This Tool
- When search results provide incomplete information or truncated content
- When you need complete step-by-step procedures or tutorials
- When you need troubleshooting sections, prerequisites, or detailed explanations
- When search results reference a specific page that seems highly relevant
- For comprehensive guides that require full context

## Usage Pattern
Use this tool AFTER microsoft_docs_search when you identify specific high-value pages that need complete content. The search tool gives you an overview; this tool gives you the complete picture.

## URL Requirements
- The URL must be a valid HTML documentation webpage from the microsoft.com domain
- Binary files (PDF, DOCX, images, etc.) are not supported

## Output Format
markdown with headings, code blocks, tables, and links preserved.

**Parameters:**

- **`url`** (string) - *required*
  URL of the Microsoft documentation page to read







---

*Generated with [mcpcontract](https://github.com/cisco-open/mcptoolkit-contract) v1.0.0-rc.3*
