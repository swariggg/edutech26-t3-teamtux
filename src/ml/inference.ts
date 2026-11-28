/**
 * Inferencia en TypeScript de los modelos exportados desde scikit-learn
 * (ver Modelos/exportar_modelos.py → src/ml/modelos.json). Sin dependencias: corre en server y cliente.
 */

export const CLASSES = ["puntual", "tardio", "incumplimiento"] as const;
export type PaymentClass = (typeof CLASSES)[number];

export const FEATURES = [
  "obligaciones_mes",
  "valor_mes",
  "meses_historial",
  "obligaciones_historial",
  "tasa_puntualidad",
  "tasa_tardanza",
  "tasa_incumplimiento",
] as const;
export type FeatureName = (typeof FEATURES)[number];
export type FeatureVector = Record<FeatureName, number>;
export type Proba = Record<PaymentClass, number>;

interface TreeSpec { left: number[]; right: number[]; feature: number[]; threshold: number[]; value: number[][] }
export type ModelSpec =
  | { kind: "logistic"; features: FeatureName[]; classes: PaymentClass[]; mean: number[]; scale: number[]; coef: number[][]; intercept: number[]; params: Record<string, unknown> }
  | { kind: "tree"; features: FeatureName[]; classes: PaymentClass[]; tree: TreeSpec; importances: number[]; params: Record<string, unknown> }
  | { kind: "forest"; features: FeatureName[]; classes: PaymentClass[]; trees: TreeSpec[]; importances: number[]; params: Record<string, unknown> };

export const MODEL_IDS = ["regresion_logistica", "arbol_decision", "random_forest"] as const;
export type ModelId = (typeof MODEL_IDS)[number];
export type ModelBundle = Record<ModelId, ModelSpec>;

export const MODEL_META: Record<ModelId, { label: string; short: string; color: string }> = {
  regresion_logistica: { label: "Regresión logística", short: "RL", color: "var(--model-1)" },
  arbol_decision: { label: "Árbol de decisión", short: "AD", color: "var(--model-2)" },
  random_forest: { label: "Random Forest", short: "RF", color: "var(--model-3)" },
};

// sklearn compara en float32: X <= threshold (ambos float32).
const f32 = Math.fround;

function treeLeaf(t: TreeSpec, x: number[]): number[] {
  let n = 0;
  while (t.left[n] !== -1) n = f32(x[t.feature[n]!]!) <= f32(t.threshold[n]!) ? t.left[n]! : t.right[n]!;
  return t.value[n]!;
}

function toProba(classes: PaymentClass[], p: number[]): Proba {
  const out = { puntual: 0, tardio: 0, incumplimiento: 0 } as Proba;
  classes.forEach((c, i) => (out[c] = p[i] ?? 0));
  return out;
}

/** Forma mínima de cualquier modelo exportado (multiclase o binario). */
export type RawSpec =
  | { kind: "logistic"; classes: string[]; mean: number[]; scale: number[]; coef: number[][]; intercept: number[] }
  | { kind: "tree"; classes: string[]; tree: TreeSpec }
  | { kind: "forest"; classes: string[]; trees: TreeSpec[] };

/** Probabilidades en el orden de `m.classes` (equivale a predict_proba de sklearn). */
export function rawProba(m: RawSpec, x: number[]): number[] {
  if (m.kind === "logistic") {
    const z = m.coef.map((w, k) => m.intercept[k]! + w.reduce((s, wi, i) => s + wi * ((x[i]! - m.mean[i]!) / m.scale[i]!), 0));
    if (z.length === 1) {
      // binario: sigmoide sobre la clase positiva (classes[1])
      const p = 1 / (1 + Math.exp(-z[0]!));
      return [1 - p, p];
    }
    // multinomial: softmax(z)
    const mx = Math.max(...z);
    const e = z.map((v) => Math.exp(v - mx));
    const sum = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / sum);
  }
  if (m.kind === "tree") return treeLeaf(m.tree, x);
  const acc = new Array<number>(m.classes.length).fill(0);
  for (const t of m.trees) treeLeaf(t, x).forEach((v, i) => (acc[i] = acc[i]! + v));
  return acc.map((v) => v / m.trees.length);
}

export function predictProba(m: ModelSpec, f: FeatureVector): Proba {
  return toProba(m.classes, rawProba(m, m.features.map((k) => f[k])));
}

export function argmax(p: Proba): PaymentClass {
  // desempate en el orden de sklearn (orden alfabético de classes_)
  return (["incumplimiento", "puntual", "tardio"] as PaymentClass[]).reduce((best, c) => (p[c] > p[best] ? c : best), "incumplimiento");
}

/** Importancia por variable. Para la RL: |coef| medio sobre clases, normalizado a 1. */
export function featureImportance(m: ModelSpec): Partial<Record<FeatureName, number>> {
  const raw = m.kind === "logistic" ? m.features.map((_, i) => m.coef.reduce((s, w) => s + Math.abs(w[i]!), 0) / m.coef.length) : m.importances;
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(m.features.map((k, i) => [k, raw[i]! / total]));
}
