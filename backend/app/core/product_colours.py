"""Supported colour selectors for inventory variants."""

PRODUCT_COLOURS = ("Black", "White", "Pink", "Brown", "Blue")
_COLOUR_BY_CASEFOLD = {colour.casefold(): colour for colour in PRODUCT_COLOURS}


def normalize_product_colour(value: str | None) -> str | None:
	if value is None or not value.strip():
		return None
	colour = _COLOUR_BY_CASEFOLD.get(value.strip().casefold())
	if colour is None:
		raise ValueError(f"Colour must be one of: {', '.join(PRODUCT_COLOURS)}")
	return colour