"""
Transcritor Local Zero-Custo (Império HQ)
Usa faster-whisper localmente no PC (CPU ou GPU NVIDIA CUDA).
Custo de API: R$ 0,00 / $ 0.00.
Suporta arquivos locais (.mp4, .mp3, .wav, .m4a) ou URLs diretas / Google Drive / YouTube via yt-dlp.
"""

import sys
import os
import json
import argparse
import subprocess
from faster_whisper import WhisperModel

def extract_or_download_audio(source: str, output_path: str = "scratch/temp_local_audio.mp3") -> str:
    os.makedirs("scratch", exist_ok=True)
    if os.path.exists(source):
        # Arquivo local
        if source.endswith(('.mp3', '.wav', '.m4a')):
            return source
        # Se for vídeo local (.mp4), extrai áudio via ffmpeg
        cmd = ["ffmpeg", "-y", "-i", source, "-vn", "-acodec", "libmp3lame", "-q:a", "4", output_path]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return output_path
    
    # Se for URL externa, baixa com yt-dlp
    cmd = ["yt-dlp", "-x", "--audio-format", "mp3", "-o", output_path, source]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return output_path

def transcribe(audio_path: str, model_size: str = "base", language: str = "pt") -> dict:
    print(f"🎙️ Carregando modelo Whisper '{model_size}' localmente...")
    # No Windows, CPU int8 funciona imediatamente sem depender de DLLs de CUDA externas
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("💻 Usando CPU local (int8 quantizado)")
    except Exception as e:
        model = WhisperModel(model_size, device="auto")
        print(f"💻 Usando dispositivo padrão: {e}")

    print(f"🎧 Transcrevendo '{audio_path}'...")
    segments, info = model.transcribe(audio_path, language=language, beam_size=5)

    transcript_segments = []
    full_text_parts = []

    for seg in segments:
        text = seg.text.strip()
        transcript_segments.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": text
        })
        full_text_parts.append(text)

    full_text = " ".join(full_text_parts)
    duration = round(info.duration, 2) if hasattr(info, 'duration') else (transcript_segments[-1]["end"] if transcript_segments else 0.0)

    return {
        "ok": True,
        "duracao": duration,
        "idioma": info.language,
        "probabilidade_idioma": round(info.language_probability, 3),
        "total_segmentos": len(transcript_segments),
        "transcricao": full_text,
        "transcript": transcript_segments
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transcritor Local Zero-Custo")
    parser.add_argument("source", help="Caminho do arquivo local ou URL")
    parser.add_argument("--model", default="base", help="Tamanho do modelo: tiny, base, small, medium, large-v3 (default: base)")
    parser.add_argument("--lang", default=None, help="Idioma forçado (ex: pt, en). Deixe vazio para autodetectar.")
    parser.add_argument("--out", default=None, help="Caminho para salvar o JSON resultante")

    args = parser.parse_args()

    audio = extract_or_download_audio(args.source)
    res = transcribe(audio, model_size=args.model, language=args.lang)

    print("\n✅ Transcrição Concluída!")
    print(f"⏱️ Duração: {res['duracao']}s | Segmentos: {res['total_segmentos']}")
    print(f"📝 Texto:\n{res['transcricao'][:200]}...")

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=2)
        print(f"💾 Salvo em: {args.out}")
    else:
        print(json.dumps(res, ensure_ascii=False, indent=2))
