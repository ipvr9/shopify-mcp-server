# Shopify MCP Server

> 🔧 This is a fork of the original [shopify-mcp-server](https://github.com/amir-bengherbi/shopify-mcp-server) by Amir Bengherbi.

MCP Server for Shopify API, enabling interaction with store data through GraphQL API. This fork includes additional tools for product and collection management.

## What's Different

This fork adds:
- Additional tools for product/collection management (see New Tools section below)
- Uses Shopify GraphQL Admin API version 2025-04
- Includes automatic GID formatting for IDs

## Features

* **Product Management**: Search and retrieve product information
* **Customer Management**: Load customer data and manage customer tags
* **Order Management**: Advanced order querying and filtering
* **GraphQL Integration**: Direct integration with Shopify's GraphQL Admin API
* **Comprehensive Error Handling**: Clear error messages for API and authentication issues

## Tools

### Original Tools (from upstream)

1. `get-products`
   * Get all products or search by title
   * Inputs:
     * `searchTitle` (optional string): Filter products by title
     * `limit` (number): Maximum number of products to return
   * Returns: Formatted product details including title, description, handle, and variants

2. `get-products-by-collection`
   * Get products from a specific collection
   * Inputs:
     * `collectionId` (string): ID of the collection to get products from
     * `limit` (optional number, default: 10): Maximum number of products to return
   * Returns: Formatted product details from the specified collection

3. `get-products-by-ids`
   * Get products by their IDs
   * Inputs:
     * `productIds` (array of strings): Array of product IDs to retrieve
   * Returns: Formatted product details for the specified products

4. `get-variants-by-ids`
   * Get product variants by their IDs
   * Inputs:
     * `variantIds` (array of strings): Array of variant IDs to retrieve
   * Returns: Detailed variant information including product details

5. `get-customers`
   * Get shopify customers with pagination support
   * Inputs:
     * `limit` (optional number): Maximum number of customers to return
     * `next` (optional string): Next page cursor
   * Returns: Customer data in JSON format

6. `tag-customer`
   * Add tags to a customer
   * Inputs:
     * `customerId` (string): Customer ID to tag
     * `tags` (array of strings): Tags to add to the customer
   * Returns: Success or failure message

7. `get-orders`
   * Get orders with advanced filtering and sorting
   * Inputs:
     * `first` (optional number): Limit of orders to return
     * `after` (optional string): Next page cursor
     * `query` (optional string): Filter orders using query syntax
     * `sortKey` (optional enum): Field to sort by ('PROCESSED_AT', 'TOTAL_PRICE', 'ID', 'CREATED_AT', 'UPDATED_AT', 'ORDER_NUMBER')
     * `reverse` (optional boolean): Reverse sort order
   * Returns: Formatted order details

8. `get-order`
   * Get a single order by ID
   * Inputs:
     * `orderId` (string): ID of the order to retrieve
   * Returns: Detailed order information

9. `create-discount`
   * Create a basic discount code
   * Inputs:
     * `title` (string): Title of the discount
     * `code` (string): Discount code that customers will enter
     * `valueType` (enum): Type of discount ('percentage' or 'fixed_amount')
     * `value` (number): Discount value (percentage as decimal or fixed amount)
     * `startsAt` (string): Start date in ISO format
     * `endsAt` (optional string): Optional end date in ISO format
     * `appliesOncePerCustomer` (boolean): Whether discount can be used only once per customer
   * Returns: Created discount details

10. `create-draft-order`
    * Create a draft order
    * Inputs:
      * `lineItems` (array): Array of items with variantId and quantity
      * `email` (string): Customer email
      * `shippingAddress` (object): Shipping address details
      * `note` (optional string): Optional note for the order
    * Returns: Created draft order details

11. `complete-draft-order`
    * Complete a draft order
    * Inputs:
      * `draftOrderId` (string): ID of the draft order to complete
      * `variantId` (string): ID of the variant in the draft order
    * Returns: Completed order details

12. `get-collections`
    * Get all collections
    * Inputs:
      * `limit` (optional number, default: 10): Maximum number of collections to return
      * `name` (optional string): Filter collections by name
    * Returns: Collection details

13. `get-shop`
    * Get shop details
    * Inputs: None
    * Returns: Basic shop information

14. `get-shop-details`
    * Get extended shop details including shipping countries
    * Inputs: None
    * Returns: Extended shop information including shipping countries

15. `manage-webhook`
    * Subscribe, find, or unsubscribe webhooks
    * Inputs:
      * `action` (enum): Action to perform ('subscribe', 'find', 'unsubscribe')
      * `callbackUrl` (string): Webhook callback URL
      * `topic` (enum): Webhook topic to subscribe to
      * `webhookId` (optional string): Webhook ID (required for unsubscribe)
    * Returns: Webhook details or success message

### New Tools (added in this fork)

16. `create-product`
    * Create a new product with variants and options
    * Inputs:
      * `title` (string): Product title
      * `descriptionHtml` (optional string): Product description in HTML
      * `vendor` (optional string): Product vendor
      * `productType` (optional string): Product type
      * `handle` (optional string): Product handle/slug
      * `status` (optional enum): Product status (ACTIVE, ARCHIVED, DRAFT)
      * `tags` (optional array): Product tags
      * `productOptions` (optional array): Product options (e.g., Size, Color)
      * `metafields` (optional array): Product metafields
    * Returns: Created product details

17. `update-product`
    * Update an existing product
    * Inputs:
      * `id` (string): Product ID to update
      * All other fields from create-product (optional)
    * Returns: Updated product details

18. `create-product-variants-bulk`
    * Create multiple variants for a product
    * Inputs:
      * `productId` (string): Product ID to add variants to
      * `variants` (array): Array of variant objects with optionValues, price, barcode, etc.
    * Returns: Created variants details

19. `update-product-variants-bulk`
    * Update multiple variants for a product
    * Inputs:
      * `productId` (string): Product ID
      * `variants` (array): Array of variant objects with id and fields to update
    * Returns: Updated variants details

20. `delete-product-variants-bulk`
    * Delete multiple variants from a product
    * Inputs:
      * `productId` (string): Product ID
      * `variantIds` (array): Array of variant IDs to delete
    * Returns: Deletion confirmation

21. `create-staged-uploads`
    * Stage media files for upload to Shopify
    * Inputs:
      * `uploads` (array): Array of upload requests with filename, mimeType, resource type
    * Returns: Staged upload URLs and parameters

22. `create-product-media`
    * Add media files to a product
    * Inputs:
      * `productId` (string): Product ID to add media to
      * `media` (array): Array of media objects with originalSource URLs
    * Returns: Created media details

23. `set-metafields`
    * Set metafields for products, variants, or other resources
    * Inputs:
      * `metafields` (array): Array of metafield objects with key, namespace, ownerId, type, value
    * Returns: Created/updated metafield details

24. `create-collection`
    * Create a new collection
    * Inputs:
      * `title` (string): Collection title
      * `descriptionHtml` (optional string): Collection description
      * `handle` (optional string): Collection handle
      * `products` (optional array): Product IDs to include
      * `ruleSet` (optional object): Smart collection rules
      * `metafields` (optional array): Collection metafields
    * Returns: Created collection details

25. `update-collection`
    * Update an existing collection
    * Inputs:
      * `id` (string): Collection ID to update
      * All other fields from create-collection (optional)
    * Returns: Updated collection details

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

Since this is a fork, you'll need to run it locally. First clone and build this repository (see Development section below).

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "shopify": {
      "command": "node",
      "args": ["/path/to/your/shopify-mcp-server/build/index.js"],
      "env": {
        "SHOPIFY_ACCESS_TOKEN": "<YOUR_ACCESS_TOKEN>",
        "MYSHOPIFY_DOMAIN": "<YOUR_SHOP>.myshopify.com"
      }
    }
  }
}
```

> **Note**: Replace `/path/to/your/shopify-mcp-server` with the actual path where you cloned this repository.

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

## API Version

This server uses Shopify GraphQL Admin API version **2025-04**.

## Contributing

Contributions are welcome!

## Credits

- Original author: [Amir Bengherbi](https://github.com/amir-bengherbi)
- Extended by: [Ryan Boyle](https://github.com/ipvr9) with [Claude (Opus 4)](https://claude.ai)
- Built with the [Model Context Protocol](https://modelcontextprotocol.io)

## License

MIT - See [LICENSE](LICENSE) file for details.

## Support

- [Report Issues](https://github.com/ipvr9/shopify-mcp-server/issues)
- [Original Repository](https://github.com/amir-bengherbi/shopify-mcp-server)
- [MCP GitHub Discussions](https://github.com/modelcontextprotocol/servers/discussions) 
