"""Offline regression tests for the storefront price import and write guard."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('scrape', Path(__file__).resolve().parents[1] / 'scraper/scrape.py')
scrape = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scrape)


def product(price, unit='', weight='', slug='test'):
    return f'''<section itemtype="https://schema.org/Product" itemid="/store/product/{slug}">
      <span itemprop="name">Test product</span>{price}
      <span class="productListing__price_unit">{unit}</span>
      <span class="productListing__averageWeight">{weight}</span></section>'''


class PriceImportTests(unittest.TestCase):
    def test_meta_price_and_separate_pound_unit(self):
        p = scrape.parse_products(product('<meta itemprop="price" content="7.50">', '/lb.', 'Avg. 4 lb.'), 'chicken')[0]
        self.assertEqual((p['price'], p['price_unit'], p['avg_weight_lb']), (7.5, 'lb', 4))

    def test_meta_each_and_ounces(self):
        p = scrape.parse_products(product('<meta itemprop="price" content="8.00">', '', 'Avg. 11.2 oz.'), 'eggs')[0]
        self.assertEqual((p['price'], p['price_unit'], p['avg_weight_lb']), (8, 'each', .7))

    def test_legacy_inline_price(self):
        html = product('<span itemprop="price">$12.50/lb</span>')
        p = scrape.parse_products(html, 'pork')[0]
        self.assertEqual((p['price'], p['price_unit']), (12.5, 'lb'))

    def test_invalid_prices_remain_unavailable(self):
        for raw in ('', 'unavailable', 'NaN', '-5', '0', '12x'):
            with self.subTest(raw=raw):
                p = scrape.parse_products(product(f'<meta itemprop="price" content="{raw}">'), 'pork')[0]
                self.assertIsNone(p['price'])

    def test_failed_scrape_preserves_last_file(self):
        for price, unit, weight in [('', '', ''), ('7.50', '/lb.', ''), ('0', '', '')]:
            html = ''.join(product(f'<meta itemprop="price" content="{price}">', unit, weight, str(i)) for i in range(10))
            with tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp) / 'inventory.json'
                out.write_text('last good snapshot')
                with patch.object(scrape, 'OUT_PATH', out), patch.object(scrape, 'discover_categories', return_value=['chicken']), patch.object(scrape, 'fetch', return_value=html), patch.object(scrape.time, 'sleep'):
                    self.assertEqual(scrape.main(), 1)
                self.assertEqual(out.read_text(), 'last good snapshot')

    def test_valid_scrape_is_written(self):
        html = ''.join(product('<meta itemprop="price" content="7.50">', '/lb.', 'Avg. 4 lb.', str(i)) for i in range(10))
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'inventory.json'
            with patch.object(scrape, 'OUT_PATH', out), patch.object(scrape, 'discover_categories', return_value=['chicken']), patch.object(scrape, 'fetch', return_value=html), patch.object(scrape.time, 'sleep'):
                self.assertEqual(scrape.main(), 0)
            self.assertEqual(len(scrape.json.loads(out.read_text())['products']), 10)


if __name__ == '__main__':
    unittest.main()
