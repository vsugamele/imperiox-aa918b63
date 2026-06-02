import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\vsuga\.gemini\antigravity\scratch\imperiox\supabase\functions\instagram-webhook\index.ts"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("Direct message prompt area:")
for i in range(245, 290):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\nComment prompt area:")
for i in range(545, 595):
    print(f"{i+1}: {lines[i].rstrip()}")
