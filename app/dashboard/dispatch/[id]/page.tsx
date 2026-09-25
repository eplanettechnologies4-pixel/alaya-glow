import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import PrintButton from "@/components/dispatch/PrintButton";
import ReceiptStatusToggle from "@/components/dispatch/ReceiptStatusToggle";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Sparkles,
  Calendar,
  User,
  FileText,
  CreditCard,
  Clock,
  PackageCheck,
} from "lucide-react";

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

  // Parse optional pricing, discount, and paymentStatus metadata from notes
  let displayNotes = dispatch.notes || "";
  let paymentStatus: "paid" | "unpaid" = "unpaid";
  let paidAt: string | null = null;
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
        paymentStatus = parsed.paymentStatus === "paid" ? "paid" : "unpaid";
        paidAt = parsed.paidAt || null;
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
    <>
      {/* Zero margin print style to eliminate browser default URL and date footers/headers */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A4 portrait;
              margin: 0mm !important;
            }
            @media print {
              html, body {
                margin: 0mm !important;
                padding: 0mm !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .receipt-page {
                page-break-after: avoid !important;
                page-break-before: avoid !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `,
        }}
      />

      <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-8 font-sans print:p-0 print:m-0 print:min-h-0 print:bg-white print:text-black">
        {/* Top Navigation Bar - Hidden on Print */}
        <div className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/dispatch"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              New Dispatch
            </Link>
            <Link
              href="/dashboard/dispatch/history"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all shadow-sm"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              History Log
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Shopify Synced
            </div>
            <PrintButton />
          </div>
        </div>

        {/* Main Printable Receipt Card - Strictly 1 Page */}
        <div className="max-w-4xl mx-auto rounded-3xl border border-slate-800/80 bg-[#0c1220] shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:m-0 print:p-6 print:max-w-none print:w-full print:rounded-none receipt-page print:max-h-[285mm] print:overflow-hidden">
          <div className="p-6 sm:p-9 print:p-0 text-slate-100 print:text-slate-900 space-y-4 print:space-y-3.5">
            
            {/* Header Block: Alaya Glow Emerald Branding & Status Badges */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-800 print:border-slate-300">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center print:border-emerald-700 print:bg-emerald-50">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-700 stroke-[2.5]" />
                  </div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 print:text-emerald-700">
                    ALAYA GLOW ERP • DISTRIBUTION PORTAL
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white print:text-slate-900">
                  Stock Dispatch Receipt
                </h1>
                <p className="text-[11px] text-slate-400 print:text-slate-600 mt-0.5">
                  Official Delivery Voucher &amp; Inventory Deduction Confirmation
                </p>
              </div>

              {/* Status and Reference ID */}
              <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                      paymentStatus === "paid"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 print:bg-emerald-50 print:text-emerald-800 print:border-emerald-300"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/30 print:bg-amber-50 print:text-amber-800 print:border-amber-300"
                    }`}
                  >
                    {paymentStatus === "paid" ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                        PAID IN FULL
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 stroke-[2.5]" />
                        PAYMENT PENDING
                      </>
                    )}
                  </span>
                  <span className="inline-block px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 print:bg-slate-100 print:text-slate-800 print:border-slate-300 text-[11px] font-mono font-bold">
                    SYNCED
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-400 print:text-slate-600">
                  Ref: <span className="text-slate-200 print:text-slate-900 font-bold">{dispatch.id}</span>
                </p>
              </div>
            </div>

            {/* Interactive Payment Status Changer (On-screen only, hidden on print) */}
            <ReceiptStatusToggle
              dispatchId={dispatch.id}
              initialStatus={paymentStatus}
              paidAt={paidAt}
            />

            {/* Consignee & Details Ribbon (Compact 4-column bar) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-900/60 print:bg-slate-50 border border-slate-800 print:border-slate-200 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500 mb-0.5 flex items-center gap-1">
                  <User className="w-3 h-3 text-emerald-400 print:text-emerald-700" />
                  Recipient / Consignee
                </p>
                <p className="text-sm font-bold text-white print:text-slate-900 truncate">
                  {dispatch.recipient_name}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500 mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-400 print:text-emerald-700" />
                  Dispatch Date
                </p>
                <p className="text-xs font-semibold text-slate-200 print:text-slate-800 font-mono">
                  {dispatchDate}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500 mb-0.5 flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-emerald-400 print:text-emerald-700" />
                  Payment Status
                </p>
                <p
                  className={`text-xs font-bold font-mono ${
                    paymentStatus === "paid"
                      ? "text-emerald-400 print:text-emerald-700"
                      : "text-amber-400 print:text-amber-700"
                  }`}
                >
                  {paymentStatus === "paid" ? "Paid In Full" : "Pending Payment"}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500 mb-0.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-emerald-400 print:text-emerald-700" />
                  Notes / Reference
                </p>
                <p className="text-xs text-slate-300 print:text-slate-700 truncate" title={displayNotes || "None"}>
                  {displayNotes || "—"}
                </p>
              </div>
            </div>

            {/* Dispatched Line Items Table */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-700" />
                  Dispatched Line Items ({items?.length || 0})
                </h2>
              </div>

              <div className="border border-slate-800/90 print:border-slate-300 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 print:bg-slate-100 border-b border-slate-800 print:border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-700">
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Item &amp; Description</th>
                      <th className="py-2 px-3">SKU</th>
                      {hasPricing && <th className="py-2 px-3 text-right">Unit Price</th>}
                      <th className="py-2 px-3 text-right">Qty</th>
                      {hasPricing && <th className="py-2 px-3 text-right">Total Price</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 text-slate-200 print:text-slate-900">
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
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400 print:text-slate-600">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-semibold text-white print:text-slate-900">
                            <span>{productTitle}</span>
                            {variantTitle && (
                              <span className="text-[11px] text-slate-400 print:text-slate-600 block font-normal">
                                {variantTitle}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-400 print:text-slate-600">
                            {variant?.sku || "—"}
                          </td>
                          {hasPricing && (
                            <td className="py-2 px-3 text-right font-mono text-xs text-slate-300 print:text-slate-800">
                              Rs {unitPrice.toLocaleString()}
                            </td>
                          )}
                          <td className="py-2 px-3 text-right font-mono font-bold text-white print:text-slate-900">
                            {row.quantity}
                          </td>
                          {hasPricing && (
                            <td className="py-2 px-3 text-right font-mono font-bold text-white print:text-slate-900">
                              Rs {lineTotal.toLocaleString()}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {/* Units Total Row */}
                    <tr className="bg-slate-900/80 print:bg-slate-50 border-t-2 border-slate-800 print:border-slate-300 text-xs font-semibold">
                      <td
                        colSpan={hasPricing ? 4 : 3}
                        className="py-2 px-3 text-right uppercase tracking-wider text-[11px] text-slate-400 print:text-slate-600"
                      >
                        Total Units Dispatched:
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-sm font-bold text-emerald-400 print:text-slate-900">
                        {dispatch.total_quantity}
                      </td>
                      {hasPricing && <td className="py-2 px-3" />}
                    </tr>

                    {/* Financial Totals Rows */}
                    {hasPricing && (
                      <>
                        <tr className="bg-slate-900/50 print:bg-white text-xs text-slate-300 print:text-slate-700 border-t border-slate-800/60 print:border-slate-200">
                          <td colSpan={5} className="py-1.5 px-3 text-right font-medium text-[11px]">
                            Items Subtotal:
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-white print:text-slate-900">
                            Rs {pricingData?.subtotal?.toLocaleString() ?? "0"}
                          </td>
                        </tr>

                        {pricingData?.discount && pricingData.discount.amount > 0 && (
                          <tr className="bg-slate-900/50 print:bg-white text-xs text-emerald-400 print:text-emerald-700 border-t border-slate-800/60 print:border-slate-200">
                            <td colSpan={5} className="py-1.5 px-3 text-right font-medium text-[11px]">
                              Discount ({pricingData.discount.type === "percentage" ? `${pricingData.discount.value}%` : "Fixed"}):
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-semibold">
                              - Rs {pricingData.discount.amount.toLocaleString()}
                            </td>
                          </tr>
                        )}

                        <tr className="bg-slate-900 print:bg-slate-100 border-t-2 border-slate-800 print:border-slate-400 text-xs">
                          <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px] text-white print:text-slate-900 font-extrabold">
                            Final Net Payable / Total:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-base font-extrabold text-emerald-400 print:text-emerald-700">
                            Rs {pricingData?.totalAmount?.toLocaleString() ?? "0"}
                          </td>
                        </tr>
                      </>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Micro ERP footer (1 single line, no signatures) */}
            <div className="pt-2 text-center">
              <p className="text-[10px] text-slate-500 print:text-slate-400 font-mono">
                Electronic Record • Alaya Glow ERP System • Automatically synchronized with Shopify Store Inventory
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

