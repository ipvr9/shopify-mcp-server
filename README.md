# Shopify MCP Server

MCP Server for Shopify API, enabling interaction with store data through GraphQL API. This server provides tools for managing products, customers, orders, and more.

<a href="https://glama.ai/mcp/servers/bemvhpy885"><img width="380" height="200" src="https://glama.ai/mcp/servers/bemvhpy885/badge" alt="Shopify Server MCP server" /></a>

## Features

* **Product Management**: Search and retrieve product information
* **Customer Management**: Load customer data and manage customer tags
* **Order Management**: Advanced order querying and filtering
* **GraphQL Integration**: Direct integration with Shopify's GraphQL Admin API
* **Comprehensive Error Handling**: Clear error messages for API and authentication issues

## Tools

1. `get-products`
   * Get products from your Shopify store
   * Inputs:
     * `searchTitle` (optional string): Filter products by title
     * `limit` (number): Maximum number of products to return
   * Returns: Formatted product details including:
     * Title, description, handle
     * Variants with prices, SKUs, and inventory policies

2. `get-customers`
   * Retrieve customer information
   * Inputs:
     * `limit` (optional number): Maximum number of customers to return
     * `next` (optional string): Pagination cursor for next page
   * Returns: Customer data in JSON format

3. `tag-customer`
   * Add tags to a customer
   * Inputs:
     * `customerId` (string): ID of the customer to tag
     * `tags` (array of strings): Tags to add to the customer
   * Returns: Success or failure message

4. `get-orders`
   * Fetch and filter orders
   * Inputs:
     * `first` (optional number): Number of orders to return
     * `after` (optional string): Pagination cursor
     * `query` (optional string): Filter query
     * `sortKey` (optional enum): Sort field ('PROCESSED_AT', 'TOTAL_PRICE', 'ID', 'CREATED_AT', 'UPDATED_AT', 'ORDER_NUMBER')
     * `reverse` (optional boolean): Reverse sort order
   * Returns: Formatted order details including:
     * Order ID and status
     * Financial information
     * Customer details
     * Shipping information
     * Line items with variants

## Setup

### Shopify Access Token

To use this MCP server, you'll need to create a custom app in your Shopify store:

1. From your Shopify admin, go to **Settings** > **Apps and sales channels**
2. Click **Develop apps** (you may need to enable developer preview first)
3. Click **Create an app**
4. Set a name for your app (e.g., "Shopify MCP Server")
5. Click **Configure Admin API scopes**
6. Select the following scopes:
   * `read_products`, `write_products`
   * `read_customers`, `write_customers`
   * `read_orders`, `write_orders`
7. Click **Save**
8. Click **Install app**
9. Click **Install** to give the app access to your store data
10. After installation, you'll see your **Admin API access token**
11. Copy this token - you'll need it for configuration

Note: Store your access token securely. It provides access to your store data and should never be shared or committed to version control.
More details on how to create a Shopify app can be found [here](https://help.shopify.com/en/manual/apps/app-types/custom-apps).

### Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "shopify": {
      "command": "npx",
      "args": ["-y", "shopify-mcp-server"],
      "env": {
        "SHOPIFY_ACCESS_TOKEN": "<YOUR_ACCESS_TOKEN>",
        "MYSHOPIFY_DOMAIN": "<YOUR_SHOP>.myshopify.com"
      }
    }
  }
}
```

## Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file:
```
SHOPIFY_ACCESS_TOKEN=your_access_token
MYSHOPIFY_DOMAIN=your-store.myshopify.com
```
4. Build the project:
```bash
npm run build
```
5. Run tests:
```bash
npm test
```

## Dependencies

- @modelcontextprotocol/sdk - MCP protocol implementation
- graphql-request - GraphQL client for Shopify API
- zod - Runtime type validation

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

## License

MIT

## Community

- [MCP GitHub Discussions](https://github.com/modelcontextprotocol/servers/discussions)
- [Report Issues](https://github.com/your-username/shopify-mcp-server/issues)

---

Built with ❤️ using the [Model Context Protocol](https://modelcontextprotocol.io) 
