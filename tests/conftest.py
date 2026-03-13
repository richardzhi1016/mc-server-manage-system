import sys
from pathlib import Path

# Ensure the project root is on sys.path so `from app.xxx import` works
PROJECT_ROOT = str(Path(__file__).parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
