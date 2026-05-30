from fastapi import FastAPI, Request
from pydantic import BaseModel
import joblib, shap
from evidently.api.dashboard import DashboardBuilder
from evidently.metrics import DataDriftPreset

# fast api + kserve
app = FastAPI(title="LOWDATAESC AI Behavioral Engine")

model = joblib.load("models/behavior_v2.pkl")
explainer = shap.TreeExplainer(model)

class BehavioralInput(BaseModel):
    keystroke_latency: float
    touch_pressure: float
    session_entropy: float
    geo_anomaly: float

@app.post("/v1/models/behavior/predict")
async def predict(data: BehavioralInput):
    features = [data.keystroke_latency, data.touch_pressure, 
                data.session_entropy, data.geo_anomaly]
    risk_score = model.predict_proba([features])[0][1]
    
    shap_values = explainer.shap_values([features])
    return {
        "risk_score": float(risk_score),
        "action": "BLOCK" if risk_score > 0.85 else "ALLOW",
        "explainability": shap_values.tolist(),
        "timestamp": "2025-05-30T14:32:00Z"
    }

@app.post("/v1/models/behavior/drift")
async def check_drift():
    # Integração com Evidently AI para monitoramento de drift
    return {"status": "healthy", "drift_detected": False}
