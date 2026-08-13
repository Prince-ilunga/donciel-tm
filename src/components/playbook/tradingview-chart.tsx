"use client";

import React, { useEffect, useRef, memo } from "react";

interface TradingViewChartProps {
  symbol: string;          // e.g. "OANDA:XAUUSD", "FX:EURUSD", "BINANCE:BTCUSDT"
  interval: string;        // "1","5","15","60","240","D","W"
  height?: number;
  studies?: string[];      // e.g. ["STD;RSI", "STD;MACD"]
  theme?: "light" | "dark";
  hideSideToolbar?: boolean;
}

/**
 * TradingView Advanced Chart widget.
 * Embeds the official TradingView widget via the external-embedding script.
 * The widget re-renders whenever the config (symbol/interval/...) changes.
 */
function TradingViewChartBase({
  symbol,
  interval,
  height = 420,
  studies = [],
  theme = "dark",
  hideSideToolbar = true,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any previous widget content
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = `${height}px`;
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol || "OANDA:XAUUSD",
      interval: interval || "60",
      timezone: "Etc/UTC",
      theme,
      style: "1",
      locale: "fr",
      enable_publishing: false,
      hide_side_toolbar: hideSideToolbar,
      hide_top_toolbar: false,
      allow_symbol_change: true,
      studies,
      backgroundColor: theme === "dark" ? "rgba(15, 23, 42, 1)" : "rgba(255, 255, 255, 1)",
      gridColor: theme === "dark" ? "rgba(148, 163, 184, 0.1)" : "rgba(15, 23, 42, 0.08)",
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = "";
    };
  }, [symbol, interval, height, theme, hideSideToolbar, JSON.stringify(studies)]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full rounded-lg overflow-hidden border border-border"
      style={{ height }}
    />
  );
}

export const TradingViewChart = memo(TradingViewChartBase);
