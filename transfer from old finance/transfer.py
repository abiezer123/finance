from pymongo import MongoClient
import pprint

# === 1. OLD CLUSTER (from your Flask app config) ===
old_uri = "mongodb+srv://abiezer:abiatharfam@cluster0.ghn0wj8.mongodb.net/church_finance?retryWrites=true&w=majority&appName=Cluster0"

# === 2. NEW CLUSTER (from your new MongoDB Atlas) ===
new_uri = "mongodb+srv://abiezervilla12_db_user:abiathar@cluster0.klixyhd.mongodb.net/?appName=Cluster0"

# === 3. Connect to both clusters ===
old_client = MongoClient(old_uri)
new_client = MongoClient(new_uri)

old_db = old_client["church_finance"]   # same DB name
new_db = new_client["church_finance"]

# === 4. Copy all collections and data ===
for name in old_db.list_collection_names():
    print(f"\nCopying collection: {name}")
    old_col = old_db[name]
    new_col = new_db[name]

    data = list(old_col.find())
    if data:
        # clear new collection before inserting (optional)
        
        new_col.insert_many(data)
        print(f"✅ Copied {len(data)} documents.")
    else:
        print("⚠️ No documents found.")

print("\n🎉 Transfer complete! All collections have been copied successfully.")
