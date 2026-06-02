import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\vsuga\.gemini\antigravity\scratch\imperiox\supabase\functions\whatsapp-api\index.ts"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(2390, 2415):
    print(f"{i+1}: {lines[i].rstrip()}")
