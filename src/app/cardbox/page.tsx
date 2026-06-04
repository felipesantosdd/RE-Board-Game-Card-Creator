"use client";

import { jsPDF } from "jspdf";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Unit = "mm" | "cm" | "inch";
type PageSizeKey = "a4" | "letter";

const MM_PER_INCH = 25.4;
const UNIT_TO_MM: Record<Unit, number> = {
  mm: 1,
  cm: 10,
  inch: MM_PER_INCH,
};

const PAGE_SIZES: Record<PageSizeKey, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 8.5 * MM_PER_INCH, h: 11 * MM_PER_INCH },
};

/** Converte valor do formulário para mm */
function toMm(value: number, unit: Unit): number {
  return value * UNIT_TO_MM[unit];
}

/** Desenha o net da caixa (tuck box) em um contexto 2D, origem no top-left, escala mm -> px */
function drawBoxNet(
  ctx: CanvasRenderingContext2D,
  L: number,
  W: number,
  H: number,
  tuckFlap: number,
  glueFlap: number,
  thumbHoleDiam: number,
  scale: number,
  marginPx: number,
) {
  const stroke = 1;
  const foldLine = 0.5;
  ctx.strokeStyle = "#333";
  ctx.lineWidth = stroke * scale;
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  ctx.font = `bold ${Math.max(8, 10 * scale)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const m = marginPx;
  let x = m;
  let y = m;

  // Linhas de dobra (tracejado)
  ctx.setLineDash([4 * scale, 4 * scale]);

  // Linha central horizontal: acima = topo, abaixo = faixa lateral + base
  const topHeight = W * scale;
  const bandHeight = H * scale;
  const bottomHeight = W * scale;

  // Faixa lateral: [glue] [fundo L] [esq W] [frente L] [dir W] [glue]
  const bandWidth = 2 * glueFlap * scale + 2 * L * scale + 2 * W * scale;
  const glueW = glueFlap * scale;
  const lw = L * scale;
  const ww = W * scale;

  // Topo (acima da faixa)
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(x, y, lw, topHeight);
  ctx.strokeStyle = "#333";
  ctx.setLineDash([]);
  ctx.strokeRect(x, y, lw, topHeight);
  ctx.setLineDash([4 * scale, 4 * scale]);
  ctx.strokeStyle = "#666";
  ctx.strokeRect(x, y, lw, topHeight);
  ctx.fillStyle = "#333";
  ctx.fillText("Topo", x + lw / 2, y + topHeight / 2);
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  y += topHeight;

  // Faixa: fundo, esq, frente, dir
  const bandY = y;
  ctx.setLineDash([]);
  // Glue
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(x, y, glueW, bandHeight);
  ctx.strokeRect(x, y, glueW, bandHeight);
  ctx.fillStyle = "#666";
  ctx.fillText("Cola", x + glueW / 2, y + bandHeight / 2);
  x += glueW;
  // Fundo
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(x, y, lw, bandHeight);
  ctx.strokeRect(x, y, lw, bandHeight);
  ctx.fillStyle = "#333";
  ctx.fillText("Fundo", x + lw / 2, y + bandHeight / 2);
  x += lw;
  // Esquerda
  ctx.fillRect(x, y, ww, bandHeight);
  ctx.strokeRect(x, y, ww, bandHeight);
  ctx.fillText("Esq", x + ww / 2, y + bandHeight / 2);
  x += ww;
  // Frente
  ctx.fillRect(x, y, lw, bandHeight);
  ctx.strokeRect(x, y, lw, bandHeight);
  ctx.fillText("Frente", x + lw / 2, y + bandHeight / 2);
  if (thumbHoleDiam > 0) {
    ctx.beginPath();
    ctx.arc(x + lw / 2, y + bandHeight / 2, (thumbHoleDiam / 2) * scale, 0, Math.PI * 2);
    ctx.strokeStyle = "#c00";
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.strokeStyle = "#333";
  }
  x += lw;
  // Direita
  ctx.fillRect(x, y, ww, bandHeight);
  ctx.strokeRect(x, y, ww, bandHeight);
  ctx.fillText("Dir", x + ww / 2, y + bandHeight / 2);
  x += ww;
  // Glue
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(x, y, glueW, bandHeight);
  ctx.strokeRect(x, y, glueW, bandHeight);
  ctx.fillStyle = "#666";
  ctx.fillText("Cola", x + glueW / 2, y + bandHeight / 2);
  x = m;
  y += bandHeight;

  // Base
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(x, y, lw, bottomHeight);
  ctx.strokeRect(x, y, lw, bottomHeight);
  ctx.fillStyle = "#333";
  ctx.fillText("Base", x + lw / 2, y + bottomHeight / 2);
}

/** Desenha o mesmo net no PDF (jsPDF usa mm) */
function drawBoxNetPdf(
  doc: jsPDF,
  L: number,
  W: number,
  H: number,
  tuckFlap: number,
  glueFlap: number,
  thumbHoleDiam: number,
  x0: number,
  y0: number,
) {
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.2);
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);

  let x = x0;
  let y = y0;

  // Topo
  doc.setFillColor(240, 240, 240);
  doc.rect(x, y, L, W, "FD");
  doc.rect(x, y, L, W, "S");
  doc.text("Topo", x + L / 2, y + W / 2, { align: "center" });
  y += W;

  // Faixa
  const bandY = y;
  // Glue
  doc.setFillColor(232, 232, 232);
  doc.rect(x, y, glueFlap, H, "FD");
  doc.rect(x, y, glueFlap, H, "S");
  doc.text("Cola", x + glueFlap / 2, y + H / 2, { align: "center" });
  x += glueFlap;
  doc.setFillColor(240, 240, 240);
  doc.rect(x, y, L, H, "FD");
  doc.rect(x, y, L, H, "S");
  doc.text("Fundo", x + L / 2, y + H / 2, { align: "center" });
  x += L;
  doc.rect(x, y, W, H, "FD");
  doc.rect(x, y, W, H, "S");
  doc.text("Esq", x + W / 2, y + H / 2, { align: "center" });
  x += W;
  doc.rect(x, y, L, H, "FD");
  doc.rect(x, y, L, H, "S");
  doc.text("Frente", x + L / 2, y + H / 2, { align: "center" });
  if (thumbHoleDiam > 0) {
    doc.setDrawColor(200, 0, 0);
    doc.circle(x + L / 2, y + H / 2, thumbHoleDiam / 2, "S");
    doc.setDrawColor(50, 50, 50);
  }
  x += L;
  doc.rect(x, y, W, H, "FD");
  doc.rect(x, y, W, H, "S");
  doc.text("Dir", x + W / 2, y + H / 2, { align: "center" });
  x += W;
  doc.setFillColor(232, 232, 232);
  doc.rect(x, y, glueFlap, H, "FD");
  doc.rect(x, y, glueFlap, H, "S");
  doc.text("Cola", x + glueFlap / 2, y + H / 2, { align: "center" });
  x = x0;
  y += H;

  // Base
  doc.setFillColor(240, 240, 240);
  doc.rect(x, y, L, W, "FD");
  doc.rect(x, y, L, W, "S");
  doc.text("Base", x + L / 2, y + W / 2, { align: "center" });
}

const DEFAULT_LENGTH_MM = 65;
const DEFAULT_WIDTH_MM = 15;
const DEFAULT_HEIGHT_MM = 95;

export default function CardboxPage() {
  const [unit, setUnit] = useState<Unit>("mm");
  const [length, setLength] = useState(
    unit === "mm" ? String(DEFAULT_LENGTH_MM) : unit === "cm" ? "6.5" : "2.56",
  );
  const [width, setWidth] = useState(
    unit === "mm" ? String(DEFAULT_WIDTH_MM) : unit === "cm" ? "1.5" : "0.59",
  );
  const [height, setHeight] = useState(
    unit === "mm" ? String(DEFAULT_HEIGHT_MM) : unit === "cm" ? "9.5" : "3.74",
  );
  const [thumbHoleDiam, setThumbHoleDiam] = useState("");
  const [tuckFlapSize, setTuckFlapSize] = useState("15");
  const [glueFlapSize, setGlueFlapSize] = useState("12");
  const [pageSize, setPageSize] = useState<PageSizeKey>("a4");
  const [marginMm, setMarginMm] = useState("10");
  const [previewScale, setPreviewScale] = useState(2);

  const dimsMm = useMemo(() => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    return {
      L: toMm(l, unit),
      W: toMm(w, unit),
      H: toMm(h, unit),
    };
  }, [length, width, height, unit]);

  const optsMm = useMemo(() => {
    const tuck = parseFloat(tuckFlapSize) || 15;
    const glue = parseFloat(glueFlapSize) || 12;
    const thumb = parseFloat(thumbHoleDiam) || 0;
    return {
      tuckFlap: toMm(tuck, unit),
      glueFlap: toMm(glue, unit),
      thumbHoleDiam: toMm(thumb, unit),
    };
  }, [tuckFlapSize, glueFlapSize, thumbHoleDiam, unit]);

  const previewSize = useMemo(() => {
    const { L, W, H } = dimsMm;
    const { glueFlap } = optsMm;
    const totalW = 2 * glueFlap + 2 * L + 2 * W;
    const totalH = W + H + W;
    const scale = previewScale;
    return {
      width: totalW * scale + 40,
      height: totalH * scale + 40,
      scale,
      marginPx: 20,
    };
  }, [dimsMm, optsMm, previewScale]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawPreview = useCallback(() => {
    const node = canvasRef.current;
    if (!node) return;
    const { L, W, H } = dimsMm;
    const { tuckFlap, glueFlap, thumbHoleDiam: thumb } = optsMm;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    node.width = previewSize.width * dpr;
    node.height = previewSize.height * dpr;
    node.style.width = `${previewSize.width}px`;
    node.style.height = `${previewSize.height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, previewSize.width, previewSize.height);
    drawBoxNet(
      ctx,
      L,
      W,
      H,
      tuckFlap,
      glueFlap,
      thumb,
      previewSize.scale,
      previewSize.marginPx,
    );
  }, [dimsMm, optsMm, previewSize]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const handleDownloadPdf = useCallback(() => {
    const { L, W, H } = dimsMm;
    const { tuckFlap, glueFlap, thumbHoleDiam: thumb } = optsMm;
    const page = PAGE_SIZES[pageSize];
    const margin = parseFloat(marginMm) || 10;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [page.w, page.h],
    });
    const x0 = margin;
    const y0 = margin;
    drawBoxNetPdf(doc, L, W, H, tuckFlap, glueFlap, thumb, x0, y0);
    doc.save("cardbox-template.pdf");
  }, [dimsMm, optsMm, pageSize, marginMm]);

  const updateDimsForUnit = (newUnit: Unit) => {
    const { L, W, H } = dimsMm;
    if (newUnit === "mm") {
      setLength(String(Math.round(L)));
      setWidth(String(Math.round(W)));
      setHeight(String(Math.round(H)));
    } else if (newUnit === "cm") {
      setLength((L / 10).toFixed(1));
      setWidth((W / 10).toFixed(1));
      setHeight((H / 10).toFixed(1));
    } else {
      setLength((L / MM_PER_INCH).toFixed(2));
      setWidth((W / MM_PER_INCH).toFixed(2));
      setHeight((H / MM_PER_INCH).toFixed(2));
    }
    setUnit(newUnit);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-10 border-b border-white/20 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm transition hover:border-white"
          >
            ← Início
          </Link>
          <h1 className="text-xl font-semibold">Criar cardbox</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="mb-6 text-slate-400">
          Gere um template (net) de caixa para baralho. Defina as dimensões,
          baixe o PDF e recorte/dobre. Inspirado em{" "}
          <a
            href="https://www.templatemaker.nl/en/cardbox/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-300 underline hover:text-amber-200"
          >
            templatemaker.nl
          </a>
          .
        </p>

        <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
          {/* Formulário */}
          <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-800/60 p-5">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Unidade
              </h2>
              <div className="flex gap-2">
                {(["mm", "cm", "inch"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => updateDimsForUnit(u)}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      unit === u
                        ? "bg-amber-500/30 text-amber-200"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {u === "inch" ? "polegada" : u}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Dimensões
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs text-slate-500">Comprimento (L)</span>
                  <input
                    type="number"
                    step={unit === "mm" ? 1 : unit === "cm" ? 0.1 : 0.01}
                    min={0}
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Largura (W)</span>
                  <input
                    type="number"
                    step={unit === "mm" ? 1 : unit === "cm" ? 0.1 : 0.01}
                    min={0}
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Altura (H)</span>
                  <input
                    type="number"
                    step={unit === "mm" ? 1 : unit === "cm" ? 0.1 : 0.01}
                    min={0}
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Baralho bridge: ~65×95×15 mm. Poker: 2.5×3.5×0.6 in.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Opcionais
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs text-slate-500">
                    Aba de cola ({unit})
                  </span>
                  <input
                    type="number"
                    step={unit === "mm" ? 1 : 0.1}
                    min={0}
                    value={glueFlapSize}
                    onChange={(e) => setGlueFlapSize(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">
                    Diâmetro furo dedo ({unit})
                  </span>
                  <input
                    type="number"
                    step={unit === "mm" ? 1 : 0.1}
                    min={0}
                    value={thumbHoleDiam}
                    onChange={(e) => setThumbHoleDiam(e.target.value)}
                    placeholder="0 = sem furo"
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white placeholder:text-slate-500"
                  />
                </label>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Documento PDF
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs text-slate-500">Página</span>
                  <select
                    value={pageSize}
                    onChange={(e) =>
                      setPageSize(e.target.value as PageSizeKey)
                    }
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white"
                  >
                    <option value="a4">A4 (210 × 297 mm)</option>
                    <option value="letter">US Letter (8.5 × 11 in)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Margem (mm)</span>
                  <input
                    type="number"
                    min={0}
                    value={marginMm}
                    onChange={(e) => setMarginMm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white"
                  />
                </label>
              </div>
            </section>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="rounded-xl bg-amber-500 px-4 py-3 font-medium text-slate-900 transition hover:bg-amber-400"
              >
                Baixar PDF
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <span>Zoom preview:</span>
                <input
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.25}
                  value={previewScale}
                  onChange={(e) =>
                    setPreviewScale(parseFloat(e.target.value))
                  }
                  className="w-24"
                />
                <span>{previewScale.toFixed(1)}×</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Preview do template
            </h2>
            <div className="overflow-auto rounded-xl bg-white/5 p-4">
              <canvas
                ref={canvasRef}
                className="max-w-full rounded border border-white/10"
                style={{ background: "#1e293b" }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
