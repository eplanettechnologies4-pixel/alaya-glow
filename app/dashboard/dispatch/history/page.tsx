import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Truck, Plus, ArrowLeft, History, FileText, ArrowUpRight } from "lucide-react";

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
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 md:p-10 font-sans space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
            <Link
              href="/dashboard?tab=inventory"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Inventory
            </Link>
            <span>/</span>
            <span className="text-slate-200">Dispatch History</span>
          </div>
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
                  <th className="py-3 px-6">Remarks / Notes</th>
                  <th className="py-3 px-6 text-right">Receipt</th>
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
                      <td className="py-3.5 px-6 font-mono font-bold text-emerald-400">
                        {item.total_quantity}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-400 max-w-xs truncate">
                        {item.notes || "—"}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Link
                          href={`/dashboard/dispatch/${item.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          View Receipt
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </Link>
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
