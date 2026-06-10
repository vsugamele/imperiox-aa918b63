"""
Servidor TTS local unificado — dois modos:
  • /tts/edge   — edge-tts (Microsoft, gratuito, vozes pt-BR genéricas)
  • /tts/clone  — Coqui XTTS v2 (clonagem de voz a partir de referência .wav)

Instalação completa:
  pip install edge-tts fastapi uvicorn python-multipart torch torchaudio TTS

  NOTA: TTS (Coqui) requer ~4 GB de download no primeiro uso (modelo XTTS v2).
  GPU: muito mais rápido (RTX 3060+ roda em ~2-3s). CPU funciona mas ~15-25s.

Uso rápido (apenas edge-tts, sem GPU):
  pip install edge-tts fastapi uvicorn
  XTTS_ENABLED=false python server.py

Expor publicamente (Cloudflare Tunnel, gratuito, sem conta):
  cloudflared tunnel --url http://localhost:8765

Variáveis de ambiente:
  PORT            — porta local (padrão: 8765)
  TTS_VOICE       — voz padrão edge-tts (padrão: pt-BR-FranciscaNeural)
  XTTS_ENABLED    — habilita XTTS v2 (padrão: true se TTS instalado)
  XTTS_DEVICE     — cuda | cpu (padrão: auto-detecta)
  REFERENCE_AUDIO — caminho para o .wav de referência da voz clonada
                    (padrão: ./reference.wav)

Vozes edge-tts pt-BR: FranciscaNeural, AntonioNeural, BrendaNeural, DonatoNeural,
  GiovannaNeural, HumbertoNeural, JulioNeural, LeticiaNeural, ManuelaNeural, YaraNeural
"""

import asyncio
import io
import os
import sys
import logging
import tempfile
from pathlib import Path

import uvicorn
import edge_tts
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("tts-server")

PORT = int(os.getenv("PORT", "8765"))
DEFAULT_EDGE_VOICE = os.getenv("TTS_VOICE", "pt-BR-FranciscaNeural")
REFERENCE_AUDIO = os.getenv("REFERENCE_AUDIO", "./reference.wav")
XTTS_ENABLED_ENV = os.getenv("XTTS_ENABLED", "true").lower() != "false"

# ── XTTS v2 setup ────────────────────────────────────────────────────────────
xtts_model = None
XTTS_AVAILABLE = False

if XTTS_ENABLED_ENV:
    try:
        import torch
        from TTS.api import TTS as CoquiTTS
        XTTS_DEVICE = os.getenv("XTTS_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
        log.info(f"Carregando XTTS v2 no dispositivo: {XTTS_DEVICE}...")
        xtts_model = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to(XTTS_DEVICE)
        XTTS_AVAILABLE = True
        log.info("✅ XTTS v2 carregado com sucesso!")
    except ImportError:
        log.warning("⚠️  TTS (Coqui) não instalado — /tts/clone desabilitado. pip install TTS")
    except Exception as e:
        log.warning(f"⚠️  Falha ao carregar XTTS v2: {e} — /tts/clone desabilitado.")

app = FastAPI(title="Local TTS Server", version="2.0.0")


# ── Models ───────────────────────────────────────────────────────────────────
class EdgeTTSRequest(BaseModel):
    text: str
    voice: str = DEFAULT_EDGE_VOICE
    rate: str = "+0%"
    pitch: str = "+0Hz"


class CloneTTSRequest(BaseModel):
    text: str
    # Caminho local OU URL pública do áudio de referência.
    # Se omitido, usa REFERENCE_AUDIO env var.
    reference_audio: str | None = None
    language: str = "pt"
    speed: float = 1.0


# ── Helpers ──────────────────────────────────────────────────────────────────
def _trim_text(text: str, limit: int = 800) -> str:
    """Limita texto para evitar áudios longos demais no WA."""
    text = text.strip()
    if len(text) <= limit:
        return text
    # Corta na última frase completa dentro do limite
    cut = text[:limit].rfind(".")
    return text[: cut + 1] if cut > 0 else text[:limit]


# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "ok": True,
        "edge_tts": True,
        "xtts_v2": XTTS_AVAILABLE,
        "xtts_device": os.getenv("XTTS_DEVICE", "cpu") if XTTS_AVAILABLE else None,
        "default_edge_voice": DEFAULT_EDGE_VOICE,
        "reference_audio": REFERENCE_AUDIO if XTTS_AVAILABLE else None,
    }


@app.get("/voices")
async def list_voices():
    """Lista vozes edge-tts disponíveis em pt-BR."""
    voices = await edge_tts.list_voices()
    pt_br = [
        {"name": v["ShortName"], "gender": v["Gender"], "locale": v["Locale"]}
        for v in voices if v["Locale"].startswith("pt-BR")
    ]
    return {"voices": pt_br, "total": len(pt_br)}


@app.post("/tts/edge")
@app.post("/tts")  # alias para compatibilidade com código anterior
async def tts_edge(req: EdgeTTSRequest):
    """Gera áudio usando edge-tts (gratuito, vozes pt-BR genéricas)."""
    text = _trim_text(req.text)
    if not text:
        raise HTTPException(status_code=400, detail="text é obrigatório")

    try:
        communicate = edge_tts.Communicate(text, req.voice, rate=req.rate, pitch=req.pitch)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        buf.seek(0)
        if buf.getbuffer().nbytes == 0:
            raise HTTPException(status_code=500, detail="edge-tts gerou áudio vazio")
        return StreamingResponse(buf, media_type="audio/mpeg",
                                 headers={"X-TTS-Provider": "edge-tts",
                                          "X-Voice": req.voice})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro edge-tts: {e}")


@app.post("/tts/clone")
async def tts_clone(req: CloneTTSRequest):
    """
    Clona a voz de referência e sintetiza o texto com XTTS v2.
    Requer Coqui TTS instalado e XTTS_ENABLED=true.
    """
    if not XTTS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="XTTS v2 não disponível. Instale: pip install TTS  e reinicie o servidor."
        )

    text = _trim_text(req.text)
    if not text:
        raise HTTPException(status_code=400, detail="text é obrigatório")

    # Resolve áudio de referência
    ref_audio = req.reference_audio or REFERENCE_AUDIO
    ref_path = Path(ref_audio)

    # Se for URL, faz download temporário
    tmp_ref = None
    if ref_audio.startswith("http"):
        import urllib.request
        tmp_ref = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        urllib.request.urlretrieve(ref_audio, tmp_ref.name)
        ref_path = Path(tmp_ref.name)

    if not ref_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Áudio de referência não encontrado: {ref_path}. "
                   f"Coloque o arquivo .wav do JP em {REFERENCE_AUDIO} ou "
                   f"envie o caminho correto em reference_audio."
        )

    try:
        out_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        out_path = out_tmp.name
        out_tmp.close()

        # XTTS v2 synthesis (síncrono — roda em thread separada para não bloquear o loop)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: xtts_model.tts_to_file(
                text=text,
                speaker_wav=str(ref_path),
                language=req.language,
                file_path=out_path,
                speed=req.speed,
            )
        )

        with open(out_path, "rb") as f:
            audio_bytes = f.read()

        os.unlink(out_path)
        if tmp_ref:
            os.unlink(tmp_ref.name)

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={"X-TTS-Provider": "xtts-v2", "X-Voice": "clone"},
        )
    except Exception as e:
        log.error(f"XTTS v2 error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro XTTS v2: {e}")


@app.post("/reference/upload")
async def upload_reference(file: UploadFile = File(...)):
    """
    Faz upload do áudio de referência da voz clonada (ex: voz do JP).
    Salva em ./reference.wav (ou REFERENCE_AUDIO env var).
    Formatos aceitos: .wav, .mp3, .ogg, .m4a
    Recomendado: .wav, 16-24kHz, mono, 10-30s, sem ruído de fundo.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo inválido")

    content = await file.read()
    save_path = Path(REFERENCE_AUDIO)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    save_path.write_bytes(content)
    log.info(f"Referência salva: {save_path} ({len(content) // 1024} KB)")
    return {
        "ok": True,
        "saved_to": str(save_path),
        "size_kb": len(content) // 1024,
        "message": "Áudio de referência salvo. Use POST /tts/clone para sintetizar com esta voz.",
    }


# ── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║         Servidor TTS Local v2 — edge-tts + XTTS v2          ║
║                                                              ║
║  URL local:   http://localhost:{PORT}                         ║
║  edge-tts:    ✅ sempre disponível (gratuito)                 ║
║  XTTS v2:     {"✅ carregado  " if XTTS_AVAILABLE else "❌ não disponível (pip install TTS)"}                      ║
║                                                              ║
║  Endpoints:                                                  ║
║   GET  /health              — status                         ║
║   GET  /voices              — vozes pt-BR edge-tts           ║
║   POST /tts/edge            — voz genérica (gratuita)        ║
║   POST /tts/clone           — voz clonada do JP (XTTS v2)   ║
║   POST /reference/upload    — envia .wav de referência       ║
║                                                              ║
║  Para expor publicamente (sem conta):                        ║
║   cloudflared tunnel --url http://localhost:{PORT}            ║
╚══════════════════════════════════════════════════════════════╝
""")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
