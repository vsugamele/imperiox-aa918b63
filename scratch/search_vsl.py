import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\vsuga\.gemini\antigravity\scratch\imperiox\src\pages\VslLab.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
for i, line in enumerate(lines):
    if "const [" in line or "function " in line or "interface " in line or "<h2>" in line or "<h3>" in line or "CardTitle" in line or "Tabs" in line:
        if i < 200: # Let's show first 200 lines features
            print(f"{i+1}: {line.strip()}")
