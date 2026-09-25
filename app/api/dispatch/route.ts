import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { queryShopifyAdmin } from "@/lib/shopify/client";

export const dynamic = "force-dynamic";

interface DispatchItemInput {
  variantId: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
}

interface DispatchRequestBody {
  recipientName: string;
  notes?: string;
  paymentStatus?: "paid" | "unpaid";
  discount?: {
    type: "percentage" | "fixed";
    value: number;
    amount: number;
  };
  subtotal?: number;
  totalAmount?: number;
  items: DispatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const body: DispatchRequestBody = await request.json();
    const { recipientName, notes, paymentStatus, discount, subtotal, totalAmount, items } = body;

    // 1. Validation
    if (!recipientName || typeof recipientName !== "string" || !recipientName.trim()) {
      return NextResponse.json(
        { success: false, error: "Recipient name is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one line item is required" },
        { status: 400 }
      );
    }

    // Validate quantities and collect variant info
    const validatedItems: Array<{
      variantId: string;
      quantity: number;
      invRowId: string;
      quantityBefore: number;
      quantityAfter: number;
      shopifyVariantId: number | null;
      itemTitle: string;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    for (const item of items) {
      const parsedQty = parseInt(String(item.quantity), 10);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        return NextResponse.json(
          { success: false, error: "Item quantity must be a positive integer" },
          { status: 400 }
        );
      }

      if (!item.variantId) {
        return NextResponse.json(
          { success: false, error: "Missing variant selection for line item" },
          { status: 400 }
        );
      }

      // Check inventory in Supabase
      const { data: invRow, error: invErr } = await supabaseAdmin
        .from("inventory")
        .select(
          `
          id,
          quantity,
          variant_id,
          product_variants (
            id,
            shopify_variant_id,
            title,
            price,
            products (
              title,
              price_min
            )
          )
        `
        )
        .eq("variant_id", item.variantId)
        .maybeSingle();

      if (invErr) {
        console.error("Error checking inventory for variant:", invErr);
        throw invErr;
      }

      if (!invRow) {
        return NextResponse.json(
          { success: false, error: `No inventory record found for variant ID ${item.variantId}` },
          { status: 400 }
        );
      }

      const variantData = invRow.product_variants as any;
      const productTitle = variantData?.products?.title || "Product";
      const variantTitle = variantData?.title && variantData.title !== "Default Title" ? ` (${variantData.title})` : "";
      const fullTitle = `${productTitle}${variantTitle}`;

      if (invRow.quantity < parsedQty) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for "${fullTitle}". Requested ${parsedQty}, but only ${invRow.quantity} available.`,
          },
          { status: 400 }
        );
      }

      const fallbackPrice =
        typeof variantData?.price === "number"
          ? variantData.price
          : typeof variantData?.products?.price_min === "number"
          ? variantData.products.price_min
          : 0;

      const itemUnitPrice = typeof item.unitPrice === "number" ? item.unitPrice : fallbackPrice;
      const itemTotalPrice = typeof item.totalPrice === "number" ? item.totalPrice : itemUnitPrice * parsedQty;

      validatedItems.push({
        variantId: item.variantId,
        quantity: parsedQty,
        invRowId: invRow.id,
        quantityBefore: invRow.quantity,
        quantityAfter: invRow.quantity - parsedQty,
        shopifyVariantId: variantData?.shopify_variant_id || null,
        itemTitle: fullTitle,
        unitPrice: itemUnitPrice,
        totalPrice: itemTotalPrice,
      });
    }

    // 2. Format notes, payment status, and pricing metadata
    const rawNotes = notes?.trim() || "";
    const effectivePaymentStatus: "paid" | "unpaid" = paymentStatus === "paid" ? "paid" : "unpaid";
    const calculatedSubtotal =
      typeof subtotal === "number" ? subtotal : validatedItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const calculatedTotalAmount = typeof totalAmount === "number" ? totalAmount : calculatedSubtotal;

    const notesToSave = JSON.stringify({
      text: rawNotes,
      paymentStatus: effectivePaymentStatus,
      paidAt: effectivePaymentStatus === "paid" ? new Date().toISOString() : null,
      pricing: {
        subtotal: calculatedSubtotal,
        discount: discount || { type: "fixed", value: 0, amount: 0 },
        totalAmount: calculatedTotalAmount,
        items: validatedItems.map((it) => ({
          variantId: it.variantId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
        })),
      },
    });

    // 3. Insert row into manual_dispatches
    const totalQuantity = validatedItems.reduce((acc, it) => acc + it.quantity, 0);

    const { data: dispatch, error: dispatchErr } = await supabaseAdmin
      .from("manual_dispatches")
      .insert({
        recipient_name: recipientName.trim(),
        notes: notesToSave,
        total_quantity: totalQuantity,
      })
      .select("id")
      .single();

    if (dispatchErr || !dispatch) {
      console.error("Error creating manual dispatch record:", dispatchErr);
      throw dispatchErr || new Error("Failed to create dispatch record");
    }

    // 4. For each item: insert into manual_dispatch_items, decrement inventory, push to Shopify
    for (const item of validatedItems) {
      // a. Insert into manual_dispatch_items
      const { error: itemInsertErr } = await supabaseAdmin
        .from("manual_dispatch_items")
        .insert({
          dispatch_id: dispatch.id,
          variant_id: item.variantId,
          quantity: item.quantity,
          quantity_before: item.quantityBefore,
          quantity_after: item.quantityAfter,
        });

      if (itemInsertErr) {
        console.error("Error inserting manual dispatch item:", itemInsertErr);
      }

      // b. Decrement inventory in Supabase
      const { error: invUpdateErr } = await supabaseAdmin
        .from("inventory")
        .update({
          quantity: item.quantityAfter,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.invRowId);

      if (invUpdateErr) {
        console.error("Error updating inventory quantity in Supabase:", invUpdateErr);
      }

      // c. Push decrement to Shopify via inventorySetQuantities mutation
      if (item.shopifyVariantId) {
        try {
          const shopifyVariantGid = `gid://shopify/ProductVariant/${item.shopifyVariantId}`;
          const variantQuery = `
            query GetVariantInventory($id: ID!) {
              productVariant(id: $id) {
                id
                inventoryItem {
                  id
                  inventoryLevels(first: 1) {
                    edges {
                      node {
                        location {
                          id
                        }
                        quantities(names: ["available"]) {
                          name
                          quantity
                        }
                      }
                    }
                  }
                }
              }
            }
          `;

          const variantRes = await queryShopifyAdmin(variantQuery, { id: shopifyVariantGid });
          const variantData = variantRes.data?.productVariant;

          if (variantData?.inventoryItem) {
            const inventoryItemId = variantData.inventoryItem.id;
            const invLevels = variantData.inventoryItem.inventoryLevels?.edges || [];

            if (invLevels.length > 0 && invLevels[0].node?.location?.id) {
              const locationId = invLevels[0].node.location.id;
              const currentQuantities = invLevels[0].node.quantities || [];
              const availableObj = currentQuantities.find((q: any) => q.name === "available");
              const currentShopifyQty =
                typeof availableObj?.quantity === "number" ? availableObj.quantity : item.quantityBefore;

              const idempotencyKey = crypto.randomUUID();
              const setInvMutation = `
                mutation SetInventory($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
                  inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
                    inventoryAdjustmentGroup {
                      id
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `;

              await queryShopifyAdmin(setInvMutation, {
                idempotencyKey,
                input: {
                  name: "available",
                  reason: "correction",
                  quantities: [
                    {
                      inventoryItemId,
                      locationId,
                      quantity: item.quantityAfter,
                      changeFromQuantity: currentShopifyQty,
                    },
                  ],
                },
              });
            }
          }
        } catch (shopifyErr) {
          console.warn(`Could not sync dispatch decrement to Shopify for variant ${item.shopifyVariantId}:`, shopifyErr);
          // We continue processing so local dispatch record is preserved
        }
      }
    }

    return NextResponse.json({
      success: true,
      dispatchId: dispatch.id,
      totalQuantity,
    });
  } catch (error: any) {
    console.error("Error processing manual dispatch:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process manual dispatch" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let dispatchId: string | null = null;
    let restoreInventory: boolean = true;

    // Check query parameter ?id=...
    const { searchParams } = new URL(request.url);
    if (searchParams.get("id")) {
      dispatchId = searchParams.get("id");
    }
    if (searchParams.get("restoreInventory") !== null) {
      restoreInventory = searchParams.get("restoreInventory") === "true";
    }

    // Check JSON body if available
    try {
      const body = await request.json();
      if (body?.dispatchId) dispatchId = body.dispatchId;
      if (typeof body?.restoreInventory === "boolean") restoreInventory = body.restoreInventory;
    } catch {
      // Body may not be passed or already parsed
    }

    if (!dispatchId || typeof dispatchId !== "string") {
      return NextResponse.json(
        { success: false, error: "Dispatch ID is required" },
        { status: 400 }
      );
    }

    // 1. Fetch dispatch record to verify it exists
    const { data: dispatch, error: fetchErr } = await supabaseAdmin
      .from("manual_dispatches")
      .select("id, recipient_name, total_quantity")
      .eq("id", dispatchId)
      .maybeSingle();

    if (fetchErr || !dispatch) {
      return NextResponse.json(
        { success: false, error: "Dispatch record not found in database" },
        { status: 404 }
      );
    }

    // 2. Fetch dispatch items
    const { data: dispatchItems, error: itemsFetchErr } = await supabaseAdmin
      .from("manual_dispatch_items")
      .select(
        `
        id,
        variant_id,
        quantity,
        product_variants (
          id,
          shopify_variant_id,
          title
        )
      `
      )
      .eq("dispatch_id", dispatchId);

    if (itemsFetchErr) {
      console.error("Error fetching dispatch items for deletion:", itemsFetchErr);
    }

    // 3. If restoreInventory is true, add the quantities back to inventory and Shopify
    if (restoreInventory && Array.isArray(dispatchItems) && dispatchItems.length > 0) {
      for (const item of dispatchItems) {
        if (!item.variant_id || !item.quantity) continue;

        // a. Fetch current inventory row in Supabase
        const { data: invRow } = await supabaseAdmin
          .from("inventory")
          .select("id, quantity")
          .eq("variant_id", item.variant_id)
          .maybeSingle();

        if (invRow) {
          const restoredQty = invRow.quantity + item.quantity;
          await supabaseAdmin
            .from("inventory")
            .update({
              quantity: restoredQty,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invRow.id);

          // b. Sync restored quantity to Shopify if variant has shopify_variant_id
          const shopifyVariantId = (item.product_variants as any)?.shopify_variant_id;
          if (shopifyVariantId) {
            try {
              const shopifyVariantGid = `gid://shopify/ProductVariant/${shopifyVariantId}`;
              const variantQuery = `
                query GetVariantInventory($id: ID!) {
                  productVariant(id: $id) {
                    id
                    inventoryItem {
                      id
                      inventoryLevels(first: 1) {
                        edges {
                          node {
                            location {
                              id
                            }
                            quantities(names: ["available"]) {
                              name
                              quantity
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `;

              const variantRes = await queryShopifyAdmin(variantQuery, { id: shopifyVariantGid });
              const variantData = variantRes.data?.productVariant;

              if (variantData?.inventoryItem) {
                const inventoryItemId = variantData.inventoryItem.id;
                const invLevels = variantData.inventoryItem.inventoryLevels?.edges || [];

                if (invLevels.length > 0 && invLevels[0].node?.location?.id) {
                  const locationId = invLevels[0].node.location.id;
                  const currentQuantities = invLevels[0].node.quantities || [];
                  const availableObj = currentQuantities.find((q: any) => q.name === "available");
                  const currentShopifyQty =
                    typeof availableObj?.quantity === "number" ? availableObj.quantity : invRow.quantity;

                  const idempotencyKey = crypto.randomUUID();
                  const setInvMutation = `
                    mutation SetInventory($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
                      inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
                        inventoryAdjustmentGroup {
                          id
                        }
                        userErrors {
                          field
                          message
                        }
                      }
                    }
                  `;

                  await queryShopifyAdmin(setInvMutation, {
                    idempotencyKey,
                    input: {
                      name: "available",
                      reason: "correction",
                      quantities: [
                        {
                          inventoryItemId,
                          locationId,
                          quantity: currentShopifyQty + item.quantity,
                          changeFromQuantity: currentShopifyQty,
                        },
                      ],
                    },
                  });
                }
              }
            } catch (shopifyErr) {
              console.warn(
                `Could not sync restored inventory to Shopify for variant ${shopifyVariantId}:`,
                shopifyErr
              );
            }
          }
        }
      }
    }

    // 4. Delete related items from manual_dispatch_items table
    const { error: itemsDeleteErr } = await supabaseAdmin
      .from("manual_dispatch_items")
      .delete()
      .eq("dispatch_id", dispatchId);

    if (itemsDeleteErr) {
      console.error("Error deleting dispatch items:", itemsDeleteErr);
      return NextResponse.json(
        { success: false, error: "Failed to delete dispatch items from database" },
        { status: 500 }
      );
    }

    // 5. Delete parent record from manual_dispatches table
    const { error: dispatchDeleteErr } = await supabaseAdmin
      .from("manual_dispatches")
      .delete()
      .eq("id", dispatchId);

    if (dispatchDeleteErr) {
      console.error("Error deleting dispatch record:", dispatchDeleteErr);
      return NextResponse.json(
        { success: false, error: "Failed to delete dispatch record from database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Dispatch record completely removed from database",
      deletedId: dispatchId,
      restoredInventory: restoreInventory,
    });
  } catch (error: any) {
    console.error("Error deleting dispatch:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error deleting dispatch" },
      { status: 500 }
    );
  }
}

