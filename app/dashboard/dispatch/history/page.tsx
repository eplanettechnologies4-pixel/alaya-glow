import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import DeleteDispatchButton from "@/components/dispatch/DeleteDispatchButton";
import { Plus, History, FileText, ArrowUpRight, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DispatchHistoryPage() {
  const { data: dispatches, error } = await supabaseServer
    .from("manual_dispatches")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching dispatch history:", error);
  }

  const dispatchList = dispatches || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-emerald-400 stroke-[2.2]" />
            Stock Dispatch History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Past manual dispatches and inventory deductions. Click any record to view and reprint its receipt.
          </p>
        </div>

        <Link
          href="/dashboard/dispatch"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          New Dispatch
        </Link>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/70 backdrop-blur-sm shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Dispatches Log</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing {dispatchList.length} dispatch shipments recorded
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Table: <span className="text-emerald-400">manual_dispatches</span>
          </div>
        </div>

        {dispatchList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6">Date &amp; Time</th>
                  <th className="py-3 px-6">Recipient</th>
                  <th className="py-3 px-6">Total Units</th>
                  <th className="py-3 px-6">Payment Status</th>
                  <th className="py-3 px-6">Total Value</th>
                  <th className="py-3 px-6">Remarks / Notes</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {dispatchList.map((item) => {
                  const formattedDate = new Date(item.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  let displayRemarks = item.notes || "—";
                  let totalAmountVal: number | null = null;
                  let hasDiscount = false;
                  let paymentStatus: "paid" | "unpaid" = "unpaid";

                  if (item.notes && item.notes.trim().startsWith("{")) {
                    try {
                      const parsed = JSON.parse(item.notes);
                      if (parsed && typeof parsed === "object") {
                        displayRemarks = parsed.text || "—";
                        paymentStatus = parsed.paymentStatus === "paid" ? "paid" : "unpaid";
                        if (typeof parsed.pricing?.totalAmount === "number") {
                          totalAmountVal = parsed.pricing.totalAmount;
                        }
                        if (parsed.pricing?.discount?.amount > 0) {
                          hasDiscount = true;
                        }
                      }
                    } catch {
                      // Fallback
                    }
                  }

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/30 transition-colors duration-100"
                    >
                      <td className="py-3.5 px-6 font-mono text-xs text-slate-300">
                        {formattedDate}
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-white">
                        {item.recipient_name}
                      </td>
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-200">
                        {item.total_quantity}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${
                            paymentStatus === "paid"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              paymentStatus === "paid" ? "bg-emerald-400" : "bg-amber-400"
                            }`}
                          />
                          {paymentStatus === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-mono font-bold text-emerald-400 text-xs">
                        {totalAmountVal !== null ? (
                          <div className="flex items-center gap-1.5">
                            <span>Rs {totalAmountVal.toLocaleString()}</span>
                            {hasDiscount && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-sans">
                                Discounted
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-400 max-w-xs truncate">
                        {displayRemarks}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/dispatch/${item.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            <span>View</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-400" />
                          </Link>
                          <DeleteDispatchButton
                            dispatchId={item.id}
                            recipientName={item.recipient_name}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-400">
              <Truck className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">No Dispatches Recorded Yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                When you record manual distributor shipments, their receipts and inventory logs will appear here.
              </p>
            </div>
            <Link
              href="/dashboard/dispatch"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Create First Dispatch
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
