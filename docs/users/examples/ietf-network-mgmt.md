# IETF Network Management MCP Server Dump Documentation

## Overview

This document describes the MCP server capability dump for a network equipment management server implementing the IETF specification [draft-zw-opsawg-mcp-network-mgmt-00](https://www.ietf.org/archive/id/draft-zw-opsawg-mcp-network-mgmt-00.html).

**File**: `ietf-network-mgmt-mcp-dump.json`  
**Created**: 2025-11-12  
**MCP Protocol Version**: 2025-06-18  
**Specification**: IETF draft-zw-opsawg-mcp-network-mgmt-00

## Purpose

This dump represents what an MCP server would expose if implemented according to the IETF specification for "Model Context Protocol (MCP) Extensions for Network Equipment Management". The specification defines minimal extensions to allow network equipment (routers, switches, etc.) to act as MCP servers while controllers act as MCP clients.

## Server Information

- **Name**: IOS-XR-MCP
- **Version**: 7.5.3
- **Protocol Version**: 2025-06-18
- **Transport**: stdio (command-based)
- **CLI Dialect**: huawei-vrp

## Capabilities

### Standard MCP Capabilities

- **Prompts**: listChanged = false
- **Resources**: subscribe = true, listChanged = false
- **Tools**: listChanged = false

### Network-Specific Capability (Extension)

The server advertises a custom `network` capability object containing:

```json
{
  "yangModules": [
    "ietf-interfaces",
    "ietf-ip",
    "ietf-routing",
    "openconfig-interfaces",
    "openconfig-network-instance",
    "openconfig-vlan",
    "ietf-system"
  ],
  "cliDialect": "huawei-vrp",
  "configDatastore": ["running", "candidate", "operational"],
  "notificationStream": ["syslog", "netconf-stream", "snmp-trap"],
  "maxBulkEdit": 1000,
  "supportsRollback": true,
  "rollbackTimeout": 300
}
```

This extension allows controllers to:
- Discover supported YANG modules
- Identify CLI dialect for command syntax
- Determine available datastores (running, candidate, operational)
- Learn about notification/event stream capabilities
- Understand bulk edit limitations
- Verify rollback support and timeout windows

## Tools (8 total)

The server exposes 8 tools as defined in Section 4 of the IETF specification:

### 1. network.cli.exec
Execute operational CLI show commands for retrieving state and diagnostics.

**Parameters**:
- `cmd` (required): CLI command to execute
- `timeout` (optional): Command timeout in seconds (1-300, default: 30)

**Use cases**: Show commands, operational queries, diagnostics

### 2. network.cli.configure
Enter configuration mode and send configuration commands to candidate datastore.

**Parameters**:
- `commands` (required): Array of configuration commands
- `target` (optional): Target datastore (candidate/running, default: candidate)

**Use cases**: Configuration changes requiring commit

### 3. network.yang.get
Retrieve YANG data node from specified datastore with XPath-style paths.

**Parameters**:
- `path` (required): YANG data path
- `datastore` (optional): running/operational/candidate (default: operational)
- `depth` (optional): Subtree depth (0 = unlimited)

**Use cases**: Structured data retrieval, YANG model queries

### 4. network.yang.edit
Edit candidate datastore using YANG structures. Supports merge, create, replace, delete operations.

**Parameters**:
- `target` (optional): Target datastore (candidate)
- `edit` (required): Array of edit operations with path, operation, and value

**Use cases**: Structured configuration changes via YANG models

### 5. network.commit
Commit candidate configuration to running datastore with optional confirmed commit.

**Parameters**:
- `confirmed` (optional): Timeout in seconds for confirmed commit (0-3600, default: 0)
- `confirm` (optional): Confirm previous confirmed commit (boolean)
- `comment` (optional): Audit trail comment

**Use cases**: Applying configuration changes, safe commits with rollback window

### 6. network.rollback
Rollback configuration to previous commit state.

**Parameters**:
- `commitId` (optional): Specific commit ID to rollback to
- `steps` (optional): Number of commits to rollback (1-100, default: 1)

**Use cases**: Undo configuration changes, disaster recovery

### 7. network.file.pull
Backup configuration file from device to controller.

**Parameters**:
- `filename` (optional): File to retrieve (running-config/startup-config/candidate-config)
- `format` (optional): Output format (text/xml/json, default: text)

**Use cases**: Configuration backup, audit, disaster recovery

### 8. network.file.push
Restore configuration file to device with validation.

**Parameters**:
- `filename` (required): Target file (candidate-config/startup-config)
- `content` (required): File content
- `format` (optional): Content format (text/xml/json, default: text)
- `validate` (optional): Validate before writing (default: true)

**Use cases**: Configuration restore, provisioning, mass deployment

## Resources (8 fixed + 3 templates)

### Fixed Resources

Resources defined in Section 5.1 of the specification:

1. **network:///interfaces**
   - All network interfaces with operational/config state
   - MIME: `application/yang-data+json`
   - Supports: subscription, pagination

2. **network:///routing/ipv4/route-table**
   - IPv4 routing information base (RIB)
   - MIME: `application/yang-data+json`
   - Supports: subscription, pagination

3. **network:///routing/ipv6/route-table**
   - IPv6 routing information base (RIB)
   - MIME: `application/yang-data+json`
   - Supports: subscription, pagination

4. **network:///system/cpu-utilization**
   - Real-time CPU percentage (updated every 30s)
   - MIME: `application/json`
   - Supports: subscription
   - Metadata: unit=percent, precision=0.1

5. **network:///system/memory-summary**
   - Memory usage summary (updated every 30s)
   - MIME: `application/json`
   - Supports: subscription
   - Metadata: unit=bytes

6. **network:///file/running-config**
   - Current active configuration (plain text)
   - MIME: `text/plain`
   - Read-only

7. **network:///file/startup-config**
   - Boot configuration (plain text)
   - MIME: `text/plain`
   - Read-only

8. **network:///file/candidate-config**
   - Staged configuration changes (plain text)
   - MIME: `text/plain`
   - Read-write (optional per spec Section 5.3)

### Resource Templates (URI Templates)

Dynamic resources using RFC 6570 URI templates:

1. **network:///interface/{name}**
   - Single interface details by name
   - Parameters: name (required) - interface identifier
   - MIME: `application/yang-data+json`
   - Supports: subscription

2. **network:///log/syslog/last{count}**
   - Recent syslog messages (max 10,000)
   - Parameters: count (required, 1-10000) - number of entries
   - MIME: `text/plain; charset=utf-8`
   - Supports: subscription

3. **network:///file/{slot}/crashinfo**
   - Crash information by hardware slot
   - Parameters: slot (required) - hardware slot identifier
   - MIME: `application/json`
   - Hardware-specific metadata

## Prompts (3 interactive workflows)

Defined in Section 6 of the specification:

### 1. network.troubleshoot.ping-fail
Step-by-step ping failure diagnosis workflow.

**Arguments**:
- `src` (required): Source IP address
- `dst` (required): Destination IP address
- `vrf` (optional): VRF/routing instance name

**Workflow**: ARP checks → interface status → routing table → extended ping → remediation

### 2. network.config.add-vlan
Interactive VLAN creation wizard.

**Arguments**:
- `vlan_id` (required): IEEE 802.1Q VLAN ID (1-4094)
- `name` (required): VLAN name (alphanumeric, no spaces)
- `ports` (optional): List of interface names

**Workflow**: Validation → CLI command generation → configuration application

### 3. network.security.audit
Security compliance check execution.

**Arguments**:
- `profile` (required): Audit profile (basic/detailed)

**Workflow**: Profile selection → checks execution → report generation → remediation recommendations

## Key Features from Specification

### Capability Advertisement (Section 3)
- Custom `network` capability namespace
- YANG module discovery
- CLI dialect identification
- Datastore availability
- Notification stream types
- Bulk edit limits
- Rollback support indication

### Pagination Support (Section 5.2)
Resources like routing tables support cursor-based pagination using `nextCursor` for large datasets.

### Subscription Support (Section 5.2)
Dynamic resources (CPU, memory, syslog, interfaces) support `resources/subscribe` for real-time updates via `resources/updated` notifications.

### Read-Write Resources (Section 5.3)
Optional support for writing to `candidate-config` and `startup-config` via `resources/write` method.

### Error Codes (Section 7)
The specification defines error codes -32081 to -32090 for network-specific failures:
- Network.Timeout (-32081)
- Network.Unreachable (-32082)
- Network.AccessDenied (-32083)
- Network.ConfigIncompatible (-32084)
- Network.RollbackFailed (-32085)
- Network.ConfirmedCommitTimeout (-32086)
- And others...

## Use Cases

This MCP server implementation enables:

1. **AI-Driven Network Management**: LLMs can interact with network devices using standardized MCP interface instead of vendor-specific APIs
2. **Unified Protocol**: Single JSON-RPC 2.0 interface replaces CLI, NETCONF, SNMP, gNMI
3. **Safe Configuration**: Confirmed commits with automatic rollback
4. **Interactive Troubleshooting**: Guided diagnostic workflows via prompts
5. **Real-time Monitoring**: Resource subscriptions for streaming telemetry
6. **Multi-Vendor Support**: CLI dialect hints allow controllers to adapt to different vendors

## Compliance Notes

This dump conforms to:
- MCP specification 2025-06-18
- IETF draft-zw-opsawg-mcp-network-mgmt-00
- mcpdesc 0.7.0 (x-cisco-metadata extension 0.2.0)

All tools, resources, and prompts align with the examples and requirements in the IETF specification sections 4, 5, and 6 respectively.

## Related Files

- **Dump File**: `ietf-network-mgmt-mcp-dump.json`
- **Specification**: https://www.ietf.org/archive/id/draft-zw-opsawg-mcp-network-mgmt-00.html
- **Schema**: `../../schemas/mcp-description/0.7.0.json`

## References

- [IETF Draft: MCP Extensions for Network Equipment Management](https://www.ietf.org/archive/id/draft-zw-opsawg-mcp-network-mgmt-00.html)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic)
- [RFC 6570: URI Template](https://www.rfc-editor.org/rfc/rfc6570)
- [RFC 7950: YANG 1.1 Data Modeling Language](https://www.rfc-editor.org/rfc/rfc7950)
