import "server-only";
import bundleJson from "./modelos.json";
import { buildFamilyMonths, HISTORY_WINDOW, loadDataset } from "./features";
import { argmax, CLASSES, featureImportance, FEATURES, MODEL_IDS, predictProba, type FeatureName, type FeatureVector, type ModelBundle, type ModelId, type PaymentClass, type Proba } from "./inference";

export const bundle = bundleJson as unknown as ModelBundle;
/** Meses objetivo usados para entrenar (verificado contra el StandardScaler). Se evalúa en los posteriores. */
export const TRAIN_MONTHS = ["2025-10", "2025-11"];

export interface ClassMetric { precision: number; recall: number; f1: number; support: number }
export interface ModelMetrics { accuracy: number; macroF1: number; perClass: Record<PaymentClass, ClassMetric>; confusion: Record<PaymentClass, Record<PaymentClass, number>>; predicted: Record<PaymentClass, number> }

export interface FamilyPrediction {
  representante: string;
  estudiantes: { nombre: string; curso: string; paralelo: string }[];
  features: FeatureVector;
  proba: Record<ModelId, Proba>;
  pred: Record<ModelId, PaymentClass>;
  consenso: PaymentClass;
  /** Cuántos de los 3 modelos coinciden con el consenso. */
  acuerdo: number;
  riesgo: number; // P(incumplimiento) promedio
}

export interface MlDashboard {
  /** Fecha de corte (fecha de la app) y año lectivo de los datos leídos de la base. */
  asOf: string;
  academicYear: string;
  evalMonths: string[];
  predictMonth: string;
  window: number;
  evalSize: number;
  realDistribution: Record<PaymentClass, number>;
  metrics: Record<ModelId | "base", ModelMetrics>;
  importances: { feature: FeatureName; values: Partial<Record<ModelId, number>> }[];
  predictions: FamilyPrediction[];
  predictedDistribution: Record<ModelId, Record<PaymentClass, number>>;
  unanimous: number;
  params: Record<ModelId, Record<string, unknown>>;
}

const zeros = () => ({ puntual: 0, tardio: 0, incumplimiento: 0 }) as Record<PaymentClass, number>;

function metrics(real: PaymentClass[], pred: PaymentClass[]): ModelMetrics {
  const confusion = { puntual: zeros(), tardio: zeros(), incumplimiento: zeros() };
  const predicted = zeros();
  real.forEach((r, i) => {
    const p = pred[i]!;
    confusion[r][p]++;
    predicted[p]++;
  });
  const perClass = {} as Record<PaymentClass, ClassMetric>;
  for (const c of CLASSES) {
    const tp = confusion[c][c];
    const support = CLASSES.reduce((s, p) => s + confusion[c][p], 0);
    const precision = predicted[c] ? tp / predicted[c] : 0;
    const recall = support ? tp / support : 0;
    perClass[c] = { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0, support };
  }
  const accuracy = real.length ? CLASSES.reduce((s, c) => s + confusion[c][c], 0) / real.length : 0;
  const macroF1 = CLASSES.reduce((s, c) => s + perClass[c].f1, 0) / CLASSES.length;
  return { accuracy, macroF1, perClass, confusion, predicted };
}

function vote(preds: PaymentClass[], proba: Proba[]): { c: PaymentClass; n: number } {
  const counts = zeros();
  preds.forEach((p) => counts[p]++);
  const max = Math.max(...Object.values(counts));
  const tied = CLASSES.filter((c) => counts[c] === max);
  if (tied.length === 1) return { c: tied[0]!, n: max };
  // empate 1-1-1: gana la clase con mayor probabilidad promedio
  const avg = (c: PaymentClass) => proba.reduce((s, p) => s + p[c], 0);
  return { c: tied.reduce((b, c) => (avg(c) > avg(b) ? c : b)), n: max };
}

export async function getMlDashboard(): Promise<MlDashboard> {
  const ds = await loadDataset();
  const evalMonths = ds.closedMonths.filter((m) => m > TRAIN_MONTHS[TRAIN_MONTHS.length - 1]!);
  const predictMonth = ds.openMonth ?? ds.months[ds.months.length - 1] ?? "";

  const evalRows = evalMonths.flatMap((m) => buildFamilyMonths(ds, m)).filter((r) => r.real);
  const real = evalRows.map((r) => r.real!);
  const realDistribution = zeros();
  real.forEach((r) => realDistribution[r]++);

  const m = {} as MlDashboard["metrics"];
  for (const id of MODEL_IDS) m[id] = metrics(real, evalRows.map((r) => argmax(predictProba(bundle[id], r.features))));
  m.base = metrics(real, real.map(() => "puntual"));

  const imps = Object.fromEntries(MODEL_IDS.map((id) => [id, featureImportance(bundle[id])])) as Record<ModelId, Partial<Record<FeatureName, number>>>;
  const importances = FEATURES.map((feature) => ({ feature, values: Object.fromEntries(MODEL_IDS.map((id) => [id, imps[id][feature]])) }));

  const predictedDistribution = Object.fromEntries(MODEL_IDS.map((id) => [id, zeros()])) as MlDashboard["predictedDistribution"];
  let unanimous = 0;
  const predictions: FamilyPrediction[] = buildFamilyMonths(ds, predictMonth).map((r) => {
    const proba = Object.fromEntries(MODEL_IDS.map((id) => [id, predictProba(bundle[id], r.features)])) as Record<ModelId, Proba>;
    const pred = Object.fromEntries(MODEL_IDS.map((id) => [id, argmax(proba[id])])) as Record<ModelId, PaymentClass>;
    MODEL_IDS.forEach((id) => predictedDistribution[id][pred[id]]++);
    const v = vote(MODEL_IDS.map((id) => pred[id]), MODEL_IDS.map((id) => proba[id]));
    if (v.n === 3) unanimous++;
    const fam = ds.byFamily.get(r.representante)!;
    return {
      representante: r.representante,
      estudiantes: fam.students.map((s) => ({ nombre: s.nombre, curso: s.curso, paralelo: s.paralelo })),
      features: r.features,
      proba,
      pred,
      consenso: v.c,
      acuerdo: v.n,
      riesgo: MODEL_IDS.reduce((s, id) => s + proba[id].incumplimiento, 0) / MODEL_IDS.length,
    };
  });
  predictions.sort((a, b) => b.riesgo - a.riesgo);

  return {
    asOf: ds.asOf,
    academicYear: ds.academicYear,
    evalMonths,
    predictMonth,
    window: HISTORY_WINDOW,
    evalSize: evalRows.length,
    realDistribution,
    metrics: m,
    importances,
    predictions,
    predictedDistribution,
    unanimous,
    params: Object.fromEntries(MODEL_IDS.map((id) => [id, bundle[id].params])) as Record<ModelId, Record<string, unknown>>,
  };
}
