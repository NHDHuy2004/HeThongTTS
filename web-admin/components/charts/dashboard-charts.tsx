"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { statusLabel } from "@/features/labels";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export type InternSummary = {
  active: number;
  completed: number;
  converted: number;
  other: number;
};

/**
 * Biểu đồ dashboard Admin/HR — thay cho 2 danh sách "Task theo trạng thái"
 * và "Đợt thực tập theo trạng thái" dạng text.
 */
export function DashboardCharts({
  tasksByStatus,
  internSummary,
}: {
  tasksByStatus: Record<string, number>;
  internSummary: InternSummary;
}) {
  const taskData = Object.entries(tasksByStatus).map(([status, count]) => ({
    status,
    label: statusLabel[status] ?? status,
    count,
  }));

  const internData = [
    { name: "Đang thực tập", value: internSummary.active },
    { name: "Hoàn thành", value: internSummary.completed },
    { name: "Chuyển NV chính thức", value: internSummary.converted },
    { name: "Khác", value: internSummary.other },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task theo trạng thái</CardTitle>
        </CardHeader>
        <CardContent>
          {taskData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Chưa có task nào.
            </p>
          ) : (
            <>
              <div className="h-56" role="img" aria-label={`Biểu đồ thanh: ${taskData.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={52}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{
                        borderRadius: 12,
                        fontSize: 12,
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        color: "var(--popover-foreground)",
                      }}
                      labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600 }}
                      formatter={(value) => [`${value} task`, "Số lượng"]}
                    />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]}>
                      {taskData.map((entry, i) => (
                        <Cell key={entry.status} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Nhóm task theo trạng thái</caption>
                <thead>
                  <tr>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Số lượng</th>
                  </tr>
                </thead>
                <tbody>
                  {taskData.map((d) => (
                    <tr key={d.status}>
                      <td>{d.label}</td>
                      <td>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tình hình thực tập sinh</CardTitle>
        </CardHeader>
        <CardContent>
          {internData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Chưa có thực tập sinh nào.
            </p>
          ) : (
            <div className="h-56" role="img" aria-label={`Biểu đồ tròn: ${internData.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={internData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={84}
                    paddingAngle={2}
                  >
                    {internData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      fontSize: 12,
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      color: "var(--popover-foreground)",
                    }}
                    labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600 }}
                    formatter={(value, name) => [`${value} người`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul aria-label="Chú thích tình hình thực tập sinh" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {internData.map((d, i) => (
              <li key={d.name} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {d.name}: <span className="font-semibold text-foreground">{d.value}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
