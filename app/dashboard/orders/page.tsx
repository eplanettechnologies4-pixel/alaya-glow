import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import OrdersView, { OrderData, OrderLineItem } from "@/components/orders/OrdersView";
import { ShoppingCart, ArrowLeft, Package, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  // Query orders joined with customer and line items
  const { data: rawOrders, error } = await supabaseServer
    .from("orders")
    .select(
      `
      id,
      shopify_order_id,
      order_number,
      total_price,
      financial_status,
      fulfillment_status,
      created_at,
      customers (
        first_name,
        last_name,
        email,
        phone
      ),
      order_line_items (
        id,
        quantity,
        price,
        product_variants (
          title,
          products (
            title
          )
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
  }

  const initialOrders: OrderData[] = (rawOrders || []).map((order: any) => {
    const cust = order.customers;
    const customerName =
      `${cust?.first_name || ""} ${cust?.last_name || ""}`.trim() || "Guest Customer";

    const rawItems = order.order_line_items || [];
    const lineItems: OrderLineItem[] = rawItems.map((it: any) => ({
      id: it.id,
      quantity: it.quantity || 1,
      price: typeof it.price === "number" ? it.price : parseFloat(it.price || "0"),
      variantTitle: it.product_variants?.title,
      productTitle: it.product_variants?.products?.title,
    }));

    return {
      id: order.id,
      shopify_order_id: order.shopify_order_id,
      order_number: order.order_number || `#${order.shopify_order_id}`,
      total_price:
        typeof order.total_price === "number"
          ? order.total_price
          : parseFloat(order.total_price || "0"),
      financial_status: order.financial_status || "pending",
      fulfillment_status: order.fulfillment_status || "unfulfilled",
      created_at: order.created_at,
      customer_name: customerName,
      customer_email: cust?.email || null,
      customer_phone: cust?.phone || null,
      items_count: lineItems.reduce((sum, item) => sum + item.quantity, 0),
      line_items: lineItems,
    };
  });

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 md:p-10 font-sans space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
          <Link
            href="/dashboard"
            className="hover:text-emerald-400 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-slate-200">Orders Management</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <ShoppingCart className="w-6 h-6 text-emerald-400 stroke-[2.2]" />
              Customer Orders
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live order feed updated in real time via Shopify webhooks &amp; Supabase Realtime.
            </p>
          </div>
        </div>
      </div>

      <OrdersView initialOrders={initialOrders} />
    </div>
  );
}
