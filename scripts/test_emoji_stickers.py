#!/usr/bin/env python3
"""Verify that user-requested emoji stickers are all present exactly once.

The existing emoji library and older "other" emoji choices must remain intact.
The unrenderable object-replacement characters from pasted text are excluded.
"""
from __future__ import annotations

import re
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent.parent
REQUESTED_NEW = (
    "❤️", "🩷", "🍙", "💢", "🎁", "🎊", "🍻", "👏", "🙌", "㊗️",
    "👼", "💩", "🫨", "🤩", "😛", "🥶", "🤬", "🤭", "🤝", "👀",
    "🎅🏻", "🙇‍♀️", "🤦‍♂️", "🤷🏿", "🍖", "🎂", "🍰", "🥂", "💰",
    "💔", "💕", "㊙️", "🈲",
)
ALREADY_PRESENT = ("🎉", "✨", "🌈", "💯")


class EmojiStickerTests(unittest.TestCase):
    def test_requested_emojis_are_available_without_duplicates(self):
        panel = (ROOT / "src/components/Panel.tsx").read_text(encoding="utf-8")
        source = (ROOT / "src/lib/stickers.ts").read_text(encoding="utf-8")
        match = re.search(r"const EXTRA_EMOJI = \[([\s\S]*?)\];", panel)
        self.assertIsNotNone(match, "Extra emoji list is missing")
        extra = re.findall(r"'([^']+)'", match.group(1))
        built_in = re.findall(r"kind: 'emoji', emoji: '([^']+)'", source)
        self.assertEqual(len(REQUESTED_NEW), 33)
        self.assertEqual(len(set(REQUESTED_NEW)), len(REQUESTED_NEW))
        self.assertEqual(len(extra), len(set(extra)), "Duplicate extra emoji")
        self.assertFalse(set(extra) & set(built_in), "Extra emoji repeats an existing sticker")
        combined = built_in + extra
        for emoji in (*REQUESTED_NEW, *ALREADY_PRESENT):
            self.assertEqual(combined.count(emoji), 1, f"Missing or duplicate: {emoji}")
        self.assertNotIn("\ufffc", combined, "Object replacement is not an emoji")
        self.assertIn("addSticker(emoji)", panel, "Emoji must remain insertable")
        self.assertIn("extraEmoji.map(", panel, "Emoji picker must render the extras")


if __name__ == "__main__":
    unittest.main(verbosity=2)
