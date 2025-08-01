import {
  CompleteDraftOrderResponse,
  CreateBasicDiscountCodeInput,
  CreateBasicDiscountCodeResponse,
  BasicDiscountCodeResponse,
  CreateDiscountCodeResponse,
  CreateDraftOrderPayload,
  CreatePriceRuleInput,
  CreatePriceRuleResponse,
  DraftOrderResponse,
  GeneralShopifyClientError,
  GetPriceRuleInput,
  GetPriceRuleResponse,
  LoadCollectionsResponse,
  LoadCustomersResponse,
  LoadProductsResponse,
  LoadStorefrontsResponse,
  LoadVariantsByIdResponse,
  ProductNode,
  ProductVariantWithProductDetails,
  ShopResponse,
  ShopifyAuthorizationError,
  ShopifyClientErrorBase,
  ShopifyCollection,
  ShopifyCollectionsQueryParams,
  ShopifyCustomCollectionsResponse,
  ShopifyInputError,
  ShopifyLoadOrderQueryParams,
  ShopifyOrder,
  ShopifyPaymentError,
  ShopifyProductVariantNotAvailableForSaleError,
  ShopifyProductVariantNotFoundError,
  ShopifyRequestError,
  ShopifySmartCollectionsResponse,
  ShopifyWebhook,
  getGraphqlShopifyError,
  getGraphqlShopifyUserError,
  getHttpShopifyError,
  ShopifyWebhookTopic,
  ShopifyWebhookTopicGraphql,
  ShopifyClientPort,
  CustomError,
  Maybe,
  ShopifyOrdersGraphqlQueryParams,
  ShopifyOrdersGraphqlResponse,
  ShopifyOrderGraphql,
  // New imports for product management
  ProductCreateInput,
  ProductCreateResponse,
  ProductUpdateInput,
  ProductUpdateResponse,
  ProductVariantsBulkInput,
  ProductVariantsBulkCreateResponse,
  ProductVariantsBulkUpdateResponse,
  ProductVariantsBulkDeleteResponse,
  StagedUploadInput,
  StagedUploadsCreateResponse,
  CreateMediaInput,
  ProductCreateMediaResponse,
  MetafieldsSetInput,
  MetafieldsSetResponse,
  CollectionCreateInput,
  CollectionCreateResponse,
  CollectionUpdateInput,
  CollectionUpdateResponse,
  UserError,
} from "./ShopifyClientPort.js";
import { gql } from "graphql-request";

const productImagesFragment = gql`
  src
  height
  width
`;

const productVariantsFragment = gql`
  id
  title
  price
  sku
  image {
    ${productImagesFragment}
  }
  availableForSale
  inventoryPolicy
  selectedOptions {
    name
    value
  }
`;

const productFragment = gql`
  id
  handle
  title
  description
  publishedAt
  updatedAt
  options {
    id
    name
    values
  }
  images(first: 20) {
    edges {
      node {
        ${productImagesFragment}
      }
    }
  }
  variants(first: 250) {
    edges {
      node {
        ${productVariantsFragment}
      }
    }
  }
`;

export class ShopifyClient implements ShopifyClientPort {
  private readonly logger = console;

  private SHOPIFY_API_VERSION = "2025-04";

  static getShopifyOrdersNextPage(link: Maybe<string>): string | undefined {
    if (!link) return;
    if (!link.includes("next")) return;

    if (link.includes("next") && link.includes("previous")) {
      return link
        .split('rel="previous"')[1]
        .split("page_info=")[1]
        .split('>; rel="next"')[0];
    }

    return link.split("page_info=")[1].split('>; rel="next"')[0];
  }

  async shopifyHTTPRequest<T>({
    method,
    url,
    accessToken,
    params,
    data,
  }: {
    method: "GET" | "POST" | "DELETE" | "PUT";
    url: string;
    accessToken: string;
    params?: Record<string, any>;
    data?: Record<string, any>;
  }): Promise<{ data: T; headers: Headers }> {
    try {
      // Add query parameters to URL if they exist
      if (params) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, String(value));
          }
        });
        url = `${url}${url.includes("?") ? "&" : "?"}${queryParams.toString()}`;
      }

      const response = await fetch(url, {
        method,
        headers: {
          "X-Shopify-Access-Token": accessToken,
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });

      if (!response.ok) {
        const responseData = await response
          .json()
          .catch(() => response.statusText);
        const responseError =
          responseData.error ??
          responseData.errors ??
          responseData ??
          response.status;
        throw getHttpShopifyError(responseError, response.status, {
          url,
          params,
          method,
          data: responseData,
        });
      }

      const responseData = await response.json();
      return {
        data: responseData,
        headers: response.headers,
      };
    } catch (error: any) {
      let shopifyError: ShopifyClientErrorBase;
      if (error instanceof ShopifyClientErrorBase) {
        shopifyError = error;
      } else {
        shopifyError = new GeneralShopifyClientError({
          innerError: error,
          contextData: {
            url,
            params,
            method,
          },
        });
      }

      if (
        shopifyError instanceof ShopifyRequestError ||
        shopifyError instanceof GeneralShopifyClientError
      ) {
        this.logger.error(shopifyError);
      } else if (
        shopifyError instanceof ShopifyInputError ||
        shopifyError instanceof ShopifyAuthorizationError ||
        shopifyError instanceof ShopifyPaymentError
      ) {
        this.logger.debug(shopifyError);
      } else {
        this.logger.warn(shopifyError);
      }

      throw shopifyError;
    }
  }

  async shopifyGraphqlRequest<T>({
    url,
    accessToken,
    query,
    variables,
  }: {
    url: string;
    accessToken: string;
    query: string;
    variables?: Record<string, any>;
  }): Promise<{ data: T; headers: Headers }> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      const responseData = await response.json();

      if (!response.ok || responseData?.errors) {
        // Enhanced error logging for debugging
        console.error('Shopify GraphQL Error Details:', {
          status: response.status,
          statusText: response.statusText,
          url,
          query: query.substring(0, 200) + '...',
          variables,
          responseData,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        const error = new Error("Shopify GraphQL Error");
        throw Object.assign(error, {
          response: { data: responseData, status: response.status },
        });
      }

      return {
        data: responseData,
        headers: response.headers,
      };
    } catch (error: any) {
      let shopifyError: ShopifyClientErrorBase;
      if (error.response) {
        const responseError =
          error.response.data.error ??
          error.response.data.errors ??
          error.response.data ??
          error.response.status;
        shopifyError = getGraphqlShopifyError(
          responseError,
          error.response.status,
          {
            url,
            query,
            variables,
            data: error.response.data,
          }
        );
      } else {
        shopifyError = new GeneralShopifyClientError({
          innerError: error,
          contextData: {
            url,
            query,
            variables,
          },
        });
      }

      if (
        shopifyError instanceof ShopifyRequestError ||
        shopifyError instanceof GeneralShopifyClientError
      ) {
        this.logger.error(shopifyError);
      } else if (
        shopifyError instanceof ShopifyInputError ||
        shopifyError instanceof ShopifyAuthorizationError ||
        shopifyError instanceof ShopifyPaymentError
      ) {
        this.logger.debug(shopifyError);
      } else {
        this.logger.warn(shopifyError);
      }

      throw shopifyError;
    }
  }

  private async getMyShopifyDomain(
    accessToken: string,
    shop: string
  ): Promise<string> {
    // POST requests are getting converted into GET on custom domain, so we need to retrieve the myshopify domain from the shop object
    const loadedShop = await this.loadShop(accessToken, shop);
    return loadedShop.shop.myshopify_domain;
  }

  async checkSubscriptionEligibility(
    accessToken: string,
    myshopifyDomain: string
  ): Promise<boolean> {
    const graphqlQuery = gql`
      query CheckSubscriptionEligibility {
        shop {
          features {
            eligibleForSubscriptions
            sellsSubscriptions
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        shop: {
          features: {
            eligibleForSubscriptions: boolean;
            sellsSubscriptions: boolean;
          };
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
    });

    return (
      res.data.data.shop.features.eligibleForSubscriptions &&
      res.data.data.shop.features.sellsSubscriptions
    );
  }

  async createBasicDiscountCode(
    accessToken: string,
    shop: string,
    discountInput: CreateBasicDiscountCodeInput
  ): Promise<CreateBasicDiscountCodeResponse> {
    if (discountInput.valueType === "percentage") {
      if (discountInput.value < 0 || discountInput.value > 1) {
        throw new CustomError(
          "Invalid input: percentage value must be between 0 and 1",
          "InvalidInputError",
          {
            contextData: {
              discountInput,
              shop,
            },
          }
        );
      }
    }

    if (discountInput.valueType === "fixed_amount") {
      if (discountInput.value <= 0) {
        throw new CustomError(
          "Invalid input: fixed_amount value must be greater than 0",
          "InvalidInputError",
          {
            contextData: {
              discountInput,
              shop,
            },
          }
        );
      }
    }

    const myShopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const isEligibleForSubscription = await this.checkSubscriptionEligibility(
      accessToken,
      myShopifyDomain
    );

    const graphqlQuery =
      this.graphqlQueryPreparationForCreateBasicDiscountCode();

    const variables = this.prepareBasicDiscountCodeVariable(
      discountInput,
      isEligibleForSubscription
    );

    const res = await this.shopifyGraphqlRequest<BasicDiscountCodeResponse>({
      url: `https://${myShopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables,
    });

    const id = res.data.data.discountCodeBasicCreate.codeDiscountNode.id;
    const codeDiscount =
      res.data.data.discountCodeBasicCreate.codeDiscountNode.codeDiscount.codes
        .nodes[0];
    const userErrors = res.data.data.discountCodeBasicCreate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        discountInput,
      });
    }

    return {
      id,
      code: codeDiscount.code,
    };
  }

  private graphqlQueryPreparationForCreateBasicDiscountCode(): string {
    return gql`
      mutation discountCodeBasicCreate(
        $basicCodeDiscount: DiscountCodeBasicInput!
      ) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 10) {
                  nodes {
                    code
                  }
                }
                startsAt
                endsAt
                customerSelection {
                  ... on DiscountCustomerAll {
                    allCustomers
                  }
                }
                customerGets {
                  appliesOnOneTimePurchase
                  appliesOnSubscription
                  value {
                    ... on DiscountPercentage {
                      percentage
                    }
                    ... on DiscountAmount {
                      amount {
                        amount
                        currencyCode
                      }
                      appliesOnEachItem
                    }
                  }
                  items {
                    ... on AllDiscountItems {
                      allItems
                    }
                  }
                }
                appliesOncePerCustomer
              }
            }
          }
          userErrors {
            field
            code
            message
          }
        }
      }
    `;
  }

  private prepareBasicDiscountCodeVariable(
    discountInput: CreateBasicDiscountCodeInput,
    isEligibleForSubscription: boolean
  ): any {
    return {
      basicCodeDiscount: {
        title: discountInput.title,
        code: discountInput.code,
        startsAt: discountInput.startsAt,
        endsAt: discountInput.endsAt,
        customerSelection: {
          all: true,
        },
        customerGets: {
          appliesOnOneTimePurchase: isEligibleForSubscription
            ? true
            : undefined,
          appliesOnSubscription: isEligibleForSubscription ? true : undefined,
          value: {
            percentage:
              discountInput.valueType === "percentage"
                ? discountInput.value
                : undefined,
            discountAmount:
              discountInput.valueType === "fixed_amount"
                ? {
                    amount: discountInput.value,
                    appliesOnEachItem: false,
                  }
                : undefined,
          },
          items: {
            all:
              discountInput.excludeCollectionIds.length === 0 &&
              discountInput.includeCollectionIds.length === 0,
            collections:
              discountInput.includeCollectionIds.length ||
              discountInput.excludeCollectionIds.length
                ? {
                    add: discountInput.includeCollectionIds.map(
                      (id) => `gid://shopify/Collection/${id}`
                    ),
                    remove: discountInput.excludeCollectionIds.map(
                      (id) => `gid://shopify/Collection/${id}`
                    ),
                  }
                : undefined,
          },
        },
        appliesOncePerCustomer: discountInput.appliesOncePerCustomer,
        recurringCycleLimit: isEligibleForSubscription
          ? discountInput.valueType === "fixed_amount"
            ? 1
            : null
          : undefined,
        usageLimit: discountInput.usageLimit,
        combinesWith: {
          productDiscounts: discountInput.combinesWith.productDiscounts,
          orderDiscounts: discountInput.combinesWith.orderDiscounts,
          shippingDiscounts: discountInput.combinesWith.shippingDiscounts,
        },
      },
    };
  }

  async createPriceRule(
    accessToken: string,
    shop: string,
    priceRuleInput: CreatePriceRuleInput
  ): Promise<CreatePriceRuleResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation priceRuleCreate($priceRule: PriceRuleInput!) {
        priceRuleCreate(priceRule: $priceRule) {
          priceRule {
            id
          }
          priceRuleDiscountCode {
            id
            code
          }
          priceRuleUserErrors {
            field
            message
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        priceRuleCreate: {
          priceRule: {
            id: string;
          };
          priceRuleUserErrors: Array<{
            field: string[];
            message: string;
          }>;
          userErrors: Array<{
            field: string[];
            message: string;
          }>;
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        priceRule: {
          title: priceRuleInput.title,
          allocationMethod: priceRuleInput.allocationMethod,
          target: priceRuleInput.targetType,
          value:
            priceRuleInput.valueType === "fixed_amount"
              ? { fixedAmountValue: priceRuleInput.value }
              : { percentageValue: parseFloat(priceRuleInput.value) },
          validityPeriod: {
            start: priceRuleInput.startsAt,
            end: priceRuleInput.endsAt,
          },
          usageLimit: priceRuleInput.usageLimit,
          customerSelection: {
            forAllCustomers: true,
          },
          itemEntitlements: {
            collectionIds: priceRuleInput.entitledCollectionIds.map(
              (id) => `gid://shopify/Collection/${id}`
            ),
            targetAllLineItems:
              priceRuleInput.entitledCollectionIds.length === 0,
          },
          combinesWith: {
            productDiscounts: true,
            orderDiscounts: false,
            shippingDiscounts: true,
          },
        },
      },
    });

    const priceRule = res.data.data.priceRuleCreate.priceRule;
    const userErrors = res.data.data.priceRuleCreate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        priceRuleInput,
      });
    }

    return {
      id: priceRule.id,
    };
  }

  async createDiscountCode(
    accessToken: string,
    shop: string,
    code: string,
    priceRuleId: string
  ): Promise<CreateDiscountCodeResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation priceRuleDiscountCodeCreate($priceRuleId: ID!, $code: String!) {
        priceRuleDiscountCodeCreate(priceRuleId: $priceRuleId, code: $code) {
          priceRuleUserErrors {
            field
            message
            code
          }
          priceRule {
            id
            title
          }
          priceRuleDiscountCode {
            id
            code
            usageCount
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        priceRuleDiscountCodeCreate: {
          priceRuleUserErrors: Array<{
            field: string[];
            message: string;
            code: string;
          }>;
          priceRule: {
            id: string;
            title: string;
          };
          priceRuleDiscountCode: {
            id: string;
            code: string;
            usageCount: number;
          };
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        priceRuleId,
        code,
      },
    });

    const discountCode =
      res.data.data.priceRuleDiscountCodeCreate.priceRuleDiscountCode;
    const userErrors =
      res.data.data.priceRuleDiscountCodeCreate.priceRuleUserErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        code,
        priceRuleId,
      });
    }

    return {
      id: priceRuleId,
      priceRuleId: priceRuleId,
      code: discountCode.code,
      usageCount: discountCode.usageCount,
    };
  }

  async deleteBasicDiscountCode(
    accessToken: string,
    shop: string,
    discountCodeId: string
  ): Promise<void> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation discountCodeDelete($id: ID!) {
        discountCodeDelete(id: $id) {
          deletedCodeDiscountId
          userErrors {
            field
            code
            message
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        discountCodeDelete: {
          deletedCodeDiscountId: string;
          userErrors: Array<{
            field: string[];
            code: string;
            message: string;
          }>;
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        id: discountCodeId,
      },
    });

    const userErrors = res.data.data.discountCodeDelete.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        discountCodeId,
      });
    }
  }

  async deletePriceRule(
    accessToken: string,
    shop: string,
    priceRuleId: string
  ): Promise<void> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    await this.shopifyHTTPRequest({
      method: "DELETE",
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/price_rules/${priceRuleId}.json`,
      accessToken,
    });
  }

  async deleteDiscountCode(
    accessToken: string,
    shop: string,
    priceRuleId: string,
    discountCodeId: string
  ): Promise<void> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    await this.shopifyHTTPRequest({
      method: "DELETE",
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/price_rules/${priceRuleId}/discount_codes/${discountCodeId}.json`,
      accessToken,
    });
  }

  async loadOrders(
    accessToken: string,
    shop: string,
    queryParams: ShopifyOrdersGraphqlQueryParams
  ): Promise<ShopifyOrdersGraphqlResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      query getOrdersDetailed(
        $first: Int
        $after: String
        $query: String
        $sortKey: OrderSortKeys
        $reverse: Boolean
      ) {
        orders(
          first: $first
          after: $after
          query: $query
          sortKey: $sortKey
          reverse: $reverse
        ) {
          nodes {
            id
            name
            createdAt
            displayFinancialStatus
            email
            phone
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            customer {
              id
              email
            }
            shippingAddress {
              provinceCode
              countryCode
            }
            lineItems(first: 50) {
              nodes {
                id
                title
                quantity
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                variant {
                  id
                  title
                  sku
                  price
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      first: queryParams.first || 50,
      after: queryParams.after,
      query: queryParams.query,
      sortKey: queryParams.sortKey,
      reverse: queryParams.reverse,
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        orders: {
          nodes: ShopifyOrderGraphql[];
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables,
    });

    return {
      orders: res.data.data.orders.nodes,
      pageInfo: res.data.data.orders.pageInfo,
    };
  }

  async loadOrder(
    accessToken: string,
    shop: string,
    queryParams: ShopifyLoadOrderQueryParams
  ): Promise<ShopifyOrder> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const res = await this.shopifyHTTPRequest<{ order: ShopifyOrder }>({
      method: "GET",
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/orders/${queryParams.orderId}.json`,
      accessToken,
      params: {
        fields: this.getOrdersFields(queryParams.fields),
      },
    });

    return res.data.order;
  }

  async loadCollections(
    accessToken: string,
    shop: string,
    queryParams: ShopifyCollectionsQueryParams,
    next?: string
  ): Promise<LoadCollectionsResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);
    const nextList = next?.split(",");
    const customNext = nextList?.[0];
    const smartNext = nextList?.[1];
    let customCollections: ShopifyCollection[] = [];
    let customCollectionsNextPage;
    let smartCollections: ShopifyCollection[] = [];
    let smartCollectionsNextPage;

    if (customNext !== "undefined") {
      const customRes =
        await this.shopifyHTTPRequest<ShopifyCustomCollectionsResponse>({
          method: "GET",
          url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/custom_collections.json`,
          accessToken,
          params: {
            limit: queryParams.limit,
            page_info: customNext,
            title: customNext ? undefined : queryParams.name,
            since_id: customNext ? undefined : queryParams.sinceId,
          },
        });

      customCollections = customRes.data?.custom_collections || [];

      customCollectionsNextPage = ShopifyClient.getShopifyOrdersNextPage(
        customRes.headers?.get("link")
      );
    }
    if (smartNext !== "undefined") {
      const smartRes =
        await this.shopifyHTTPRequest<ShopifySmartCollectionsResponse>({
          method: "GET",
          url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/smart_collections.json`,
          accessToken,
          params: {
            limit: queryParams.limit,
            page_info: smartNext,
            title: smartNext ? undefined : queryParams.name,
            since_id: smartNext ? undefined : queryParams.sinceId,
          },
        });

      smartCollections = smartRes.data?.smart_collections || [];

      smartCollectionsNextPage = ShopifyClient.getShopifyOrdersNextPage(
        smartRes.headers?.get("link")
      );
    }
    const collections = [...customCollections, ...smartCollections];

    if (customCollectionsNextPage || smartCollectionsNextPage) {
      next = `${customCollectionsNextPage},${smartCollectionsNextPage}`;
    } else {
      next = undefined;
    }
    return { collections, next };
  }

  async loadShop(
    accessToken: string,
    shop: string
  ): Promise<LoadStorefrontsResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const res = await this.shopifyHTTPRequest<LoadStorefrontsResponse>({
      method: "GET",
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/shop.json`,
      accessToken,
    });

    return res.data;
  }

  async loadShopDetail(
    accessToken: string,
    shop: string
  ): Promise<ShopResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      {
        shop {
          shipsToCountries
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<ShopResponse>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
    });

    return res.data;
  }

  async loadMarkets(accessToken: string, shop: string): Promise<ShopResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      {
        markets(first: 100) {
          nodes {
            name
            enabled
            regions {
              nodes {
                name
                ... on MarketRegionCountry {
                  code
                  __typename
                }
              }
            }
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<ShopResponse>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
    });

    return res.data;
  }

  async loadProductsByCollectionId(
    accessToken: string,
    shop: string,
    collectionId: string,
    limit: number = 10,
    afterCursor?: string
  ): Promise<LoadProductsResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      {
        shop {
          currencyCode
        }
        collection(id: "gid://shopify/Collection/${collectionId}") {
          products(
            first: ${limit}${afterCursor ? `, after: "${afterCursor}"` : ""}
          ) {
            edges {
              node {
                ${productFragment}
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        shop: {
          currencyCode: string;
        };
        collection: {
          products: {
            edges: Array<{
              node: ProductNode;
            }>;
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string;
            };
          };
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
    });

    const data = res.data.data;
    const edges = data.collection.products.edges;
    const products = edges.map((edge) => edge.node);
    const pageInfo = data.collection.products.pageInfo;
    const next = pageInfo.hasNextPage ? pageInfo.endCursor : undefined;
    const currencyCode = data.shop.currencyCode;

    return { products, next, currencyCode };
  }

  async loadProducts(
    accessToken: string,
    myshopifyDomain: string,
    searchTitle: string | null,
    limit: number = 10,
    afterCursor?: string
  ): Promise<LoadProductsResponse> {
    const titleFilter = searchTitle ? `title:*${searchTitle}*` : "";
    const graphqlQuery = gql`
      {
        shop {
          currencyCode
        }
        products(first: ${limit}, query: "${titleFilter}"${
      afterCursor ? `, after: "${afterCursor}"` : ""
    }) {
          edges {
            node {
              ${productFragment}
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        shop: {
          currencyCode: string;
        };
        products: {
          edges: Array<{
            node: ProductNode;
          }>;
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string;
          };
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
    });

    const data = res.data.data;
    const edges = data.products.edges;
    const products = edges.map((edge) => edge.node);
    const pageInfo = data.products.pageInfo;
    const next = pageInfo.hasNextPage ? pageInfo.endCursor : undefined;
    const currencyCode = data.shop.currencyCode;

    return { products, next, currencyCode };
  }

  async loadVariantsByIds(
    accessToken: string,
    shop: string,
    variantIds: string[]
  ): Promise<LoadVariantsByIdResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      {
        shop {
          currencyCode
        }
        nodes(ids: ${JSON.stringify(variantIds)}) {
          __typename
          ... on ProductVariant {
            ${productVariantsFragment}
            product {
              id
              title
              description
              images(first: 20) {
                edges {
                  node {
                    ${productImagesFragment}
                  }
                }
              }
            }
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        shop: {
          currencyCode: string;
        };
        nodes: Array<
          | ({
              __typename: string;
            } & ProductVariantWithProductDetails)
          | null
        >;
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
    });

    const variants = res.data.data.nodes.filter(
      (
        node
      ): node is {
        __typename: string;
      } & ProductVariantWithProductDetails =>
        node?.__typename === "ProductVariant"
    );
    const currencyCode = res.data.data.shop.currencyCode;

    return { variants, currencyCode };
  }

  async createDraftOrder(
    accessToken: string,
    myshopifyDomain: string,
    draftOrderData: CreateDraftOrderPayload
  ): Promise<DraftOrderResponse> {
    const graphqlQuery = gql`
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        draftOrderCreate: {
          draftOrder: {
            id: string;
            name: string;
          };
          userErrors: Array<{
            field: string[];
            message: string;
          }>;
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        input: draftOrderData,
      },
    });

    const draftOrder = res.data.data.draftOrderCreate.draftOrder;
    const userErrors = res.data.data.draftOrderCreate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        myshopifyDomain,
        draftOrderData,
      });
    }

    return {
      draftOrderId: draftOrder.id,
      draftOrderName: draftOrder.name,
    };
  }

  async completeDraftOrder(
    accessToken: string,
    shop: string,
    draftOrderId: string,
    variantId: string
  ): Promise<CompleteDraftOrderResponse> {
    // First, load the variant to check if it's available for sale
    const variantResult = await this.loadVariantsByIds(accessToken, shop, [
      variantId,
    ]);

    if (!variantResult.variants || variantResult.variants.length === 0) {
      throw new ShopifyProductVariantNotFoundError({
        contextData: {
          shop,
          variantId,
        },
      });
    }

    const variant = variantResult.variants[0];

    if (!variant.availableForSale) {
      throw new ShopifyProductVariantNotAvailableForSaleError({
        contextData: {
          shop,
          variantId,
        },
      });
    }

    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation draftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id) {
          draftOrder {
            id
            name
            order {
              id
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        draftOrderComplete: {
          draftOrder: {
            id: string;
            name: string;
            order: {
              id: string;
            };
          };
          userErrors: Array<{
            field: string[];
            message: string;
          }>;
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        id: draftOrderId,
      },
    });

    const draftOrder = res.data.data.draftOrderComplete.draftOrder;
    const order = draftOrder.order;
    const userErrors = res.data.data.draftOrderComplete.userErrors;

    if (userErrors && userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        draftOrderId,
        variantId,
      });
    }

    return {
      draftOrderId: draftOrder.id,
      orderId: order.id,
      draftOrderName: draftOrder.name,
    };
  }

  async loadProductsByIds(
    accessToken: string,
    shop: string,
    productIds: string[]
  ): Promise<LoadProductsResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      {
        shop {
          currencyCode
        }
        nodes(ids: ${JSON.stringify(productIds)}) {
          __typename
          ... on Product {
            ${productFragment}
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        shop: {
          currencyCode: string;
        };
        nodes: Array<
          | ({
              __typename: string;
            } & ProductNode)
          | null
        >;
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
    });

    const data = res.data.data;

    const products = data.nodes.filter(
      (
        node
      ): node is {
        __typename: string;
      } & ProductNode => node?.__typename === "Product"
    );
    const currencyCode = data.shop.currencyCode;

    return { products, currencyCode };
  }

  async loadCustomers(
    accessToken: string,
    shop: string,
    limit?: number,
    next?: string
  ): Promise<LoadCustomersResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const res = await this.shopifyHTTPRequest<{ customers: any[] }>({
      method: "GET",
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/customers.json`,
      accessToken,
      params: {
        limit: limit ?? 250,
        page_info: next,
        fields: ["id", "email", "tags"].join(","),
      },
    });

    const customers = res.data.customers;
    const nextPageInfo = ShopifyClient.getShopifyOrdersNextPage(
      res.headers.get("link")
    );

    return { customers, next: nextPageInfo };
  }

  async tagCustomer(
    accessToken: string,
    shop: string,
    tags: string[],
    externalCustomerId: string
  ): Promise<boolean> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation tagsAdd($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors {
            field
            message
          }
          node {
            id
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        tagsAdd: {
          userErrors: Array<{
            field: string[];
            message: string;
          }>;
          node: {
            id: string;
          };
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        id: `gid://shopify/Customer/${externalCustomerId}`,
        tags,
      },
    });

    const userErrors = res.data.data.tagsAdd.userErrors;
    if (userErrors.length > 0) {
      const errorMessages = userErrors.map((error) => error.message).join(", ");
      throw new Error(errorMessages);
    }

    return true;
  }

  async subscribeWebhook(
    accessToken: string,
    shop: string,
    callbackUrl: string,
    topic: ShopifyWebhookTopic
  ): Promise<ShopifyWebhook> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation webhookSubscriptionCreate(
        $topic: WebhookSubscriptionTopic!
        $webhookSubscription: WebhookSubscriptionInput!
      ) {
        webhookSubscriptionCreate(
          topic: $topic
          webhookSubscription: $webhookSubscription
        ) {
          webhookSubscription {
            id
            topic
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        webhookSubscriptionCreate: {
          webhookSubscription: {
            id: string;
            topic: ShopifyWebhookTopicGraphql;
            endpoint: {
              callbackUrl: string;
            };
          };
          userErrors: Array<{
            field: string[];
            message: string;
          }>;
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        topic: this.mapTopicToGraphqlTopic(topic),
        webhookSubscription: {
          callbackUrl,
        },
      },
    });

    const webhookSubscription =
      res.data.data.webhookSubscriptionCreate.webhookSubscription;
    const userErrors = res.data.data.webhookSubscriptionCreate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        topic,
        callbackUrl: callbackUrl,
      });
    }

    return {
      id: webhookSubscription.id,
      topic: this.mapGraphqlTopicToTopic(webhookSubscription.topic),
      callbackUrl: webhookSubscription.endpoint.callbackUrl,
    };
  }

  async findWebhookByTopicAndCallbackUrl(
    accessToken: string,
    shop: string,
    callbackUrl: string,
    topic: ShopifyWebhookTopic
  ): Promise<ShopifyWebhook | null> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      query webhookSubscriptions(
        $topics: [WebhookSubscriptionTopic!]
        $callbackUrl: URL!
      ) {
        webhookSubscriptions(
          first: 10
          topics: $topics
          callbackUrl: $callbackUrl
        ) {
          edges {
            node {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        webhookSubscriptions: {
          edges: {
            node: {
              id: string;
              topic: ShopifyWebhookTopicGraphql;
              endpoint: {
                callbackUrl: string;
              };
            };
          }[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        topics: [this.mapTopicToGraphqlTopic(topic)],
        callbackUrl,
      },
    });

    const webhookSubscriptions = res.data.data.webhookSubscriptions.edges;
    if (webhookSubscriptions.length === 0) {
      return null;
    }

    const webhookSubscription = webhookSubscriptions[0].node;
    return {
      id: webhookSubscription.id,
      topic: this.mapGraphqlTopicToTopic(webhookSubscription.topic),
      callbackUrl: webhookSubscription.endpoint.callbackUrl,
    };
  }

  async unsubscribeWebhook(
    accessToken: string,
    shop: string,
    webhookId: string
  ): Promise<void> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation webhookSubscriptionDelete($id: ID!) {
        webhookSubscriptionDelete(id: $id) {
          userErrors {
            field
            message
          }
          deletedWebhookSubscriptionId
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: {
        webhookSubscriptionDelete: {
          deletedWebhookSubscriptionId: string;
          userErrors: Array<{
            field: string[];
            message: string;
          }>;
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: {
        id: webhookId,
      },
    });

    const userErrors = res.data.data.webhookSubscriptionDelete.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        webhookId,
      });
    }
  }

  // New product management methods implementation

  /**
   * Creates a new product in the Shopify store
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param productInput - Product creation input data
   * @returns Promise with created product data and any errors
   */
  async createProduct(
    accessToken: string,
    shop: string,
    productInput: ProductCreateInput
  ): Promise<ProductCreateResponse> {
    // Validate required fields
    if (!productInput.title || productInput.title.trim() === '') {
      throw new Error('Product title is required');
    }
    
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        title: productInput.title,
        descriptionHtml: productInput.descriptionHtml,
        vendor: productInput.vendor,
        productType: productInput.productType,
        handle: productInput.handle,
        status: productInput.status,
        tags: productInput.tags,
        productOptions: productInput.productOptions,
        metafields: productInput.metafields?.map(metafield => ({
          key: metafield.key,
          namespace: metafield.namespace,
          value: metafield.value,
          type: metafield.type
        }))
      }
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        productCreate: {
          product: {
            id: string;
            title: string;
            handle: string;
            status: string;
          };
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const product = res.data.data.productCreate.product;
    const userErrors = res.data.data.productCreate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        productInput
      });
    }

    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status
    };
  }

  /**
   * Updates an existing product in the Shopify store
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param productInput - Product update input data including ID
   * @returns Promise with updated product data and any errors
   */
  async updateProduct(
    accessToken: string,
    shop: string,
    productInput: ProductUpdateInput
  ): Promise<ProductUpdateResponse> {
    // Validate required fields
    if (!productInput.id) {
      throw new Error('Product ID is required for update');
    }
    
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation ProductUpdate($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            id
            title
            handle
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      product: {
        id: this.ensureGid(productInput.id, 'Product'),
        title: productInput.title,
        descriptionHtml: productInput.descriptionHtml,
        vendor: productInput.vendor,
        productType: productInput.productType,
        handle: productInput.handle,
        status: productInput.status,
        tags: productInput.tags,
        metafields: productInput.metafields?.map(metafield => ({
          key: metafield.key,
          namespace: metafield.namespace,
          value: metafield.value,
          type: metafield.type
        }))
      }
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        productUpdate: {
          product: {
            id: string;
            title: string;
            handle: string;
            status: string;
          };
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const product = res.data.data.productUpdate.product;
    const userErrors = res.data.data.productUpdate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        productInput
      });
    }

    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status
    };
  }

  /**
   * Creates multiple product variants in bulk
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param productId - ID of the product to add variants to
   * @param variants - Array of variant data to create
   * @returns Promise with created variants data and any errors
   */
  async createProductVariantsBulk(
    accessToken: string,
    shop: string,
    productId: string,
    variants: ProductVariantsBulkInput[]
  ): Promise<ProductVariantsBulkCreateResponse> {
    // Validate inputs
    if (!productId) {
      throw new Error('Product ID is required');
    }
    if (!variants || variants.length === 0) {
      throw new Error('At least one variant is required');
    }
    
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants {
            id
            title
            price
            sku
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      productId: this.ensureGid(productId, 'Product'),
      variants: variants.map(variant => ({
        optionValues: variant.optionValues,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        barcode: variant.barcode,
        inventoryPolicy: variant.inventoryPolicy,
        metafields: variant.metafields?.map(metafield => ({
          key: metafield.key,
          namespace: metafield.namespace,
          value: metafield.value,
          type: metafield.type
        }))
      }))
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        productVariantsBulkCreate: {
          productVariants: Array<{
            id: string;
            title: string;
            price: string;
            sku?: string;
          }>;
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const productVariants = res.data.data.productVariantsBulkCreate.productVariants;
    const userErrors = res.data.data.productVariantsBulkCreate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        productId,
        variants
      });
    }

    return {
      productVariants,
      userErrors
    };
  }

  /**
   * Updates multiple product variants in bulk
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param productId - ID of the product containing the variants
   * @param variants - Array of variant data to update
   * @returns Promise with updated variants data and any errors
   */
  async updateProductVariantsBulk(
    accessToken: string,
    shop: string,
    productId: string,
    variants: ProductVariantsBulkInput[]
  ): Promise<ProductVariantsBulkUpdateResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
            title
            price
            sku
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      productId: this.ensureGid(productId, 'Product'),
      variants: variants.map(variant => ({
        id: variant.id ? this.ensureGid(variant.id, 'ProductVariant') : undefined,
        optionValues: variant.optionValues,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        barcode: variant.barcode,
        inventoryPolicy: variant.inventoryPolicy,
        metafields: variant.metafields?.map(metafield => ({
          key: metafield.key,
          namespace: metafield.namespace,
          value: metafield.value,
          type: metafield.type
        }))
      }))
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        productVariantsBulkUpdate: {
          productVariants: Array<{
            id: string;
            title: string;
            price: string;
            sku?: string;
          }>;
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const productVariants = res.data.data.productVariantsBulkUpdate.productVariants;
    const userErrors = res.data.data.productVariantsBulkUpdate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        productId,
        variants
      });
    }

    return {
      productVariants,
      userErrors
    };
  }

  /**
   * Deletes multiple product variants in bulk
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param productId - ID of the product containing the variants
   * @param variantIds - Array of variant IDs to delete
   * @returns Promise with deletion results and any errors
   */
  async deleteProductVariantsBulk(
    accessToken: string,
    shop: string,
    productId: string,
    variantIds: string[]
  ): Promise<ProductVariantsBulkDeleteResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation ProductVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
        productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
          product {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      productId: this.ensureGid(productId, 'Product'),
      variantsIds: variantIds.map(id => this.ensureGid(id, 'ProductVariant'))
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        productVariantsBulkDelete: {
          product: {
            id: string;
          };
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const product = res.data.data.productVariantsBulkDelete.product;
    const userErrors = res.data.data.productVariantsBulkDelete.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        productId,
        variantIds
      });
    }

    return {
      product,
      userErrors
    };
  }

  /**
   * Creates staged uploads for media files to be uploaded to Shopify
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param uploads - Array of upload configurations
   * @returns Promise with staged upload targets and parameters
   */
  async createStagedUploads(
    accessToken: string,
    shop: string,
    uploads: StagedUploadInput[]
  ): Promise<StagedUploadsCreateResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: uploads.map(upload => ({
        filename: upload.filename,
        mimeType: upload.mimeType,
        httpMethod: upload.httpMethod,
        resource: upload.resource,
        fileSize: upload.fileSize
      }))
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        stagedUploadsCreate: {
          stagedTargets: Array<{
            url: string;
            resourceUrl: string;
            parameters: Array<{
              name: string;
              value: string;
            }>;
          }>;
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const stagedTargets = res.data.data.stagedUploadsCreate.stagedTargets;
    const userErrors = res.data.data.stagedUploadsCreate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        uploads
      });
    }

    return {
      stagedTargets,
      userErrors
    };
  }

  /**
   * Adds media files to a product after uploading them
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param productId - ID of the product to add media to
   * @param media - Array of media configurations
   * @returns Promise with created media data and any errors
   */
  async createProductMedia(
    accessToken: string,
    shop: string,
    productId: string,
    media: CreateMediaInput[]
  ): Promise<ProductCreateMediaResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation ProductCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
        productCreateMedia(media: $media, productId: $productId) {
          media {
            alt
            mediaContentType
            status
          }
          mediaUserErrors {
            field
            message
          }
          product {
            id
          }
        }
      }
    `;

    const variables = {
      productId,
      media: media.map(m => ({
        alt: m.alt,
        mediaContentType: m.mediaContentType,
        originalSource: m.originalSource
      }))
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        productCreateMedia: {
          media: Array<{
            alt?: string;
            mediaContentType: string;
            status: string;
          }>;
          mediaUserErrors: UserError[];
          product: {
            id: string;
          };
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const mediaData = res.data.data.productCreateMedia.media;
    const mediaUserErrors = res.data.data.productCreateMedia.mediaUserErrors;
    const product = res.data.data.productCreateMedia.product;

    if (mediaUserErrors.length > 0) {
      throw getGraphqlShopifyUserError(mediaUserErrors, {
        shop,
        productId,
        media
      });
    }

    return {
      media: mediaData,
      mediaUserErrors,
      product
    };
  }

  /**
   * Sets metafields for products, variants, or other resources
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param metafields - Array of metafield data to set
   * @returns Promise with created/updated metafields and any errors
   */
  async setMetafields(
    accessToken: string,
    shop: string,
    metafields: MetafieldsSetInput[]
  ): Promise<MetafieldsSetResponse> {
    // Validate inputs
    if (!metafields || metafields.length === 0) {
      throw new Error('At least one metafield is required');
    }
    
    // Validate each metafield
    metafields.forEach((metafield, index) => {
      if (!metafield.key || !metafield.namespace || !metafield.ownerId || !metafield.type || metafield.value === undefined) {
        throw new Error(`Metafield at index ${index} is missing required fields (key, namespace, ownerId, type, value)`);
      }
    });
    
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            namespace
            value
            type
            createdAt
            updatedAt
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const variables = {
      metafields: metafields.map(metafield => ({
        key: metafield.key,
        namespace: metafield.namespace,
        ownerId: this.ensureGid(metafield.ownerId, this.inferResourceType(metafield.ownerId)),
        type: metafield.type,
        value: metafield.value
      }))
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        metafieldsSet: {
          metafields: Array<{
            id: string;
            key: string;
            namespace: string;
            value: string;
            type: string;
            createdAt: string;
            updatedAt: string;
          }>;
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const metafieldsData = res.data.data.metafieldsSet.metafields;
    const userErrors = res.data.data.metafieldsSet.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        metafields
      });
    }

    return {
      metafields: metafieldsData,
      userErrors
    };
  }

  /**
   * Creates a new collection in the Shopify store
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param collectionInput - Collection creation input data
   * @returns Promise with created collection data and any errors
   */
  async createCollection(
    accessToken: string,
    shop: string,
    collectionInput: CollectionCreateInput
  ): Promise<CollectionCreateResponse> {
    // Validate required fields
    if (!collectionInput.title || collectionInput.title.trim() === '') {
      throw new Error('Collection title is required');
    }
    
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation CollectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection {
            id
            title
            handle
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        title: collectionInput.title,
        descriptionHtml: collectionInput.descriptionHtml,
        handle: collectionInput.handle,
        products: collectionInput.products?.map(id => this.ensureGid(id, 'Product')),
        ruleSet: collectionInput.ruleSet,
        metafields: collectionInput.metafields?.map(metafield => ({
          key: metafield.key,
          namespace: metafield.namespace,
          value: metafield.value,
          type: metafield.type
        }))
      }
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        collectionCreate: {
          collection: {
            id: string;
            title: string;
            handle: string;
            descriptionHtml?: string;
          };
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const collection = res.data.data.collectionCreate.collection;
    const userErrors = res.data.data.collectionCreate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        collectionInput
      });
    }

    return {
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      descriptionHtml: collection.descriptionHtml
    };
  }

  /**
   * Updates an existing collection in the Shopify store
   * @param accessToken - Shopify API access token
   * @param shop - Shop domain
   * @param collectionInput - Collection update input data including ID
   * @returns Promise with updated collection data and any errors
   */
  async updateCollection(
    accessToken: string,
    shop: string,
    collectionInput: CollectionUpdateInput
  ): Promise<CollectionUpdateResponse> {
    const myshopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      mutation CollectionUpdate($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          collection {
            id
            title
            handle
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: this.ensureGid(collectionInput.id, 'Collection'),
        title: collectionInput.title,
        descriptionHtml: collectionInput.descriptionHtml,
        handle: collectionInput.handle,
        products: collectionInput.products?.map(id => this.ensureGid(id, 'Product')),
        ruleSet: collectionInput.ruleSet,
        metafields: collectionInput.metafields?.map(metafield => ({
          key: metafield.key,
          namespace: metafield.namespace,
          value: metafield.value,
          type: metafield.type
        }))
      }
    };

    const res = await this.shopifyGraphqlRequest<{
      data: {
        collectionUpdate: {
          collection: {
            id: string;
            title: string;
            handle: string;
            descriptionHtml?: string;
          };
          userErrors: UserError[];
        };
      };
    }>({
      url: `https://${myshopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables
    });

    const collection = res.data.data.collectionUpdate.collection;
    const userErrors = res.data.data.collectionUpdate.userErrors;

    if (userErrors.length > 0) {
      throw getGraphqlShopifyUserError(userErrors, {
        shop,
        collectionInput
      });
    }

    return {
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      descriptionHtml: collection.descriptionHtml
    };
  }

  private getOrdersFields(fields?: string[]): string {
    const defaultFields = [
      "id",
      "order_number",
      "total_price",
      "discount_codes",
      "currency",
      "financial_status",
      "total_shipping_price_set",
      "created_at",
      "customer",
      "email",
    ];

    if (!fields) return defaultFields.join(",");

    return [...defaultFields, ...fields].join(",");
  }

  private getIds(ids?: string[]): string | undefined {
    if (!ids) return;
    return ids.join(",");
  }

  public getIdFromGid(gid: string): string {
    const id = gid.split("/").pop();
    if (!id) {
      throw new Error("Invalid GID");
    }
    return id;
  }

  public ensureGid(id: string, type: string): string {
    if (id.startsWith('gid://shopify/')) {
      return id;
    }
    return `gid://shopify/${type}/${id}`;
  }

  private inferResourceType(ownerId: string): string {
    // If already a GID, extract the type
    if (ownerId.startsWith('gid://shopify/')) {
      const match = ownerId.match(/gid:\/\/shopify\/([^\/]+)\//);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Default to Product, but this could be enhanced with more context
    // Common resource types: Product, ProductVariant, Collection, Customer, Order
    return 'Product';
  }

  async getPriceRule(
    accessToken: string,
    shop: string,
    priceRuleInput: GetPriceRuleInput
  ): Promise<GetPriceRuleResponse> {
    const myShopifyDomain = await this.getMyShopifyDomain(accessToken, shop);

    const graphqlQuery = gql`
      query priceRules(first:250,$query: String) {
        priceRules(query: $query) {
          nodes {
            id
            title
            status
          }
        }
      }
    `;

    const res = await this.shopifyGraphqlRequest<{
      data: GetPriceRuleResponse;
    }>({
      url: `https://${myShopifyDomain}/admin/api/${this.SHOPIFY_API_VERSION}/graphql.json`,
      accessToken,
      query: graphqlQuery,
      variables: priceRuleInput,
    });

    return res.data.data;
  }

  private mapGraphqlTopicToTopic(
    topic: ShopifyWebhookTopicGraphql
  ): ShopifyWebhookTopic {
    switch (topic) {
      case ShopifyWebhookTopicGraphql.ORDERS_UPDATED:
        return ShopifyWebhookTopic.ORDERS_UPDATED;
    }
  }

  private mapTopicToGraphqlTopic(
    topic: ShopifyWebhookTopic
  ): ShopifyWebhookTopicGraphql {
    switch (topic) {
      case ShopifyWebhookTopic.ORDERS_UPDATED:
        return ShopifyWebhookTopicGraphql.ORDERS_UPDATED;
    }
  }
}
