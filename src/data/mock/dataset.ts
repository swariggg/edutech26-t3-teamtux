/**
 * Lector del dataset ficticio del hackatón (dataset-ficticio-colegio/, CC0, datos sintéticos).
 * Solo servidor: se lee una vez al construir la base simulada.
 */
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

export const DATASET_DIR = path.join(process.cwd(), "dataset-ficticio-colegio");

/** CSV simple (sin comillas ni comas internas, como el dataset). */
function readCsv<K extends string>(file: string): Record<K, string>[] {
  const text = readFileSync(path.join(DATASET_DIR, file), "utf8").replace(/^﻿/, "");
  const [header, ...lines] = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const cols = header!.split(",").map((c) => c.trim()) as K[];
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").trim()])) as Record<K, string>;
  });
}

export type DatasetStudent = Record<
  "codigo" | "nombre_ficticio" | "curso" | "paralelo" | "anio_nacimiento" | "genero" | "necesidad_educativa" | "beca_porcentaje" | "representante_codigo" | "fecha_ingreso",
  string
>;
export type DatasetPension = Record<"codigo_estudiante" | "mes" | "valor" | "estado" | "fecha_pago", string>;

export function loadDataset() {
  return {
    students: readCsv<keyof DatasetStudent>("estudiantes.csv") as DatasetStudent[],
    pensions: readCsv<keyof DatasetPension>("pensiones.csv") as DatasetPension[],
  };
}
