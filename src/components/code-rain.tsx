"use client";

import { useEffect, useRef } from "react";

const GLYPHS = Array.from(
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ0123456789Z:・.=*+<>¦｜",
);

type Stream = {
  x: number;
  y: number;
  speed: number;
  length: number;
  fontSize: number;
  opacity: number;
  glyphs: string[];
  accent: boolean;
};

export function CodeRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const drawingCanvas: HTMLCanvasElement = canvas;
    const drawingContext: CanvasRenderingContext2D = context;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let streams: Stream[] = [];
    let animationFrame = 0;
    let lastFrameTime = performance.now();
    const columnWidth = 15;

    function randomGlyph() {
      return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "0";
    }

    function resetStream(stream: Stream, height: number, initial = false) {
      const depth = 0.62 + Math.random() * 0.62;
      stream.y = initial ? Math.random() * height * 1.5 - height * 0.5 : -Math.random() * height * 0.8;
      stream.speed = 0.045 + depth * 0.065 + Math.random() * 0.035;
      stream.length = 10 + Math.floor(Math.random() * 24);
      stream.fontSize = Math.round(13 + depth * 4);
      stream.opacity = Math.min(1, 0.54 + depth * 0.38);
      stream.glyphs = Array.from({ length: stream.length }, randomGlyph);
      stream.accent = Math.random() > 0.94;
    }

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      drawingCanvas.width = Math.floor(window.innerWidth * ratio);
      drawingCanvas.height = Math.floor(window.innerHeight * ratio);
      drawingCanvas.style.width = `${window.innerWidth}px`;
      drawingCanvas.style.height = `${window.innerHeight}px`;
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawingContext.textBaseline = "top";
      streams = Array.from({ length: Math.ceil(window.innerWidth / columnWidth) + 3 }, (_, index) => {
        const stream: Stream = {
          x: index * columnWidth + Math.random() * 4,
          y: 0,
          speed: 0,
          length: 0,
          fontSize: 15,
          opacity: 1,
          glyphs: [],
          accent: false,
        };
        resetStream(stream, window.innerHeight, true);
        return stream;
      });
    }

    function draw(delta: number) {
      const { innerWidth: width, innerHeight: height } = window;
      drawingContext.globalCompositeOperation = "source-over";
      drawingContext.shadowBlur = 0;
      drawingContext.fillStyle = "rgba(0, 0, 0, 0.14)";
      drawingContext.fillRect(0, 0, width, height);

      streams.forEach((stream) => {
        drawingContext.font = `700 ${stream.fontSize}px "Courier New", monospace`;
        for (let index = 0; index < stream.length; index += 1) {
          const y = stream.y - index * (stream.fontSize + 3);
          if (y < -stream.fontSize || y > height + stream.fontSize) continue;

          if (Math.random() < 0.012) stream.glyphs[index] = randomGlyph();

          const strength = Math.pow(1 - index / stream.length, 1.45) * stream.opacity;
          if (index === 0) {
            drawingContext.shadowColor = "rgba(255, 255, 255, 0.9)";
            drawingContext.shadowBlur = 13;
            drawingContext.fillStyle = "rgba(255, 255, 255, 1)";
          } else if (index < 3) {
            drawingContext.shadowColor = "rgba(214, 219, 226, 0.72)";
            drawingContext.shadowBlur = 7;
            drawingContext.fillStyle = `rgba(214, 219, 226, ${strength})`;
          } else {
            drawingContext.shadowBlur = 0;
            drawingContext.fillStyle = stream.accent
              ? `rgba(255, 255, 255, ${strength * 0.72})`
              : `rgba(150, 156, 166, ${strength * 0.84})`;
          }
          drawingContext.fillText(stream.glyphs[index] ?? "0", stream.x, y);
        }

        stream.y += stream.speed * delta;
        if (stream.y - stream.length * (stream.fontSize + 3) > height) resetStream(stream, height);
      });
    }

    function tick(now: number) {
      const delta = Math.min(now - lastFrameTime, 40);
      lastFrameTime = now;
      draw(delta);
      animationFrame = window.requestAnimationFrame(tick);
    }

    function syncAnimation() {
      window.cancelAnimationFrame(animationFrame);
      if (reducedMotion.matches || document.hidden) {
        draw(0);
        return;
      }
      lastFrameTime = performance.now();
      animationFrame = window.requestAnimationFrame(tick);
    }

    resize();
    draw(0);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", syncAnimation);
    reducedMotion.addEventListener("change", syncAnimation);
    syncAnimation();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotion.removeEventListener("change", syncAnimation);
    };
  }, []);

  return <canvas ref={canvasRef} className="code-rain" aria-hidden="true" />;
}
