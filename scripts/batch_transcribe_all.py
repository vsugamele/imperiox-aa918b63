import os, sys, json, time, base64, subprocess, urllib.request, re
import requests

API_KEY = os.getenv("OPENROUTER_API_KEY")
if not API_KEY:
    print("ERRO: OPENROUTER_API_KEY não encontrada no ambiente!")
    sys.exit(1)

CACHE_DIR = "scratch/creatives_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

with open("scratch/remaining_33_creatives.json", "r", encoding="utf-8") as f:
    creatives = json.load(f)

print(f"Iniciando transcrição e dissecação em lote de {len(creatives)} criativos...")

results = []
success_count = 0
fail_count = 0

for idx, c in enumerate(creatives, 1):
    c_id = c["id"]
    titulo = c["titulo"]
    produto = c["produto"]
    pasta = c["pasta"]
    url = c["url"]
    cache_json = os.path.join(CACHE_DIR, f"{c_id}.json")

    print(f"\n[{idx}/{len(creatives)}] Processando: {titulo}")

    if os.path.exists(cache_json):
        print("  -> Já processado em cache. Pulando.")
        with open(cache_json, "r", encoding="utf-8") as jf:
            results.append(json.load(jf))
        success_count += 1
        continue

    audio_path = os.path.join(CACHE_DIR, f"{c_id}.mp3")
    is_video_audio = False
    duration = 0.0

    # 1. Tentar baixar áudio via yt-dlp
    if not os.path.exists(audio_path):
        cmd = [
            "yt-dlp",
            "--no-update",
            "-x",
            "--audio-format", "mp3",
            "-o", audio_path,
            url
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
            if res.returncode == 0 and os.path.exists(audio_path):
                is_video_audio = True
            else:
                print(f"  yt-dlp aviso/erro: {res.stderr[:120] if res.stderr else 'falhou'}")
        except Exception as e:
            print(f"  yt-dlp exceção: {e}")

    if os.path.exists(audio_path) and os.path.getsize(audio_path) > 1000:
        is_video_audio = True
        # Pegar duração via ffprobe
        try:
            p_res = subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "json", audio_path],
                capture_output=True, text=True, timeout=10
            )
            p_data = json.loads(p_res.stdout)
            duration = float(p_data["format"]["duration"])
        except Exception:
            duration = 30.0

    # Se não for áudio/vídeo, tentar baixar como imagem direta
    image_path = os.path.join(CACHE_DIR, f"{c_id}.png")
    is_image = False
    if not is_video_audio:
        match = re.search(r"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)", url)
        if match:
            file_id = match.group(1)
            dl_url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0"
            req = urllib.request.Request(dl_url, headers={"User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = resp.read()
                    with open(image_path, "wb") as out:
                        out.write(data)
                if os.path.exists(image_path) and os.path.getsize(image_path) > 1000:
                    is_image = True
                    print(f"  Baixado como imagem estática ({os.path.getsize(image_path)} bytes)")
            except Exception as e:
                print(f"  Falha no download direto: {e}")

    # Chamar Gemini 2.5 Flash
    if is_video_audio:
        print(f"  Transcrevendo áudio ({duration:.1f}s) via Gemini 2.5 Flash...")
        with open(audio_path, "rb") as af:
            b64_data = base64.b64encode(af.read()).decode("utf-8")

        prompt = f"""Você é um copywriter de resposta direta de elite.
Analise e transcreva este criativo de anúncio em vídeo para a oferta '{produto}' ({pasta}).
Você deve retornar ESTRITAMENTE um objeto JSON válido (sem tags markdown, sem blocos ```json, apenas JSON puro) com a seguinte estrutura:

{{
  "transcricao": "Transcrição literal palavra por palavra de todo o áudio falado.",
  "duracao": {duration:.1f},
  "analise": {{
    "angle_family": "Nome conciso da família de ângulo (ex: Segredo de Despensa / Inimigo Oculto / Contraste de Preço)",
    "caption": "Resumo em uma linha do criativo",
    "criador": "{produto}",
    "editorial": {{
      "format": "Formato de vídeo (ex: UGC Casual / Alerta Médico / Demo de Cozinha)",
      "primaryNiche": "{pasta.replace('SwipeRadar — ', '')}",
      "topic": "Tema central do anúncio em 1-2 frases",
      "transfer": "O que copiar ou modelar deste criativo para ofertas similares"
    }},
    "anatomy": {{
      "blocks": [
        {{
          "start": 0.0,
          "end": 10.0,
          "kind": "hook",
          "label": "Nome do bloco",
          "purpose": "Objetivo persuasivo do bloco"
        }}
      ]
    }},
    "replication_prompt": "Prompt pronto para gerar cópia/roteiro modelado deste anúncio"
  }}
}}"""

        payload = {
            "model": "google/gemini-2.5-flash",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "input_audio", "input_audio": {"data": b64_data, "format": "mp3"}}
                    ]
                }
            ],
            "response_format": {"type": "json_object"}
        }

    elif is_image:
        print("  Analisando criativo de imagem via Gemini 2.5 Flash...")
        with open(image_path, "rb") as imf:
            b64_data = base64.b64encode(imf.read()).decode("utf-8")

        prompt = f"""Você é um copywriter de resposta direta de elite.
Analise este criativo estático de imagem da oferta '{produto}' ({pasta}).
Extraia todos os textos (headline, body, badge, CTA) e disseque a engenharia persuasiva.
Retorne ESTRITAMENTE um objeto JSON válido (sem tags markdown):

{{
  "transcricao": "Texto completo presente na imagem e headline do anúncio.",
  "duracao": 0.0,
  "analise": {{
    "angle_family": "Família de ângulo da imagem",
    "caption": "Resumo do criativo estático",
    "criador": "{produto}",
    "editorial": {{
      "format": "Imagem Estática / Print Nativo / Advertorial Card",
      "primaryNiche": "{pasta.replace('SwipeRadar — ', '')}",
      "topic": "Tema central da imagem",
      "transfer": "O que aproveitar do layout e copy visual"
    }},
    "anatomy": {{
      "blocks": [
        {{
          "start": 0.0,
          "end": 0.0,
          "kind": "hook",
          "label": "Headline / Gancho Visual",
          "purpose": "Quebrar o scroll e gerar clique"
        }}
      ]
    }},
    "replication_prompt": "Prompt para recriar esta imagem com IA ou copywriter"
  }}
}}"""

        payload = {
            "model": "google/gemini-2.5-flash",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_data}"}}
                    ]
                }
            ],
            "response_format": {"type": "json_object"}
        }
    else:
        print(f"  Não foi possível obter áudio nem imagem para {titulo}")
        fail_count += 1
        continue

    # Enviar para OpenRouter
    try:
        t0 = time.time()
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=70
        )
        t_elapsed = time.time() - t0

        if resp.status_code == 200:
            raw_text = resp.json()["choices"][0]["message"]["content"].strip()
            # Limpar formatações se houver
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            parsed_data = json.loads(raw_text.strip())

            # Garantir campos chave
            parsed_data["id"] = c_id
            parsed_data["titulo"] = titulo
            parsed_data["produto"] = produto
            parsed_data["pasta"] = pasta
            if "duracao" not in parsed_data or parsed_data["duracao"] == 0:
                parsed_data["duracao"] = duration

            with open(cache_json, "w", encoding="utf-8") as out_jf:
                json.dump(parsed_data, out_jf, ensure_ascii=False, indent=2)

            results.append(parsed_data)
            success_count += 1
            print(f"  -> Concluído com sucesso em {t_elapsed:.1f}s ({len(parsed_data.get('transcricao',''))} chars)")
        else:
            print(f"  Erro OpenRouter ({resp.status_code}): {resp.text[:150]}")
            fail_count += 1
    except Exception as e:
        print(f"  Exceção ao chamar LLM: {e}")
        fail_count += 1

print(f"\n==========================================")
print(f"Fim da rodada: {success_count} sucessos, {fail_count} falhas.")
print(f"Salvando resultados consolidados em scratch/all_33_transcribed.json...")

with open("scratch/all_33_transcribed.json", "w", encoding="utf-8") as f_all:
    json.dump(results, f_all, ensure_ascii=False, indent=2)

# Gerar SQL de Atualização
sqls = []
for item in results:
    c_id = item["id"]
    trans = item.get("transcricao", "").replace("'", "''")
    analise_json = json.dumps(item.get("analise", {})).replace("'", "''")
    dur = item.get("duracao", 0.0)

    sqls.push_stmt = f"""UPDATE imphq_referencias
SET transcricao = '{trans}',
    analise = '{analise_json}'::jsonb,
    duracao = {dur},
    transcribe_status = 'done',
    transcribe_provider = 'google/gemini-2.5-flash',
    transcribed_at = NOW(),
    updated_at = NOW()
WHERE id = '{c_id}';"""
    sqls.append(sqls.push_stmt)

sql_file = "scripts/update_33_creatives.sql"
with open(sql_file, "w", encoding="utf-8") as sf:
    sf.write("\n\n".join(sqls))

print(f"Arquivo SQL gerado: {sql_file} ({len(sqls)} atualizações)")
