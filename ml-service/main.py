from fastapi import FastAPI
from pydantic import BaseModel
from predictor import predict, retrain, get_feature_importances

app = FastAPI(title="SAT Score Prediction Service")


class PredictRequest(BaseModel):
    student_id: int
    features: dict


class RetrainRequest(BaseModel):
    student_id: int
    training_data: list = []


@app.post("/predict")
def predict_score(req: PredictRequest):
    return predict(req.student_id, req.features)


@app.post("/retrain")
def retrain_model(req: RetrainRequest):
    return retrain(req.student_id, req.training_data)


@app.get("/feature-importance")
def feature_importance(student_id: int):
    return get_feature_importances(student_id)


@app.get("/health")
def health():
    return {"status": "ok"}
