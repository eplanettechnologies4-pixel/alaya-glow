import React from "react";
import Link from "next/link";
import {
  Package,
  ShoppingCart,
  Boxes,
  Users,
  LayoutDashboard,
  Bell,
  Search,
  Database,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  ImageIcon,
  Truck,
  History,
} from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import InventoryTable, { InventoryItemData } from "@/components/inventory/InventoryTable";
import OrdersView, { OrderData, OrderLineItem } from "@/components/orders/OrdersView";
import CustomersView, { CustomerData } from "@/components/customers/CustomersView";
import LogoutButton from "@/components/auth/LogoutButton";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams?: {
    tab?: string;
  };
}

function formatSyncTime(dateString?: string | null): string {
  if (!dateString) return "Synced";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Synced";
    return `Synced ${d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "Synced";
  }
}

function formatProductPrice(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (min === null || min === undefined) return "—";
  const fmt = (n: number) =>
    Math.round(n).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });

  if (max === null || max === undefined || min === max) {
    return `Rs ${fmt(min)}`;
  }
  return `Rs ${fmt(min)} - Rs ${fmt(max)}`;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const currentTab = searchParams?.tab || "products";
  const activeTab = ["products", "orders", "inventory", "customers"].includes(currentTab)
    ? (currentTab as "products" | "orders" | "inventory" | "customers")
    : "products";

  // 1. Fetch real counts from Supabase
  const [
    { count: productsCount },
    { count: ordersCount },
    { count: inventoryCount },
    { count: customersCount },
    { data: latestProduct },
  ] = await Promise.all([
    supabaseServer.from("products").select("*", { count: "exact", head: true }),
    supabaseServer.from("orders").select("*", { count: "exact", head: true }),
    supabaseServer.from("inventory").select("*", { count: "exact", head: true }),
    supabaseServer.from("customers").select("*", { count: "exact", head: true }),
    supabaseServer
      .from("products")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const totalProducts = productsCount ?? 0;
  const totalOrders = ordersCount ?? 0;
  const totalInventory = inventoryCount ?? 0;
  const totalCustomers = customersCount ?? 0;

  // 2. Fetch data specific to the active tab
  let productsList: any[] = [];
  let ordersList: any[] = [];
  let customersList: any[] = [];
  let inventoryList: InventoryItemData[] = [];

  if (activeTab === "products") {
    const { data } = await supabaseServer
      .from("products")
      .select(
        `
        id,
        shopify_product_id,
        title,
        vendor,
        product_type,
        status,
        image_url,
        price_min,
        price_max,
        updated_at,
        product_variants (
          id
        )
      `
      )
      .order("title", { ascending: true });
    productsList = data || [];
  } else if (activeTab === "orders") {
    const { data } = await supabaseServer
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

    ordersList = (data || []).map((order: any) => {
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
        items_count: lineItems.reduce((sum: number, item: any) => sum + item.quantity, 0),
        line_items: lineItems,
      };
    });
  } else if (activeTab === "customers") {
    const { data } = await supabaseServer
      .from("customers")
      .select("*")
      .order("total_spent", { ascending: false });

    customersList = (data || []).map((c: any) => ({
      id: c.id,
      shopify_customer_id: c.shopify_customer_id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone || null,
      total_orders: c.total_orders || 0,
      total_spent:
        typeof c.total_spent === "number" ? c.total_spent : parseFloat(c.total_spent || "0"),
      created_at: c.created_at,
    }));
  } else if (activeTab === "inventory") {
    const { data } = await supabaseServer
      .from("inventory")
      .select(
        `
        id,
        variant_id,
        quantity,
        updated_at,
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
      .order("updated_at", { ascending: false });
    inventoryList = (data as unknown as InventoryItemData[]) || [];
  }

  const navItems = [
    {
      id: "products" as const,
      label: "Products",
      href: "/dashboard?tab=products",
      icon: Package,
      count: `${totalProducts} items`,
      metricCount: totalProducts,
      statusSubtitle:
        totalProducts > 0
          ? formatSyncTime(latestProduct?.updated_at)
          : "Awaiting initial sync",
    },
    {
      id: "orders" as const,
      label: "Orders",
      href: "/dashboard?tab=orders",
      icon: ShoppingCart,
      count: `${totalOrders} orders`,
      metricCount: totalOrders,
      statusSubtitle: totalOrders > 0 ? "Synced" : "0 total",
    },
    {
      id: "inventory" as const,
      label: "Inventory",
      href: "/dashboard?tab=inventory",
      icon: Boxes,
      count: `${totalInventory} tracked`,
      metricCount: totalInventory,
      statusSubtitle: totalInventory > 0 ? "Synced" : "0 tracked",
    },
    {
      id: "customers" as const,
      label: "Customers",
      href: "/dashboard?tab=customers",
      icon: Users,
      count: `${totalCustomers} registered`,
      metricCount: totalCustomers,
      statusSubtitle: totalCustomers > 0 ? "Synced" : "0 registered",
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#090d16] text-slate-100 font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-slate-800/80 bg-[#0c1220]/90 backdrop-blur-md flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              {/* <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                Shopify CRM
              </h1> */}
              <p className="text-[11px] text-emerald-400 font-medium tracking-wide uppercase">
                Alaya Glow
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="px-3 py-6">
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Management
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm shadow-emerald-950"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors ${isActive
                          ? "text-emerald-400"
                          : "text-slate-400 group-hover:text-slate-200"
                          }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${isActive
                        ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                        : "bg-slate-800 text-slate-400"
                        }`}
                    >
                      {item.metricCount}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="px-3 pt-5 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Operations
            </div>
            <nav className="space-y-1">
              <Link
                href="/dashboard/dispatch"
                className="group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
                  <span>Dispatch Stock</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold uppercase">
                  Manual
                </span>
              </Link>
              <Link
                href="/dashboard/dispatch/history"
                className="group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              >
                <div className="flex items-center gap-3">
                  <History className="w-4 h-4 text-slate-400 group-hover:text-slate-200" />
                  <span>Dispatch History</span>
                </div>
              </Link>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          {/* Admin Profile & Logout Section */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs font-semibold shrink-0">
                AG
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-medium text-slate-200 leading-none truncate">Admin</div>
                <div className="text-[10px] text-emerald-400 mt-1 font-medium">Administrator</div>
              </div>
            </div>
            <LogoutButton variant="sidebar" />
          </div>

          {/* <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              <span className="text-xs font-medium text-slate-300">
                Connected to Supabase
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Real-time query via Server Components.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                Next.js 14 App Router
              </span>
            </div>
          </div> */}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0c1220]/60 backdrop-blur-md px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center text-sm text-slate-400">
              <LayoutDashboard className="w-4 h-4 mr-2 text-slate-400" />
              <span>CRM</span>
              <ChevronRight className="w-4 h-4 mx-1.5 text-slate-400" />
              <span className="text-slate-200 font-medium capitalize">{activeTab}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search records..."
                disabled
                className="bg-slate-900/80 border border-slate-800 text-xs rounded-lg pl-9 pr-4 py-2 text-slate-400 placeholder-slate-400 focus:outline-none w-56 cursor-not-allowed opacity-75"
              />
            </div>

            <button
              type="button"
              className="p-2 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200"
            >
              <Bell className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs font-semibold">
                  AG
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-medium text-slate-200 leading-none">Admin</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Administrator</div>
                </div>
              </div>
              <LogoutButton variant="header" />
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 p-8 space-y-8 overflow-y-auto">
          {/* Welcome Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white capitalize">
                {activeTab} Overview
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Real-time database records from your Supabase database.
              </p>
            </div>
            {/* <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs font-medium text-slate-400 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Supabase Live</span>
              </div>
            </div> */}
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isCurrent = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`p-5 rounded-xl border transition-all duration-150 block ${isCurrent
                    ? "bg-slate-900/90 border-emerald-500/30 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/20"
                    : "bg-[#0c1220]/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40"
                    }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {item.label}
                    </span>
                    <div
                      className={`p-2 rounded-lg ${isCurrent
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-slate-800/70 text-slate-400"
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {item.metricCount}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                    {item.metricCount > 0 ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-slate-300">{item.statusSubtitle}</span>
                      </>
                    ) : (
                      <>
                        <span>{item.statusSubtitle}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Products Tab Content */}
          {activeTab === "products" && (
            <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/60 backdrop-blur-sm overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Products Catalog</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Showing {productsList.length} products synced from Shopify
                  </p>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Table: <span className="text-emerald-400">products</span>
                </div>
              </div>

              {productsList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-6">Product</th>
                        <th className="py-3 px-6">Vendor</th>
                        <th className="py-3 px-6">Price</th>
                        <th className="py-3 px-6">Status</th>
                        <th className="py-3 px-6">Variants</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {productsList.map((product) => {
                        const variantCount = product.product_variants?.length || 0;
                        const isDraft = product.status?.toLowerCase() === "draft";
                        const priceDisplay = formatProductPrice(
                          product.price_min,
                          product.price_max
                        );

                        return (
                          <tr
                            key={product.id}
                            className="hover:bg-slate-800/30 transition-colors duration-100"
                          >
                            <td className="py-3 px-6 font-medium text-white">
                              <div className="flex items-center gap-3.5">
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.title}
                                    className="w-12 h-12 rounded-lg object-cover border border-slate-800 bg-slate-900 shrink-0 shadow-sm"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-slate-400 shadow-sm">
                                    <ImageIcon className="w-5 h-5 text-slate-400 stroke-[1.5]" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-white text-sm truncate max-w-sm">
                                    {product.title}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {product.product_type || "Standard Product"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-6 text-slate-400 text-xs">
                              {product.vendor || "—"}
                            </td>

                            <td className="py-3 px-6 font-medium text-slate-200 text-sm whitespace-nowrap">
                              {priceDisplay}
                            </td>

                            <td className="py-3 px-6">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${isDraft
                                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  }`}
                              >
                                {product.status || "active"}
                              </span>
                            </td>

                            <td className="py-3 px-6 text-slate-300 text-xs whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md text-slate-300">
                                <Boxes className="w-3 h-3 text-slate-400" />
                                {variantCount} variant{variantCount === 1 ? "" : "s"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No products found in the database. Run product sync to populate.
                </div>
              )}
            </div>
          )}

          {/* Orders Tab Content */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              <OrdersView initialOrders={ordersList as OrderData[]} />
            </div>
          )}

          {/* Customers Tab Content */}
          {activeTab === "customers" && (
            <div className="space-y-4">
              <CustomersView initialCustomers={customersList as CustomerData[]} />
            </div>
          )}

          {/* Inventory Tab Content */}
          {activeTab === "inventory" && (
            <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/60 backdrop-blur-sm overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Inventory Stock</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Showing {inventoryList.length} tracked items from Shopify &amp; Supabase
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard/dispatch"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-emerald-500/20"
                  >
                    <Truck className="w-3.5 h-3.5 stroke-[2.5]" />
                    Dispatch Stock
                  </Link>
                  <div className="text-xs text-slate-400 font-mono">
                    Table: <span className="text-emerald-400">inventory</span>
                  </div>
                </div>
              </div>

              <InventoryTable initialItems={inventoryList} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
