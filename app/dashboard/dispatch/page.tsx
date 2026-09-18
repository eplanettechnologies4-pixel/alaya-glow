import React from "react";
import { supabaseServer } from "@/lib/supabase/server";
import DispatchForm, { DispatchableItem } from "@/components/dispatch/DispatchForm";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  // Fetch variants and their current stock from inventory table
  const { data: inventoryRows, error } = await supabaseServer
    .from("inventory")
    .select(
      `
      id,
      variant_id,
      quantity,
      product_variants (
        id,
        shopify_variant_id,
        title,
        sku,
        products (
          id,
          title,
          image_url
        )
      )
    `
    )
    .order("quantity", { ascending: false });

  if (error) {
    console.error("Error fetching inventory for dispatch form:", error);
  }

  const availableItems: DispatchableItem[] = (inventoryRows || [])
    .map((row: any) => {
      const variant = row.product_variants;
      const product = variant?.products;
      if (!variant || !row.variant_id) return null;

      return {
        variantId: row.variant_id,
        productTitle: product?.title || "Unknown Product",
        variantTitle: variant.title || "Default Title",
        sku: variant.sku || null,
        stock: typeof row.quantity === "number" ? row.quantity : 0,
        imageUrl: product?.image_url || null,
      };
    })
    .filter(Boolean) as DispatchableItem[];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 md:p-10 font-sans">
      <DispatchForm availableItems={availableItems} />
    </div>
  );
}
