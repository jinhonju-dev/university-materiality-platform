"use client";

import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Scatter } from "react-chartjs-2";

import type { Campaign, TopicMetric } from "@/lib/types";

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

const categoryColors: Record<string, string> = {
  環境: "#25a36f",
  社會: "#d5903f",
  治理: "#556dc8",
};

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
      label: topic.name,
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
    layout: { padding: 12 },
    scales: {
      x: {
        min: 1,
        max: 5,
        title: { display: true, text: "財務重大性 →", color: "#66746c" },
        grid: { color: "#e7ece9" },
        ticks: { stepSize: 1 },
      },
      y: {
        min: 1,
        max: 5,
        title: { display: true, text: "衝擊重大性 →", color: "#66746c" },
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
            return `${topic.name}｜衝擊 ${topic.impact}・財務 ${topic.financial}`;
          },
        },
      },
    },
  };

  const thresholdPlugin = {
    id: "thresholds",
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
      ctx.restore();
    },
  };

  return (
    <div className="matrix-wrap">
      {activeTopics.length ? (
        <Scatter data={data} options={options} plugins={[thresholdPlugin]} />
      ) : (
        <div className="empty-chart">完成第一份問卷後，議題將顯示於矩陣中</div>
      )}
    </div>
  );
}

