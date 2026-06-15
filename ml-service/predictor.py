import numpy as np
import os
import joblib

FEATURE_KEYS = [
    "algebra_acc", "adv_math_acc", "psda_acc", "geometry_acc",
    "info_ideas_acc", "craft_structure_acc", "expression_acc", "conventions_acc",
    "weekly_hours", "sr_mastery_rate", "days_until_test", "quiz_count",
    "mock_test_count", "score_trend_slope",
]


def _feature_vector(f: dict) -> np.ndarray:
    return np.array([[f.get(k, 0.5 if k.endswith("_acc") or k == "sr_mastery_rate" else 0) for k in FEATURE_KEYS]])


def _fallback(f: dict) -> dict:
    acc_avg = np.mean([f.get(k, 0.5) for k in FEATURE_KEYS if k.endswith("_acc")])
    composite = int(400 + acc_avg * 1200)
    return {
        "predicted_composite": composite,
        "predicted_math": composite // 2,
        "predicted_rw": composite // 2,
        "confidence_interval": 100,
        "feature_importances": {},
        "model_type": "fallback",
    }


def predict(student_id: int, features: dict) -> dict:
    n_tests = features.get("quiz_count", 0) + features.get("mock_test_count", 0)
    model_path = f"models/student_{student_id}.pkl"

    if n_tests < 3:
        composite = int(features.get("avg_composite", 1000))
        return {
            "predicted_composite": composite,
            "predicted_math": composite // 2,
            "predicted_rw": composite // 2,
            "confidence_interval": 80,
            "feature_importances": {},
            "model_type": "average",
        }

    if not os.path.exists(model_path):
        return _fallback(features)

    model = joblib.load(model_path)
    X = _feature_vector(features)
    composite = int(np.clip(model.predict(X)[0], 400, 1600))
    ci = max(20, 100 - n_tests * 5)

    importances = {}
    if hasattr(model, "feature_importances_"):
        importances = dict(zip(FEATURE_KEYS, [round(float(v), 4) for v in model.feature_importances_]))
    elif hasattr(model, "coef_"):
        importances = dict(zip(FEATURE_KEYS, [round(float(v), 4) for v in model.coef_[0]]))

    return {
        "predicted_composite": composite,
        "predicted_math": int(composite * 0.5),
        "predicted_rw": int(composite * 0.5),
        "confidence_interval": ci,
        "feature_importances": importances,
        "model_type": type(model).__name__,
    }


def retrain(student_id: int, training_data: list) -> dict:
    if len(training_data) < 3:
        return {"status": "skipped", "reason": "insufficient_data", "n_samples": len(training_data)}

    X = np.array([_feature_vector(d["features"])[0] for d in training_data])
    y = np.array([d["composite_score"] for d in training_data])

    os.makedirs("models", exist_ok=True)

    if len(training_data) >= 10:
        from xgboost import XGBRegressor
        model = XGBRegressor(n_estimators=50, max_depth=3, learning_rate=0.1, random_state=42)
        model_type = "xgb"
    else:
        from sklearn.linear_model import Ridge
        model = Ridge(alpha=1.0)
        model_type = "ridge"

    model.fit(X, y)
    model_path = f"models/student_{student_id}.pkl"
    joblib.dump(model, model_path)

    return {"status": "ok", "model_version": f"{model_type}_v1", "n_samples": len(training_data)}


def get_feature_importances(student_id: int) -> dict:
    model_path = f"models/student_{student_id}.pkl"
    if not os.path.exists(model_path):
        return {"feature_importances": {}, "model_type": "none"}

    model = joblib.load(model_path)
    importances = {}

    if hasattr(model, "feature_importances_"):
        importances = dict(zip(FEATURE_KEYS, [round(float(v), 4) for v in model.feature_importances_]))
    elif hasattr(model, "coef_"):
        importances = dict(zip(FEATURE_KEYS, [round(abs(float(v)), 4) for v in model.coef_]))

    sorted_importances = dict(sorted(importances.items(), key=lambda x: x[1], reverse=True))
    return {"feature_importances": sorted_importances, "model_type": type(model).__name__}
