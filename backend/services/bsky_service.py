import random
from typing import Any
import httpx


class BskyService:
    BASE_URL = "https://api.bsky.app"

    THEME_MAP: dict[str, str] = {
        "movies": "(#filmsky OR #movies OR #cinema OR #film)",
        "anime": "(#anime OR #アニメ OR #manga)",
        "gaming": "(#gaming OR #games OR #gamedev)",
        "books": "(#booksky OR #books OR #reading)",
        "tech": "(#tech OR #programming OR #coding OR #dev)",
    }

    async def _get_follows(
        self,
        client: httpx.AsyncClient,
        handle: str,
        limit: int = 100,
    ) -> set[str]:
        """Fetch the DIDs and handles of accounts followed by `handle`."""
        try:
            response = await client.get(
                f"{self.BASE_URL}/xrpc/app.bsky.graph.getFollows",
                params={"actor": handle, "limit": limit},
            )
            response.raise_for_status()
            data = response.json()

            follows_set = set()
            for item in data.get("follows", []):
                if "handle" in item:
                    follows_set.add(item["handle"].lower())
                if "did" in item:
                    follows_set.add(item["did"])
            return follows_set
        except httpx.HTTPError:
            return set()

    async def search_posts(
        self,
        word: str,
        lang: str | None = "ja",
        theme: str | None = None,
        user_handle: str | None = None,
        limit: int = 100,
    ) -> dict[str, Any] | None:

        query = f'"{word}"'

        if theme and theme.lower() in self.THEME_MAP:
            query += f" {self.THEME_MAP[theme.lower()]}"

        params: dict[str, Any] = {
            "q": query,
            "limit": limit,
        }

        if lang:
            params["lang"] = lang

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(10.0),
                headers=headers,
            ) as client:
                
                # If user_handle is provided, fetch who they follow concurrently
                follows_set: set[str] = set()
                if user_handle:
                    follows_set = await self._get_follows(client, user_handle)

                response = await client.get(
                    f"{self.BASE_URL}/xrpc/app.bsky.feed.searchPosts",
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

        except httpx.HTTPStatusError as error:
            raise RuntimeError(
                f"Bluesky API error HTTP {error.response.status_code}: {error.response.text}"
            )
        except (httpx.ConnectTimeout, httpx.ConnectError):
            raise RuntimeError("Could not connect to Bluesky servers.")

        raw_posts = data.get("posts", [])
        if not raw_posts:
            return None

        # Filter posts where target word is present AND author is in followed accounts list
        valid_posts = []
        for p in raw_posts:
            if not (p.get("record") and isinstance(p["record"].get("text"), str)):
                continue

            text = p["record"]["text"]
            if word.lower() not in text.lower():
                continue

            if follows_set:
                author_handle = p["author"]["handle"].lower()
                author_did = p["author"]["did"]
                if author_handle not in follows_set and author_did not in follows_set:
                    continue

            valid_posts.append(p)

        if not valid_posts:
            return None

        post = random.choice(valid_posts)
        record = post["record"]
        author = post["author"]
        rkey = post["uri"].split("/")[-1]

        return {
            "uri": post["uri"],
            "cid": post["cid"],
            "text": record["text"].strip(),
            "author_handle": author["handle"],
            "author_display_name": author.get("displayName"),
            "created_at": record.get("createdAt"),
            "url": f"https://bsky.app/profile/{author['handle']}/post/{rkey}",
        }

    async def get_random_post_from_follows(
        self,
        user_handle: str,
        lang: str | None = None,
    ) -> dict[str, Any] | None:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0),
            headers=headers,
        ) as client:
            # 1. Fetch followed accounts
            follows = list(await self._get_follows(client, user_handle, limit=100))
            if not follows:
                return None

            # Shuffle followed users to pick randomly
            random.shuffle(follows)

            # 2. Check accounts until valid posts are found
            for target_handle in follows[:10]:
                try:
                    response = await client.get(
                        f"{self.BASE_URL}/xrpc/app.bsky.feed.getAuthorFeed",
                        params={
                            "actor": target_handle,
                            "filter": "posts_no_replies",
                            "limit": 30,
                        },
                    )
                    if response.status_code != 200:
                        continue

                    feed_items = response.json().get("feed", [])
                    valid_posts = []

                    for item in feed_items:
                        post = item.get("post", {})
                        record = post.get("record", {})
                        text = record.get("text", "")

                        if not text or not isinstance(text, str):
                            continue

                        # Optional language filter check
                        if lang:
                            record_langs = record.get("langs", [])
                            if record_langs and lang.lower() not in [
                                l.lower() for l in record_langs
                            ]:
                                continue

                        valid_posts.append(post)

                    if valid_posts:
                        chosen_post = random.choice(valid_posts)
                        record = chosen_post["record"]
                        author = chosen_post["author"]
                        rkey = chosen_post["uri"].split("/")[-1]

                        return {
                            "uri": chosen_post["uri"],
                            "cid": chosen_post["cid"],
                            "text": record["text"].strip(),
                            "author_handle": author["handle"],
                            "author_display_name": author.get("displayName"),
                            "created_at": record.get("createdAt"),
                            "url": f"https://bsky.app/profile/{author['handle']}/post/{rkey}",
                        }

                except httpx.HTTPError:
                    continue

            return None