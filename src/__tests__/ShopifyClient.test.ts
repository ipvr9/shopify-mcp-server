import { config } from "dotenv";
import { ShopifyClient } from "../ShopifyClient/ShopifyClient.js";

// Load environment variables from .env file
config();

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const MYSHOPIFY_DOMAIN = process.env.MYSHOPIFY_DOMAIN;

if (!SHOPIFY_ACCESS_TOKEN || !MYSHOPIFY_DOMAIN) {
  throw new Error(
    "SHOPIFY_ACCESS_TOKEN and MYSHOPIFY_DOMAIN must be set in .env file"
  );
}

describe("ShopifyClient.getShopifyOrdersNextPage", () => {
  // add test for load products
  it("should load products", async () => {
    const client = new ShopifyClient();
    const products = await client.loadProducts(
      SHOPIFY_ACCESS_TOKEN,
      MYSHOPIFY_DOMAIN,
      "*",
      100
    );
    console.log(products);
    expect(products).toBeDefined();
  });

  // add test for get customers
  it("should load customers", async () => {
    const client = new ShopifyClient();
    const customers = await client.loadCustomers(
      SHOPIFY_ACCESS_TOKEN,
      MYSHOPIFY_DOMAIN,
      100
    );
    console.log(customers);
    expect(customers).toBeDefined();
  });

  // add test for tag customer
  it("should tag customer", async () => {
    const client = new ShopifyClient();
    const tagged = await client.tagCustomer(
      SHOPIFY_ACCESS_TOKEN,
      MYSHOPIFY_DOMAIN,
      ["test"],
      "7466474373213"
    );
    expect(tagged).toBe(true);
  });

  // add test for load orders graphql
  it.only("should load orders graphql", async () => {
    const client = new ShopifyClient();
    const orders = await client.loadOrders(
      SHOPIFY_ACCESS_TOKEN,
      MYSHOPIFY_DOMAIN,
      {
        first: 100,
      }
    );
    console.log(orders);
    expect(orders).toBeDefined();
  });
});
