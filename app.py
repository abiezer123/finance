from flask import Flask, render_template, request, redirect, url_for, send_file, jsonify
from flask_pymongo import PyMongo
from bson.objectid import ObjectId
from datetime import datetime
import io
import pandas as pd

app = Flask(__name__)
app.config["MONGO_URI"] = "mongodb+srv://abiezer:abiatharfam@cluster0.ghn0wj8.mongodb.net/church_finance?retryWrites=true&w=majority&appName=Cluster0"

mongo = PyMongo(app)
# Make sure this runs without error
print("MongoDB connection successful:", mongo.db)

@app.route("/", methods=["GET", "POST"])
def index():
    selected_date = request.args.get("date") or datetime.today().strftime("%Y-%m-%d")

    if request.method == "POST":
        data = {
            "date": request.form["date"],
            "name": request.form["name"],
            "tithes": int(request.form.get("tithes", 0)),
            "offering": int(request.form.get("offering", 0)),
            "sfc": int(request.form.get("sfc", 0)),
            "fp": int(request.form.get("fp", 0)),
            "ph": int(request.form.get("ph", 0)),
            "hor": int(request.form.get("hor", 0)),
            "soc": int(request.form.get("soc", 0)),
            "others": int(request.form.get("others", 0)),
            "others_label": request.form.get("others_label", "")
        }
        mongo.db.entries.insert_one(data)
        return redirect(url_for("index", date=data["date"]))

    entries = list(mongo.db.entries.find({"date": selected_date}))

    totals = {
        "tithes": sum(e.get("tithes", 0) for e in entries),
        "offering": sum(e.get("offering", 0) for e in entries),
        "sfc": sum(e.get("sfc", 0) for e in entries),
        "fp": sum(e.get("fp", 0) for e in entries),
        "ph": sum(e.get("ph", 0) for e in entries),
        "hor": sum(e.get("hor", 0) for e in entries),
        "soc": sum(e.get("soc", 0) for e in entries),
        "others": sum(e.get("others", 0) for e in entries)
    }

    return render_template("index.html", entries=entries, date=selected_date, totals=totals)

@app.route("/delete/<id>")
def delete(id):
    mongo.db.entries.delete_one({"_id": ObjectId(id)})
    return redirect(request.referrer)

@app.route("/edit/<id>", methods=["POST"])
def edit(id):
    updated = {
        "name": request.form["name"],
        "tithes": int(request.form["tithes"] or 0),
        "offering": int(request.form["offering"] or 0),
        "sfc": int(request.form["sfc"] or 0),
        "fp": int(request.form["fp"] or 0),
        "ph": int(request.form["ph"] or 0),
        "hor": int(request.form["hor"] or 0),
        "soc": int(request.form["soc"] or 0),
        "others_label": request.form["others_label"],
        "others": int(request.form["others"] or 0)
    }
    mongo.db.entries.update_one({"_id": ObjectId(id)}, {"$set": updated})
    return redirect(request.referrer)

@app.route("/download/<date>")
def download(date):
    entries = list(mongo.db.entries.find({"date": date}))
    if not entries:
        return "No data found for this date", 404

    # Calculate totals
    totals = {
        "name": "TOTAL",
        "tithes": sum(e.get("tithes", 0) for e in entries),
        "offering": sum(e.get("offering", 0) for e in entries),
        "sfc": sum(e.get("sfc", 0) for e in entries),
        "fp": sum(e.get("fp", 0) for e in entries),
        "ph": sum(e.get("ph", 0) for e in entries),
        "hor": sum(e.get("hor", 0) for e in entries),
        "soc": sum(e.get("soc", 0) for e in entries),
        "others_label": "—",
        "others": sum(e.get("others", 0) for e in entries)
    }
    entries.append(totals)


    df = pd.DataFrame(entries)
    df.drop(columns=["_id"], inplace=True, errors='ignore')

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name=date)
    output.seek(0)
    return send_file(output, download_name=f"Report_{date}.xlsx", as_attachment=True)

@app.route("/api/entries")
def api_entries():
    date = request.args.get("date")
    if not date:
        return jsonify([])

    entries = list(mongo.db.entries.find({"date": date}))
    for e in entries:
        e["_id"] = str(e["_id"])  # Convert ObjectId to string
    return jsonify(entries)


if __name__ == "__main__":
    app.run(debug=True)
