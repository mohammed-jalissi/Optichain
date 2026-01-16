import pandas as pd
import numpy as np
import json
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor, RandomForestRegressor, GradientBoostingClassifier, AdaBoostClassifier, AdaBoostRegressor, ExtraTreesClassifier, ExtraTreesRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge, Lasso, ElasticNet, SGDClassifier
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, r2_score, mean_absolute_error, mean_squared_error
from xgboost import XGBClassifier, XGBRegressor

# Initialiser l'aléatoire pour la reproductibilité
np.random.seed(42)

def train_and_evaluate():
    print("Chargement des données...")
    # Chemin vers le fichier CSV
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'bdd_log_clean_CORRIGE_updated.csv')
    
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        print(f"Erreur: Le fichier {csv_path} n'a pas été trouvé.")
        return

    print(f"Dimension du dataset: {df.shape}")

    # --- Préparation des données ---
    print("Validation et Nettoyage...")
    
    if 'date_commande' in df.columns:
        df['date_commande'] = pd.to_datetime(df['date_commande'], errors='coerce')
        df['month'] = df['date_commande'].dt.month
        df['day_of_week'] = df['date_commande'].dt.dayofweek
    
    for col in df.select_dtypes(include=[np.number]).columns:
        df[col] = df[col].fillna(df[col].median())
        
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].fillna(df[col].mode()[0])

    print("Encodage & Normalisation...")
    categorical_cols = df.select_dtypes(include=['object']).columns
    
    for col in categorical_cols:
        if col not in ['order_id', 'date_commande', 'date_expedition', 'date_livraison']:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))

    # --- Définition des Features et Targets ---
    target_cls = 'retard'
    target_reg = 'delai_livraison'
    
    drop_cols = ['order_id', 'date_commande', 'date_expedition', 'date_livraison', target_cls, target_reg, 'ecart_delai', 'delai_prevu']
    feature_cols = [c for c in df.columns if c not in drop_cols and c in df.select_dtypes(include=[np.number]).columns]
    
    X = df[feature_cols]
    y_cls = df[target_cls] if target_cls in df.columns else np.random.randint(0, 2, size=len(df))
    y_reg = df[target_reg] if target_reg in df.columns else np.random.rand(len(df)) * 10

    # Standard Scaling
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Split
    X_train, X_test, y_cls_train, y_cls_test, y_reg_train, y_reg_test = train_test_split(
        X_scaled, y_cls, y_reg, test_size=0.2, random_state=42
    )

    results = {
        "classification": [],
        "regression": []
    }

    # --- Helper pour benchmark Classification ---
    def eval_clf(name, model):
        try:
            model.fit(X_train, y_cls_train)
            y_pred = model.predict(X_test)
            y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else [0]*len(y_pred)
            
            acc = round(accuracy_score(y_cls_test, y_pred), 4)
            f1 = round(f1_score(y_cls_test, y_pred, average='weighted'), 4)
            auc = round(roc_auc_score(y_cls_test, y_prob), 4) if len(np.unique(y_cls_test)) > 1 else 0.0
            
            results["classification"].append({
                "model": name,
                "accuracy": acc,
                "f1": f1,
                "auc": auc,
                "isBest": False
            })
            print(f"✅ {name}: F1={f1}")
        except Exception as e:
            print(f"❌ {name}: Erreur - {e}")

    # --- Helper pour benchmark Régression ---
    def eval_reg(name, model):
        try:
            model.fit(X_train, y_reg_train)
            y_pred = model.predict(X_test)
            
            r2 = round(r2_score(y_reg_test, y_pred), 4)
            mae = round(mean_absolute_error(y_reg_test, y_pred), 4)
            rmse = round(np.sqrt(mean_squared_error(y_reg_test, y_pred)), 4)
            
            results["regression"].append({
                "model": name,
                "r2": r2,
                "mae": mae,
                "rmse": rmse,
                "isBest": False
            })
            print(f"✅ {name}: RMSE={rmse}")
        except Exception as e:
            print(f"❌ {name}: Erreur - {e}")

    # --- 8 Algorithmes de Classification ---
    print("\nBenchmark Classification (8 Algorithmes)...")
    eval_clf("Random Forest", RandomForestClassifier(n_estimators=20, random_state=42))
    eval_clf("XGBoost", XGBClassifier(eval_metric='logloss', random_state=42, n_estimators=20))
    eval_clf("SVM", SVC(probability=True, random_state=42))
    eval_clf("Logistic Regression", LogisticRegression(max_iter=1000, random_state=42))
    eval_clf("KNN", KNeighborsClassifier(n_neighbors=5))
    eval_clf("Decision Tree", DecisionTreeClassifier(random_state=42))
    eval_clf("Naive Bayes", GaussianNB())
    eval_clf("Gradient Boosting", GradientBoostingClassifier(n_estimators=20, random_state=42))

    # Meilleur Clf
    if results["classification"]:
        best_clf = max(results["classification"], key=lambda x: x['f1'])
        best_clf['isBest'] = True


    # --- 8 Algorithmes de Régression ---
    print("\nBenchmark Régression (8 Algorithmes)...")
    eval_reg("Random Forest", RandomForestRegressor(n_estimators=20, random_state=42))
    eval_reg("Gradient Boosting", GradientBoostingRegressor(n_estimators=20, random_state=42))
    eval_reg("Linear Regression", LinearRegression())
    eval_reg("Ridge Regression", Ridge(alpha=1.0))
    eval_reg("Lasso", Lasso(alpha=0.1))
    eval_reg("SVR", SVR(kernel='rbf'))
    eval_reg("XGBoost Regressor", XGBRegressor(n_estimators=20, random_state=42))
    eval_reg("Decision Tree Reg", DecisionTreeRegressor(random_state=42))

    # Meilleur Reg
    if results["regression"]:
        best_reg = min(results["regression"], key=lambda x: x['rmse'])
        best_reg['isBest'] = True

    # --- Export Results ---
    output_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'training_results.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=4)
        
    print(f"\nRésultats exportés vers {output_path}")

if __name__ == "__main__":
    train_and_evaluate()
