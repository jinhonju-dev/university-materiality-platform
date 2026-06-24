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
  const threshold = campaign.materiality_threshold || campaign.impact_threshold || 3.5;
  const data = {
    datasets: activeTopics.map((topic) => ({
      label: `${topic.code} ${topic.name}`,
      data: [{ x: topic.financial_materiality_score, y: topic.impact_materiality_score }],
      backgroundColor: categoryColors[topic.category] || "#4d6a5a",
      borderColor: topic.is_final_material_topic ? "#17281f" : "#ffffff",
      borderWidth: topic.is_final_material_topic ? 3 : 2,
      pointRadius: Math.max(6, Math.min(18, 4 + topic.concern_score * 2.4)),
      pointHoverRadius: Math.max(10, Math.min(22, 8 + topic.concern_score * 2.4)),
    })),
  };

  const options: ChartOptions<"scatter"> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 18 },
    scales: {
      x: {
        min: 0,
        max: 5,
        title: { display: true, text: "Financial Materiality Score", color: "#66746c" },
        grid: { color: "#e7ece9" },
        ticks: { stepSize: 1 },
      },
      y: {
        min: 0,
        max: 5,
        title: { display: true, text: "Impact Materiality Score", color: "#66746c" },
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
              `衝擊重大性：${topic.impact_materiality_score.toFixed(2)}`,
              `財務重大性：${topic.financial_materiality_score.toFixed(2)}`,
              `關注度：${topic.concern_score.toFixed(2)}`,
              `回答數：${topic.response_count}`,
              `不清楚比例：${topic.unknown_ratio.toFixed(1)}%`,
              `象限：${topic.quadrant}`,
              `最終重大主題：${topic.is_final_material_topic ? "是" : "否"}`,
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
      const x = scales.x.getPixelForValue(threshold);
      const y = scales.y.getPixelForValue(threshold);
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
      ctx.fillStyle = "rgba(24, 53, 42, 0.78)";
      ctx.font = "12px sans-serif";
      ctx.fillText("衝擊重大主題", chartArea.left + 10, chartArea.top + 18);
      ctx.fillText("核心重大主題", x + 10, chartArea.top + 18);
      ctx.fillText("持續觀察議題", chartArea.left + 10, chartArea.bottom - 10);
      ctx.fillText("財務重大主題", x + 10, chartArea.bottom - 10);
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
        const offsetX = index % 3 === 0 ? 12 : index % 3 === 1 ? -34 : 14;
        const offsetY = index % 2 === 0 ? 14 : -18;
        ctx.fillText(topic.code, x + offsetX, y + offsetY);
      });
      ctx.restore();
    },
  };

  return (
    <div className="matrix-wrap">
      {activeTopics.length ? (
        <Scatter data={data} options={options} plugins={[matrixPlugin]} />
      ) : (
        <div className="empty-chart">尚無專家重大性評估資料，完成填答後會顯示矩陣圖。</div>
      )}
    </div>
  );
}
