import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import CustomersView, { CustomerData } from "@/components/customers/CustomersView";
import { Users, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { data: rawCustomers, error } = await supabaseServer
    .from("customers")
    .select("*")
    .order("total_spent", { ascending: false });

  if (error) {
    console.error("Error fetching customers:", error);
  }

  const initialCustomers: CustomerData[] = (rawCustomers || []).map((c: any) => ({
    id: c.id,
    shopify_customer_id: c.shopify_customer_id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.phone || null,
    total_orders: c.total_orders || 0,
    total_spent:
      typeof c.total_spent === "number"
        ? c.total_spent
        : parseFloat(c.total_spent || "0"),
    created_at: c.created_at,
  }));

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
          <span className="text-slate-200">Customers Directory</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Users className="w-6 h-6 text-emerald-400 stroke-[2.2]" />
              Customers Directory
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Customer profiles, order frequency, and lifetime spend synced live with Shopify.
            </p>
          </div>
        </div>
      </div>

      <CustomersView initialCustomers={initialCustomers} />
    </div>
  );
}
