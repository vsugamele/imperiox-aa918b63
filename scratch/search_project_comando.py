import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\vsuga\.gemini\antigravity\scratch\imperiox\src\components\projeto\ProjetoComando.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "drawerProduto" in line or "setDrawerProduto" in line:
        print(f"{i+1}: {line.strip()}")
