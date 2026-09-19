import os
from pathlib import Path

# Directories and extensions to ignore
EXCLUDE_DIRS = {
    '.git', '.venv', 'venv', 'node_modules', '__pycache__', 
    'dist', 'build', '.idea', '.vscode', '.next', 'coverage'
}
EXCLUDE_EXTS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', 
    '.tar', '.gz', '.pyc', '.lock', '.svg', '.epub', '.mp3'
}

OUTPUT_FILE = "condensed_codebase.txt"

def pack_codebase(root_dir="."):
    root_path = Path(root_dir).resolve()
    processed_count = 0

    with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
        for path in root_path.rglob("*"):
            # Skip ignored directories
            if any(part in EXCLUDE_DIRS for part in path.parts):
                continue

            # Skip binary/ignored files and the output file itself
            if (
                path.is_file()
                and path.suffix.lower() not in EXCLUDE_EXTS
                and path.name != OUTPUT_FILE
                and path.name != "pack_codebase.py"
            ):
                relative_path = path.relative_to(root_path)
                folder = relative_path.parent
                filename = relative_path.name

                try:
                    content = path.read_text(encoding="utf-8")
                    
                    # Custom header format requested
                    outfile.write(f"[{folder}] [[{filename}]]:\n")
                    outfile.write("```\n")
                    outfile.write(content)
                    outfile.write("\n```\n\n" + "=" * 50 + "\n\n")
                    
                    processed_count += 1
                    print(f"Added: {relative_path}")
                except (UnicodeDecodeError, PermissionError):
                    # Skip non-UTF-8 or unreadable files
                    continue

    print(f"\nSuccessfully packed {processed_count} files into '{OUTPUT_FILE}'.")

if __name__ == "__main__":
    pack_codebase()