"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  ArrowUpRight,
  Truck,
  Plus,
  Search,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  X,
  SlidersHorizontal,
} from "lucide-react";
import DeleteDispatchButton from "@/components/dispatch/DeleteDispatchButton";
import DispatchStatusDropdown from "@/components/dispatch/DispatchStatusDropdown";

export interface RawDispatchRecord {
  id: string;
  recipient_name: string;
  notes: string | null;
  total_quantity: number;
  created_at: string;
}

interface DispatchHistoryTableProps {
  initialDispatches: RawDispatchRecord[];
}

export default function DispatchHistoryTable({ initialDispatches }: DispatchHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all");

  // Process raw records with parsed metadata
  const parsedRecords = useMemo(() => {
    return initialDispatches.map((item) => {
      let displayRemarks = item.notes || "—";
      let totalAmountVal: number | null = null;
      let hasDiscount = false;
      let paymentStatus: "paid" | "unpaid" = "unpaid";
      let address = "";
      let phone = "";

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
            if (typeof parsed.address === "string") {
              address = parsed.address;
            }
            if (typeof parsed.phone === "string") {
              phone = parsed.phone;
            }
          }
        } catch {
          // Fallback to raw text
        }
      }

      const formattedDate = new Date(item.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        ...item,
        displayRemarks,
        totalAmountVal,
        hasDiscount,
        paymentStatus,
        address,
        phone,
        formattedDate,
      };
    });
  }, [initialDispatches]);

  // Counts for status filters
  const counts = useMemo(() => {
    let unpaid = 0;
    let paid = 0;
    for (const r of parsedRecords) {
      if (r.paymentStatus === "paid") paid++;
      else unpaid++;
    }
    return { all: parsedRecords.length, unpaid, paid };
  }, [parsedRecords]);

  // Filter records based on search and status
  const filteredRecords = useMemo(() => {
    return parsedRecords.filter((item) => {
      // 1. Status filter
      if (statusFilter !== "all" && item.paymentStatus !== statusFilter) {
        return false;
      }

      // 2. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRecipient = item.recipient_name.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchRemarks = item.displayRemarks.toLowerCase().includes(q);
        const matchAddress = item.address.toLowerCase().includes(q);
        const matchPhone = item.phone.toLowerCase().includes(q);
        return matchRecipient || matchId || matchRemarks || matchAddress || matchPhone;
      }

      return true;
    });
  }, [parsedRecords, statusFilter, searchQuery]);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/70 backdrop-blur-sm shadow-xl overflow-hidden flex flex-col" style={{ height: "100%" }}>
      {/* Controls Bar: Search & Status Filter Options */}
      <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Option Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === "all"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
              }`}
          >
            <span>All</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === "all"
                ? "bg-slate-700 text-slate-200"
                : "bg-slate-800 text-slate-400"
                }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("unpaid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === "unpaid"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
              : "text-slate-400 hover:text-amber-400"
              }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Unpaid</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === "unpaid"
                ? "bg-amber-500/30 text-amber-200"
                : "bg-slate-800 text-slate-400"
                }`}
            >
              {counts.unpaid}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("paid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === "paid"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
              : "text-slate-400 hover:text-emerald-400"
              }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Paid</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === "paid"
                ? "bg-emerald-500/30 text-emerald-200"
                : "bg-slate-800 text-slate-400"
                }`}
            >
              {counts.paid}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search party, phone, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      {filteredRecords.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-6">Date &amp; Time</th>
                <th className="py-3 px-6">Recipient &amp; Contact</th>
                <th className="py-3 px-6">Total Units</th>
                <th className="py-3 px-6">Payment Status</th>
                <th className="py-3 px-6">Total Value</th>
                <th className="py-3 px-6">Remarks / Notes</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredRecords.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-800/30 transition-colors duration-100"
                >
                  {/* Date & Time */}
                  <td className="py-3.5 px-6 font-mono text-xs text-slate-300 whitespace-nowrap">
                    {item.formattedDate}
                  </td>

                  {/* Recipient & Contact Info */}
                  <td className="py-3.5 px-6">
                    <div className="font-semibold text-white">
                      {item.recipient_name}
                    </div>
                    {item.phone && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{item.phone}</span>
                      </div>
                    )}
                    {item.address && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 max-w-xs truncate" title={item.address}>
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{item.address}</span>
                      </div>
                    )}
                  </td>

                  {/* Total Units */}
                  <td className="py-3.5 px-6 font-mono font-bold text-slate-200">
                    {item.total_quantity}
                  </td>

                  {/* Interactive Status Option */}
                  <td className="py-3.5 px-6 whitespace-nowrap">
                    <DispatchStatusDropdown
                      dispatchId={item.id}
                      initialStatus={item.paymentStatus}
                    />
                  </td>

                  {/* Total Value */}
                  <td className="py-3.5 px-6 font-mono font-bold text-emerald-400 text-xs whitespace-nowrap">
                    {item.totalAmountVal !== null ? (
                      <div className="flex items-center gap-1.5">
                        <span>Rs {item.totalAmountVal.toLocaleString()}</span>
                        {item.hasDiscount && (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-sans">
                            Discounted
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 font-normal">—</span>
                    )}
                  </td>

                  {/* Remarks / Notes */}
                  <td className="py-3.5 px-6 text-xs text-slate-400 max-w-xs truncate" title={item.displayRemarks}>
                    {item.displayRemarks}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-400">
            <Truck className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">
              {searchQuery || statusFilter !== "all"
                ? "No Dispatches Match Your Filter"
                : "No Dispatches Recorded Yet"}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== "all"
                ? "Try clearing your search query or switching status filters."
                : "When you record manual distributor shipments, their receipts and inventory logs will appear here."}
            </p>
          </div>
          {searchQuery || statusFilter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
            >
              Reset Filters
            </button>
          ) : (
            <Link
              href="/dashboard/dispatch"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Create First Dispatch
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
