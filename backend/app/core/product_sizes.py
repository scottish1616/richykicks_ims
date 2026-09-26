"""
Static per-category standard size options for the receiving item-entry
checkbox grid. This is a fixed reference table, not a database table -
the 8 categories themselves are fixed (see category.py's
SEED_CATEGORY_NAMES), so there's nothing here that needs to be
editable through the UI.

This does NOT create ProductVariant rows - it only drives which sizes
the receiving-entry form offers as checkboxes. Variants still only
ever come into existence through the receiving-approval workflow
(see ProductVariant's docstring), whatever size was actually entered.
"""

STANDARD_SHOE_SIZES = [str(n) for n in range(36, 47)]  # "36".."46"

# A category with no sizes listed here falls back to a single
# free-text colour/size pair in the receiving-entry form (PRD section
# 11: non-variant products, e.g. a plain ball or a pack of socks).
CATEGORY_SIZE_OPTIONS: dict[str, list[str]] = {
    "Sneakers": STANDARD_SHOE_SIZES,
    "Slides": STANDARD_SHOE_SIZES,
    "Ladies' Shoes": STANDARD_SHOE_SIZES,
    "Crocs": STANDARD_SHOE_SIZES,
    "Football Boots": STANDARD_SHOE_SIZES,
    "High Heels": STANDARD_SHOE_SIZES,
    "Mikasa Balls": [],
    "Socks": [],
}


def sizes_for_category(category_name: str) -> list[str]:
    return CATEGORY_SIZE_OPTIONS.get(category_name, [])
