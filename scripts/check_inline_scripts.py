#!/usr/bin/env python3
"""Parse every inline JavaScript block in HTML files with Node.js --check."""
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PATTERN = re.compile(r'<script\b([^>]*)>([\s\S]*?)</script\s*>', re.I)
checked = 0
errors = []
with tempfile.TemporaryDirectory(prefix='btcbox-inline-js-') as temp:
    tmp = Path(temp) / 'inline.js'
    for html in ROOT.rglob('*.html'):
        if any(part in {'node_modules', '.git'} for part in html.parts):
            continue
        source = html.read_text(encoding='utf-8', errors='replace')
        for index, match in enumerate(PATTERN.finditer(source), 1):
            attrs, code = match.group(1), match.group(2)
            if re.search(r'\bsrc\s*=', attrs, re.I) or not code.strip():
                continue
            checked += 1
            tmp.write_text(code, encoding='utf-8')
            result = subprocess.run(['node', '--check', str(tmp)], capture_output=True, text=True)
            if result.returncode:
                errors.append((html.relative_to(ROOT), index, result.stderr.strip()))
if errors:
    for file, index, message in errors:
        print(f'FAIL {file} inline script #{index}\n{message}')
    print(f'Checked {checked} inline scripts; {len(errors)} syntax error(s).')
    sys.exit(1)
print(f'PASS: checked {checked} inline JavaScript blocks; no syntax errors.')
