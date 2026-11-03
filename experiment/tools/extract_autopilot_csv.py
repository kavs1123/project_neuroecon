"""Extract the CSV that ?autopilot=1 writes into <pre id="autopilot-output"> from a dumped DOM.

Usage: python extract_autopilot_csv.py dom.html out.csv
"""
import html
import re
import sys

dom = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r'<pre id="autopilot-output"[^>]*>(.*?)</pre>', dom, re.S)
if not m:
    sys.exit("no autopilot output found (did the run finish?)")
open(sys.argv[2], "w", encoding="utf-8", newline="").write(html.unescape(m.group(1)))
print("wrote", sys.argv[2])
