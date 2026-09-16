from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import json
import random
import traceback
from parser import (
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

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Japanese Context Reader API is running"}

@app.post("/flashcard/")
async def fetch_flashcard(
    file: UploadFile = File(...),
    start_page: int = Form(1),
    end_page: int = Form(1),
    chars_per_page: int = Form(1000),
    target_words_count: int = Form(2),
    sentence_length_words: int = Form(10),
    kanji_ratio: float = Form(0.3),
    complexity: str = Form("absolute_beginner")
):
    """Slices EPUB by simulated pages, extracts vocabulary, and generates one flashcard sentence."""
    if not file.filename.endswith(".epub"):
        raise HTTPException(status_code=400, detail="Only .epub files are supported.")
    
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
        
        vocab = extract_vocabulary(raw_text)
        if not vocab:
            raise HTTPException(status_code=400, detail="No valid Japanese vocabulary found in this page range.")
            
        # Shuffle vocabulary so subsequent clicks pick new target words from the range
        random.shuffle(vocab)
        
        json_response_str = generate_single_flashcard(
            vocab_list=vocab,
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
        
        # Post-process to guarantee no extra spaces exist in the Japanese sentence
        if "japanese_sentence" in parsed_data:
            parsed_data["japanese_sentence"] = parsed_data["japanese_sentence"].replace(" ", "").replace(" ", "")
            
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
    complexity: str = Query("absolute_beginner")
):
    """Generates a multiple choice grammar question."""
    try:
        json_response_str = generate_grammar_question(topic=topic, complexity=complexity)
        
        clean_json_str = json_response_str.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
            
        return json.loads(clean_json_str.strip())

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))