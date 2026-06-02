import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\vsuga\.gemini\antigravity\scratch\imperiox\src\pages\InstagramPage.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("Last 30 lines of InstagramPage.tsx:")
for i in range(len(lines) - 30, len(lines)):
    print(f"{i+1}: {lines[i].rstrip()}")
