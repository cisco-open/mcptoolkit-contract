# Catalog Test Fixtures

This directory contains test fixtures for catalog validation tests.

## Structure

```
catalogs/
├── valid/              # Valid catalog entries for testing
├── invalid/            # Invalid catalog entries for negative tests
└── completeness/       # Rules files and catalogs for completeness tests
```

## Usage

These fixtures are used by the catalog validator unit tests to ensure:
- Schema validation works correctly
- Internal consistency checks function
- Completeness validation detects missing entries
- Custom catalog discovery works as expected

## Adding Test Cases

When adding new catalog validation features, create corresponding test fixtures here.
