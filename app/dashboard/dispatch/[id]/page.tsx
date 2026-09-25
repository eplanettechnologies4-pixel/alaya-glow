import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import PrintButton from "@/components/dispatch/PrintButton";
import { ArrowLeft, CheckCircle2, History, Package, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

interface ReceiptPageProps {
  params: {
    id: string;
  };
}

export default async function DispatchReceiptPage({ params }: ReceiptPageProps) {
  const { id } = params;

  // 1. Fetch dispatch details
  const { data: dispatch, error: dispatchErr } = await supabaseServer
    .from("manual_dispatches")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (dispatchErr || !dispatch) {
    notFound();
  }

  // 2. Fetch dispatch items
  const { data: items, error: itemsErr } = await supabaseServer
    .from("manual_dispatch_items")
    .select(
      `
      id,
      quantity,
      quantity_before,
      quantity_after,
      variant_id,
      product_variants (
        id,
        shopify_variant_id,
        title,
        sku,
        products (
          id,
          title
        )
      )
    `
    )
    .eq("dispatch_id", id);

  if (itemsErr) {
    console.error("Error fetching dispatch items:", itemsErr);
  }

  const dispatchDate = new Date(dispatch.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Parse optional pricing and discount metadata from notes
  let displayNotes = dispatch.notes || "";
  let pricingData: {
    subtotal?: number;
    discount?: { type: "percentage" | "fixed"; value: number; amount: number };
    totalAmount?: number;
    items?: Array<{ variantId: string; quantity: number; unitPrice: number; totalPrice: number }>;
  } | null = null;

  if (dispatch.notes && typeof dispatch.notes === "string" && dispatch.notes.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(dispatch.notes);
      if (parsed && typeof parsed === "object") {
        displayNotes = parsed.text || "";
        pricingData = parsed.pricing || null;
      }
    } catch {
      // Keep plain text fallback
    }
  }

  const pricingMap = new Map<string, { unitPrice: number; totalPrice: number }>();
  if (pricingData?.items) {
    pricingData.items.forEach((pItem) => {
      pricingMap.set(pItem.variantId, {
        unitPrice: pItem.unitPrice,
        totalPrice: pItem.totalPrice,
      });
    });
  }

  const hasPricing = Boolean(pricingData && (pricingData.subtotal !== undefined || pricingData.totalAmount !== undefined));

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-8 font-sans print:p-0 print:m-0 print:min-h-0 print:bg-white print:text-black">
      {/* Top Navigation Bar - Hidden on Print */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/dispatch"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            New Dispatch
          </Link>
          <Link
            href="/dashboard/dispatch/history"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-all shadow-sm"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            History
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            Dispatched &amp; Synced
          </div>
          <PrintButton />
        </div>
      </div>

      {/* Printable Receipt Card */}
      <div className="max-w-3xl mx-auto rounded-2xl border border-slate-800 bg-[#0c1220] shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-transparent print:m-0 print:p-0 print:max-w-none print:w-full print:rounded-none">
        <div className="p-8 sm:p-12 print:p-0 text-slate-100 print:text-black space-y-8 print:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-800 print:border-slate-300">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-5 h-5 text-emerald-400 print:text-black" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 print:text-black">
                  Alaya Glow ERP
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white print:text-black">
                Stock Dispatch Receipt
              </h1>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                Offline shipment and warehouse inventory reduction confirmation.
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="inline-block px-2.5 py-1 rounded bg-slate-800 text-emerald-400 print:bg-slate-100 print:text-black print:border print:border-slate-300 text-[11px] font-mono font-bold tracking-wider">
                COMPLETED
              </span>
              <p className="text-xs font-mono text-slate-400 print:text-slate-600">
                Dispatch ID:
              </p>
              <p className="text-xs font-mono text-slate-200 print:text-black font-semibold break-all">
                {dispatch.id}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-900/60 print:bg-slate-50 border border-slate-800/80 print:border-slate-300 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600 mb-1">
                Recipient / Consignee
              </p>
              <p className="text-base font-bold text-white print:text-black">
                {dispatch.recipient_name}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600 mb-1">
                Dispatch Date &amp; Time
              </p>
              <p className="text-sm font-medium text-slate-200 print:text-black">
                {dispatchDate}
              </p>
            </div>

            {displayNotes && (
              <div className="sm:col-span-2 pt-2 border-t border-slate-800/60 print:border-slate-300">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600 mb-1">
                  Notes / Shipment Remarks
                </p>
                <p className="text-xs text-slate-300 print:text-slate-800 whitespace-pre-wrap">
                  {displayNotes}
                </p>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-black">
              Dispatched Line Items
            </h2>

            <div className="border border-slate-800 print:border-slate-300 rounded-xl overflow-hidden print:rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 print:bg-slate-100 border-b border-slate-800 print:border-slate-300 text-[11px] font-semibold uppercase tracking-wider text-slate-400 print:text-slate-800">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Item Description</th>
                    <th className="py-2.5 px-4">SKU</th>
                    {hasPricing && <th className="py-2.5 px-4 text-right">Unit Price</th>}
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    {hasPricing && <th className="py-2.5 px-4 text-right">Line Total</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 print:divide-slate-200 text-slate-200 print:text-black">
                  {(items || []).map((row: any, idx: number) => {
                    const variant = row.product_variants;
                    const productTitle = variant?.products?.title || "Product";
                    const variantTitle =
                      variant?.title && variant.title !== "Default Title" ? ` - ${variant.title}` : "";

                    const pricingItem = pricingMap.get(row.variant_id);
                    const unitPrice = pricingItem?.unitPrice ?? 0;
                    const lineTotal = pricingItem?.totalPrice ?? unitPrice * row.quantity;

                    return (
                      <tr key={row.id} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                        <td className="py-3 px-4 text-center font-mono text-xs text-slate-400 print:text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-medium text-white print:text-black">
                          {productTitle}
                          {variantTitle && (
                            <span className="text-xs text-slate-400 print:text-slate-600 block">
                              {variantTitle}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 print:text-slate-700">
                          {variant?.sku || "—"}
                        </td>
                        {hasPricing && (
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-300 print:text-black">
                            Rs {unitPrice.toLocaleString()}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right font-mono font-bold text-white print:text-black">
                          {row.quantity}
                        </td>
                        {hasPricing && (
                          <td className="py-3 px-4 text-right font-mono font-bold text-white print:text-black">
                            Rs {lineTotal.toLocaleString()}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900/80 print:bg-slate-100 border-t-2 border-slate-800 print:border-slate-400 font-bold">
                    <td colSpan={hasPricing ? 4 : 3} className="py-3 px-4 text-right uppercase tracking-wider text-xs text-slate-300 print:text-black">
                      Total Units Dispatched:
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-base text-emerald-400 print:text-black">
                      {dispatch.total_quantity}
                    </td>
                    {hasPricing && <td className="py-3 px-4" />}
                  </tr>

                  {hasPricing && (
                    <>
                      <tr className="bg-slate-900/60 print:bg-slate-50 border-t border-slate-800 print:border-slate-300 text-xs text-slate-300 print:text-black">
                        <td colSpan={5} className="py-2 px-4 text-right font-medium">
                          Items Subtotal:
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold">
                          Rs {pricingData?.subtotal?.toLocaleString() ?? "0"}
                        </td>
                      </tr>

                      {pricingData?.discount && pricingData.discount.amount > 0 && (
                        <tr className="bg-slate-900/60 print:bg-slate-50 text-xs text-emerald-400 print:text-black">
                          <td colSpan={5} className="py-2 px-4 text-right font-medium">
                            Discount ({pricingData.discount.type === "percentage" ? `${pricingData.discount.value}%` : "Fixed"}):
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-semibold">
                            - Rs {pricingData.discount.amount.toLocaleString()}
                          </td>
                        </tr>
                      )}

                      <tr className="bg-slate-900 print:bg-slate-100 border-t-2 border-slate-800 print:border-slate-400 font-bold text-sm">
                        <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-xs text-white print:text-black">
                          Final Net Payable / Total:
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-base text-emerald-400 print:text-black font-extrabold">
                          Rs {pricingData?.totalAmount?.toLocaleString() ?? "0"}
                        </td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>
          </div>

          {/* Signoff / Verification footer for physical receipt */}
          <div className="pt-8 border-t border-slate-800 print:border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-400 print:text-slate-800">
            <div className="space-y-8">
              <p className="font-medium text-slate-300 print:text-black">Dispatched By (Warehouse / Officer):</p>
              <div className="border-b border-slate-700 print:border-black w-56" />
            </div>
            <div className="space-y-8">
              <p className="font-medium text-slate-300 print:text-black">Received In Good Condition By:</p>
              <div className="border-b border-slate-700 print:border-black w-56" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
