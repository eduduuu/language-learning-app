from supabase import create_client, Client
from core.config import settings

def get_supabase_client() -> Client:
    """
    Instantiates the Supabase client using the Service Role Key
    to allow the backend service layer to execute authorized transactions.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# Shared singleton instance
supabase: Client = get_supabase_client()