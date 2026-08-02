import { useMemo } from "react";
import { DataTable } from "../../shared-table/DataTable";
import type { Column } from "../../shared-table/DataTable";
import { useSheetStream } from "../../shared-table/useSheetStream";
import { api } from "../../shared-table/apiClient";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  status: "active" | "draft" | "archived";
  updated_at: string;
  version: number;
};

export default function ProductsPage() {
  const { rows, status, refetch } = useSheetStream<Product>("Products", { intervalMs: 3000 });

  const columns = useMemo<Column<Product>[]>(() => [
    { key: "name", header: "Name", priority: 1, clamp: 1, width: "minmax(160px, 1.4fr)" },
    { key: "description", header: "Description", clamp: 2, width: "minmax(200px, 2fr)", priority: 3 },
    { key: "price", header: "Price", format: "price", currency: "VND", align: "right", width: "140px", priority: 1 },
    { key: "stock", header: "Stock", format: "text", align: "right", width: "100px", priority: 2 },
    { key: "status", header: "Status", format: "badge", width: "120px", priority: 2 },
    { key: "updated_at", header: "Updated", format: "datetime", width: "180px", priority: 3 },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Products</h1>
        <span className="text-xs text-slate-500">stream: {status}</span>
      </div>
      <DataTable<Product>
        columns={columns}
        data={rows}
        rowKey={r => r.id}
        responsive="auto"
        onEdit={async (row, patch) => {
          await api.update<Product>("Products", row.id, patch);
          refetch();
        }}
        onDelete={async (row) => {
          await api.remove("Products", row.id);
          refetch();
        }}
      />
    </div>
  );
}
