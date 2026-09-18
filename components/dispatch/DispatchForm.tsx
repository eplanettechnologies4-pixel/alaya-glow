"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Truck,
  Plus,
  Trash2,
  AlertCircle,
  Package,
  Layers,
  ArrowLeft,
  CheckCircle2,
  FileText,
  History,
} from "lucide-react";

export interface DispatchableItem {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  stock: number;
  imageUrl: string | null;
}

interface DispatchFormProps {
  availableItems: DispatchableItem[];
}

interface LineItemState {
  id: string; // internal unique key for form row
  variantId: string;
  quantity: number;
}

export default function DispatchForm({ availableItems }: DispatchFormProps) {
  const router = useRouter();

  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItemState[]>([
    {
      id: crypto.randomUUID(),
      variantId: availableItems[0]?.variantId || "",
      quantity: 1,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Map for fast lookup
  const itemsMap = useMemo(() => {
    const map = new Map<string, DispatchableItem>();
    availableItems.forEach((item) => map.set(item.variantId, item));
    return map;
  }, [availableItems]);

  // Running totals
  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [items]);

  const uniqueItemCount = useMemo(() => {
    const validIds = items.filter((it) => it.variantId).map((it) => it.variantId);
    return new Set(validIds).size;
  }, [items]);

  const handleAddItem = () => {
    // Pick first variant that isn't selected yet if possible
    const selectedVariantIds = new Set(items.map((i) => i.variantId));
    const nextAvailable = availableItems.find((i) => !selectedVariantIds.has(i.variantId));

    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        variantId: nextAvailable ? nextAvailable.variantId : availableItems[0]?.variantId || "",
        quantity: 1,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: "variantId" | "quantity", value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (field === "quantity") {
          const qty = parseInt(value, 10);
          return { ...it, quantity: isNaN(qty) ? 0 : Math.max(0, qty) };
        }
        return { ...it, [field]: value };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!recipientName.trim()) {
      setErrorMessage("Please enter a recipient name.");
      return;
    }

    if (items.length === 0) {
      setErrorMessage("Please add at least one line item.");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.variantId) {
        setErrorMessage(`Line item #${i + 1} has no product selected.`);
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        setErrorMessage(`Line item #${i + 1} must have a quantity of at least 1.`);
        return;
      }
      const stockInfo = itemsMap.get(item.variantId);
      if (stockInfo && item.quantity > stockInfo.stock) {
        setErrorMessage(
          `Line item #${i + 1} (${stockInfo.productTitle}): requested quantity (${item.quantity}) exceeds available stock (${stockInfo.stock}).`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        recipientName: recipientName.trim(),
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          variantId: it.variantId,
          quantity: it.quantity,
        })),
      };

      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create dispatch");
      }

      // Redirect directly to receipt
      router.push(`/dashboard/dispatch/${data.dispatchId}`);
    } catch (err: any) {
      console.error("Submission error:", err);
      setErrorMessage(err.message || "An unexpected error occurred while processing dispatch.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner / Breadcrumb */}
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
            <span className="text-slate-200">Manual Stock Dispatch</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-emerald-400 stroke-[2.2]" />
            Manual Stock Dispatch
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deduct offline distributor and wholesale shipments from Supabase and sync updated quantities to Shopify.
          </p>
        </div>

        <Link
          href="/dashboard/dispatch/history"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-all shadow-sm"
        >
          <History className="w-3.5 h-3.5 text-slate-400" />
          Dispatch History
        </Link>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to process dispatch</p>
            <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Recipient & Notes Section */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/70 backdrop-blur-sm p-6 shadow-xl space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          1. Shipment &amp; Recipient Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Recipient Name <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Lahore Central Distributor / Wholesale Partner"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Notes / Reference (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Invoice #2041, dispatch via cargo, batch delivery"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all resize-none"
            />
          </div>
        </div>
      </div>

      {/* Line Items Section */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/70 backdrop-blur-sm p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            2. Items To Dispatch
          </h2>

          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another Item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((lineItem, index) => {
            const currentStockInfo = itemsMap.get(lineItem.variantId);
            const maxStock = currentStockInfo ? currentStockInfo.stock : 0;
            const isExceeded = lineItem.quantity > maxStock;

            return (
              <div
                key={lineItem.id}
                className={`p-4 rounded-xl border transition-all ${
                  isExceeded
                    ? "border-rose-500/50 bg-rose-500/5"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700/80"
                } flex flex-col md:flex-row items-start md:items-center gap-4`}
              >
                <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-slate-500">
                  <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold">
                    {index + 1}
                  </span>
                </div>

                {/* Product/Variant Select */}
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Select Product / Variant
                  </label>
                  <select
                    value={lineItem.variantId}
                    onChange={(e) => handleUpdateItem(lineItem.id, "variantId", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all font-sans"
                  >
                    {availableItems.map((prod) => (
                      <option key={prod.variantId} value={prod.variantId}>
                        {prod.productTitle}
                        {prod.variantTitle && prod.variantTitle !== "Default Title"
                          ? ` - ${prod.variantTitle}`
                          : ""}
                        {prod.sku ? ` (${prod.sku})` : ""} — Stock: {prod.stock}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Available Stock Indicator */}
                <div className="w-full md:w-32 shrink-0">
                  <span className="block text-[11px] font-medium text-slate-400 mb-1">
                    Current Stock
                  </span>
                  <div
                    className={`px-3 py-2 rounded-lg text-xs font-semibold font-mono border ${
                      maxStock > 0
                        ? "bg-slate-800/80 text-emerald-400 border-slate-700/60"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {maxStock} available
                  </div>
                </div>

                {/* Dispatch Quantity Input */}
                <div className="w-full md:w-36 shrink-0">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Dispatch Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxStock}
                    value={lineItem.quantity || ""}
                    onChange={(e) => handleUpdateItem(lineItem.id, "quantity", e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-sm font-mono focus:outline-none transition-all ${
                      isExceeded
                        ? "border-rose-500 text-rose-300 focus:ring-2 focus:ring-rose-500/40"
                        : "border-slate-700/80 text-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    }`}
                  />
                </div>

                {/* Remove Button */}
                <div className="self-end md:self-center shrink-0 pt-1 md:pt-5">
                  <button
                    type="button"
                    disabled={items.length <= 1}
                    onClick={() => handleRemoveItem(lineItem.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary & Submit Footer */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 backdrop-blur-md p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Total Dispatched
              </p>
              <p className="text-xl font-extrabold text-white font-mono">
                {totalQuantity} <span className="text-xs font-normal text-slate-400">units</span>
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Distinct Items
            </p>
            <p className="text-sm font-bold text-slate-300 font-mono">
              {uniqueItemCount} <span className="text-xs font-normal text-slate-500">SKUs</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <Link
            href="/dashboard?tab=inventory"
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition-all"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || totalQuantity <= 0}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Processing Dispatch...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                Confirm &amp; Dispatch Stock
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
