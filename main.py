import os
import sys
from pathlib import Path

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from src.models.user import db
from src.routes.user import user_bp
from src.routes.chat import chat_bp

# --- Environment setup ---
load_dotenv()  # reads .env in development

# Paths
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_STATIC = BASE_DIR / "static"          # fallback if you are serving plain files
# If you build a React/Vite app, point STATIC_DIR to that build (e.g. frontend/dist)
STATIC_DIR = Path(os.getenv("STATIC_DIR", str(DEFAULT_STATIC)))

# --- Flask app ---
app = Flask(__name__, static_folder=str(STATIC_DIR))

# Secrets and config (never hard-code in source)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-insecure-secret-change-me")

# CORS: default to allowing same origin; widen via env if needed
# e.g. CORS_ORIGINS="http://localhost:5173,https://yourdomain.com"
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
CORS(app, resources={r"/api/*": {"origins": origins or "*"}})

# --- Blueprints ---
app.register_blueprint(user_bp, url_prefix="/api")
app.register_blueprint(chat_bp, url_prefix="/api")

# --- Database (SQLite) ---
db_path = BASE_DIR / "database" / "app.db"
db_path.parent.mkdir(parents=True, exist_ok=True)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)
with app.app_context():
    db.create_all()

# --- Static file serving ---
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    static_folder_path = app.static_folder
    if not static_folder_path:
        return "Static folder not configured", 404

    candidate = os.path.join(static_folder_path, path)
    if path and os.path.exists(candidate):
        return send_from_directory(static_folder_path, path)

    index_path = os.path.join(static_folder_path, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(static_folder_path, "index.html")

    return "index.html not found", 404

# --- Entrypoint ---
if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "true").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=port, debug=debug)
