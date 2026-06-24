export class Cart {
    constructor(lines = []) {
        this.lines = new Map();
        lines.forEach(line => {
            const key = `${Number(line.menu_item_id)}-${Number(line.price)}`;
            const current = this.lines.get(key);
            const quantity = Number(line.quantity);
            const note = line.note || '';
            if (current) {
                current.quantity = Math.min(99, current.quantity + quantity);
                if (note && current.note !== note) {
                    current.note = current.note
                        ? [...new Set(`${current.note}, ${note}`.split(',').map(part => part.trim()).filter(Boolean))].join(', ')
                        : note;
                }
                return;
            }
            this.lines.set(key, { ...line, quantity, note });
        });
    }
    add(item, customPrice = null) {
        const price = customPrice !== null ? Number(customPrice) : Number(item.price);
        const key = `${item.id}-${price}`;
        const current = this.lines.get(key);
        this.lines.set(key, {
            menu_item_id: Number(item.id),
            name: item.name,
            price: price,
            quantity: Math.min(99, (current?.quantity || 0) + 1),
            note: current?.note || ''
        });
        return this;
    }
    set(item, quantity, customPrice = null) {
        quantity = Number(quantity);
        const price = customPrice !== null ? Number(customPrice) : Number(item.price);
        const key = `${item.id}-${price}`;
        if (quantity <= 0) {
            this.lines.delete(key);
        } else {
            const current = this.lines.get(key);
            this.lines.set(key, {
                menu_item_id: Number(item.id),
                name: item.name,
                price: price,
                quantity: Math.min(99, quantity),
                note: current?.note || ''
            });
        }
        return this;
    }
    updatePrice(id, oldPrice, newPrice) {
        id = Number(id);
        oldPrice = Number(oldPrice);
        newPrice = Math.max(0, Number(newPrice) || 0);

        const oldKey = `${id}-${oldPrice}`;
        const current = this.lines.get(oldKey);
        if (!current) return this;

        if (oldPrice === newPrice) {
            current.price = newPrice;
            return this;
        }

        this.lines.delete(oldKey);
        const newKey = `${id}-${newPrice}`;
        const existing = this.lines.get(newKey);
        if (existing) {
            existing.quantity = Math.min(99, existing.quantity + current.quantity);
            if (!existing.note && current.note) existing.note = current.note;
        } else {
            this.lines.set(newKey, { ...current, price: newPrice });
        }
        return this;
    }
    setNote(id, note, price = null) {
        let key = `${id}-${price}`;
        if (price === null) {
            const foundKey = [...this.lines.keys()].find(k => k.startsWith(`${id}-`));
            if (foundKey) key = foundKey;
        }
        const current = this.lines.get(key);
        if (current) current.note = note;
        return this;
    }
    quantity(id, price = null) {
        if (price !== null) {
            return this.lines.get(`${id}-${price}`)?.quantity || 0;
        }
        return [...this.lines.values()]
            .filter(line => line.menu_item_id === Number(id))
            .reduce((sum, line) => sum + line.quantity, 0);
    }
    total() {
        return [...this.lines.values()].reduce((sum, line) => sum + line.price * line.quantity, 0);
    }
    payload() {
        return [...this.lines.values()].map(({ menu_item_id, quantity, price, note }) => ({
            menu_item_id,
            quantity,
            unit_price: price,
            note: note || ''
        }));
    }
    values() {
        return [...this.lines.values()];
    }
}
