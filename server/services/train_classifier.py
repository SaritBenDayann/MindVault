import os
import pickle
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_PATH = os.path.join(PROJECT_ROOT, "data", "site_tag_dataset.csv")

MODEL_DIR = os.path.join(PROJECT_ROOT, "model")
os.makedirs(MODEL_DIR, exist_ok=True)


def train_and_save_model(data_path: str = DATA_PATH, model_dir: str = MODEL_DIR) -> None:
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at: {data_path}")

    df = pd.read_csv(data_path)

    required_columns = {"description", "tag"}
    missing = required_columns.difference(df.columns)
    if missing:
        raise KeyError(f"Dataset missing required columns: {sorted(missing)}")

    df = df.dropna(subset=["description", "tag"]).copy()
    df["description"] = df["description"].astype(str)
    df["tag"] = df["tag"].astype(str)

    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(df["tag"])

    vectorizer = TfidfVectorizer()
    X = vectorizer.fit_transform(df["description"])

    model = LogisticRegression(max_iter=1000)
    model.fit(X, y)

    with open(os.path.join(model_dir, "model.pkl"), "wb") as f:
        pickle.dump(model, f)

    with open(os.path.join(model_dir, "vectorizer.pkl"), "wb") as f:
        pickle.dump(vectorizer, f)

    with open(os.path.join(model_dir, "label_encoder.pkl"), "wb") as f:
        pickle.dump(label_encoder, f)

    print("Model trained and saved to /server/model/")


if __name__ == "__main__":
    train_and_save_model()
