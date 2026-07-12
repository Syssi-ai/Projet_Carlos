import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, render_template, request

app = Flask(__name__, static_folder="static", template_folder="templates")
DATA_FILE = Path(__file__).with_name("data.json")
CODE_GERANT = "carlos1269"


def default_availability():
    return {
        "dureeCreneau": 3600,
        "lundi": [],
        "mardi": [],
        "mercredi": [],
        "jeudi": [],
        "vendredi": [],
        "samedi": [],
        "dimanche": [],
    }


def load_data():
    if not DATA_FILE.exists():
        return {
            "users": [],
            "client_index": [],
            "availability": default_availability(),
            "appointments": [],
            "reset_codes": {},
        }
    try:
        with DATA_FILE.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        return {
            "users": [],
            "client_index": [],
            "availability": default_availability(),
            "appointments": [],
            "reset_codes": {},
        }


def save_data(data):
    with DATA_FILE.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)


def find_user(data, email):
    email = email.lower().strip()
    return next((user for user in data["users"] if user["email"] == email), None)


def build_user_response(user):
    if not user:
        return None
    return {
        "id": user["id"],
        "prenom": user["prenom"],
        "nom": user["nom"],
        "email": user["email"],
        "telephone": user["telephone"],
        "adresse": user["adresse"],
        "role": user["role"],
    }


@app.route("/")
def index():
    return render_template("catex.html")


@app.route("/api/user/<email>", methods=["GET", "PUT"])
def api_user(email):
    data = load_data()
    user = find_user(data, email)
    if request.method == "GET":
        if not user:
            return jsonify({"error": "Utilisateur introuvable."}), 404
        return jsonify({"user": build_user_response(user)})

    if not user:
        return jsonify({"error": "Utilisateur introuvable."}), 404
    payload = request.get_json(silent=True) or {}
    for key in ["prenom", "nom", "telephone", "adresse", "passwordHash"]:
        if key in payload:
            user[key] = payload[key]
    save_data(data)
    return jsonify({"ok": True, "user": build_user_response(user)})


@app.route("/api/register", methods=["POST"])
def api_register():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").lower().strip()
    if not email:
        return jsonify({"error": "Adresse e-mail manquante."}), 400
    data = load_data()
    if find_user(data, email):
        return jsonify({"error": "Un compte existe déjà avec cette adresse e-mail."}), 400
    role = payload.get("role", "client")
    if role not in ["client", "gerant"]:
        return jsonify({"error": "Rôle invalide."}), 400
    if role == "gerant" and payload.get("code") != CODE_GERANT:
        return jsonify({"error": "Code gérant invalide."}), 400
    user = {
        "id": str(uuid4()),
        "prenom": payload.get("prenom", ""),
        "nom": payload.get("nom", ""),
        "email": email,
        "telephone": payload.get("telephone", ""),
        "adresse": payload.get("adresse", ""),
        "role": role,
        "passwordHash": payload.get("passwordHash", ""),
    }
    data["users"].append(user)
    if role == "client" and email not in data["client_index"]:
        data["client_index"].append(email)
    save_data(data)
    return jsonify({"ok": True, "user": build_user_response(user)})


@app.route("/api/login", methods=["POST"])
def api_login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").lower().strip()
    password_hash = payload.get("passwordHash")
    data = load_data()
    user = find_user(data, email)
    if not user or user.get("passwordHash") != password_hash:
        return jsonify({"error": "Adresse e-mail ou mot de passe incorrect."}), 401
    return jsonify({"ok": True, "user": build_user_response(user)})


@app.route("/api/availability", methods=["GET", "POST"])
def api_availability():
    data = load_data()
    if request.method == "GET":
        return jsonify({"availability": data.get("availability", default_availability())})
    payload = request.get_json(silent=True) or {}
    availability = data.get("availability", default_availability())
    availability.update(payload)
    data["availability"] = availability
    save_data(data)
    return jsonify({"ok": True, "availability": availability})


@app.route("/api/appointments", methods=["GET", "POST"])
def api_appointments():
    data = load_data()
    if request.method == "GET":
        return jsonify({"appointments": data.get("appointments", [])})
    payload = request.get_json(silent=True) or {}
    appointment = {
        "id": payload.get("id") or str(uuid4()),
        "clientEmail": payload.get("clientEmail"),
        "clientNom": payload.get("clientNom"),
        "clientPrenom": payload.get("clientPrenom"),
        "date": payload.get("date"),
        "start": payload.get("start"),
        "end": payload.get("end"),
        "status": payload.get("status", "confirme"),
        "createdAt": payload.get("createdAt") or int(datetime.utcnow().timestamp() * 1000),
    }
    data.setdefault("appointments", []).append(appointment)
    save_data(data)
    return jsonify({"ok": True, "id": appointment["id"], "appointment": appointment})


@app.route("/api/appointment/<appointment_id>", methods=["GET"])
def api_get_appointment(appointment_id):
    data = load_data()
    appointment = next((appt for appt in data.get("appointments", []) if appt.get("id") == appointment_id), None)
    if not appointment:
        return jsonify({"error": "Rendez-vous introuvable."}), 404
    return jsonify({"appointment": appointment})


@app.route("/api/clients", methods=["GET"])
def api_clients():
    data = load_data()
    clients = [build_user_response(user) for user in data.get("users", []) if user.get("role") == "client"]
    return jsonify({"clients": clients})


@app.route("/api/reset-request", methods=["POST"])
def api_reset_request():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").lower().strip()
    data = load_data()
    user = find_user(data, email)
    if not user:
        return jsonify({"error": "Aucun compte associé à cette adresse e-mail."}), 404
    code = str(uuid4().int)[:6]
    expires = int((datetime.utcnow() + timedelta(minutes=15)).timestamp() * 1000)
    data.setdefault("reset_codes", {})[email] = {"code": code, "expires": expires}
    save_data(data)
    return jsonify({"ok": True, "code": code})


@app.route("/api/reset-password", methods=["POST"])
def api_reset_password():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").lower().strip()
    code = payload.get("code")
    new_password = payload.get("newPassword")
    data = load_data()
    stored = data.get("reset_codes", {}).get(email)
    if not stored or stored.get("code") != code or stored.get("expires", 0) < int(datetime.utcnow().timestamp() * 1000):
        return jsonify({"error": "Code invalide ou expiré."}), 400
    user = find_user(data, email)
    if not user:
        return jsonify({"error": "Utilisateur introuvable."}), 404
    user["passwordHash"] = new_password
    data["reset_codes"].pop(email, None)
    save_data(data)
    return jsonify({"ok": True})


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "0") == "1"
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=debug_mode, use_reloader=False)
