"""Entrena 3 modelos para estimar si una familia NUEVA (sin historial de pagos) es propensa a no pagar.

Solo usa datos que se conocen al matricular: hijos a matricular, beca, valor mensual, curso y
necesidades educativas. Etiqueta: la familia tuvo al menos una pensión vencida (impaga) entre
sep-2025 y el último mes cerrado del dataset.

Uso (desde la raíz del repo, con scikit-learn y pandas instalados):
    python Modelos/entrenar_nuevo_cliente.py

Genera:
    Modelos/nuevo_cliente/*.joblib           (modelos sklearn, mismo formato dict que los originales)
    src/ml/modelos-nuevo-cliente.json        (para la inferencia en TypeScript del panel)
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "dataset-ficticio-colegio"
OUT_JSON = ROOT / "src" / "ml" / "modelos-nuevo-cliente.json"
OUT_DIR = ROOT / "Modelos" / "nuevo_cliente"

BASE_FEE = 185
GRADOS = {"8vo EGB": 8, "9no EGB": 9, "10mo EGB": 10, "1ro BGU": 11, "2do BGU": 12, "3ro BGU": 13}
FEATURES = ["hijos", "beca_porcentaje", "valor_mensual", "grado_menor", "grado_mayor", "tiene_nee"]
CLASSES = ["paga", "impago"]
SEED = 42


def build_dataset() -> pd.DataFrame:
    e = pd.read_csv(DATA / "estudiantes.csv")
    p = pd.read_csv(DATA / "pensiones.csv")
    p = p[p.estado != "por_vencer"].merge(e[["codigo", "representante_codigo"]], left_on="codigo_estudiante", right_on="codigo")
    impago = p.assign(v=p.estado == "vencido").groupby("representante_codigo").v.any()
    e["grado"] = e.curso.map(GRADOS)
    e["valor"] = BASE_FEE * (1 - e.beca_porcentaje / 100)
    g = e.groupby("representante_codigo")
    df = pd.DataFrame({
        "hijos": g.size(),
        "beca_porcentaje": g.beca_porcentaje.max(),
        "valor_mensual": g.valor.sum(),
        "grado_menor": g.grado.min(),
        "grado_mayor": g.grado.max(),
        "tiene_nee": g.necesidad_educativa.apply(lambda s: int((s != "ninguna").any())),
    })
    df["y"] = impago.reindex(df.index).fillna(False).astype(int)
    return df


def models():
    return {
        "regresion_logistica": Pipeline([("scaler", StandardScaler()), ("modelo", LogisticRegression(class_weight="balanced", max_iter=2000, random_state=SEED))]),
        "arbol_decision": DecisionTreeClassifier(class_weight="balanced", max_depth=3, min_samples_leaf=10, random_state=SEED),
        "random_forest": RandomForestClassifier(class_weight="balanced", n_estimators=200, max_depth=4, min_samples_leaf=5, random_state=SEED),
    }


def r(x, n=8):
    return [round(float(v), n) for v in x]


def export_tree(t):
    s = t.tree_
    vals = s.value[:, 0, :]
    vals = vals / vals.sum(axis=1, keepdims=True)
    return {"left": s.children_left.tolist(), "right": s.children_right.tolist(), "feature": s.feature.tolist(), "threshold": r(s.threshold), "value": [r(v, 6) for v in vals]}


def export(m):
    if isinstance(m, Pipeline):
        sc, lr = m.named_steps["scaler"], m.named_steps["modelo"]
        # binario: sklearn guarda una sola fila de coeficientes para la clase positiva
        return {"kind": "logistic", "features": FEATURES, "classes": CLASSES, "mean": r(sc.mean_), "scale": r(sc.scale_), "coef": [r(c) for c in lr.coef_], "intercept": r(lr.intercept_), "params": {"C": lr.C, "class_weight": "balanced"}}
    if isinstance(m, RandomForestClassifier):
        return {"kind": "forest", "features": FEATURES, "classes": CLASSES, "trees": [export_tree(t) for t in m.estimators_], "importances": r(m.feature_importances_, 6), "params": {"n_estimators": m.n_estimators, "max_depth": m.max_depth, "min_samples_leaf": m.min_samples_leaf}}
    return {"kind": "tree", "features": FEATURES, "classes": CLASSES, "tree": export_tree(m), "importances": r(m.feature_importances_, 6), "params": {"max_depth": m.max_depth, "min_samples_leaf": m.min_samples_leaf}}


def main():
    df = build_dataset()
    X, y = df[FEATURES], df.y.values
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    out = {"meta": {"familias": int(len(df)), "tasa_impago": float(y.mean()), "features": FEATURES, "cv": "StratifiedKFold(5)"}, "modelos": {}}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, m in models().items():
        proba = cross_val_predict(m, X, y, cv=cv, method="predict_proba")[:, 1]
        pred = (proba >= 0.5).astype(int)
        metrics = {
            "auc": float(roc_auc_score(y, proba)),
            "accuracy": float(accuracy_score(y, pred)),
            "precision": float(precision_score(y, pred, zero_division=0)),
            "recall": float(recall_score(y, pred)),
            "f1": float(f1_score(y, pred)),
            "confusion": [[int(((y == a) & (pred == b)).sum()) for b in (0, 1)] for a in (0, 1)],
        }
        m.fit(X, y)
        joblib.dump({"modelo": m, "features": FEATURES, "clases": CLASSES}, OUT_DIR / f"{name}.joblib")
        out["modelos"][name] = {**export(m), "metrics": metrics}
        print(f"{name:22s} AUC {metrics['auc']:.3f}  acc {metrics['accuracy']:.3f}  recall {metrics['recall']:.3f}  f1 {metrics['f1']:.3f}", file=sys.stderr)
    # referencia: predecir siempre "paga"
    out["meta"]["referencia_accuracy"] = float(1 - y.mean())
    OUT_JSON.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"OK -> {OUT_JSON}", file=sys.stderr)


if __name__ == "__main__":
    main()
