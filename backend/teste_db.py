import os
from dotenv import load_dotenv
from supabase import create_client

# Load the keys from your .env file
load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

# Connect to Supabase
supabase = create_client(url, key)

# 1. Fetch data from the test_vocab table
response = supabase.table("test_vocab").select("*").execute()
print("Current Database Rows:", response.data)

# 2. Insert a new word into the table
new_data = {"word": "Apple", "language": "English"}
supabase.table("test_vocab").insert(new_data).execute()
print("Successfully inserted 'Apple' into the database!")

# 3. Fetch again to see the updated list
updated_response = supabase.table("test_vocab").select("*").execute()
print("Updated Database Rows:", updated_response.data)