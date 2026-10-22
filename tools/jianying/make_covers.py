# -*- coding: utf-8 -*-
"""jianying 管线 · 封面生成（OpenAI 兼容文生图，纯标准库）

默认读项目根 `.env` 的 IMG_BASE_URL / IMG_MODEL / IMG_API_KEY，
调用 `<base>/images/generations`，把封面直接写进项目内
（默认约定：content/<slug>/covers/<slug>-4x3.jpg）。

用法：
  python tools/jianying/make_covers.py --prompt-file content/<slug>/封面提示词.txt \
    --size 2048x1536 --out content/<slug>/covers/<slug>-4x3.jpg
  python tools/jianying/make_covers.py --check

硬规则：输出必须位于项目根之内；标题仍按管线要求由模型直接画进画面，
出图后人工放大逐字核对（恰好 6 个汉字）。
"""
import argparse
import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_KEYS = ("IMG_BASE_URL", "IMG_MODEL", "IMG_API_KEY")
ALIASES = {
    "IMG_BASE_URL": ("OPENAI_BASE_URL", "OPENAI_API_BASE", "BASE_URL"),
    "IMG_MODEL": ("OPENAI_IMAGE_MODEL", "IMAGE_MODEL", "OPENAI_MODEL"),
    "IMG_API_KEY": ("OPENAI_API_KEY", "API_KEY"),
}


def fail(msg):
    print("错误：%s" % msg, file=sys.stderr)
    raise SystemExit(1)


def strip_value(value):
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def load_env(path):
    if path is None:
        return
    for line in Path(path).read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), strip_value(value))


def find_env(explicit):
    if explicit:
        return Path(explicit)
    candidate = ROOT / ".env"
    if candidate.is_file():
        return candidate
    for parent in Path.cwd().parents:
        candidate = parent / ".env"
        if candidate.is_file():
            return candidate
    return None


def resolve(name):
    for key in (name, *ALIASES.get(name, ())):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    return ""


def api_url(base, tail):
    return base.rstrip("/") + "/" + tail.lstrip("/")


def http_post(url, api_key, payload, timeout=240):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer %s" % api_key,
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:800]
        fail("接口返回 HTTP %s：%s" % (exc.code, detail))
    except urllib.error.URLError as exc:
        fail("连接失败：%s" % exc.reason)


def download(url, target):
    req = urllib.request.Request(url, headers={"User-Agent": "jianying-cover/1.0"})
    with urllib.request.urlopen(req, timeout=240) as resp:
        target.write_bytes(resp.read())


def save_result(result, out, fmt):
    data = result.get("data")
    if not isinstance(data, list) or not data:
        fail("接口返回没有 data 图片数组：%s" % json.dumps(result, ensure_ascii=False)[:300])
    item = data[0]
    out.parent.mkdir(parents=True, exist_ok=True)
    if item.get("b64_json"):
        out.write_bytes(base64.b64decode(item["b64_json"]))
        return out
    if item.get("url"):
        url = item["url"]
        suffix = Path(urllib.parse.urlsplit(url).path).suffix.lstrip(".").lower()
        if suffix in {"jpg", "jpeg", "png", "webp"} and suffix != fmt:
            out = out.with_suffix("." + suffix)
        download(url, out)
        return out
    fail("图片结果既没有 b64_json，也没有 url")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt")
    ap.add_argument("--prompt-file")
    ap.add_argument("--size", default="2048x1536")
    ap.add_argument("--out", required=False)
    ap.add_argument("--model")
    ap.add_argument("--env-file")
    ap.add_argument("--watermark", action="store_true", help="默认关闭水印")
    ap.add_argument("--allow-external", action="store_true",
                    help="允许写到项目根之外（默认禁止，保持素材在项目内）")
    ap.add_argument("--check", action="store_true", help="只检查配置，不发起请求")
    args = ap.parse_args()

    load_env(find_env(args.env_file))
    base = resolve("IMG_BASE_URL")
    model = args.model or resolve("IMG_MODEL")
    api_key = resolve("IMG_API_KEY")
    missing = [n for n, v in zip(ENV_KEYS, (base, model, api_key)) if not v]
    if args.check:
        print("env:", find_env(args.env_file))
        print("base_url:", base or "(未设置)")
        print("model:", model or "(未设置)")
        print("api_key:", "已设置" if api_key else "(未设置)")
        print("状态:", "OK" if not missing else "缺少 " + "、".join(missing))
        return 0 if not missing else 1
    if missing:
        fail("缺少配置：" + "、".join(missing) + "（检查项目根 .env）")
    if not args.out:
        fail("需要 --out")
    if not args.prompt_file and not args.prompt:
        fail("需要 --prompt 或 --prompt-file")

    prompt = Path(args.prompt_file).read_text(encoding="utf-8-sig").strip() \
        if args.prompt_file else args.prompt.strip()
    out = Path(args.out)
    if not out.is_absolute():
        out = (ROOT / out).resolve()
    if not args.allow_external:
        try:
            out.resolve().relative_to(ROOT.resolve())
        except ValueError:
            fail("输出必须位于项目内：%s；确需外写请加 --allow-external" % out)

    fmt = out.suffix.lstrip(".").lower() or "jpg"
    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": args.size,
        "watermark": bool(args.watermark),
    }
    endpoint = api_url(base, "images/generations")
    print("提交 %s（%s，模型 %s）..." % (endpoint, args.size, model), file=sys.stderr)
    result = http_post(endpoint, api_key, payload)
    saved = save_result(result, out, fmt)
    print("已保存：%s（%d B）" % (saved, saved.stat().st_size))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
