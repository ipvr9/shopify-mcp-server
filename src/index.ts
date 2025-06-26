#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ShopifyClient } from "./ShopifyClient/ShopifyClient.js";
import {
  CustomError,
  ProductNode,
  ShopifyOrderGraphql,
  CreateBasicDiscountCodeInput,
  CreateDraftOrderPayload,
  ShopifyWebhookTopic,
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

// Products Tools
server.tool(
  "get-products",
  "Get all products or search by title",
  {
    searchTitle: z
      .string()
      .optional()
      .describe("Search title, if missing, will return all products"),
    limit: z.number().describe("Maximum number of products to return"),
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
        content: [{ type: "text", text: formattedProducts.join("\n") }],
      };
    } catch (error) {
      return handleError("Failed to retrieve products data", error);
    }
  }
);

server.tool(
  "get-products-by-collection",
  "Get products from a specific collection",
  {
    collectionId: z
      .string()
      .describe("ID of the collection to get products from"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of products to return"),
  },
  async ({ collectionId, limit }) => {
    const client = new ShopifyClient();
    try {
      const products = await client.loadProductsByCollectionId(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        collectionId,
        limit
      );
      const formattedProducts = products.products.map(formatProduct);
      return {
        content: [{ type: "text", text: formattedProducts.join("\n") }],
      };
    } catch (error) {
      return handleError("Failed to retrieve products from collection", error);
    }
  }
);

server.tool(
  "get-products-by-ids",
  "Get products by their IDs",
  {
    productIds: z
      .array(z.string())
      .describe("Array of product IDs to retrieve"),
  },
  async ({ productIds }) => {
    const client = new ShopifyClient();
    try {
      const products = await client.loadProductsByIds(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        productIds
      );
      const formattedProducts = products.products.map(formatProduct);
      return {
        content: [{ type: "text", text: formattedProducts.join("\n") }],
      };
    } catch (error) {
      return handleError("Failed to retrieve products by IDs", error);
    }
  }
);

server.tool(
  "get-variants-by-ids",
  "Get product variants by their IDs",
  {
    variantIds: z
      .array(z.string())
      .describe("Array of variant IDs to retrieve"),
  },
  async ({ variantIds }) => {
    const client = new ShopifyClient();
    try {
      const variants = await client.loadVariantsByIds(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        variantIds
      );
      return {
        content: [{ type: "text", text: JSON.stringify(variants, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to retrieve variants", error);
    }
  }
);

// Customer Tools
server.tool(
  "get-customers",
  "Get shopify customers with pagination support",
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
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to retrieve customers data", error);
    }
  }
);

server.tool(
  "tag-customer",
  "Add tags to a customer",
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
      return handleError("Failed to tag customer", error);
    }
  }
);

// Order Tools
server.tool(
  "get-orders",
  "Get shopify orders with advanced filtering and sorting",
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
        content: [{ type: "text", text: formattedOrders.join("\n---\n") }],
      };
    } catch (error) {
      return handleError("Failed to retrieve orders data", error);
    }
  }
);

server.tool(
  "get-order",
  "Get a single order by ID",
  {
    orderId: z.string().describe("ID of the order to retrieve"),
  },
  async ({ orderId }) => {
    const client = new ShopifyClient();
    try {
      const order = await client.loadOrder(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        { orderId }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(order, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to retrieve order", error);
    }
  }
);

// Discount Tools
server.tool(
  "create-discount",
  "Create a basic discount code",
  {
    title: z.string().describe("Title of the discount"),
    code: z.string().describe("Discount code that customers will enter"),
    valueType: z
      .enum(["percentage", "fixed_amount"])
      .describe("Type of discount"),
    value: z
      .number()
      .describe("Discount value (percentage as decimal or fixed amount)"),
    startsAt: z.string().describe("Start date in ISO format"),
    endsAt: z.string().optional().describe("Optional end date in ISO format"),
    appliesOncePerCustomer: z
      .boolean()
      .describe("Whether discount can be used only once per customer"),
  },
  async ({
    title,
    code,
    valueType,
    value,
    startsAt,
    endsAt,
    appliesOncePerCustomer,
  }) => {
    const client = new ShopifyClient();
    try {
      const discountInput: CreateBasicDiscountCodeInput = {
        title,
        code,
        valueType,
        value,
        startsAt,
        endsAt,
        includeCollectionIds: [],
        excludeCollectionIds: [],
        appliesOncePerCustomer,
        combinesWith: {
          productDiscounts: true,
          orderDiscounts: true,
          shippingDiscounts: true,
        },
      };
      const discount = await client.createBasicDiscountCode(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        discountInput
      );
      return {
        content: [{ type: "text", text: JSON.stringify(discount, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to create discount", error);
    }
  }
);

// Draft Order Tools
server.tool(
  "create-draft-order",
  "Create a draft order",
  {
    lineItems: z
      .array(
        z.object({
          variantId: z.string(),
          quantity: z.number(),
        })
      )
      .describe("Line items to add to the order"),
    email: z.string().email().describe("Customer email"),
    shippingAddress: z
      .object({
        address1: z.string(),
        city: z.string(),
        province: z.string(),
        country: z.string(),
        zip: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        countryCode: z.string(),
      })
      .describe("Shipping address details"),
    note: z.string().optional().describe("Optional note for the order"),
  },
  async ({ lineItems, email, shippingAddress, note }) => {
    const client = new ShopifyClient();
    try {
      const draftOrderData: CreateDraftOrderPayload = {
        lineItems,
        email,
        shippingAddress,
        billingAddress: shippingAddress, // Using same address for billing
        tags: "draft",
        note: note || "",
      };
      const draftOrder = await client.createDraftOrder(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        draftOrderData
      );
      return {
        content: [{ type: "text", text: JSON.stringify(draftOrder, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to create draft order", error);
    }
  }
);

server.tool(
  "complete-draft-order",
  "Complete a draft order",
  {
    draftOrderId: z.string().describe("ID of the draft order to complete"),
    variantId: z.string().describe("ID of the variant in the draft order"),
  },
  async ({ draftOrderId, variantId }) => {
    const client = new ShopifyClient();
    try {
      const completedOrder = await client.completeDraftOrder(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        draftOrderId,
        variantId
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(completedOrder, null, 2) },
        ],
      };
    } catch (error) {
      return handleError("Failed to complete draft order", error);
    }
  }
);

// Collection Tools
server.tool(
  "get-collections",
  "Get all collections",
  {
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of collections to return"),
    name: z.string().optional().describe("Filter collections by name"),
  },
  async ({ limit, name }) => {
    const client = new ShopifyClient();
    try {
      const collections = await client.loadCollections(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        { limit, name }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(collections, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to retrieve collections", error);
    }
  }
);

// Shop Tools
server.tool("get-shop", "Get shop details", {}, async () => {
  const client = new ShopifyClient();
  try {
    const shop = await client.loadShop(SHOPIFY_ACCESS_TOKEN, MYSHOPIFY_DOMAIN);
    return {
      content: [{ type: "text", text: JSON.stringify(shop, null, 2) }],
    };
  } catch (error) {
    return handleError("Failed to retrieve shop details", error);
  }
});

server.tool(
  "get-shop-details",
  "Get extended shop details including shipping countries",
  {},
  async () => {
    const client = new ShopifyClient();
    try {
      const shopDetails = await client.loadShopDetail(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN
      );
      return {
        content: [{ type: "text", text: JSON.stringify(shopDetails, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to retrieve extended shop details", error);
    }
  }
);

// Webhook Tools
server.tool(
  "manage-webhook",
  "Subscribe, find, or unsubscribe webhooks",
  {
    action: z
      .enum(["subscribe", "find", "unsubscribe"])
      .describe("Action to perform with webhook"),
    callbackUrl: z.string().url().describe("Webhook callback URL"),
    topic: z
      .nativeEnum(ShopifyWebhookTopic)
      .describe("Webhook topic to subscribe to"),
    webhookId: z
      .string()
      .optional()
      .describe("Webhook ID (required for unsubscribe)"),
  },
  async ({ action, callbackUrl, topic, webhookId }) => {
    const client = new ShopifyClient();
    try {
      switch (action) {
        case "subscribe": {
          const webhook = await client.subscribeWebhook(
            SHOPIFY_ACCESS_TOKEN,
            MYSHOPIFY_DOMAIN,
            callbackUrl,
            topic
          );
          return {
            content: [{ type: "text", text: JSON.stringify(webhook, null, 2) }],
          };
        }
        case "find": {
          const webhook = await client.findWebhookByTopicAndCallbackUrl(
            SHOPIFY_ACCESS_TOKEN,
            MYSHOPIFY_DOMAIN,
            callbackUrl,
            topic
          );
          return {
            content: [{ type: "text", text: JSON.stringify(webhook, null, 2) }],
          };
        }
        case "unsubscribe": {
          if (!webhookId) {
            throw new Error("webhookId is required for unsubscribe action");
          }
          await client.unsubscribeWebhook(
            SHOPIFY_ACCESS_TOKEN,
            MYSHOPIFY_DOMAIN,
            webhookId
          );
          return {
            content: [
              { type: "text", text: "Webhook unsubscribed successfully" },
            ],
          };
        }
      }
    } catch (error) {
      return handleError("Failed to manage webhook", error);
    }
  }
);

// Product Management Tools
server.tool(
  "create-product",
  "Create a new product with variants and options",
  {
    title: z.string().describe("Product title"),
    descriptionHtml: z.string().optional().describe("Product description in HTML"),
    vendor: z.string().optional().describe("Product vendor"),
    productType: z.string().optional().describe("Product type"),
    handle: z.string().optional().describe("Product handle/slug"),
    status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional().describe("Product status"),
    tags: z.array(z.string()).optional().describe("Product tags"),
    productOptions: z.array(z.object({
      name: z.string(),
      values: z.array(z.object({
        name: z.string()
      }))
    })).optional().describe("Product options (e.g., Size, Color)"),
    metafields: z.array(z.object({
      key: z.string(),
      namespace: z.string(),
      value: z.string(),
      type: z.string()
    })).optional().describe("Product metafields")
  },
  async ({ title, descriptionHtml, vendor, productType, handle, status, tags, productOptions, metafields }) => {
    const client = new ShopifyClient();
    try {
      const product = await client.createProduct(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        {
          title,
          descriptionHtml,
          vendor,
          productType,
          handle,
          status,
          tags,
          productOptions,
          metafields
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(product, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to create product", error);
    }
  }
);

server.tool(
  "update-product",
  "Update an existing product",
  {
    id: z.string().describe("Product ID to update"),
    title: z.string().optional().describe("Product title"),
    descriptionHtml: z.string().optional().describe("Product description in HTML"),
    vendor: z.string().optional().describe("Product vendor"),
    productType: z.string().optional().describe("Product type"),
    handle: z.string().optional().describe("Product handle/slug"),
    status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional().describe("Product status"),
    tags: z.array(z.string()).optional().describe("Product tags"),
    metafields: z.array(z.object({
      key: z.string(),
      namespace: z.string(),
      value: z.string(),
      type: z.string()
    })).optional().describe("Product metafields")
  },
  async ({ id, title, descriptionHtml, vendor, productType, handle, status, tags, metafields }) => {
    const client = new ShopifyClient();
    try {
      const product = await client.updateProduct(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        {
          id,
          title,
          descriptionHtml,
          vendor,
          productType,
          handle,
          status,
          tags,
          metafields
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(product, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to update product", error);
    }
  }
);

server.tool(
  "create-product-variants-bulk",
  "Create multiple product variants at once",
  {
    productId: z.string().describe("Product ID to add variants to"),
    variants: z.array(z.object({
      optionValues: z.array(z.object({
        optionName: z.string(),
        name: z.string()
      })).optional().describe("Option values for this variant"),
      price: z.string().optional().describe("Variant price"),
      compareAtPrice: z.string().optional().describe("Compare at price"),
      barcode: z.string().optional().describe("Barcode"),
      inventoryPolicy: z.enum(["DENY", "CONTINUE"]).optional().describe("Inventory policy"),
      inventoryManagement: z.enum(["SHOPIFY", "NOT_MANAGED"]).optional().describe("Inventory management"),
      inventoryQuantity: z.number().optional().describe("Inventory quantity"),
      sku: z.string().optional().describe("SKU"),
      weight: z.number().optional().describe("Weight"),
      weightUnit: z.enum(["GRAMS", "KILOGRAMS", "OUNCES", "POUNDS"]).optional().describe("Weight unit"),
      requiresShipping: z.boolean().optional().describe("Requires shipping"),
      metafields: z.array(z.object({
        key: z.string(),
        namespace: z.string(),
        value: z.string(),
        type: z.string()
      })).optional().describe("Variant metafields")
    })).describe("Array of variants to create")
  },
  async ({ productId, variants }) => {
    const client = new ShopifyClient();
    try {
      const result = await client.createProductVariantsBulk(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        productId,
        variants
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to create product variants", error);
    }
  }
);

server.tool(
  "update-product-variants-bulk",
  "Update multiple product variants at once",
  {
    productId: z.string().describe("Product ID"),
    variants: z.array(z.object({
      id: z.string().describe("Variant ID to update"),
      optionValues: z.array(z.object({
        optionName: z.string(),
        name: z.string()
      })).optional().describe("Option values for this variant"),
      price: z.string().optional().describe("Variant price"),
      compareAtPrice: z.string().optional().describe("Compare at price"),
      barcode: z.string().optional().describe("Barcode"),
      inventoryPolicy: z.enum(["DENY", "CONTINUE"]).optional().describe("Inventory policy"),
      inventoryManagement: z.enum(["SHOPIFY", "NOT_MANAGED"]).optional().describe("Inventory management"),
      inventoryQuantity: z.number().optional().describe("Inventory quantity"),
      sku: z.string().optional().describe("SKU"),
      weight: z.number().optional().describe("Weight"),
      weightUnit: z.enum(["GRAMS", "KILOGRAMS", "OUNCES", "POUNDS"]).optional().describe("Weight unit"),
      requiresShipping: z.boolean().optional().describe("Requires shipping"),
      metafields: z.array(z.object({
        key: z.string(),
        namespace: z.string(),
        value: z.string(),
        type: z.string()
      })).optional().describe("Variant metafields")
    })).describe("Array of variants to update")
  },
  async ({ productId, variants }) => {
    const client = new ShopifyClient();
    try {
      const result = await client.updateProductVariantsBulk(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        productId,
        variants
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to update product variants", error);
    }
  }
);

server.tool(
  "delete-product-variants-bulk",
  "Delete multiple product variants at once",
  {
    productId: z.string().describe("Product ID"),
    variantIds: z.array(z.string()).describe("Array of variant IDs to delete")
  },
  async ({ productId, variantIds }) => {
    const client = new ShopifyClient();
    try {
      const result = await client.deleteProductVariantsBulk(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        productId,
        variantIds
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to delete product variants", error);
    }
  }
);

server.tool(
  "create-staged-uploads",
  "Create staged uploads for media files",
  {
    uploads: z.array(z.object({
      filename: z.string().describe("Filename"),
      mimeType: z.string().describe("MIME type (e.g., image/jpeg)"),
      httpMethod: z.literal("POST").describe("HTTP method"),
      resource: z.enum(["IMAGE", "VIDEO", "MODEL_3D"]).describe("Resource type"),
      fileSize: z.string().optional().describe("File size for videos and 3D models")
    })).describe("Array of upload requests")
  },
  async ({ uploads }) => {
    const client = new ShopifyClient();
    try {
      const result = await client.createStagedUploads(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        uploads
      );
      
      // Safely serialize only the needed data to avoid circular references
      const safeResult = {
        stagedTargets: result.stagedTargets?.map(target => ({
          url: target.url,
          resourceUrl: target.resourceUrl,
          parameters: target.parameters?.map(param => ({
            name: param.name,
            value: param.value
          }))
        })) || [],
        userErrors: result.userErrors?.map(error => ({
          field: error.field,
          message: error.message,
          code: error.code
        })) || []
      };
      
      return {
        content: [{ type: "text", text: JSON.stringify(safeResult, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to create staged uploads", error);
    }
  }
);

server.tool(
  "create-product-media",
  "Add media files to a product after uploading them",
  {
    productId: z.string().describe("Product ID to add media to"),
    media: z.array(z.object({
      alt: z.string().optional().describe("Alt text for the media"),
      mediaContentType: z.enum(["IMAGE", "VIDEO", "EXTERNAL_VIDEO", "MODEL_3D"]).describe("Media content type"),
      originalSource: z.string().describe("URL from staged upload")
    })).describe("Array of media to add")
  },
  async ({ productId, media }) => {
    const client = new ShopifyClient();
    try {
      const result = await client.createProductMedia(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        productId,
        media
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to create product media", error);
    }
  }
);

server.tool(
  "set-metafields",
  "Set metafields for products, variants, or other resources",
  {
    metafields: z.array(z.object({
      key: z.string().describe("Metafield key"),
      namespace: z.string().describe("Metafield namespace"),
      ownerId: z.string().describe("ID of the resource that owns the metafield"),
      type: z.string().describe("Metafield type (e.g., single_line_text_field)"),
      value: z.string().describe("Metafield value")
    })).describe("Array of metafields to set")
  },
  async ({ metafields }) => {
    const client = new ShopifyClient();
    try {
      const result = await client.setMetafields(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        metafields
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to set metafields", error);
    }
  }
);

server.tool(
  "create-collection",
  "Create a new collection",
  {
    title: z.string().describe("Collection title"),
    descriptionHtml: z.string().optional().describe("Collection description in HTML"),
    handle: z.string().optional().describe("Collection handle/slug"),
    products: z.array(z.string()).optional().describe("Array of product IDs to include"),
    ruleSet: z.object({
      appliedDisjunctively: z.boolean(),
      rules: z.array(z.object({
        column: z.string(),
        relation: z.string(),
        condition: z.string()
      }))
    }).optional().describe("Smart collection rules"),
    metafields: z.array(z.object({
      key: z.string(),
      namespace: z.string(),
      value: z.string(),
      type: z.string()
    })).optional().describe("Collection metafields")
  },
  async ({ title, descriptionHtml, handle, products, ruleSet, metafields }) => {
    const client = new ShopifyClient();
    try {
      const collection = await client.createCollection(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        {
          title,
          descriptionHtml,
          handle,
          products,
          ruleSet,
          metafields
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(collection, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to create collection", error);
    }
  }
);

server.tool(
  "update-collection",
  "Update an existing collection",
  {
    id: z.string().describe("Collection ID to update"),
    title: z.string().optional().describe("Collection title"),
    descriptionHtml: z.string().optional().describe("Collection description in HTML"),
    handle: z.string().optional().describe("Collection handle/slug"),
    products: z.array(z.string()).optional().describe("Array of product IDs to include"),
    ruleSet: z.object({
      appliedDisjunctively: z.boolean(),
      rules: z.array(z.object({
        column: z.string(),
        relation: z.string(),
        condition: z.string()
      }))
    }).optional().describe("Smart collection rules"),
    metafields: z.array(z.object({
      key: z.string(),
      namespace: z.string(),
      value: z.string(),
      type: z.string()
    })).optional().describe("Collection metafields")
  },
  async ({ id, title, descriptionHtml, handle, products, ruleSet, metafields }) => {
    const client = new ShopifyClient();
    try {
      const collection = await client.updateCollection(
        SHOPIFY_ACCESS_TOKEN,
        MYSHOPIFY_DOMAIN,
        {
          id,
          title,
          descriptionHtml,
          handle,
          products,
          ruleSet,
          metafields
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(collection, null, 2) }],
      };
    } catch (error) {
      return handleError("Failed to update collection", error);
    }
  }
);

// Utility function to handle errors
function handleError(
  defaultMessage: string,
  error: unknown
): {
  content: { type: "text"; text: string }[];
  isError: boolean;
} {
  let errorMessage = defaultMessage;
  if (error instanceof Error) {
    errorMessage = `${defaultMessage}: ${error.message}`;
    console.error("Full error details:", error);
  } else {
    errorMessage = `${defaultMessage}: ${String(error)}`;
    console.error("Unknown error type:", error);
  }
  return {
    content: [{ type: "text", text: errorMessage }],
    isError: true,
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Shopify MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
