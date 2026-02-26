import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export type IconOptionResponse = {
  id: string;
  label: string;
  description: string;
  src: string;
};

const ICONS_BASE = path.join(process.cwd(), "public", "models", "icons");

/** Gera id slug a partir do nome do arquivo (sem extensão). */
function filenameToId(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * GET /api/icons?path=A
 * path pode ser: A, B, C, Effects/01, Effects/02, Effects/03, Effects/04
 * Lista todos os .png da pasta public/models/icons/{path}
 */
export async function GET(request: NextRequest) {
  try {
    const pathParam = request.nextUrl.searchParams.get("path");
    if (!pathParam || pathParam.trim() === "") {
      return NextResponse.json(
        { error: "Query 'path' é obrigatório (ex: A, B, C, Effects/01)" },
        { status: 400 }
      );
    }
    const normalized = pathParam.replace(/\\/g, "/").trim();
    if (normalized.includes("..")) {
      return NextResponse.json({ error: "Path inválido" }, { status: 400 });
    }
    const dir = path.join(ICONS_BASE, normalized);
    const realDir = path.resolve(dir);
    const realBase = path.resolve(ICONS_BASE);
    if (!realDir.startsWith(realBase)) {
      return NextResponse.json({ error: "Path inválido" }, { status: 400 });
    }
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(dir);
    const pngs = files.filter((f) => {
      const lower = f.toLowerCase();
      return (
        (lower.endsWith(".png") || lower.endsWith(".webp")) &&
        !f.startsWith(".")
      );
    });
    const prefix = `/models/icons/${normalized}`;
    const options: IconOptionResponse[] = pngs.map((filename) => {
      const base = path.basename(filename, path.extname(filename));
      const id = filenameToId(filename);
      return {
        id,
        label: base,
        description: "",
        src: `${prefix}/${encodeURIComponent(filename)}`,
      };
    });
    return NextResponse.json(options);
  } catch (e) {
    console.error("Erro ao listar ícones:", e);
    return NextResponse.json([], { status: 500 });
  }
}
