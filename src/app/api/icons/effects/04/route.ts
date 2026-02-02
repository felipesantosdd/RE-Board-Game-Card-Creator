import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export type IconOption04 = {
  id: string;
  label: string;
  description: string;
  src: string;
};

/** Gera id slug a partir do nome do arquivo (sem extensão). */
function filenameToId(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function GET() {
  try {
    const dir = path.join(
      process.cwd(),
      "public",
      "models",
      "icons",
      "Effects",
      "04"
    );
    if (!fs.existsSync(dir)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(dir);
    const pngs = files.filter(
      (f) => f.toLowerCase().endsWith(".png") && !f.startsWith(".")
    );
    const options: IconOption04[] = pngs.map((filename) => {
      const base = path.basename(filename, path.extname(filename));
      const id = filenameToId(filename);
      return {
        id,
        label: base,
        description: "",
        src: `/models/icons/Effects/04/${encodeURIComponent(filename)}`,
      };
    });
    return NextResponse.json(options);
  } catch (e) {
    console.error("Erro ao listar ícones Effects/04:", e);
    return NextResponse.json([], { status: 500 });
  }
}
