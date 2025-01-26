#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ShopifyClient } from "./ShopifyClient/ShopifyClient.js";
import {
  CustomError,
  ProductNode,
  ShopifyOrderGraphql,
} from "./ShopifyClient/ShopifyClientPort.js";

const server = new McpServer({
  name: "shopify-tools",
  version: "1.0.0",
});

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
if (!SHOPIFY_ACCESS_TOKEN) {
  console.error("Error: SHOPIFY_ACCESS_TOKEN environment variable is required");
  process.exit(1);
}

const MYSHOPIFY_DOMAIN = process.env.MYSHOPIFY_DOMAIN;
if (!MYSHOPIFY_DOMAIN) {
  console.error("Error: MYSHOPIFY_DOMAIN environment variable is required");
  process.exit(1);
}

function formatProduct(product: ProductNode): string {
  return `
  Product: ${product.title} 
  description: ${product.description} 
  handle: ${product.handle}
  variants: ${product.variants.edges
    .map(
      (variant) => `variant.title: ${variant.node.title}
    variant.id: ${variant.node.id}
    variant.price: ${variant.node.price}
    variant.sku: ${variant.node.sku}
    variant.inventoryPolicy: ${variant.node.inventoryPolicy}
    `
    )
    .join(", ")}
  `;
}

function formatOrder(order: ShopifyOrderGraphql): string {
  return `
  Order: ${order.name} (${order.id})
  Created At: ${order.createdAt}
  Status: ${order.displayFinancialStatus || "N/A"}
  Email: ${order.email || "N/A"}
  Phone: ${order.phone || "N/A"}
  
  Total Price: ${order.totalPriceSet.shopMoney.amount} ${
    order.totalPriceSet.shopMoney.currencyCode
  }
  
  Customer: ${
    order.customer
      ? `
    ID: ${order.customer.id}
    Email: ${order.customer.email}`
      : "No customer information"
  }

  Shipping Address: ${
    order.shippingAddress
      ? `
    Province: ${order.shippingAddress.provinceCode || "N/A"}
    Country: ${order.shippingAddress.countryCode}`
      : "No shipping address"
  }

  Line Items: ${
    order.lineItems.nodes.length > 0
      ? order.lineItems.nodes
          .map(
            (item) => `
    Title: ${item.title}
    Quantity: ${item.quantity}
    Price: ${item.originalTotalSet.shopMoney.amount} ${
              item.originalTotalSet.shopMoney.currencyCode
            }
    Variant: ${
      item.variant
        ? `
      Title: ${item.variant.title}
      SKU: ${item.variant.sku || "N/A"}
      Price: ${item.variant.price}`
        : "No variant information"
    }`
          )
          .join("\n")
      : "No items"
  }
  `;
}

server.tool(
  "get-products",
  "Get shopify products",
  {
    searchTitle: z
      .string()
      .optional()
      .describe("Search title, if missing, will return all products"),
    limit: z.number().describe("Limit"),
  },
  async ({ searchTitle, limit }) => {
    const client = new ShopifyClient();

    try {
      const products = await client.loadProducts(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        searchTitle ?? null,
        limit
      );

      const formattedProducts = products.products.map(formatProduct);
      return {
        content: [
          {
            type: "text",
            text: formattedProducts.join("\n"),
          },
        ],
      };
    } catch (error) {
      let errorMessage = "Failed to retrieve products data";
      if (error instanceof CustomError) {
        errorMessage = `Failed to retrieve products data with this error: ${error.message}`;
      }
      return {
        content: [
          {
            type: "text",
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get-customers",
  "Get shopify customers",
  {
    limit: z.number().optional().describe("Limit of customers to return"),
    next: z.string().optional().describe("Next page cursor"),
  },
  async ({ limit, next }) => {
    const client = new ShopifyClient();

    try {
      const response = await client.loadCustomers(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        limit,
        next
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      let errorMessage = "Failed to retrieve customers data";
      if (error instanceof CustomError) {
        errorMessage = `Failed to retrieve customers data with this error: ${error.message}`;
      }
      return {
        content: [
          {
            type: "text",
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "tag-customer",
  "Tag a shopify customer",
  {
    customerId: z.string().describe("Customer ID to tag"),
    tags: z.array(z.string()).describe("Tags to add to the customer"),
  },
  async ({ customerId, tags }) => {
    const client = new ShopifyClient();

    try {
      const success = await client.tagCustomer(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        tags,
        customerId
      );

      return {
        content: [
          {
            type: "text",
            text: success
              ? "Successfully tagged customer"
              : "Failed to tag customer",
          },
        ],
      };
    } catch (error) {
      let errorMessage = "Failed to tag customer";
      if (error instanceof CustomError) {
        errorMessage = `Failed to tag customer with this error: ${error.message}`;
      }
      return {
        content: [
          {
            type: "text",
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get-orders",
  "Get shopify orders",
  {
    first: z.number().optional().describe("Limit of orders to return"),
    after: z.string().optional().describe("Next page cursor"),
    query: z.string().optional().describe("Filter orders using query syntax"),
    sortKey: z
      .enum([
        "PROCESSED_AT",
        "TOTAL_PRICE",
        "ID",
        "CREATED_AT",
        "UPDATED_AT",
        "ORDER_NUMBER",
      ])
      .optional()
      .describe("Field to sort by"),
    reverse: z.boolean().optional().describe("Reverse sort order"),
  },
  async ({ first, after, query, sortKey, reverse }) => {
    const client = new ShopifyClient();

    try {
      const response = await client.loadOrders(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        {
          first,
          after,
          query,
          sortKey,
          reverse,
        }
      );

      const formattedOrders = response.orders.map(formatOrder);
      return {
        content: [
          {
            type: "text",
            text: formattedOrders.join("\n---\n"),
          },
        ],
      };
    } catch (error) {
      let errorMessage = "Failed to retrieve orders data";
      if (error instanceof CustomError) {
        errorMessage = `Failed to retrieve orders data with this error: ${error.message}`;
      }
      return {
        content: [
          {
            type: "text",
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Shopify MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
