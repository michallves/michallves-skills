#!/usr/bin/env python3
"""Sobe vídeos (e legendas) ao Drive na estrutura: <pasta mãe>/<Sistema>/<Tema>/arquivo.

Uso: entregar.py --sistema "Meu Sistema" --tema "01 Criar projeto" video.mp4 [video.srt ...] [--simular]
Configuração: GRAVAR_DRIVE_REMOTE (remote do rclone, ex.: "meu-drive:"; ou --remote) e GRAVAR_DRIVE_RAIZ (pasta mãe, padrão abaixo).
Regras: cria as pastas em sequência (uma chamada por vez, para o Drive não duplicar pasta);
reaproveita pasta que já existe; não cria link público (devolve só o link de visualização montado com o ID).
"""
import argparse, json, os, subprocess, sys
from pathlib import Path

REMOTE = os.environ.get("GRAVAR_DRIVE_REMOTE", "")
MAE = os.environ.get("GRAVAR_DRIVE_RAIZ", "Vídeos - Demos e Tutoriais")


def rclone(*args, check=True):
    p = subprocess.run(["rclone", *args], capture_output=True, text=True)
    if check and p.returncode != 0:
        sys.exit(f"rclone falhou ({' '.join(args[:2])}): {p.stderr.strip().splitlines()[-1] if p.stderr.strip() else p.returncode}")
    return p


def existe(caminho):
    pai, _, nome = caminho.rpartition("/")
    p = rclone("lsf", "--dirs-only", f"{REMOTE}{pai}", check=False)
    return p.returncode == 0 and f"{nome}/" in p.stdout.splitlines()


def limpo(s):
    s = s.strip().strip("/")
    if not s or ".." in s or "/" in s:
        sys.exit(f"nome de pasta inválido: {s!r} (sem barra nem '..')")
    return s


def main():
    global REMOTE
    ap = argparse.ArgumentParser()
    ap.add_argument("--sistema", required=True)
    ap.add_argument("--tema", required=True)
    ap.add_argument("--remote", default=REMOTE)
    ap.add_argument("--simular", action="store_true")
    ap.add_argument("arquivos", nargs="+")
    a = ap.parse_args()
    if not a.remote:
        sys.exit("defina o remote do rclone: GRAVAR_DRIVE_REMOTE=meu-drive: ou --remote meu-drive:  (veja `rclone listremotes`)")
    REMOTE = a.remote if a.remote.endswith(":") else a.remote + ":"

    for f in a.arquivos:
        if not Path(f).is_file():
            sys.exit(f"arquivo não encontrado: {f}")
    niveis = [MAE, limpo(a.sistema), limpo(a.tema)]
    destino = "/".join(niveis)
    print(f"conta: {REMOTE.rstrip(':')}\ndestino: {destino}/")

    caminho = ""
    for n in niveis:
        caminho = f"{caminho}/{n}" if caminho else n
        if existe(caminho):
            print(f"  pasta existe: {caminho}")
        elif a.simular:
            print(f"  [simular] criaria: {caminho}")
        else:
            rclone("mkdir", f"{REMOTE}{caminho}")
            print(f"  pasta criada: {caminho}")

    # uma chamada por arquivo, em sequência; copyto mantém o nome do arquivo
    for f in a.arquivos:
        nome = Path(f).name
        if a.simular:
            print(f"  [simular] subiria: {nome}")
            continue
        rclone("copyto", f, f"{REMOTE}{destino}/{nome}")
        info = json.loads(rclone("lsjson", "--files-only", "--include", nome, f"{REMOTE}{destino}").stdout or "[]")
        fid = info[0]["ID"] if info else None
        print(f"  enviado: {nome}" + (f"\n    https://drive.google.com/file/d/{fid}/view" if fid else ""))


if __name__ == "__main__":
    main()
