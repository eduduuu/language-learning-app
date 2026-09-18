from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import json
import random
import traceback
from supabase import create_client, Client
from backend.parser import (
    extract_text_by_page_range, 
    extract_vocabulary, 
    generate_single_flashcard, 
    generate_grammar_question
)

app = FastAPI(title="Japanese Context Reader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase Initialization
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Context Reader API is running"}

@app.post("/upload-book/")
async def upload_book(
    file: UploadFile = File(...),
    user_id: str = Form("anonymous"),
    language: str = Form("japanese")
):
    """Ghost Extraction Endpoint: Extracts vocabulary in memory and instantly deletes the uploaded file."""
    if not file.filename.endswith((".epub", ".pdf")):
        raise HTTPException(status_code=400, detail="Only .epub and .pdf files are supported.")
    
    temp_file_path = f"temp_{file.filename}"
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Extract vocabulary from initial pages
        raw_text = extract_text_by_page_range(temp_file_path, start_page=1, end_page=20, chars_per_page=1000)
        vocab = extract_vocabulary(raw_text, language=language)
        
        if not vocab:
            raise HTTPException(status_code=400, detail="No vocabulary extracted from document.")
            
        # Save to Supabase if configured
        book_id = None
        if supabase and user_id != "anonymous":
            book_res = supabase.table("user_books").insert({
                "user_id": user_id,
                "title": file.filename.replace(".epub", "").replace(".pdf", ""),
                "language": language,
                "extracted_vocab": vocab,
                "total_words": len(vocab)
            }).execute()
            
            if book_res.data:
                book_id = book_res.data[0]["id"]
                
        return {
            "status": "success",
            "message": "Ghost extraction complete. File permanently purged from server.",
            "book_id": book_id,
            "filename": file.filename,
            "extracted_count": len(vocab),
            "sample_vocab": vocab[:15]
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # GHOST GUARANTEE: Ensure physical file is deleted immediately
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/flashcard/")
async def fetch_flashcard(
    file: UploadFile = File(None),
    start_page: int = Form(1),
    end_page: int = Form(2),
    chars_per_page: int = Form(1000),
    target_words_count: int = Form(2),
    sentence_length_words: int = Form(10),
    kanji_ratio: float = Form(0.3),
    complexity: str = Form("absolute_beginner"),
    language: str = Form("japanese")
):
    """Generates a practice flashcard sentence with optional Kanji breakdown."""
    if not file:
        raise HTTPException(status_code=400, detail="Please upload a book file to generate flashcards.")

    temp_file_path = f"temp_{file.filename}"
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        raw_text = extract_text_by_page_range(
            temp_file_path, 
            start_page=start_page, 
            end_page=end_page, 
            chars_per_page=chars_per_page
        )
        
        vocab = extract_vocabulary(raw_text, language=language)
        if not vocab:
            raise HTTPException(status_code=400, detail="No vocabulary found in range.")
            
        random.shuffle(vocab)
        
        json_response_str = generate_single_flashcard(
            vocab_list=vocab,
            language=language,
            target_words_count=target_words_count,
            complexity=complexity,
            sentence_length_words=sentence_length_words,
            kanji_ratio=kanji_ratio
        )
        
        clean_json_str = json_response_str.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
            
        parsed_data = json.loads(clean_json_str.strip())
        
        if "japanese_sentence" in parsed_data:
            parsed_data["japanese_sentence"] = parsed_data["japanese_sentence"].replace(" ", "")
            
        return parsed_data

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.get("/grammar/")
async def fetch_grammar_question(
    topic: str = Query("particles"),
    complexity: str = Query("absolute_beginner"),
    language: str = Query("japanese")
):
    """Generates a multiple choice grammar question."""
    try:
        json_response_str = generate_grammar_question(topic=topic, complexity=complexity, language=language)
        
        clean_json_str = json_response_str.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
            
        return json.loads(clean_json_str.strip())

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))