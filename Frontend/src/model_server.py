import os
import json
from typing import Any, Dict

from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from pydantic import BaseModel

MODEL_PATH = os.environ.get('MODEL_PATH', 'models/churn_model.joblib')
FEATURES_PATH = os.environ.get('MODEL_FEATURES', 'models/feature_names.json')
UPLOAD_TOKEN = os.environ.get('MODEL_UPLOAD_TOKEN', '')

app = FastAPI(title='Churn Model Server (Prototype)')

model = None
feature_names = None


class PredictRequest(BaseModel):
    phone: str
    clientData: Dict[str, Any] = {}


def load_model():
    global model, feature_names
    try:
        import joblib
    except Exception:
        raise RuntimeError('joblib is required to load models. Install requirements.')

    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
    else:
        model = None

    if os.path.exists(FEATURES_PATH):
        with open(FEATURES_PATH, 'r') as f:
            feature_names = json.load(f)
    else:
        feature_names = None


@app.on_event('startup')
def startup_event():
    try:
        load_model()
    except Exception as e:
        print('Warning: could not load model at startup:', e)


@app.post('/predict')
def predict(req: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail='No model loaded')

    # Expect the clientData to contain feature dict matching feature_names order
    features = []
    if feature_names:
        try:
            features = [req.clientData.get(k) for k in feature_names]
        except Exception:
            raise HTTPException(status_code=400, detail='Invalid clientData for expected features')
    else:
        # if no feature list provided, try to use ordered values of clientData
        features = list(req.clientData.values())

    import numpy as np

    try:
        arr = np.array(features, dtype=float).reshape(1, -1)
        # assume scikit-learn-like API
        if hasattr(model, 'predict_proba'):
            probs = model.predict_proba(arr)
            churn_prob = float(probs[0][1]) if probs.shape[1] > 1 else float(probs[0][0])
            pred = int(churn_prob >= 0.5)
        else:
            pred = int(model.predict(arr)[0])
            churn_prob = float(pred)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Error evaluating model: {e}')

    return {'phone': req.phone, 'churn_probability': churn_prob, 'prediction': pred}


@app.post('/upload-model')
async def upload_model(file: UploadFile = File(...), x_upload_token: str = Header(None)):
    if UPLOAD_TOKEN and x_upload_token != UPLOAD_TOKEN:
        raise HTTPException(status_code=401, detail='Invalid upload token')

    os.makedirs('models', exist_ok=True)
    dest = os.path.join('models', file.filename)
    with open(dest, 'wb') as f:
        content = await file.read()
        f.write(content)

    # If filename follows convention "churn_model.joblib" or "feature_names.json" reload
    if file.filename == os.path.basename(MODEL_PATH) or file.filename == os.path.basename(FEATURES_PATH):
        try:
            load_model()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'Uploaded but failed to load: {e}')

    return {'status': 'ok', 'filename': file.filename}
