from flask import Flask, render_template, request, redirect, url_for, send_file, jsonify
from flask_pymongo import PyMongo
from bson.objectid import ObjectId
from datetime import datetime
from flask import session
from functools import wraps


app = Flask(__name__)
app.config["MONGO_URI"] = "mongodb+srv://abiezer:abiatharfam@cluster0.ghn0wj8.mongodb.net/church_finance?retryWrites=true&w=majority&appName=Cluster0"

mongo = PyMongo(app)
# Make sure this runs without error
print("MongoDB connection successful:", mongo.db)
users_collection = mongo.db.users
app.secret_key = "123"

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def get_float(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


@app.route("/", methods=["GET", "POST"])
@login_required
def index():
    if 'username' not in session:
        return redirect(url_for('login'))
    
    selected_date = request.args.get("date") or datetime.today().strftime("%Y-%m-%d")

    if request.method == "POST":
        data = {
            "date": request.form["date"],
            "name": request.form["name"],
            "tithes": get_float(request.form.get("tithes")),
            "offering": get_float(request.form.get("offering")),
            "sfc": get_float(request.form.get("sfc")),
            "fp": get_float(request.form.get("fp")),
            "ph": get_float(request.form.get("ph")),
            "hor": get_float(request.form.get("hor")),
            "soc": get_float(request.form.get("soc")),
            "others": get_float(request.form.get("others")),
            "others_label": request.form.get("others_label", ""),
            "sundayschool": get_float(request.form.get("sundayschool")),
            "for_visitor": get_float(request.form.get("for_visitor")),
            "amd": get_float(request.form.get("amd"))
        }

        mongo.db.entries.insert_one(data)
        return redirect(url_for("index", date=data["date"]))

    entries = list(mongo.db.entries.find({"date": selected_date}))
    expenses = list(mongo.db.expenses.find({"date": selected_date}))

    all_entries = list(mongo.db.entries.find({}))
    all_expenses = list(mongo.db.expenses.find({}))

    all_time_total_offering = sum(e.get("offering", 0) for e in all_entries)
    all_time_offering_tithes = all_time_total_offering * 0.10
    all_time_offering_crv = all_time_total_offering * 0.10

    all_time_offering_expenses = sum(
        float(e.get("amount", 0)) for e in all_expenses if e.get("from") == "offering"
    )
    all_time_offering_remaining = max(
        all_time_total_offering - all_time_offering_tithes - all_time_offering_crv - all_time_offering_expenses,
        0
    )

    for e in expenses:
        e["_id"] = str(e["_id"])

    # Compute original totals
    categories = ["tithes", "offering", "sfc", "fp", "ph", "hor", "soc", "others", "sundayschool", "for_visitor", "amd"]
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
    total_offering = original_totals.get("offering", 0)
    offering_tithes = total_offering * 0.10
    offering_crv = total_offering * 0.10
    offering_expenses = expense_totals.get("offering", 0)
    offering_remaining = max(total_offering - offering_tithes - offering_crv - offering_expenses, 0)


    return render_template("index.html",
        date=selected_date,
        entries=entries,
        expenses=expenses,
        original_totals=original_totals,
        expense_totals=expense_totals,
        adjusted_totals=adjusted_totals,
        offering_remaining=all_time_offering_remaining 
    )



@app.route("/delete/<id>")
def delete(id):
    mongo.db.entries.delete_one({"_id": ObjectId(id)})
    return redirect(request.referrer)

# Edit Entry
@app.route("/edit/<id>", methods=["POST"])
def edit_entry(id):
    updated = {
        "name": request.form.get("name", ""),
        "tithes": get_float(request.form.get("tithes")),
        "offering": get_float(request.form.get("offering")),
        "sfc": get_float(request.form.get("sfc")),
        "fp": get_float(request.form.get("fp")),
        "ph": get_float(request.form.get("ph")),
        "hor": get_float(request.form.get("hor")),
        "soc": get_float(request.form.get("soc")),
        "others": get_float(request.form.get("others")),
        "others_label": request.form.get("others_label", ""),
        "sundayschool": get_float(request.form.get("sundayschool")),
        "for_visitor": get_float(request.form.get("for_visitor")),
        "amd": get_float(request.form.get("amd")),
        "date": request.form.get("date", "")
    }
    mongo.db.entries.update_one({"_id": ObjectId(id)}, {"$set": updated})
    return redirect(request.referrer)

# Edit Expense
@app.route("/edit-expense/<id>", methods=["POST"])
def edit_expense(id):
    updated = {
        "amount": float(request.form.get("amount", 0)),
        "label": request.form.get("label"),
        "from": request.form.get("from"),
        "date": request.form.get("date")
    }
    mongo.db.expenses.update_one({"_id": ObjectId(id)}, {"$set": updated})
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
        "amd": sum(e.get("amd", 0) for e in entries),
        "sundayschool": sum(e.get("sundayschool", 0) for e in entries),
        "for_visitor": sum(e.get("for_visitor", 0) for e in entries),
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

@app.route("/api/expenses")
def get_expenses():
    date = request.args.get("date")
    if not date:
        return jsonify([])

    expenses = list(mongo.db.expenses.find({"date": date}))
    for e in expenses:
        e["_id"] = str(e["_id"])  # convert ObjectId to string for frontend use
    return jsonify(expenses)


@app.route("/add-expense", methods=["POST"])
def add_expense():
    data = request.json

    if not all(k in data for k in ("date", "from", "label", "amount")):
        return jsonify({"error": "Missing fields"}), 400

    mongo.db.expenses.insert_one({
        "date": data["date"],
        "from": data["from"],
        "label": data["label"],
        "amount": float(data["amount"]),
        "type": "Expense"
    })

    return jsonify({"message": "Expense added"}), 200



@app.route("/delete-expense/<id>", methods=["DELETE"])
def delete_expense(id):
    try:
        mongo.db.expenses.delete_one({"_id": ObjectId(id)})
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/alltime-summary")
def alltime_summary():
    categories = ["tithes", "offering", "sfc", "fp", "ph", "hor", "soc", "others", "sundayschool", "for_visitor", "amd"]
    # Get all unique dates
    entry_dates = mongo.db.entries.distinct("date")
    expense_dates = mongo.db.expenses.distinct("date")
    all_dates = sorted(set(entry_dates + expense_dates), reverse=True)

    summary = []

    for date in all_dates:
        entry_docs = list(mongo.db.entries.find({"date": date}))
        expense_docs = list(mongo.db.expenses.find({"date": date}))

        # Givings per category
        givings = {cat: sum(float(e.get(cat, 0)) for e in entry_docs) for cat in categories}
        total_givings = sum(givings.values())

        # Expenses per record
        expenses = []
        total_expenses = 0
        for exp in expense_docs:
            label = exp.get("label", "")
            amount = float(exp.get("amount", 0))
            from_cat = exp.get("from", "")
            total_expenses += amount

            expenses.append({
                "label": label,
                "amount": amount,
                "from": from_cat
            })

        summary.append({
            "date": date,
            "givings": givings,
            "expenses": expenses,
            "total_givings": total_givings,
            "total_expenses": total_expenses
        })

    return jsonify({"summary": summary})


# category summary page
@app.route("/category-summary")
@login_required
def category_summary():
    return render_template("category_summary.html", username=session.get('username'))

@app.route("/api/category-history/<category>")
def category_history(category):
    base_categories = ["tithes", "offering", "sfc", "fp", "ph", "hor", "soc", "sundayschool", "for_visitor", "others", "amd"]
    derived_categories = [
        "tithes(tithes)", "offering(tithes)", "fp(tithes)", "hor(tithes)",
        "sundayschool(tithes)", "crv", "fp(hq)", "hor(hq)"
    ]
    
    all_dates = sorted(set(mongo.db.entries.distinct("date") + mongo.db.expenses.distinct("date")))
    history = []
    total_remaining_cash = 0

    if category in base_categories:
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
                tithes_cut = total_giving * 0.10
                offering_cut = total_giving * 0.30
                crv_cut = total_giving * 0.10
                pastor_cut = total_giving - (tithes_cut + offering_cut + crv_cut)
                total_deduction = total_giving
                remaining = 0

                breakdown.extend([
                    {"date": formatted_date, "type": "Tithes(Tithes) - 10%", "amount": tithes_cut, "label": ""},
                    {"date": formatted_date, "type": "Tithes(Offering) - 30%", "amount": offering_cut, "label": ""},
                    {"date": formatted_date, "type": "CRV - 10%", "amount": crv_cut, "label": ""},
                    {"date": formatted_date, "type": "For Pastor - 50%", "amount": pastor_cut, "label": ""}
                ])
            elif category == "offering":
                tithe_cut = total_giving * 0.10
                crv_cut = total_giving * 0.10
                expense_cut = total_expenses
                total_deduction = tithe_cut + crv_cut + expense_cut
                remaining = total_giving - total_deduction
                total_remaining_cash += remaining

                breakdown.extend([
                    {"date": formatted_date, "type": "Offering(Tithes) - 10%", "amount": tithe_cut, "label": ""},
                    {"date": formatted_date, "type": "CRV - 10%", "amount": crv_cut, "label": ""},
                    {"date": formatted_date, "type": "Expenses", "amount": expense_cut, "label": ""}
                ])
            elif category in ["fp", "hor"]:
                tithe_cut = total_giving * 0.10
                hq_cut = total_giving * 0.45
                expense_cut = total_expenses
                total_deduction = tithe_cut + hq_cut + expense_cut
                remaining = total_giving - total_deduction
                total_remaining_cash += remaining

                breakdown.extend([
                    {"date": formatted_date, "type": f"{category.upper()}(Tithes) - 10%", "amount": tithe_cut, "label": ""},
                    {"date": formatted_date, "type": f"{category.upper()}(HQ) - 45%", "amount": hq_cut, "label": ""},
                    {"date": formatted_date, "type": "Expenses", "amount": expense_cut, "label": ""}
                ])
            elif category == "sundayschool":
                tithe_cut = total_giving * 0.10
                expense_cut = total_expenses
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
                total_remaining_cash += 0

                breakdown.append({
                    "date": formatted_date,
                    "type": f"{category.upper()}(HQ) - 100%",
                    "amount": hq_cut,
                    "label": ""
                })
            else:
                expense_cut = total_expenses
                total_deduction = expense_cut
                remaining = total_giving - expense_cut
                total_remaining_cash += remaining

                breakdown.append({
                    "date": formatted_date,
                    "type": "Expenses",
                    "amount": expense_cut,
                    "label": ""
                })

            breakdown.insert(1, {
                "date": formatted_date,
                "type": "Total Deduction",
                "amount": total_deduction,
                "label": "",
                "total_expenses": total_deduction,
                "remaining": remaining
            })

            history.extend(breakdown)

        history.append({
            "date": "-",
            "type": "Cash on Hand",
            "amount": total_remaining_cash,
            "label": ""
        })
        return jsonify(history)

    elif category in derived_categories:
        result = []

        if category == "crv":
            total_derived = 0
            total_manual_expense = 0

            for date in all_dates:
                entry_docs = list(mongo.db.entries.find({"date": date}))
                formatted_date = datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")

                tithes_total = sum(get_float(e.get("tithes", 0)) for e in entry_docs)
                offering_total = sum(get_float(e.get("offering", 0)) for e in entry_docs)

                tithes_crv = tithes_total * 0.10
                offering_crv = offering_total * 0.10
                derived_amount = tithes_crv + offering_crv

                crv_expenses = list(mongo.db.expenses.find({"date": date, "from": "crv"}))
                crv_expense_total = sum(float(e.get("amount", 0)) for e in crv_expenses)

                total_derived += derived_amount
                total_manual_expense += crv_expense_total

                result.append({
                    "date": formatted_date,
                    "type": "CRV",
                    "amount": derived_amount,
                    "label": f"Tithes(CRV): ₱{tithes_crv:,.2f}, Offering(CRV): ₱{offering_crv:,.2f}"
                })

                if crv_expense_total > 0:
                    result.append({
                        "date": formatted_date,
                        "type": "Manual Expenses",
                        "amount": crv_expense_total,
                        "label": "Added manually"
                    })

            result.append({
                "date": "-",
                "type": "Cash on Hand",
                "amount": total_derived - total_manual_expense,
                "label": ""
            })

        else:
            for date in all_dates:
                entry_docs = list(mongo.db.entries.find({"date": date}))
                formatted_date = datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")

                tithes_total = sum(get_float(e.get("tithes", 0)) for e in entry_docs)
                offering_total = sum(get_float(e.get("offering", 0)) for e in entry_docs)
                fp_total = sum(get_float(e.get("fp", 0)) for e in entry_docs)
                hor_total = sum(get_float(e.get("hor", 0)) for e in entry_docs)
                sundayschool_total = sum(get_float(e.get("sundayschool", 0)) for e in entry_docs)

                derived_amount = 0
                source_label = ""

                if category == "tithes(tithes)":
                    derived_amount = tithes_total * 0.10
                    source_label = "10% of Tithes"
                elif category == "offering(tithes)":
                    derived_amount = offering_total * 0.10
                    source_label = "10% of Offering"
                elif category == "fp(tithes)":
                    derived_amount = fp_total * 0.10
                    source_label = "10% of FP"
                elif category == "hor(tithes)":
                    derived_amount = hor_total * 0.10
                    source_label = "10% of HOR"
                elif category == "sundayschool(tithes)":
                    derived_amount = sundayschool_total * 0.10
                    source_label = "10% of Sunday School"

                result.append({
                    "date": formatted_date,
                    "type": category.upper(),
                    "amount": derived_amount,
                    "label": source_label
                })

        return jsonify(result)



@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username').strip()
        password = request.form.get('password')

        user = users_collection.find_one({'username': username})
        if user and user.get('password') == password:
            session['username'] = username
            return redirect(url_for('index'))  # Redirect to the attendance page
        else:
            error = 'Invalid username or password'
    return render_template('login.html', error=error)

@app.route("/api/manual-category-expense", methods=["POST"])
def add_manual_category_expense():
    data = request.get_json()
    required_fields = ["date", "from", "label", "amount"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    expense = {
        "date": data["date"],
        "from": data["from"],
        "label": data["label"],
        "amount": float(data["amount"]),
        "type": "Expense",
        "source": "manual"  # So it can be deleted
    }

    mongo.db.expenses.insert_one(expense)
    return jsonify({"message": "Manual category expense added"}), 201


@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route("/delete-expense/<expense_id>", methods=["DELETE"])
def delete_manual_expense(expense_id):
    result = mongo.db.expenses.delete_one({"_id": ObjectId(expense_id), "source": "manual"})
    if result.deleted_count == 1:
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Not found or not manual"}), 404
@app.route("/api/manual-expense", methods=["POST"])
def add_manual_expense():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid or missing JSON data"}), 400

    # Ensure required fields exist
    required_fields = ["date", "from", "label", "amount"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing one or more required fields"}), 400

    # Create the expense document
    expense = {
        "date": data["date"],
        "from": data["from"],
        "label": data["label"],
        "amount": float(data["amount"]),
        "type": "Expense",
        "source": "manual"
    }

    mongo.db.expenses.insert_one(expense)

    return jsonify({"success": True, "message": "Manual expense recorded."}), 201


if __name__ == "__main__":
    app.run(debug=True)
