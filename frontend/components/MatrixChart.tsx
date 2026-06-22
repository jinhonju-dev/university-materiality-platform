"use client";

import {
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Scatter } from "react-chartjs-2";

import type { Campaign, TopicMetric } from "@/lib/types";

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

const categoryColors: Record<string, string> = {
  E: "#25a36f",
  S: "#d5903f",
  G: "#556dc8",
};

function categoryLabel(category: string) {
  if (category === "E") return "環境";
  if (category === "S") return "社會";
  if (category === "G") return "治理";
  return category;
}

export function MatrixChart({
  topics,
  campaign,
}: {
  topics: TopicMetric[];
  campaign: Campaign;
}) {
  const activeTopics = topics.filter((topic) => topic.response_count > 0);
  const data = {
    datasets: activeTopics.map((topic) => ({
      label: `${topic.code} ${topic.name}`,
      data: [{ x: topic.financial, y: topic.impact }],
      backgroundColor: categoryColors[topic.category] || "#4d6a5a",
      borderColor: "#ffffff",
      borderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 10,
    })),
  };

  const options: ChartOptions<"scatter"> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 18 },
    scales: {
      x: {
        min: 1,
        max: 5,
        title: { display: true, text: "財務重大性", color: "#66746c" },
        grid: { color: "#e7ece9" },
        ticks: { stepSize: 1 },
      },
      y: {
        min: 1,
        max: 5,
        title: { display: true, text: "衝擊重大性", color: "#66746c" },
        grid: { color: "#e7ece9" },
        ticks: { stepSize: 1 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            const topic = activeTopics[context.datasetIndex];
            return [
              `${topic.code} ${topic.name}`,
              `類別：${categoryLabel(topic.category)}`,
              `衝擊重大性：${topic.impact.toFixed(2)}`,
              `財務重大性：${topic.financial.toFixed(2)}`,
              `組織影響：${topic.organization.toFixed(2)}`,
              `回答數：${topic.response_count}`,
              `判定：${topic.quadrant}`,
            ];
          },
        },
      },
    },
  };

  const matrixPlugin = {
    id: "materialityMatrix",
    beforeDatasetsDraw(chart: ChartJS) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const x = scales.x.getPixelForValue(campaign.financial_threshold);
      const y = scales.y.getPixelForValue(campaign.impact_threshold);
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#91a49a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(24, 53, 42, 0.72)";
      ctx.font = "12px sans-serif";
      ctx.fillText("揭露主題", chartArea.left + 10, chartArea.top + 18);
      ctx.fillText("重大主題", x + 10, chartArea.top + 18);
      ctx.fillText("觀察主題", chartArea.left + 10, chartArea.bottom - 10);
      ctx.fillText("風險主題", x + 10, chartArea.bottom - 10);
      ctx.restore();
    },
    afterDatasetsDraw(chart: ChartJS) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = "600 11px sans-serif";
      ctx.fillStyle = "#19352a";
      activeTopics.forEach((topic, index) => {
        const meta = chart.getDatasetMeta(index);
        const point = meta.data[0];
        if (!point) return;
        const { x, y } = point.getProps(["x", "y"], true);
        const offset = index % 2 === 0 ? 12 : -18;
        ctx.fillText(topic.code, x + 10, y + offset);
      });
      ctx.restore();
    },
  };

  return (
    <div className="matrix-wrap">
      {activeTopics.length ? (
        <Scatter data={data} options={options} plugins={[matrixPlugin]} />
      ) : (
        <div className="empty-chart">尚未收到有效問卷，矩陣圖會在資料回收後顯示。</div>
      )}
    </div>
  );
}
