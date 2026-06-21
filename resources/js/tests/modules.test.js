import test from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../modules/cart.js';
import { formatMoneyInput, number, parseMoneyInput } from '../modules/format.js';
import { duration, remaining } from '../modules/timers.js';

test('cart tracks quantities and totals independently of the UI', () => {
    const cart = new Cart(); cart.add({ id:1, name:'Cà phê', price:30000 }).add({ id:1, name:'Cà phê', price:30000 });
    assert.equal(cart.quantity(1), 2); assert.equal(cart.total(), 60000); assert.deepEqual(cart.payload(), [{ menu_item_id:1, quantity:2, unit_price: 30000, note: '' }]);
});

test('metrics render without decimal places', () => {
    assert.equal(number(12), '12'); assert.equal(number(12.6), '13');
});

test('cash input formats Vietnamese thousands while preserving numeric value', () => {
    assert.equal(formatMoneyInput('1'), '1');
    assert.equal(formatMoneyInput('1000'), '1.000');
    assert.equal(formatMoneyInput('1.000.000'), '1.000.000');
    assert.equal(formatMoneyInput('1a00 000đ'), '100.000');
    assert.equal(parseMoneyInput('1.000.000'), 1000000);
    assert.equal(parseMoneyInput(''), 0);
});

test('countdown never becomes negative', () => {
    assert.equal(duration(3661000), '01:01:01'); assert.equal(remaining('2020-01-01T00:00:00Z', Date.now()), 0);
});
