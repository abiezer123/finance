from flask import Flask, render_template, request, redirect, url_for, send_file, jsonify
from flask_pymongo import PyMongo
from bson.objectid import ObjectId
from datetime import datetime
from flask import session
from functools import wraps
import uuid
import re
import os

# load .env ONLY if not on Render
if os.getenv("RENDER") is None:
    from dotenv import load_dotenv
    load_dotenv()

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
app.secret_key = os.getenv("SECRET_KEY")

mongo = PyMongo(app)
# Make sure this runs without error
print("MongoDB connection successful:", mongo.db)
users_collection = mongo.db.users
entries_collection = mongo.db.entries

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        username = session.get('username')
        session_token = session.get('session_token')

        if not username or not session_token:
            return redirect(url_for('login'))

        user = users_collection.find_one({'username': username})
        if not user or user.get('session_token') != session_token:
            return redirect(url_for('login')) 

        return f(*args, **kwargs)
    return decorated_function


from flask import redirect, url_for, session, request, render_template
import uuid

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username').strip()
        password = request.form.get('password')

        user = users_collection.find_one({'username': username})
        if user and user.get('password') == password:
            # Create unique session token per login (per device)
            session_token = str(uuid.uuid4())
            session['username'] = username
            session['session_token'] = session_token

            # Save the token in the database for that user
            users_collection.update_one(
                {'username': username},
                {'$set': {'session_token': session_token}}
            )

            # Mark if admin
            session['is_admin'] = username == 'admin'

            # Redirect based on admin status
            if session['is_admin']:
                return redirect(url_for('category_summary'))  # admin page
            else:
                return redirect(url_for('index'))  # normal user page
        else:
            error = 'Invalid username or password'
    
    return render_template('login.html', error=error)

def get_float(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def log_activity(action, entry_data, entry_id=None, username=None):
    """Log an activity (entry add/update/delete) to the activity_logs collection."""
    try:
        who = username or session.get("username", "unknown")
        amount_approx = float(entry_data.get("tithes", 0)) + float(entry_data.get("offering", 0)) + float(entry_data.get("others", 0))
        log_entry = {
            "date": entry_data.get("date"),
            "action": action,
            "timestamp": datetime.now(),
            "entry_id": str(entry_id) if entry_id else None,
            "name": entry_data.get("name"),
            "category": "multiple",
            "amount": amount_approx,
            "details": {k: v for k, v in entry_data.items() if k != "_id"},
            "who": who,
            "type": "entry"
        }
        mongo.db.activity_logs.insert_one(log_entry)
    except Exception as e:
        print(f"Error logging activity: {e}")


def log_activity_expense(action, expense_data, expense_id=None, username=None):
    """Log an expense activity (add/update/delete) to the activity_logs collection."""
    try:
        who = username or session.get("username", "unknown")
        log_entry = {
            "date": expense_data.get("date"),
            "action": action,
            "timestamp": datetime.now(),
            "entry_id": str(expense_id) if expense_id else None,
            "name": expense_data.get("label") or expense_data.get("from") or "-",
            "category": expense_data.get("from") or expense_data.get("category") or "expense",
            "amount": float(expense_data.get("amount", 0)),
            "details": {k: v for k, v in expense_data.items() if k != "_id"},
            "who": who,
            "type": "expense"
        }
        mongo.db.activity_logs.insert_one(log_entry)
    except Exception as e:
        print(f"Error logging expense activity: {e}")

@app.route("/", methods=["GET", "POST"])
@login_required
def index():
    if 'username' not in session:
        return redirect(url_for('login'))
    
    selected_date = request.args.get("date") or datetime.today().strftime("%Y-%m-%d")

    if request.method == "POST":
        data = {
            "date": request.form["date"],
            "name": request.form["name"].strip(),
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
        log_activity("add", data, data.get("_id"))
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
        offering_remaining=all_time_offering_remaining,
        is_admin=session.get('is_admin', False) 

    )



@app.route("/delete/<id>")
def delete(id):
    entry = mongo.db.entries.find_one({"_id": ObjectId(id)})
    if entry:
        log_activity("delete", entry, id)
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
    # Fetch full updated entry for logging
    updated_entry = mongo.db.entries.find_one({"_id": ObjectId(id)})
    if updated_entry:
        log_activity("update", updated_entry, id)
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


@app.route("/api/monthly-summary")
def monthly_summary():
    categories = ["tithes", "offering", "sfc", "fp", "ph", "hor", "soc", "others", "sundayschool", "for_visitor", "amd"]
    # Get all unique YYYY-MM from entries and expenses
    pipeline = [
        {"$project": {"month": {"$substr": ["$date", 0, 7]}}},
        {"$group": {"_id": "$month"}},
        {"$sort": {"_id": -1}}
    ]
    months_entries = [doc["_id"] for doc in mongo.db.entries.aggregate(pipeline)]
    months_expenses = [doc["_id"] for doc in mongo.db.expenses.aggregate(pipeline)]
    all_months = sorted(set(months_entries + months_expenses), reverse=True)

    # Default to latest month if not specified
    requested_month = request.args.get("month")
    if not requested_month and all_months:
        requested_month = all_months[0]

    if not requested_month:
        return jsonify({"summary": [], "available_months": [], "selected_month": None})

    # Aggregate entries for the selected month
    month_start = f"{requested_month}-01"
    month_end = f"{requested_month}-31"

    entry_docs = list(mongo.db.entries.find({"date": {"$gte": month_start, "$lte": month_end}}))
    expense_docs = list(mongo.db.expenses.find({"date": {"$gte": month_start, "$lte": month_end}}))

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

    summary = {
        "month": requested_month,
        "givings": givings,
        "expenses": expenses,
        "total_givings": total_givings,
        "total_expenses": total_expenses
    }

    # Add weekly breakdown
    weeks = []
    # Get all dates in the month
    month_dates = list(mongo.db.entries.find({"date": {"$gte": month_start, "$lte": month_end}}, {"date": 1}))
    month_dates.extend(mongo.db.expenses.find({"date": {"$gte": month_start, "$lte": month_end}}, {"date": 1}))
    unique_dates = sorted(set(doc["date"] for doc in month_dates))
    
    # Group dates by week (starting Sunday)
    current_week = []
    for date_str in unique_dates:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        weekday = date_obj.weekday()  # Monday=0, Sunday=6
        if weekday == 6 or not current_week:  # Sunday or first week
            if current_week:
                weeks.append(current_week)
            current_week = [date_str]
        else:
            current_week.append(date_str)
    if current_week:
        weeks.append(current_week)
    
    # Calculate totals for each week
    weekly_summary = []
    for i, week_dates in enumerate(weeks, 1):
        week_start = week_dates[0]
        week_end = week_dates[-1]
        
        week_entries = list(mongo.db.entries.find({"date": {"$in": week_dates}}))
        week_expenses = list(mongo.db.expenses.find({"date": {"$in": week_dates}}))
        
        week_givings = {cat: sum(float(e.get(cat, 0)) for e in week_entries) for cat in categories}
        week_total_givings = sum(week_givings.values())
        week_total_expenses = sum(float(exp.get("amount", 0)) for exp in week_expenses)
        week_cash = week_total_givings - week_total_expenses
        
        weekly_summary.append({
            "week": i,
            "week_start": week_start,
            "week_end": week_end,
            "givings": week_givings,
            "total_givings": week_total_givings,
            "total_expenses": week_total_expenses,
            "cash_on_hand": week_cash
        })
    
    summary["weekly"] = weekly_summary

    return jsonify({"summary": summary, "available_months": all_months, "selected_month": requested_month})


# category summary page
@app.route("/category-summary")
@login_required
def category_summary():
    username = session.get('username')
    is_admin = username == "admin"  # or check against a user role from the DB
    return render_template("category_summary.html", username=username, is_admin=is_admin)


@app.route("/api/category-history/<category>")
def category_history(category):
    base_categories = [
        "tithes", "offering", "sfc", "fp", "ph", "hor", "soc",
        "sundayschool", "for_visitor", "others", "amd"
    ]
    derived_categories = [
        "tithes(tithes)", "church tithes", "fp(tithes)", "hor(tithes)",
        "soc(tithes)", "sundayschool(tithes)", "for_visitor(tithes)",
        "others(tithes)", "crv", "fp(hq)", "hor(hq)", "sfc(hq)", "ph(hq)"
    ]

    def safe_parse_date(date_str):
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").strftime("%B %d, %Y")
        except Exception:
            return str(date_str) if date_str else "-"

    def safe_float(val):
        try:
            return float(val)
        except Exception:
            return 0.0

    all_dates = sorted(set(
        mongo.db.entries.distinct("date") +
        mongo.db.expenses.distinct("date")
    ))
    result = []

    if category in base_categories:
        total_remaining_cash = 0

        for date in all_dates:
            if not date:
                continue

            formatted_date = safe_parse_date(date)
            entry_docs = list(mongo.db.entries.find({"date": date}))
            expense_docs = list(mongo.db.expenses.find({"date": date, "from": category}))

            total_giving = sum(safe_float(e.get(category, 0)) for e in entry_docs)
            total_expense = sum(safe_float(e.get("amount", 0)) for e in expense_docs)

            if total_giving == 0 and not expense_docs:
                continue

            breakdown = []
            remaining = total_giving

            breakdown.append({"date": formatted_date, "type": "Total Giving", "amount": total_giving, "label": ""})

            if category == "tithes":
                tithes_cut = total_giving * 0.10
                offering_cut = total_giving * 0.30
                crv_cut = total_giving * 0.10
                pastor_cut = total_giving - (tithes_cut + offering_cut + crv_cut)
                remaining = 0

                breakdown.extend([
                    {"date": formatted_date, "type": "Tithes(Tithes) - 10%", "amount": tithes_cut, "label": ""},
                    {"date": formatted_date, "type": "Tithes(Offering) - 30%", "amount": offering_cut, "label": ""},
                    {"date": formatted_date, "type": "CRV - 10%", "amount": crv_cut, "label": ""},
                    {"date": formatted_date, "type": "For Pastor - 50%", "amount": pastor_cut, "label": ""}
                ])
            elif category == "offering":
                tithes_cut = total_giving * 0.10
                crv_cut = total_giving * 0.10
                remaining = total_giving - (tithes_cut + crv_cut) - total_expense

                breakdown.extend([
                    {"date": formatted_date, "type": "church tithes - 10%", "amount": tithes_cut, "label": ""},
                    {"date": formatted_date, "type": "CRV - 10%", "amount": crv_cut, "label": ""},
                    {"date": formatted_date, "type": "Total Expenses", "amount": total_expense, "label": ""}
            ])
            elif category in ["fp", "hor"]:
                tithes_cut = total_giving * 0.10
                hq_cut = total_giving * 0.45
                remaining = total_giving - hq_cut

                breakdown.extend([
                    {"date": formatted_date, "type": f"{category.upper()}(Tithes) - 10%", "amount": tithes_cut, "label": ""},
                    {"date": formatted_date, "type": f"{category.upper()} (HQ) - 45%", "amount": hq_cut, "label": ""},
                    {"date": formatted_date, "type": "Total Expenses", "amount": total_expense, "label": ""}
            ])
            elif category in ["sfc", "ph"]:
                breakdown.append({
                    "date": formatted_date,
                    "type": category.upper(),
                    "amount": total_giving,
                    "label": ""
            })
            elif category == "sundayschool":
                tithes_cut = total_giving * 0.10
                remaining = total_giving - tithes_cut - total_expense
                breakdown.append({"date": formatted_date, "type": "SundaySchool(Tithes) - 10%", "amount": tithes_cut, "label": ""})
                breakdown.append({"date": formatted_date, "type": "Expenses", "amount": total_expense, "label": ""})
            else:
                remaining -= total_expense
                breakdown.append({"date": formatted_date, "type": "Total Expenses", "amount": total_expense, "label": ""})

            breakdown.insert(1, {
                "date": formatted_date,
                "type": "Total Deduction",
                "amount": total_giving - remaining,
                "label": "",
                "remaining": remaining
            })

            for e in expense_docs:
                breakdown.append({
                    "date": formatted_date,
                    "type": "Expenses",
                    "amount": safe_float(e.get("amount", 0)),
                    "label": e.get("label", ""),
                    "source": e.get("source", ""),
                    "_id": str(e.get("_id"))
                })

            total_remaining_cash += remaining
            result.extend(breakdown)

        result.append({"date": "-", "type": "Cash on Hand", "amount": total_remaining_cash, "label": ""})
        return jsonify(result)

    elif category in derived_categories:
        total_derived_amount = 0
        total_manual_expense = 0

        for date in all_dates:
            if not date:
                continue

            formatted_date = safe_parse_date(date)
            entry_docs = list(mongo.db.entries.find({"date": date}))
            expense_docs = list(mongo.db.expenses.find({"date": date, "from": category}))
            formatted_date = datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")

            get_sum = lambda k: sum(safe_float(e.get(k, 0)) for e in entry_docs)

            tithes = get_sum("tithes")
            offering = get_sum("offering")
            fp = get_sum("fp")
            hor = get_sum("hor")
            soc = get_sum("soc")
            ss = get_sum("sundayschool")
            for_visitor = get_sum("for_visitor")
            others = get_sum("others")

            derived_amount = 0
            label = ""

            if category == "crv":
                derived_amount = tithes * 0.10 + offering * 0.10
                label = f"Tithes(CRV): {tithes * 0.10:.2f}, Offering(CRV): {offering * 0.10:.2f}"
            elif category == "tithes(tithes)":
                derived_amount = tithes * 0.10
                label = "10% of Tithes"
            elif category == "church tithes":
                derived_amount = offering * 0.10
                label = "10% of Offering"
            elif category == "fp(tithes)":
                derived_amount = fp * 0.10
                label = "10% of FP"
            elif category == "hor(tithes)":
                derived_amount = hor * 0.10
                label = "10% of HOR"
            elif category == "sundayschool(tithes)":
                derived_amount = ss * 0.10
                label = "10% of Sunday School"
            elif category == "fp(hq)":
                derived_amount = fp * 0.45
                label = "45% of FP"
            elif category == "hor(hq)":
                derived_amount = hor * 0.45
                label = "45% of HOR"

            if derived_amount > 0:
                result.append({"date": formatted_date, "type": category.upper(), "amount": derived_amount, "label": label})
                total_derived_amount += derived_amount

            for e in expense_docs:
                result.append({
                    "date": formatted_date,
                    "type": "Expenses",
                    "amount": safe_float(e.get("amount", 0)),
                    "label": e.get("label", ""),
                    "source": e.get("source", ""),
                    "_id": str(e.get("_id"))
                })
                total_manual_expense += safe_float(e.get("amount", 0))

        result.append({"date": "-", "type": "Cash on Hand", "amount": total_derived_amount - total_manual_expense, "label": ""})
        return jsonify(result)

        
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
    log_activity_expense("add", expense, expense.get("_id"))
    return jsonify({"message": "Manual category expense added"}), 201


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
    log_activity_expense("add", expense, expense.get("_id"))
    return jsonify({"success": True, "message": "Manual expense recorded."}), 201


# Delete manual expense for category summary
@app.route("/category-summary/delete-expense/<expense_id>", methods=["DELETE"])
def delete_manual_expense_summary(expense_id):
    doc = mongo.db.expenses.find_one({"_id": ObjectId(expense_id), "source": "manual"})
    if doc:
        expense_data = {k: v for k, v in doc.items() if k != "_id"}
        expense_data["_id"] = str(doc["_id"])
        log_activity_expense("delete", expense_data, expense_id)
    result = mongo.db.expenses.delete_one({"_id": ObjectId(expense_id), "source": "manual"})
    if result.deleted_count == 1:
        return jsonify({"success": True})
    return jsonify({"success": False}), 404

@app.route("/category-summary/edit-expense/<expense_id>", methods=["PUT"])
def edit_manual_expense(expense_id):
    from bson.objectid import ObjectId

    if not request.is_json:
        return jsonify({"success": False, "error": "Invalid content type"}), 400

    data = request.get_json()
    print("Incoming ID:", expense_id)

    try:
        obj_id = ObjectId(expense_id)
    except:
        print("Invalid ObjectId")
        return jsonify({"success": False, "error": "Invalid ID"}), 400

    doc = mongo.db.expenses.find_one({"_id": obj_id})
    if not doc:
        print("Document not found")
        return jsonify({"success": False, "error": "Not found"}), 404

    amount = float(data.get("amount", 0))
    label = data.get("label", "Manual")
    category = data.get("category")

    update_fields = {
        "amount": amount,
        "label": label,
    }
    if data.get("date"):
        update_fields["date"] = data.get("date")
    if category:
        print(f"Updating category to {category}")
        update_fields["category"] = category

    result = mongo.db.expenses.update_one(
        {"_id": obj_id},
        {"$set": update_fields}
    )

    if result.modified_count == 1:
        updated = mongo.db.expenses.find_one({"_id": obj_id})
        if updated:
            log_activity_expense("update", {k: v for k, v in updated.items() if k != "_id"}, expense_id)
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "No changes made"}), 404

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route("/api/givings-per-person/<category>")
def category_givings(category):
    month = request.args.get("month")  # e.g. "2025-08"
    if not month:
        return jsonify({"error": "Month parameter is required"}), 400

    # Find all distinct dates for this category in the given month
    date_regex = f"^{month}-"
    dates = sorted(mongo.db.entries.distinct("date", {category: {"$gt": 0}, "date": {"$regex": date_regex}}))

    # Get all entries for that month & category
    entries = list(mongo.db.entries.find(
        {"date": {"$regex": date_regex}, category: {"$gt": 0}},
        {"_id": 0, "name": 1, "date": 1, category: 1}
    ))

    # Unique names
    names = sorted(set(e["name"] for e in entries))

    # Build table data
    table_data = []
    for name in names:
        row = {"name": name}
        for date in dates:
            amount = next((e[category] for e in entries if e["name"] == name and e["date"] == date), 0)
            row[date] = amount
        table_data.append(row)

    return jsonify({
        "dates": dates,
        "data": table_data
    })


@app.route("/api/names")
def suggest_names():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])

    regex = re.compile(q, re.IGNORECASE)

    names = entries_collection.distinct("name", {"name": regex})
    return jsonify(names[:10])


@app.route("/api/dates-with-input")
def dates_with_input():
    """Return all distinct dates that have entries or expenses with actual values, sorted newest first."""
    try:
        # Find dates in entries where at least one field is > 0
        entry_query = {
            "$or": [
                {"tithes": {"$gt": 0}},
                {"offering": {"$gt": 0}},
                {"sfc": {"$gt": 0}},
                {"fp": {"$gt": 0}},
                {"ph": {"$gt": 0}},
                {"hor": {"$gt": 0}},
                {"soc": {"$gt": 0}},
                {"others": {"$gt": 0}},
                {"sundayschool": {"$gt": 0}},
                {"for_visitor": {"$gt": 0}},
                {"amd": {"$gt": 0}}
            ]
        }
        entry_dates = list(entries_collection.distinct("date", entry_query))

        # Find dates in expenses where amount > 0
        expense_query = {"amount": {"$gt": 0}}
        expense_dates = list(mongo.db.expenses.distinct("date", expense_query))

        # Combine and sort
        all_dates = sorted(set(entry_dates + expense_dates), reverse=True)
        return jsonify(all_dates)
    except Exception as e:
        print(f"Error fetching dates: {e}")
        return jsonify([])


@app.route("/api/activity-logs")
def get_activity_logs():
    """Return activity logs sorted by timestamp descending"""
    try:
        logs = list(mongo.db.activity_logs.find().sort("timestamp", -1).limit(100)) # Limit to last 100 actions
        
        # Convert ObjectIds to strings and clean up for JSON
        results = []
        for log in logs:
            log["_id"] = str(log["_id"])
            if log.get("timestamp"):
                log["timestamp"] = log["timestamp"].isoformat()
            results.append(log)
            
        return jsonify(results)
    except Exception as e:
        print(f"Error fetching logs: {e}")
        return jsonify([])

@app.route("/api/available-years")
def available_years():
    """Return all unique years from the database entries"""
    try:
        # Get all distinct dates
        dates = entries_collection.distinct("date")
        
        # Extract years from dates (format: YYYY-MM-DD)
        years = set()
        for date in dates:
            if date and isinstance(date, str) and len(date) >= 4:
                year = date[:4]
                if year.isdigit():
                    years.add(year)
        
        # Sort years in descending order (newest first)
        sorted_years = sorted(list(years), reverse=True)
        return jsonify(sorted_years)
    except Exception as e:
        print(f"Error fetching available years: {e}")
        # Return current year as fallback
        return jsonify([str(datetime.now().year)])


@app.route("/api/search-givings")
def search_givings():
    name_query = request.args.get("name", "").strip()
    year = request.args.get("year", "")
    month = request.args.get("month", "")
    specific_date = request.args.get("date", "")

    if not name_query and not specific_date and not (year and month):
        # Prevent empty heavy queries, require at least a name or specific date context
        # But user said "search a name".
        if not name_query:
            return jsonify([])

    query = {}
    
    if name_query:
        query["name"] = {"$regex": name_query, "$options": "i"}
    
    if specific_date:
        query["date"] = specific_date
    elif year and month:
        query["date"] = {"$regex": f"^{year}-{month}"}
    elif year:
        query["date"] = {"$regex": f"^{year}"}
    elif month:
        query["date"] = {"$regex": f"-{month}-"}

    entries = list(mongo.db.entries.find(query))
    
    categories = ["tithes", "offering", "sfc", "fp", "ph", "hor", "soc", "others", "sundayschool", "for_visitor", "amd"]
    results = []
    
    for entry in entries:
        date = entry.get("date", "")
        person_name = entry.get("name", "")
        
        for cat in categories:
            val = entry.get(cat, 0)
            try:
                amount = float(val)
            except:
                amount = 0.0
                
            if amount > 0:
                results.append({
                    "date": date,
                    "name": person_name,
                    "category": cat,
                    "amount": amount
                })
                
    # Sort by date descending
    results.sort(key=lambda x: x["date"], reverse=True)
    
    return jsonify(results)

def get_available_years():
    years = set()
    
    # Get years from entries
    dates = mongo.db.entries.distinct("date")
    for d in dates:
        if d and len(d) >= 4:
            years.add(d[:4])
            
    # Get years from expenses
    exp_dates = mongo.db.expenses.distinct("date")
    for d in exp_dates:
        if d and len(d) >= 4:
            years.add(d[:4])
            
    # Add current year if not present
    current_year = str(datetime.now().year)
    years.add(current_year)
            
    return jsonify(sorted(list(years), reverse=True))


if __name__ == "__main__":
    app.run(debug=True)
