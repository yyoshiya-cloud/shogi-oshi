# -*- coding: utf-8 -*-

import csv
import logging
import re
import sys
import time
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ==========================================
# 基本設定
# ==========================================

BASE_URL = "https://www.shogi.or.jp"
INDEX_URL = BASE_URL + "/player/"

AS_OF = date(2026, 11, 1)

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

CSV_FILE = OUTPUT_DIR / "shogi_players_20261101.csv"
ERROR_FILE = OUTPUT_DIR / "failed_players.csv"
LOG_FILE = OUTPUT_DIR / "collector.log"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/130 Safari/537.36"
    )
}

COLUMNS = [
    "氏名",
    "ローマ字表記の氏名",
    "棋士番号",
    "段位",
    "生年月日",
    "年齢",
    "師匠",
    "竜王戦クラス",
    "順位戦クラス"
]


# ==========================================
# ログ設定
# ==========================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(
            LOG_FILE, encoding="utf-8"
        ),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


# ==========================================
# HTTPセッション
# ==========================================

session = requests.Session()
session.headers.update(HEADERS)

retry = Retry(
    total=5,
    connect=5,
    read=3,
    backoff_factor=2,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
    respect_retry_after_header=True
)

adapter = HTTPAdapter(max_retries=retry)

session.mount("https://", adapter)


def get_soup(url):

    response = session.get(
        url,
        timeout=(15, 45)
    )

    response.raise_for_status()

    response.encoding = response.apparent_encoding

    return BeautifulSoup(
        response.text,
        "html.parser"
    )


# ==========================================
# 文字列処理
# ==========================================

def clean_text(value):

    if not value:
        return ""

    return re.sub(
        r"\s+",
        " ",
        value.replace("\u3000", " ")
    ).strip()


# ==========================================
# 現役棋士URL取得
# ==========================================

def get_profile_urls():

    logger.info("棋士一覧を取得します")

    soup = get_soup(INDEX_URL)

    urls = set()

    for a in soup.select("a[href]"):

        href = a.get("href", "").strip()

        if not href:
            continue

        url = urljoin(INDEX_URL, href)

        parsed = urlparse(url)

        if parsed.scheme != "https":
            continue

        if parsed.netloc.lower() not in (
            "www.shogi.or.jp",
            "shogi.or.jp"
        ):
            continue

        path = parsed.path.rstrip("/")

        # 個別プロフィールページのみ
        if not re.fullmatch(
            r"/player/[a-zA-Z0-9_-]+",
            path
        ):
            continue

        urls.add(
            BASE_URL + path
        )

    result = sorted(urls)

    if not result:
        raise RuntimeError(
            "プロフィールURLを取得できませんでした。"
            "公式サイトのHTML構造を確認してください。"
        )

    logger.info(
        "プロフィールURL取得数: %d",
        len(result)
    )

    return result


# ==========================================
# プロフィール項目の抽出
# ==========================================

def get_profile_fields(soup):

    fields = {}

    # table形式
    for tr in soup.select("tr"):

        cells = tr.find_all(
            ["th", "td"],
            recursive=False
        )

        if len(cells) < 2:
            continue

        key = clean_text(
            cells[0].get_text(" ", strip=True)
        )

        value = clean_text(
            " ".join(
                cell.get_text(" ", strip=True)
                for cell in cells[1:]
            )
        )

        if key and value:
            fields[key] = value

    # dl / dt / dd形式
    for dl in soup.select("dl"):

        for dt in dl.find_all("dt"):

            dd = dt.find_next_sibling("dd")

            if dd is None:
                continue

            key = clean_text(
                dt.get_text(" ", strip=True)
            )

            value = clean_text(
                dd.get_text(" ", strip=True)
            )

            if key and value:
                fields[key] = value

    return fields


def find_field(fields, label):

    for key, value in fields.items():

        if label in key:
            return value

    return ""


# ==========================================
# 氏名・ローマ字
# ==========================================

def extract_name(soup):

    h1 = soup.find("h1")

    if h1:
        return clean_text(
            h1.get_text(" ", strip=True)
        )

    return ""


def extract_roman_name(soup):

    pattern = re.compile(
        r"^[A-Za-z]+(?:[\s\u3000-]+[A-Za-z]+)+$"
    )

    candidates = []

    # HTML内の英字テキストを検索
    for node in soup.find_all(string=True):

        value = clean_text(str(node))

        if pattern.fullmatch(value):

            if len(value) < 80:
                candidates.append(value)

    # 重複を除去
    candidates = list(dict.fromkeys(candidates))

    return candidates[0] if candidates else ""


# ==========================================
# 生年月日・年齢
# ==========================================

def extract_birthdate(value):

    match = re.search(
        r"(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日",
        value
    )

    if not match:
        return ""

    year, month, day = map(
        int,
        match.groups()
    )

    return f"{year}年{month}月{day}日"


def calculate_age(birth):

    match = re.fullmatch(
        r"(\d{4})年(\d{1,2})月(\d{1,2})日",
        birth
    )

    if not match:
        return ""

    year, month, day = map(
        int,
        match.groups()
    )

    try:
        birthday = date(year, month, day)
    except ValueError:
        return ""

    age = AS_OF.year - birthday.year

    if (AS_OF.month, AS_OF.day) < (
        birthday.month,
        birthday.day
    ):
        age -= 1

    return age


# ==========================================
# クラス抽出
# ==========================================

def extract_class(value):

    if not value:
        return ""

    # 括弧内の過去実績を除去
    value = re.split(
        r"[（(]",
        clean_text(value)
    )[0].strip()

    return value


# ==========================================
# 個別プロフィール取得
# ==========================================

def extract_profile(url):

    soup = get_soup(url)

    fields = get_profile_fields(soup)

    name = extract_name(soup)

    if not name:
        raise ValueError("氏名が取得できません")

    number = find_field(fields, "棋士番号")

    if not number:
        raise ValueError("棋士番号が取得できません")

    birth_raw = find_field(
        fields,
        "生年月日"
    )

    birth = extract_birthdate(birth_raw)

    if not birth:
        logger.warning(
            "%s: 生年月日が取得できません",
            name
        )

    data = {
        "氏名": name,

        "ローマ字表記の氏名":
            extract_roman_name(soup),

        "棋士番号": number,

        "段位": find_field(
            fields,
            "段位"
        ),

        "生年月日": birth,

        "年齢": calculate_age(birth),

        "師匠": find_field(
            fields,
            "師匠"
        ),

        "竜王戦クラス": extract_class(
            find_field(fields, "竜王戦")
        ),

        "順位戦クラス": extract_class(
            find_field(fields, "順位戦")
        )
    }

    return data


# ==========================================
# CSV出力
# ==========================================

def save_csv(rows):

    with open(
        CSV_FILE,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as f:

        writer = csv.DictWriter(
            f,
            fieldnames=COLUMNS,
            extrasaction="ignore"
        )

        writer.writeheader()

        writer.writerows(rows)

    logger.info(
        "CSV出力完了: %s",
        CSV_FILE
    )


def save_errors(errors):

    with open(
        ERROR_FILE,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as f:

        writer = csv.writer(f)

        writer.writerow([
            "プロフィールURL",
            "エラー内容"
        ])

        writer.writerows(errors)


# ==========================================
# 欠損データ確認
# ==========================================

def check_missing(rows):

    logger.info("欠損項目チェック")

    for column in COLUMNS:

        missing = sum(
            1 for row in rows
            if not str(
                row.get(column, "")
            ).strip()
        )

        logger.info(
            "%s : 欠損 %d件",
            column,
            missing
        )


# ==========================================
# メイン処理
# ==========================================

def main():

    logger.info("=" * 50)
    logger.info("将棋棋士プロフィール取得開始")
    logger.info("年齢基準日: %s", AS_OF)
    logger.info("=" * 50)

    urls = get_profile_urls()

    results = []
    errors = []

    total = len(urls)

    for index, url in enumerate(urls, 1):

        try:

            data = extract_profile(url)

            results.append(data)

            logger.info(
                "[成功] %d/%d %s (%s)",
                index,
                total,
                data["氏名"],
                data["段位"]
            )

        except Exception as e:

            errors.append([
                url,
                str(e)
            ])

            logger.exception(
                "[失敗] %d/%d %s",
                index,
                total,
                url
            )

        # サーバーへの負荷軽減
        time.sleep(1.0)

        # 途中経過も保存
        if index % 20 == 0:
            save_csv(results)
            save_errors(errors)

    # 最終保存
    save_csv(results)
    save_errors(errors)

    # 欠損確認
    check_missing(results)

    logger.info("=" * 50)
    logger.info("取得処理終了")
    logger.info("対象URL数: %d", total)
    logger.info("成功件数: %d", len(results))
    logger.info("失敗件数: %d", len(errors))
    logger.info("CSV: %s", CSV_FILE)
    logger.info("エラー: %s", ERROR_FILE)
    logger.info("=" * 50)


if __name__ == "__main__":

    try:
        main()

    except KeyboardInterrupt:
        logger.warning("ユーザーによって中断されました")

    except Exception:
        logger.exception("プログラム全体でエラーが発生しました")
        sys.exit(1)
