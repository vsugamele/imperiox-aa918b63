import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\vsuga\.gemini\antigravity\scratch\imperiox\src\pages\VslLab.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(0, 25):
    print(f"{i+1}: {lines[i].rstrip()}")
