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

def get_int(value):
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0

@app.route("/", methods=["GET", "POST"])

    
def index():
    selected_date = request.args.get("date") or datetime.today().strftime("%Y-%m-%d")

    if request.method == "POST":
        data = {
            "date": request.form["date"],
            "name": request.form["name"],
            "tithes": get_int(request.form.get("tithes")),
            "offering": get_int(request.form.get("offering")),
            "sfc": get_int(request.form.get("sfc")),
            "fp": get_int(request.form.get("fp")),
            "ph": get_int(request.form.get("ph")),
            "hor": get_int(request.form.get("hor")),
            "soc": get_int(request.form.get("soc")),
            "others": get_int(request.form.get("others")),
            "others_label": request.form.get("others_label", ""),
            "sundayschool": get_int(request.form.get("sundayschool")),
            "for_visitor": get_int(request.form.get("for_visitor"))
        }

        mongo.db.entries.insert_one(data)
        return redirect(url_for("index", date=data["date"]))

    entries = list(mongo.db.entries.find({"date": selected_date}))
    expenses = list(mongo.db.expenses.find({"date": selected_date}))
    for e in expenses:
        e["_id"] = str(e["_id"])

    # Compute original totals
    categories = ["tithes", "offering", "sfc", "fp", "ph", "hor", "soc", "others", "sundayschool", "for_visitor"]
    original_totals = {cat: sum(e.get(cat, 0) for e in entries) for cat in categories}

    # Compute expenses per category
    expense_totals = {cat: 0 for cat in categories}
    for e in expenses:
        category = e.get("from")
        amount = float(e.get("amount", 0))
        if category in expense_totals:
            expense_totals[category] += amount

    # Compute adjusted totals
    adjusted_totals = {cat: original_totals[cat] - expense_totals[cat] for cat in categories}

    return render_template("index.html",
        date=selected_date,
        entries=entries,
        expenses=expenses,
        original_totals=original_totals,
        expense_totals=expense_totals,
        adjusted_totals=adjusted_totals
    )


@app.route("/delete/<id>")
def delete(id):
    mongo.db.entries.delete_one({"_id": ObjectId(id)})
    return redirect(request.referrer)

@app.route("/edit/<id>", methods=["POST"])
def edit(id):
    updated = {
        "name": request.form["name"],
        "tithes": get_int(request.form.get("tithes")),
        "offering": get_int(request.form.get("offering")),
        "sfc": get_int(request.form.get("sfc")),
        "fp": get_int(request.form.get("fp")),
        "ph": get_int(request.form.get("ph")),
        "hor": get_int(request.form.get("hor")),
        "soc": get_int(request.form.get("soc")),
        "others": get_int(request.form.get("others")),
        "others_label": request.form.get("others_label"),
        "sundayschool": get_int(request.form.get("sundayschool")),
        "for_visitor": get_int(request.form.get("for_visitor"))
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

@app.route("/add-expense", methods=["POST"])
def add_expense():
    data = request.get_json()
    if not data:
        return "Invalid request", 400

    # Save the expense record to its own collection
    mongo.db.expenses.insert_one(data)

    return jsonify({"success": True})


@app.route("/api/expenses", methods=["GET"])
def get_expenses():
    date = request.args.get("date")
    expenses = list(mongo.db.expenses.find({"date": date}))
    for e in expenses:
        e["_id"] = str(e["_id"])
    return jsonify(expenses)


@app.route("/delete-expense/<id>", methods=["DELETE"])
def delete_expense(id):
    try:
        mongo.db.expenses.delete_one({"_id": ObjectId(id)})
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/alltime-summary")
def alltime_summary():
    from collections import defaultdict

    # Collect all unique dates from both collections
    entry_dates = mongo.db.entries.distinct("date")
    expense_dates = mongo.db.expenses.distinct("date")
    all_dates = sorted(set(entry_dates + expense_dates), reverse=True)

    categories = ["tithes", "offering", "sfc", "fp", "ph", "hor", "soc", "others", "sundayschool", "for_visitor"]

    result = []

    for date in all_dates:
        entry_docs = list(mongo.db.entries.find({"date": date}))
        expense_docs = list(mongo.db.expenses.find({"date": date}))

        # Givings total per category
        givings = defaultdict(float)
        for entry in entry_docs:
            for cat in categories:
                givings[cat] += float(entry.get(cat, 0))

        # Add names for transparency
        detailed_givings = []
        for entry in entry_docs:
            giving_entry = {
                "name": entry.get("name", ""),
            }
            for cat in categories:
                giving_entry[cat] = float(entry.get(cat, 0))
            detailed_givings.append(giving_entry)

        # Total per day
        total_givings = sum(givings.values())
        total_expenses = sum(float(e.get("amount", 0)) for e in expense_docs)

        for e in expense_docs:
            e["_id"] = str(e["_id"])  # for JS use

        result.append({
            "date": date,
            "total_givings": total_givings,
            "total_expenses": total_expenses,
            "givings": givings,
            "entries": detailed_givings,
            "expenses": expense_docs
        })

    return jsonify(result)




# category summary page
@app.route("/category-summary")
def category_summary():
    return render_template("category_summary.html")

@app.route("/api/category-history/<category>")
def category_history(category):
    allowed = ["tithes", "offering", "sfc", "fp", "ph", "hor", "soc", "sundayschool", "for_visitor", "others"]
    if category not in allowed:
        return jsonify([])

    all_dates = sorted(set(mongo.db.entries.distinct("date") + mongo.db.expenses.distinct("date")))
    history = []
    total_remaining_cash = 0

    for date in all_dates:
        formatted_date = datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")
        entry_docs = list(mongo.db.entries.find({"date": date}))
        expense_docs = list(mongo.db.expenses.find({"date": date, "from": category}))
        total_giving = sum(float(entry.get(category, 0)) for entry in entry_docs)
        total_expenses = sum(float(e.get("amount", 0)) for e in expense_docs)

        if total_giving == 0 and not expense_docs:
            continue

        breakdown = []
        total_deduction = 0
        remaining = total_giving

        breakdown.append({
            "date": formatted_date,
            "type": "Total Giving",
            "amount": total_giving,
            "label": ""
        })

        if category == "tithes":
            tithes_cut = round(total_giving * 0.10)
            remaining -= tithes_cut
            total_deduction += tithes_cut

            offering_cut = round(remaining * 0.30)
            remaining -= offering_cut
            total_deduction += offering_cut

            crv_cut = round(remaining * 0.10)
            remaining -= crv_cut
            total_deduction += crv_cut

            pastor_cut = remaining
            total_deduction += pastor_cut
            remaining = 0

            breakdown.extend([
                {"date": formatted_date, "type": "Tithes(Tithes) - 10%", "amount": tithes_cut, "label": ""},
                {"date": formatted_date, "type": "Tithes(Offering) - 30%", "amount": offering_cut, "label": ""},
                {"date": formatted_date, "type": "CRV - 10%", "amount": crv_cut, "label": ""},
                {"date": formatted_date, "type": "For Pastor - 50%", "amount": pastor_cut, "label": ""}
            ])

        elif category == "offering":
            tithe_cut = round(total_giving * 0.10)
            crv_cut = round(total_giving * 0.10)
            expense_cut = round(total_expenses)

            total_deduction = tithe_cut + crv_cut + expense_cut
            remaining = total_giving - total_deduction
            total_remaining_cash += remaining

            breakdown.extend([
                {"date": formatted_date, "type": "Offering(Tithes) - 10%", "amount": tithe_cut, "label": ""},
                {"date": formatted_date, "type": "CRV - 10%", "amount": crv_cut, "label": ""},
                {"date": formatted_date, "type": "Expenses", "amount": expense_cut, "label": ""}
            ])

        elif category in ["fp", "hor"]:
            tithe_cut = round(total_giving * 0.10)
            hq_cut = round(total_giving * 0.45)
            expense_cut = round(total_expenses)

            total_deduction = tithe_cut + hq_cut + expense_cut
            remaining = total_giving - total_deduction
            total_remaining_cash += remaining

            breakdown.extend([
                {"date": formatted_date, "type": f"{category.upper()}(Tithes) - 10%", "amount": tithe_cut, "label": ""},
                {"date": formatted_date, "type": f"{category.upper()}(HQ) - 45%", "amount": hq_cut, "label": ""},
                {"date": formatted_date, "type": "Expenses", "amount": expense_cut, "label": ""}
            ])

        elif category == "sundayschool":
            tithe_cut = round(total_giving * 0.10)
            expense_cut = round(total_expenses)

            total_deduction = tithe_cut + expense_cut
            remaining = total_giving - total_deduction
            total_remaining_cash += remaining

            breakdown.extend([
                {"date": formatted_date, "type": "Sunday School(Tithes) - 10%", "amount": tithe_cut, "label": ""},
                {"date": formatted_date, "type": "Expenses", "amount": expense_cut, "label": ""}
            ])

        elif category in ["sfc", "ph"]:
            hq_cut = total_giving
            total_deduction = hq_cut
            remaining = 0
            total_remaining_cash += hq_cut

            breakdown.append({
                "date": formatted_date,
                "type": f"{category.upper()}(HQ) - 100%",
                "amount": hq_cut,
                "label": ""
            })

        else:
            expense_cut = round(total_expenses)
            total_deduction = expense_cut
            remaining = total_giving - expense_cut
            total_remaining_cash += remaining

            breakdown.append({
                "date": formatted_date,
                "type": "Expenses",
                "amount": expense_cut,
                "label": ""
            })

        # Insert Total Deduction (shown in orange) and Remaining
        breakdown.insert(1, {
            "date": formatted_date,
            "type": "Total Deduction",
            "amount": total_deduction,
            "label": "",
            "total_expenses": total_deduction,
            "remaining": remaining
        })

        history.extend(breakdown)

    # Final cash on hand line
    history.append({
        "date": "-",
        "type": "Cash on Hand",
        "amount": total_remaining_cash,
        "label": ""
    })

    return jsonify(history)


if __name__ == "__main__":
    app.run(debug=True)
