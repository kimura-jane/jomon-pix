#!/usr/bin/env python3
"""Verify that user-requested emoji stickers are all present exactly once.

The existing emoji library and older emoji choices must remain intact in the grouped picker.
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
        match = re.search(r"const EMOJI_GROUPS = \[([\s\S]*?)\];", panel)
        self.assertIsNotNone(match, "Grouped emoji list is missing")
        groups = re.findall(r"\{\s*label: '([^']+)',\s*items: \[([^\]]+)\]\s*\}", match.group(1))
        self.assertEqual(len(groups), 7, "Expected seven emoji groups")
        self.assertEqual(len(set(label for label, _ in groups)), len(groups))
        combined = [emoji for _, items in groups for emoji in re.findall(r"'([^']+)'", items)]
        built_in = re.findall(r"kind: 'emoji', emoji: '([^']+)'", source)
        older_extras = ("🐰", "🫶", "🥳", "😂", "😍", "🙈")
        expected = set((*built_in, *older_extras, *REQUESTED_NEW, *ALREADY_PRESENT))
        self.assertEqual(len(expected), 53)
        self.assertEqual(len(combined), len(set(combined)), "Duplicate emoji")
        self.assertEqual(set(combined), expected, "Emoji missing or unexpected")
        self.assertNotIn("\ufffc", combined, "Object replacement is not an emoji")
        self.assertIn("EMOJI_GROUPS.map(", panel, "Picker must render the grouped emoji")
        self.assertIn("items.map((emoji)", panel, "Picker must render each emoji")
        self.assertIn("addSticker(emoji)", panel, "Emoji must remain insertable")
        self.assertNotIn("extraEmoji", panel, "Legacy extra section must not return")
        self.assertNotIn("その他", panel, "Other heading must not return")


if __name__ == "__main__":
    unittest.main(verbosity=2)
