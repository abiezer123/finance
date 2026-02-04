from app import app, mongo

with app.app_context():
    date_to_check = "2027-01-01"
    
    print(f"Checking entries for {date_to_check}...")
    entries = list(mongo.db.entries.find({"date": date_to_check}))
    print(f"Found {len(entries)} entries.")
    for e in entries:
        print("-------------")
        filtered_e = {k: v for k, v in e.items() if k not in ['_id', 'date', 'name']}
        print(f"ID: {e['_id']}, Name: {e.get('name')}")
        print(f"Values: {filtered_e}")
        # Check if they look like strings
        for k, v in filtered_e.items():
            if v != 0 and v != 0.0:
                 print(f"   -> FIELD {k} HAS VALUE {v} (Type: {type(v)})")

    print("\nChecking expenses for {date_to_check}...")
    expenses = list(mongo.db.expenses.find({"date": date_to_check}))
    print(f"Found {len(expenses)} expenses.")
    for exp in expenses:
        print(f"Expense: {exp}")
