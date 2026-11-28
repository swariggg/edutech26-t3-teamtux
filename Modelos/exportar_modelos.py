"""Exporta los 3 modelos .joblib a JSON para ejecutarlos en TypeScript (sin Python en producción).

Uso (desde la raíz del repo, con scikit-learn instalado):
    python Modelos/exportar_modelos.py

Genera src/ml/modelos.json. Los .joblib son pickles: cárgalos solo si confías en su origen.
"""
import json
import sys
import warnings
from pathlib import Path

import joblib

warnings.simplefilter("ignore")  # entrenados con sklearn 1.6.1

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "ml" / "modelos.json"


def r(x, n=8):
    return [round(float(v), n) for v in x]


def export_tree(t):
    s = t.tree_
    # value: (nodos, 1, clases) -> fracciones de clase por nodo (ya ponderadas por class_weight)
    vals = s.value[:, 0, :]
    vals = vals / vals.sum(axis=1, keepdims=True)
    return {
        "left": s.children_left.tolist(),
        "right": s.children_right.tolist(),
        "feature": s.feature.tolist(),
        "threshold": r(s.threshold),
        "value": [r(v, 6) for v in vals],
    }


def main():
    out = {}
    for name in ["regresion_logistica", "arbol_decision", "random_forest"]:
        d = joblib.load(ROOT / "Modelos" / f"{name}.joblib")
        m = d["modelo"]
        if hasattr(m, "steps"):  # Pipeline(StandardScaler, LogisticRegression)
            sc, lr = m.steps[0][1], m.steps[-1][1]
            spec = {
                "kind": "logistic",
                "features": list(lr.feature_names_in_) if hasattr(lr, "feature_names_in_") else list(m.feature_names_in_),
                "classes": list(lr.classes_),
                "mean": r(sc.mean_),
                "scale": r(sc.scale_),
                "coef": [r(c) for c in lr.coef_],
                "intercept": r(lr.intercept_),
                "params": {"C": lr.C, "class_weight": str(lr.class_weight)},
            }
            spec["features"] = list(m.feature_names_in_)
        elif hasattr(m, "estimators_"):
            spec = {
                "kind": "forest",
                "features": list(m.feature_names_in_),
                "classes": list(m.classes_),
                "trees": [export_tree(t) for t in m.estimators_],
                "importances": r(m.feature_importances_, 6),
                "params": {"n_estimators": m.n_estimators, "max_depth": m.max_depth},
            }
        else:
            spec = {
                "kind": "tree",
                "features": list(m.feature_names_in_),
                "classes": list(m.classes_),
                "tree": export_tree(m),
                "importances": r(m.feature_importances_, 6),
                "params": {"max_depth": m.max_depth},
            }
        out[name] = spec
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"OK -> {OUT} ({OUT.stat().st_size // 1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
