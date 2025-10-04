# AGENTS.md

This file provides guidance for coding agents working in this repository.

> **Important**: Any edits made to AGENTS.md must also be applied identically to CLAUDE.md (with the exception of the introductory explanation). Keep both files in sync.

## Project Overview

This is a Model Context Protocol (MCP) server that provides tools for interacting with Shopify stores via the GraphQL Admin API (version 2025-04). It's a TypeScript-based Node.js module that implements the MCP protocol to enable AI assistants to manage Shopify store data.

## Essential Commands

```bash
# Build the TypeScript code
npm run build

# Run tests (uses experimental VM modules for ESM support)
npm test

# Run a specific test file
npx jest src/__tests__/ShopifyClient.test.ts

# Test MCP server functionality
node test-mcp.js

# Test API endpoints
node test-api.js
```

## Architecture

The codebase follows a clean architecture pattern with these key components:

- **src/index.ts**: Main entry point that implements the MCP server protocol. Sets up all Shopify tool handlers and manages the server lifecycle.

- **src/ShopifyClient/ShopifyClient.ts**: Core client class that handles all Shopify GraphQL API interactions. Contains methods for product, customer, order, and collection management.

- **src/ShopifyClient/ShopifyClientPort.ts**: Type definitions and interfaces for Shopify data structures, error handling, and GraphQL operations.

The server communicates with Shopify exclusively through GraphQL queries and mutations, formatting all IDs as Global IDs (GIDs) automatically.

## Environment Configuration

Required environment variables:
- `SHOPIFY_ACCESS_TOKEN`: Admin API access token from Shopify custom app
- `MYSHOPIFY_DOMAIN`: Store's myshopify.com domain (e.g., "store-name.myshopify.com")

For local development, create a `.env` file with these variables.

## Error Handling Strategy

The codebase uses a structured error handling approach with custom error types:
- `ShopifyAuthorizationError`: Authentication/permission issues
- `ShopifyInputError`: Invalid input parameters
- `ShopifyRequestError`: API request failures
- `ShopifyPaymentError`: Payment-related errors
- Product variant specific errors for availability and not found cases

All GraphQL errors are parsed and categorized using helper functions in the ShopifyClientPort module.

## Testing Approach

Tests use Jest with ts-jest for TypeScript support. The test suite is located in `src/__tests__/` and focuses on the ShopifyClient functionality. Use the `--experimental-vm-modules` flag when running tests due to ESM module usage.

## MCP Tool Implementation Pattern

Each MCP tool follows this pattern in index.ts:
1. Parse and validate input using Zod schemas
2. Call appropriate ShopifyClient method
3. Format response data (products use custom formatters)
4. Return structured JSON responses

## GraphQL ID Formatting

The codebase automatically handles Shopify Global ID (GID) formatting. When implementing new features:
- Always prefix IDs with appropriate GID format (e.g., "gid://shopify/Product/123")
- The ShopifyClient includes helper methods for ID formatting