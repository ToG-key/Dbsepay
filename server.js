from flask import Flask, request, jsonify
import json
import os
import uuid
import time

app = Flask(__name__)

DB_FILE = "keys_database.json"

if not os.path.exists(DB_FILE):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f)

def load_db():
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

@app.route("/api/keys/create", methods=["POST"])
def create_key():
    data = request.json or {}
    days = int(data.get("days", 30))
    
    new_key = str(uuid.uuid4())[:16].upper()
    expire_time = time.time() + (days * 24 * 60 * 60)
    
    db = load_db()
    db[new_key] = {
        "status": "pending",
        "isExpired": False,
        "expire_time": expire_time,
        "created_at": time.time()
    }
    save_db(db)
    return jsonify({"success": True, "key": new_key, "days": days})

@app.route("/api/keys/check-status", methods=["POST"])
def check_status():
    data = request.json or {}
    key = data.get("key")
    db = load_db()
    
    if key not in db:
        return jsonify({"success": False, "error": "Key không tồn tại"}), 404
        
    key_data = db[key]
    if time.time() > key_data["expire_time"]:
        key_data["isExpired"] = True
        db[key] = key_data
        save_db(db)
        
    return jsonify({
        "success": True,
        "status": key_data["status"],
        "isExpired": key_data["isExpired"]
    })

@app.route("/api/keys/manual-delete", methods=["POST"])
def delete_key():
    data = request.json or {}
    key = data.get("key")
    db = load_db()
    
    if key in db:
        del db[key]
        save_db(db)
        return jsonify({"success": True})
    return jsonify({"success": False}), 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
