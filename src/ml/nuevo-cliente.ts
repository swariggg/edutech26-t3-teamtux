/**
 * Riesgo de impago de una familia NUEVA (sin historial de pagos).
 * Modelos entrenados con Modelos/entrenar_nuevo_cliente.py → src/ml/modelos-nuevo-cliente.json.
 */
import bundleJson from "./modelos-nuevo-cliente.json";
import { MODEL_IDS, rawProba, type ModelId, type RawSpec } from "./inference";

export const NC_FEATURES = ["hijos", "beca_porcentaje", "valor_mensual", "grado_menor", "grado_mayor", "tiene_nee"] as const;
export type NcFeature = (typeof NC_FEATURES)[number];

export interface NcMetrics { auc: number; accuracy: number; precision: number; recall: number; f1: number; confusion: number[][] }
type NcModel = RawSpec & { features: NcFeature[]; importances?: number[]; params: Record<string, unknown>; metrics: NcMetrics };
interface NcBundle { meta: { familias: number; tasa_impago: number; referencia_accuracy: number; cv: string }; modelos: Record<ModelId, NcModel> }

export const ncBundle = bundleJson as unknown as NcBundle;

export const BASE_FEE = 185;
export const BECAS = [0, 10, 25, 50] as const;
/** Cursos que conocen los modelos (los del dataset). */
export const GRADOS = [
  { id: 8, label: "8vo EGB" },
  { id: 9, label: "9no EGB" },
  { id: 10, label: "10mo EGB" },
  { id: 11, label: "1ro BGU" },
  { id: 12, label: "2do BGU" },
  { id: 13, label: "3ro BGU" },
] as const;

export interface NewFamily { hijos: { grado: number; nee: boolean }[]; beca: number }

export const ncFeatureLabel: Record<NcFeature, string> = {
  hijos: "Hijos a matricular",
  beca_porcentaje: "Beca",
  valor_mensual: "Valor mensual a pagar",
  grado_menor: "Curso del hijo menor",
  grado_mayor: "Curso del hijo mayor",
  tiene_nee: "Necesidad educativa especial",
};

export function familyFeatures(f: NewFamily): Record<NcFeature, number> {
  const grados = f.hijos.map((h) => h.grado);
  return {
    hijos: f.hijos.length,
    beca_porcentaje: f.beca,
    valor_mensual: f.hijos.length * BASE_FEE * (1 - f.beca / 100),
    grado_menor: Math.min(...grados),
    grado_mayor: Math.max(...grados),
    tiene_nee: f.hijos.some((h) => h.nee) ? 1 : 0,
  };
}

export type RiskLevel = "bajo" | "medio" | "alto";
export interface NcResult {
  features: Record<NcFeature, number>;
  perModel: Record<ModelId, number>; // P(impago)
  votosImpago: number;
  promedio: number;
  nivel: RiskLevel;
}

/** Los modelos usan class_weight=balanced, así que 0,5 es el punto neutro (no la tasa base). */
export function riskLevel(p: number): RiskLevel {
  if (p >= 0.55) return "alto";
  if (p >= 0.45) return "medio";
  return "bajo";
}

export function evaluateFamily(f: NewFamily): NcResult {
  const features = familyFeatures(f);
  const perModel = Object.fromEntries(
    MODEL_IDS.map((id) => {
      const m = ncBundle.modelos[id];
      return [id, rawProba(m, m.features.map((k) => features[k]))[1] ?? 0];
    }),
  ) as Record<ModelId, number>;
  const ps = MODEL_IDS.map((id) => perModel[id]);
  const promedio = ps.reduce((a, b) => a + b, 0) / ps.length;
  return { features, perModel, votosImpago: ps.filter((p) => p >= 0.5).length, promedio, nivel: riskLevel(promedio) };
}

export function ncImportances(): { feature: NcFeature; values: Partial<Record<ModelId, number>> }[] {
  const per = Object.fromEntries(
    MODEL_IDS.map((id) => {
      const m = ncBundle.modelos[id];
      const raw = m.kind === "logistic" ? m.features.map((_, i) => Math.abs(m.coef[0]![i]!)) : (m.importances ?? []);
      const total = raw.reduce((a, b) => a + b, 0) || 1;
      return [id, Object.fromEntries(m.features.map((k, i) => [k, (raw[i] ?? 0) / total]))];
    }),
  ) as Record<ModelId, Partial<Record<NcFeature, number>>>;
  return NC_FEATURES.map((feature) => ({ feature, values: Object.fromEntries(MODEL_IDS.map((id) => [id, per[id][feature]])) }));
}
